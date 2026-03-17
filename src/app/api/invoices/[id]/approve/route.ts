import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdapter } from '@/lib/accounting'
import { getSessionOrNull } from '@/lib/get-session'
import { INVOICE_STATUS, EXCEPTION_ACTION, AUDIT_ACTION } from '@/lib/constants'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: invoiceId } = await params
  const body = await req.json()
  const { accountCodeOverrides, notes } = body as {
    accountCodeOverrides?: Record<string, string>
    notes?: string
  }

  // Use authenticated user's ID instead of trusting the request body
  const userId = session.user.id

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

  // Verify the invoice belongs to the user's firm
  if (invoice.client.firmId !== session.user.firmId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const APPROVABLE = [INVOICE_STATUS.EXCEPTION, INVOICE_STATUS.PENDING, INVOICE_STATUS.FAILED]
  if (!APPROVABLE.includes(invoice.status as any)) {
    return NextResponse.json({ error: `Cannot approve invoice with status "${invoice.status}"` }, { status: 422 })
  }

  // Apply account code overrides to line items
  if (accountCodeOverrides && Object.keys(accountCodeOverrides).length > 0) {
    for (const [lineItemId, accountCode] of Object.entries(accountCodeOverrides)) {
      await db.lineItem.update({ where: { id: lineItemId }, data: { accountCode } })
    }
  }

  // Check if all line items have account codes
  const lineItems = await db.lineItem.findMany({ where: { invoiceId } })
  const missingCodes = lineItems.filter((item) => !item.accountCode)

  // If there are line items and some are missing codes, reject
  if (lineItems.length > 0 && missingCodes.length > 0) {
    return NextResponse.json(
      { error: `${missingCodes.length} line item(s) still missing account codes` },
      { status: 422 }
    )
  }

  // Try to post to connected accounting system (if any)
  let externalId: string | null = null
  let externalRef: string | null = null

  try {
    const adapter = await getAdapter(invoice.client.accountingSystem)

    if (adapter && adapter.isRealTime) {
      const connected = await adapter.isConnected(invoice.clientId)

      if (connected) {
        // Find or create supplier contact in the external system
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
            lineItems: lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitAmount: item.unitPrice,
              accountCode: item.accountCode ?? '',
            })),
          })

          if (result.success) {
            externalId = result.externalId
            externalRef = result.externalRef ?? null
          } else {
            console.warn(`[approve] External post failed: ${result.error}`)
            // Don't block approval — just log it
          }
        }
      }
    }
  } catch (err) {
    // Log but don't block the approval
    console.warn(`[approve] Accounting system error:`, err instanceof Error ? err.message : err)
  }

  // Resolve the exception and mark approved
  const hasOverrides = accountCodeOverrides && Object.keys(accountCodeOverrides).length > 0
  const action = hasOverrides ? EXCEPTION_ACTION.EDITED_AND_APPROVED : EXCEPTION_ACTION.APPROVED

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
        detail: JSON.stringify({
          userId,
          action,
          externalId,
          externalRef,
          overrides: accountCodeOverrides,
          notes,
        }),
      },
    }),
  ]

  // Only update exception if it exists
  if (invoice.exception) {
    txOps.push(
      db.exception.update({
        where: { invoiceId },
        data: { resolvedAt: new Date(), resolution: action },
      })
    )

    if (userId) {
      txOps.push(
        db.exceptionReview.create({
          data: { exceptionId: invoice.exception.id, userId, action, notes },
        })
      )
    }
  }

  await db.$transaction(txOps)

  // ── AUTO-LEARN: Create rules from approved line items ─────────────────
  // When an accountant approves with account codes, learn those patterns
  // for future auto-matching. Only learn from items the accountant touched
  // or confirmed (has an account code after approval).
  try {
    const approvedLineItems = await db.lineItem.findMany({ where: { invoiceId } })

    for (const item of approvedLineItems) {
      if (!item.accountCode || !item.description) continue

      // Extract keyword from description (first 3+ character word, lowercased)
      const words = item.description.toLowerCase().split(/\s+/).filter((w) => w.length >= 3)
      const keyword = words[0] ?? null

      if (!keyword) continue

      // Check if a rule already exists for this keyword + supplier
      const existingRule = await db.rule.findFirst({
        where: {
          firmId: session.user.firmId,
          keyword,
          supplierId: invoice.supplierId,
          accountCode: item.accountCode,
        },
      })

      if (existingRule) continue // Already learned

      // Create a supplier-specific rule (highest priority in hierarchy)
      await db.rule.create({
        data: {
          firmId: session.user.firmId,
          clientId: invoice.clientId,
          supplierId: invoice.supplierId,
          keyword,
          accountCode: item.accountCode,
          vatRate: item.vatRate,
          priority: 10, // Supplier-specific = high priority
          active: true,
        },
      })

      await db.auditLog.create({
        data: {
          invoiceId,
          action: AUDIT_ACTION.RULE_LEARNED,
          detail: JSON.stringify({
            keyword,
            accountCode: item.accountCode,
            supplierId: invoice.supplierId,
            lineItemDescription: item.description,
          }),
        },
      })
    }
  } catch (err) {
    // Don't block the approval response if rule learning fails
    console.warn('[approve] Auto-learn rules failed:', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({
    success: true,
    externalId,
    externalRef,
    accountingSystem: invoice.client.accountingSystem,
  })
}
