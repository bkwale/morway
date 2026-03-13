import { db } from './db'
import { parseUBLInvoice } from './ubl-parser'
import { applyRules } from './rules-engine'
import { getAdapter } from './accounting'
import { INVOICE_STATUS, AUDIT_ACTION, AUTO_POST_THRESHOLD } from './constants'
import { notifyExceptionCreated } from './notifications'

/**
 * Extract a useful error message from any thrown value.
 * Accounting SDKs often throw plain objects, not Error instances.
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    if (obj.body && typeof obj.body === 'object') {
      const body = obj.body as Record<string, unknown>
      if (body.Message) return String(body.Message)
      if (body.Detail) return String(body.Detail)
      if (body.message) return String(body.message)
    }
    if (obj.statusCode) return `API error: HTTP ${obj.statusCode}`
    if (obj.message) return String(obj.message)
    try { return JSON.stringify(err).slice(0, 300) } catch { /* fallthrough */ }
  }
  return 'Unknown error — check accounting system connection'
}

/**
 * Main invoice processing pipeline.
 * Called after a Peppol invoice is received.
 *
 * 1. Parse UBL XML
 * 2. Match/create supplier
 * 3. Apply rules engine
 * 4. Auto-post if confidence >= threshold, else send to exception queue
 */
export async function processInvoice(invoiceId: string): Promise<void> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true },
  })

  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`)
  if (!invoice.client) throw new Error(`Client not found for invoice ${invoiceId}`)

  // Mark as processing
  await db.invoice.update({
    where: { id: invoiceId },
    data: { status: INVOICE_STATUS.PROCESSING, processedAt: new Date() },
  })

  try {
    // ── STEP 1: Parse UBL XML ─────────────────────────────────────────────
    const parsed = parseUBLInvoice(invoice.rawXml)

    await createAuditLog(invoiceId, AUDIT_ACTION.PARSED, {
      errors: parsed.errors,
      lineItemCount: parsed.lineItems.length,
    })

    if (parsed.errors.length > 0 && !parsed.invoiceNumber) {
      await sendToException(invoiceId, `Parse error: ${parsed.errors.join(', ')}`)
      return
    }

    // ── STEP 2: Match or create supplier ─────────────────────────────────
    let supplier = null

    if (parsed.supplier.vatNumber) {
      supplier = await db.supplier.findFirst({
        where: {
          clientId: invoice.clientId,
          vatNumber: parsed.supplier.vatNumber,
        },
      })
    }

    if (!supplier && parsed.supplier.name) {
      supplier = await db.supplier.findFirst({
        where: {
          clientId: invoice.clientId,
          name: { contains: parsed.supplier.name },
        },
      })
    }

    if (!supplier) {
      // Create supplier record
      supplier = await db.supplier.create({
        data: {
          clientId: invoice.clientId,
          name: parsed.supplier.name,
          vatNumber: parsed.supplier.vatNumber,
        },
      })
      await createAuditLog(invoiceId, AUDIT_ACTION.SUPPLIER_CREATED, {
        supplierName: parsed.supplier.name,
        supplierId: supplier.id,
      })
    } else {
      await createAuditLog(invoiceId, AUDIT_ACTION.SUPPLIER_MATCHED, {
        supplierName: supplier.name,
        supplierId: supplier.id,
      })
    }

    // Update invoice with supplier
    await db.invoice.update({
      where: { id: invoiceId },
      data: { supplierId: supplier.id },
    })

    // ── STEP 3: Apply rules engine ────────────────────────────────────────
    const rulesResult = await applyRules(
      invoice.client.firmId,
      invoice.clientId,
      supplier.id,
      parsed
    )

    await createAuditLog(invoiceId, AUDIT_ACTION.RULE_APPLIED, {
      confidence: rulesResult.overallConfidence,
      matched: rulesResult.matches.length,
      unmatched: rulesResult.unmatched,
    })

    // Save line items with applied account codes
    await db.lineItem.createMany({
      data: rulesResult.lineItems.map((item) => ({
        invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        lineTotal: item.lineTotal,
        accountCode: item.accountCode,
      })),
    })

    // Update confidence score on invoice
    await db.invoice.update({
      where: { id: invoiceId },
      data: { confidenceScore: rulesResult.overallConfidence },
    })

    // ── STEP 4: Auto-post or send to exception queue ──────────────────────
    if (rulesResult.overallConfidence >= AUTO_POST_THRESHOLD) {
      // Get the accounting adapter for this client
      const adapter = await getAdapter(invoice.clientId)

      if (!adapter) {
        await sendToException(
          invoiceId,
          `No accounting system connected for client "${invoice.client.name}". Rules matched (${Math.round(rulesResult.overallConfidence * 100)}% confidence) but cannot auto-post without a connected system.`
        )
        return
      }

      // Check connection is still valid (for real-time adapters)
      if (adapter.isRealTime) {
        const connected = await adapter.isConnected(invoice.clientId)
        if (!connected) {
          await sendToException(
            invoiceId,
            `${adapter.name} connection expired for client "${invoice.client.name}". Please reconnect to resume auto-posting.`
          )
          return
        }
      }

      await autoPost(invoiceId, invoice.clientId, supplier, parsed, rulesResult, adapter)
    } else {
      const reason =
        rulesResult.unmatched > 0
          ? `${rulesResult.unmatched} line item(s) could not be categorised (confidence: ${Math.round(rulesResult.overallConfidence * 100)}%)`
          : `Confidence score below threshold: ${Math.round(rulesResult.overallConfidence * 100)}%`

      await sendToException(invoiceId, reason)
    }
  } catch (err) {
    const message = extractErrorMessage(err)
    await db.invoice.update({
      where: { id: invoiceId },
      data: { status: INVOICE_STATUS.FAILED, failureReason: message },
    })
    await createAuditLog(invoiceId, AUDIT_ACTION.FAILED, { error: message })
    throw new Error(message)
  }
}

// ─── AUTO POST ───────────────────────────────────────────────────────────────

async function autoPost(
  invoiceId: string,
  clientId: string,
  supplier: { name: string; vatNumber: string | null; xeroContactId: string | null },
  parsed: ReturnType<typeof parseUBLInvoice> extends Promise<infer T> ? T : ReturnType<typeof parseUBLInvoice>,
  rulesResult: Awaited<ReturnType<typeof applyRules>>,
  adapter: Awaited<ReturnType<typeof getAdapter>>
) {
  if (!adapter) {
    await sendToException(invoiceId, 'No accounting adapter available')
    return
  }

  // Find or create contact in external system
  const contact = await adapter.findOrCreateContact(clientId, {
    name: supplier.name,
    vatNumber: supplier.vatNumber,
  })

  if (!contact?.contactId) {
    await sendToException(invoiceId, `Could not create or find contact in ${adapter.name}`)
    return
  }

  // Update supplier with external contact ID
  await db.supplier.updateMany({
    where: { clientId, name: supplier.name },
    data: { xeroContactId: contact.contactId },
  })

  // Post bill via adapter
  const result = await adapter.postBill(clientId, contact.contactId, {
    invoiceNumber: parsed.invoiceNumber,
    invoiceDate: parsed.invoiceDate,
    dueDate: parsed.dueDate,
    currency: parsed.currency,
    supplierName: supplier.name,
    supplierVatNumber: supplier.vatNumber,
    lineItems: rulesResult.lineItems
      .filter((item) => item.accountCode)
      .map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitAmount: item.unitPrice,
        accountCode: item.accountCode!,
      })),
  })

  if (!result.success && adapter.isRealTime) {
    await sendToException(invoiceId, `${adapter.name} posting failed: ${result.error ?? 'unknown error'}`)
    return
  }

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      status: INVOICE_STATUS.AUTO_POSTED,
      xeroInvoiceId: result.externalId,
      externalRef: result.externalRef,
      postedAt: new Date(),
    },
  })

  await createAuditLog(invoiceId, AUDIT_ACTION.AUTO_POSTED, {
    system: adapter.name,
    externalId: result.externalId,
    contactId: contact.contactId,
  })
}

// ─── EXCEPTION QUEUE ─────────────────────────────────────────────────────────

async function sendToException(invoiceId: string, reason: string) {
  await db.invoice.update({
    where: { id: invoiceId },
    data: { status: INVOICE_STATUS.EXCEPTION },
  })

  await db.exception.create({
    data: { invoiceId, reason },
  })

  await createAuditLog(invoiceId, AUDIT_ACTION.EXCEPTION_CREATED, { reason })

  // Send email notification (awaited so Vercel doesn't kill the function early)
  try {
    await notifyExceptionCreated(invoiceId, reason)
  } catch (err) {
    console.error('[notifications] Failed to send exception alert:', err)
  }
}

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────

async function createAuditLog(
  invoiceId: string,
  action: string,
  detail?: Record<string, unknown>
) {
  await db.auditLog.create({
    data: {
      invoiceId,
      action,
      detail: detail ? JSON.stringify(detail) : undefined,
    },
  })
}
