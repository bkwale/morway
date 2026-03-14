import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdapter } from '@/lib/accounting'
import { getSessionOrNull } from '@/lib/get-session'
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
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const firmId = session.user.firmId
  const userId = session.user.id
  const results: Array<{ invoiceId: string; success: boolean; error?: string; externalId?: string }> = []

  for (const invoiceId of invoiceIds) {
    try {
      if (action === 'reject') {
        await rejectInvoice(invoiceId, firmId, userId, notes)
        results.push({ invoiceId, success: true })
      } else {
        const extId = await approveInvoice(invoiceId, firmId, userId, notes)
        results.push({ invoiceId, success: true, externalId: extId ?? undefined })
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

async function approveInvoice(invoiceId: string, firmId: string, userId: string, notes?: string): Promise<string | null> {
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
  if (invoice.client.firmId !== firmId) throw new Error('Forbidden')
  if (invoice.status !== INVOICE_STATUS.EXCEPTION) throw new Error('Not in exception queue')

  // Check all line items have account codes
  const missingCodes = invoice.lineItems.filter((item) => !item.accountCode)
  if (missingCodes.length > 0) {
    throw new Error(`${missingCodes.length} line item(s) missing account codes`)
  }

  // Try to post to connected accounting system (if any)
  let externalId: string | null = null
  let externalRef: string | null = null

  try {
    const adapter = await getAdapter(invoice.client.accountingSystem)

    if (adapter && adapter.isRealTime) {
      const connected = await adapter.isConnected(invoice.clientId)

      if (connected) {
        const contact = await adapter.findOrCreateContact(invoice.clientId, {
          name: invoice.supplier?.name ?? 'Unknown Supplier',
          vatNumber: invoice.supplier?.vatNumber ?? null,
        })

        if (contact?.contactId) {
          const result = await adapter.postBill(invoice.clientId, contact.contactId, {
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            currency: invoice.currency,
            supplierName: invoice.supplier?.name ?? 'Unknown Supplier',
            supplierVatNumber: invoice.supplier?.vatNumber ?? null,
            lineItems: invoice.lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitAmount: item.unitPrice,
              accountCode: item.accountCode ?? '',
            })),
          })

          if (result.success) {
            externalId = result.externalId
            externalRef = result.externalRef ?? null
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[bulk-approve] Accounting system error:`, err instanceof Error ? err.message : err)
  }

  const updateData: Record<string, unknown> = {
    status: INVOICE_STATUS.APPROVED,
    postedAt: new Date(),
  }
  if (externalId) updateData.xeroInvoiceId = externalId
  if (externalRef) updateData.externalRef = externalRef

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txOps: any[] = [
    db.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    }),
    db.auditLog.create({
      data: {
        invoiceId,
        action: AUDIT_ACTION.EXCEPTION_APPROVED,
        detail: JSON.stringify({ bulk: true, userId, externalId, externalRef, notes }),
      },
    }),
  ]

  if (invoice.exception) {
    txOps.push(
      db.exception.update({
        where: { invoiceId },
        data: { resolvedAt: new Date(), resolution: EXCEPTION_ACTION.APPROVED },
      })
    )

    txOps.push(
      db.exceptionReview.create({
        data: { exceptionId: invoice.exception.id, userId, action: EXCEPTION_ACTION.APPROVED, notes },
      })
    )
  }

  await db.$transaction(txOps)
  return externalId
}

async function rejectInvoice(invoiceId: string, firmId: string, userId: string, notes?: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { exception: true, client: { select: { firmId: true } } },
  })

  if (!invoice) throw new Error('Invoice not found')
  if (invoice.client.firmId !== firmId) throw new Error('Forbidden')
  if (invoice.status !== INVOICE_STATUS.EXCEPTION) throw new Error('Not in exception queue')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txOps: any[] = [
    db.invoice.update({
      where: { id: invoiceId },
      data: { status: INVOICE_STATUS.REJECTED },
    }),
    db.auditLog.create({
      data: {
        invoiceId,
        action: AUDIT_ACTION.EXCEPTION_REJECTED,
        detail: JSON.stringify({ bulk: true, userId, notes }),
      },
    }),
  ]

  if (invoice.exception) {
    txOps.push(
      db.exception.update({
        where: { invoiceId },
        data: { resolvedAt: new Date(), resolution: EXCEPTION_ACTION.REJECTED },
      })
    )

    txOps.push(
      db.exceptionReview.create({
        data: { exceptionId: invoice.exception.id, userId, action: EXCEPTION_ACTION.REJECTED, notes },
      })
    )
  }

  await db.$transaction(txOps)
}
