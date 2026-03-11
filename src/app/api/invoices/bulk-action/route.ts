import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findOrCreateContact, postBillToXero } from '@/lib/xero'
import { INVOICE_STATUS, EXCEPTION_ACTION, AUDIT_ACTION } from '@/lib/constants'

/**
 * POST /api/invoices/bulk-action
 * Bulk approve or reject multiple invoices at once.
 *
 * Body: {
 *   invoiceIds: string[]
 *   action: 'approve' | 'reject'
 *   notes?: string
 * }
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { invoiceIds, action, notes } = body as {
    invoiceIds: string[]
    action: 'approve' | 'reject'
    notes?: string
  }

  if (!invoiceIds || invoiceIds.length === 0) {
    return NextResponse.json({ error: 'No invoices selected' }, { status: 400 })
  }

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const results: Array<{ invoiceId: string; success: boolean; error?: string; xeroInvoiceId?: string }> = []

  for (const invoiceId of invoiceIds) {
    try {
      if (action === 'reject') {
        await rejectInvoice(invoiceId, notes)
        results.push({ invoiceId, success: true })
      } else {
        const xeroId = await approveInvoice(invoiceId, notes)
        results.push({ invoiceId, success: true, xeroInvoiceId: xeroId ?? undefined })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.push({ invoiceId, success: false, error: message })
    }
  }

  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  return NextResponse.json({
    total: invoiceIds.length,
    succeeded,
    failed,
    results,
  })
}

async function approveInvoice(invoiceId: string, notes?: string): Promise<string | null> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      supplier: true,
      lineItems: true,
      exception: true,
    },
  })

  if (!invoice) throw new Error('Invoice not found')
  if (invoice.status !== INVOICE_STATUS.EXCEPTION) throw new Error('Not in exception queue')

  // Check all line items have account codes
  const missingCodes = invoice.lineItems.filter((item) => !item.accountCode)
  if (missingCodes.length > 0) {
    throw new Error(`${missingCodes.length} line item(s) missing account codes`)
  }

  // Post to Xero
  const xeroContact = await findOrCreateContact(invoice.clientId, {
    name: invoice.supplier?.name ?? 'Unknown Supplier',
    vatNumber: invoice.supplier?.vatNumber ?? null,
  })

  if (!xeroContact?.contactID) {
    throw new Error('Could not find or create Xero contact')
  }

  const xeroBill = await postBillToXero(invoice.clientId, xeroContact.contactID, {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    lineItems: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unitPrice,
      accountCode: item.accountCode!,
    })),
  })

  if (!xeroBill?.invoiceID) {
    throw new Error('Xero bill creation failed')
  }

  await db.$transaction([
    db.invoice.update({
      where: { id: invoiceId },
      data: { status: INVOICE_STATUS.APPROVED, xeroInvoiceId: xeroBill.invoiceID, postedAt: new Date() },
    }),
    db.exception.update({
      where: { invoiceId },
      data: { resolvedAt: new Date(), resolution: EXCEPTION_ACTION.APPROVED },
    }),
    db.auditLog.create({
      data: {
        invoiceId,
        action: AUDIT_ACTION.EXCEPTION_APPROVED,
        detail: JSON.stringify({ bulk: true, xeroInvoiceId: xeroBill.invoiceID, notes }),
      },
    }),
  ])

  return xeroBill.invoiceID
}

async function rejectInvoice(invoiceId: string, notes?: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { exception: true },
  })

  if (!invoice) throw new Error('Invoice not found')
  if (invoice.status !== INVOICE_STATUS.EXCEPTION) throw new Error('Not in exception queue')

  await db.$transaction([
    db.invoice.update({
      where: { id: invoiceId },
      data: { status: INVOICE_STATUS.REJECTED },
    }),
    db.exception.update({
      where: { invoiceId },
      data: { resolvedAt: new Date(), resolution: EXCEPTION_ACTION.REJECTED },
    }),
    db.auditLog.create({
      data: {
        invoiceId,
        action: AUDIT_ACTION.EXCEPTION_REJECTED,
        detail: JSON.stringify({ bulk: true, notes }),
      },
    }),
  ])
}
