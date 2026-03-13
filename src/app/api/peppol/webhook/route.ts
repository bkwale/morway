import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { parseUBLInvoice } from '@/lib/ubl-parser'
import { processInvoice } from '@/lib/invoice-processor'

/**
 * POST /api/peppol/webhook
 *
 * Receives incoming e-invoices from the Peppol Access Point (Storecove).
 * Storecove sends a POST with the UBL XML payload and a signature header.
 *
 * Docs: https://www.storecove.com/docs/#_receiving_documents
 */
export async function POST(req: NextRequest) {
  // ── Verify webhook signature ──────────────────────────────────────────────
  const signature = req.headers.get('x-storecove-signature')
  const secret = process.env.STORECOVE_WEBHOOK_SECRET

  if (secret && signature) {
    const body = await req.text()
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Re-parse from text since we consumed the stream
    try {
      return await handlePayload(JSON.parse(body))
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
  }

  // ── Parse payload ─────────────────────────────────────────────────────────
  const payload = await req.json()
  return handlePayload(payload)
}

async function handlePayload(payload: {
  document?: { data?: string }
  receiver?: { identifier?: { id?: string } }
}) {
  const xmlBase64 = payload?.document?.data
  const receiverPeppolId = payload?.receiver?.identifier?.id

  if (!xmlBase64) {
    return NextResponse.json({ error: 'Missing document data' }, { status: 400 })
  }

  const xml = Buffer.from(xmlBase64, 'base64').toString('utf-8')

  // ── Find the client by Peppol ID ──────────────────────────────────────────
  if (!receiverPeppolId) {
    return NextResponse.json({ error: 'Missing receiver Peppol ID' }, { status: 400 })
  }

  const client = await db.client.findUnique({
    where: { peppolId: receiverPeppolId },
  })

  if (!client) {
    return NextResponse.json(
      { error: `No client found for Peppol ID: ${receiverPeppolId}` },
      { status: 404 }
    )
  }

  // ── Quick parse to extract invoice number ─────────────────────────────────
  const parsed = parseUBLInvoice(xml)

  // ── Persist the invoice ───────────────────────────────────────────────────
  const invoice = await db.invoice.create({
    data: {
      clientId: client.id,
      invoiceNumber: parsed.invoiceNumber || `UNKNOWN-${Date.now()}`,
      invoiceDate: parsed.invoiceDate,
      dueDate: parsed.dueDate,
      currency: parsed.currency,
      netAmount: parsed.netAmount,
      vatAmount: parsed.vatAmount,
      grossAmount: parsed.grossAmount,
      rawXml: xml,
      status: 'PENDING',
    },
  })

  await db.auditLog.create({
    data: {
      invoiceId: invoice.id,
      action: 'RECEIVED',
      detail: JSON.stringify({
        peppolId: receiverPeppolId,
        supplierName: parsed.supplier.name,
        invoiceNumber: parsed.invoiceNumber,
      }),
    },
  })

  // ── Process asynchronously ────────────────────────────────────────────────
  // In production, push invoiceId to a queue (e.g. BullMQ, Inngest).
  // For now, process inline (acceptable for low volume).
  processInvoice(invoice.id).catch((err) => {
    console.error(`Failed to process invoice ${invoice.id}:`, err)
  })

  return NextResponse.json({ received: true, invoiceId: invoice.id }, { status: 202 })
}
