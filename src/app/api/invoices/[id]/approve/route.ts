import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findOrCreateContact, postBillToXero } from '@/lib/xero'
import { INVOICE_STATUS, EXCEPTION_ACTION, AUDIT_ACTION } from '@/lib/constants'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params
  const body = await req.json()
  const { userId, accountCodeOverrides, notes } = body as {
    userId: string
    accountCodeOverrides?: Record<string, string>
    notes?: string
  }

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      supplier: true,
      lineItems: true,
      exception: true,
    },
  })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (invoice.status !== INVOICE_STATUS.EXCEPTION) {
    return NextResponse.json({ error: 'Invoice is not in exception queue' }, { status: 422 })
  }

  if (accountCodeOverrides && Object.keys(accountCodeOverrides).length > 0) {
    for (const [lineItemId, accountCode] of Object.entries(accountCodeOverrides)) {
      await db.lineItem.update({ where: { id: lineItemId }, data: { accountCode } })
    }
  }

  const lineItems = await db.lineItem.findMany({ where: { invoiceId } })
  const missingCodes = lineItems.filter((item) => !item.accountCode)

  if (missingCodes.length > 0) {
    return NextResponse.json(
      { error: `${missingCodes.length} line item(s) still missing account codes` },
      { status: 422 }
    )
  }

  const xeroContact = await findOrCreateContact(invoice.clientId, {
    name: invoice.supplier?.name ?? 'Unknown Supplier',
    vatNumber: invoice.supplier?.vatNumber ?? null,
  })

  if (!xeroContact?.contactID) {
    return NextResponse.json({ error: 'Could not find or create Xero contact' }, { status: 500 })
  }

  const xeroBill = await postBillToXero(invoice.clientId, xeroContact.contactID, {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    lineItems: lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unitPrice,
      accountCode: item.accountCode!,
    })),
  })

  if (!xeroBill?.invoiceID) {
    return NextResponse.json({ error: 'Xero bill creation failed' }, { status: 500 })
  }

  const hasOverrides = accountCodeOverrides && Object.keys(accountCodeOverrides).length > 0
  const action = hasOverrides ? EXCEPTION_ACTION.EDITED_AND_APPROVED : EXCEPTION_ACTION.APPROVED

  await db.$transaction([
    db.invoice.update({
      where: { id: invoiceId },
      data: { status: INVOICE_STATUS.APPROVED, xeroInvoiceId: xeroBill.invoiceID, postedAt: new Date() },
    }),
    db.exception.update({
      where: { invoiceId },
      data: { resolvedAt: new Date(), resolution: action },
    }),
    db.exceptionReview.create({
      data: { exceptionId: invoice.exception!.id, userId, action, notes },
    }),
    db.auditLog.create({
      data: {
        invoiceId,
        action: AUDIT_ACTION.EXCEPTION_APPROVED,
        detail: JSON.stringify({ userId, action, xeroInvoiceId: xeroBill.invoiceID, overrides: accountCodeOverrides }),
      },
    }),
  ])

  return NextResponse.json({ success: true, xeroInvoiceId: xeroBill.invoiceID })
}
