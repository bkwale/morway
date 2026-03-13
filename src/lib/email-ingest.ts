/**
 * Email Ingestion
 *
 * Processes inbound emails received via Resend webhook.
 * Each client gets a unique email address: {clientSlug}@in.morway.app
 *
 * Flow:
 *   1. Resend sends webhook with email metadata
 *   2. We match the "to" address to a client
 *   3. Download attachments via Resend API
 *   4. For each attachment: parse (PDF or XML) and create invoice
 *   5. Feed into the standard processing pipeline
 */

import { db } from './db'
import { parseUBLInvoice, type ParsedInvoice } from './ubl-parser'
import { parsePdfInvoices } from './pdf-parser'
import { processInvoice } from './invoice-processor'

// ─── TYPES ──────────────────────────────────────────────────────────────────

/**
 * Resend webhook wraps the email in a top-level envelope:
 * { created_at, type: "email.received", data: { ...email fields } }
 */
export interface ResendWebhookEnvelope {
  created_at: string
  type: string
  data: ResendInboundPayload
}

export interface ResendInboundPayload {
  /** The Resend email ID */
  email_id: string
  /** Sender email */
  from: string
  /** Recipient(s) */
  to: string[]
  /** Email subject */
  subject: string
  /** Plain text body */
  text?: string
  /** HTML body */
  html?: string
  /** Attachments metadata (no content — just metadata) */
  attachments?: ResendAttachment[]
  /** When the email was created */
  created_at: string
}

export interface ResendAttachment {
  /** Filename */
  filename: string
  /** MIME type */
  content_type: string
  /** Content disposition */
  content_disposition?: string
  /** Content ID (for inline) */
  content_id?: string | null
  /** Attachment ID — used to fetch content from Resend API */
  id: string
}

// ─── CLIENT LOOKUP ──────────────────────────────────────────────────────────

/**
 * Extract client slug from email address.
 * e.g., "hof-schmidt@in.morway.app" → "hof-schmidt"
 */
function extractClientSlug(email: string): string | null {
  const match = email.match(/^([^@]+)@in\.morway\.app$/i)
  return match ? match[1].toLowerCase() : null
}

/**
 * Find client by their inbound email slug.
 * We store the slug in the client's peppolId field for now,
 * or match by a dedicated inboundEmail field.
 * For MVP: match against client name (slugified) or a lookup table.
 */
async function findClientByEmail(toAddresses: string[]): Promise<{
  client: { id: string; name: string; firmId: string } | null
  slug: string | null
}> {
  for (const addr of toAddresses) {
    const slug = extractClientSlug(addr)
    if (!slug) continue

    // Try exact match on inbound slug (stored in peppolId for now, or we add a field)
    // For MVP: search by slug matching client name pattern
    const clients = await db.client.findMany({
      where: { active: true },
      select: { id: true, name: true, firmId: true },
    })

    // Match slug to client name (e.g., "hof-schmidt" matches "Hof Schmidt GmbH")
    const slugNormalized = slug.replace(/-/g, ' ').toLowerCase()
    const match = clients.find((c) => {
      const nameNormalized = c.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
      return nameNormalized.startsWith(slugNormalized) || slugNormalized.startsWith(nameNormalized.split(' ').slice(0, 2).join(' '))
    })

    if (match) return { client: match, slug }
  }

  return { client: null, slug: null }
}

// ─── ATTACHMENT PROCESSING ──────────────────────────────────────────────────

type SupportedType = 'pdf' | 'xml' | 'unsupported'

function classifyAttachment(filename: string, contentType: string): SupportedType {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'pdf' || contentType === 'application/pdf') return 'pdf'
  if (ext === 'xml' || contentType === 'text/xml' || contentType === 'application/xml') return 'xml'
  return 'unsupported'
}

/**
 * Download attachment content from Resend API.
 * Resend inbound webhooks don't include attachment content inline —
 * we need to fetch it using the email_id and attachment filename.
 *
 * Resend API: GET /emails/{email_id}/attachments/{attachment_id}
 */
async function downloadAttachment(emailId: string, attachmentId: string): Promise<Buffer> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not set')

  // Inbound emails use /emails/receiving/{id}/attachments/{id}
  // (NOT /emails/{id}/attachments/{id} — that's for outbound)
  const metaUrl = `https://api.resend.com/emails/receiving/${emailId}/attachments/${attachmentId}`
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!metaRes.ok) {
    const body = await metaRes.text()
    throw new Error(`Resend attachment metadata failed (${metaRes.status}): ${body}`)
  }

  // Response includes a pre-signed download_url
  const meta = await metaRes.json() as { download_url: string; filename: string; content_type: string }
  console.log(`[email-ingest] Got download URL for ${meta.filename}`)

  // Download the actual file from the pre-signed URL
  const fileRes = await fetch(meta.download_url)
  if (!fileRes.ok) {
    throw new Error(`Attachment file download failed (${fileRes.status})`)
  }

  const arrayBuffer = await fileRes.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Parse attachment into one or more invoices.
 * PDFs may contain multiple invoices; XML always returns one.
 */
async function parseAttachment(
  buffer: Buffer,
  type: SupportedType
): Promise<ParsedInvoice[]> {
  if (type === 'xml') {
    const xml = buffer.toString('utf-8')
    return [parseUBLInvoice(xml)]
  }

  if (type === 'pdf') {
    return parsePdfInvoices(buffer)
  }

  return []
}

// ─── MAIN INGEST FUNCTION ───────────────────────────────────────────────────

export interface IngestResult {
  success: boolean
  clientId: string | null
  invoicesCreated: string[]
  errors: string[]
}

/**
 * Process an inbound email and create invoices from its attachments.
 * Accepts the unwrapped email data (caller extracts from envelope).
 */
export async function ingestEmail(payload: ResendInboundPayload): Promise<IngestResult> {
  const errors: string[] = []
  const invoicesCreated: string[] = []

  // Step 1: Find the client
  const { client, slug } = await findClientByEmail(payload.to)

  if (!client) {
    return {
      success: false,
      clientId: null,
      invoicesCreated: [],
      errors: [`No client found for address: ${payload.to.join(', ')} (slug: ${slug})`],
    }
  }

  // Step 2: Process attachments
  const attachments = payload.attachments ?? []

  if (attachments.length === 0) {
    return {
      success: false,
      clientId: client.id,
      invoicesCreated: [],
      errors: ['Email has no attachments — nothing to process'],
    }
  }

  for (const attachment of attachments) {
    const type = classifyAttachment(attachment.filename, attachment.content_type)

    if (type === 'unsupported') {
      errors.push(`Skipped unsupported file: ${attachment.filename} (${attachment.content_type})`)
      continue
    }

    try {
      // Download attachment content from Resend API
      console.log(`[email-ingest] Downloading attachment: ${attachment.filename} (${attachment.id})`)
      const buffer = await downloadAttachment(payload.email_id, attachment.id)

      // Parse the attachment (may return multiple invoices from one PDF)
      const parsedList = await parseAttachment(buffer, type)
      if (parsedList.length === 0) {
        errors.push(`Failed to parse: ${attachment.filename}`)
        continue
      }

      console.log(`[email-ingest] Found ${parsedList.length} invoice(s) in ${attachment.filename}`)

      for (const parsed of parsedList) {
        if (parsed.errors.length > 0 && !parsed.invoiceNumber && !parsed.supplier.name) {
          errors.push(`Could not extract data from ${attachment.filename}: ${parsed.errors.join(', ')}`)
          continue
        }

        // Store raw content — for XML we keep the full document, for PDF we store
        // the parsed data as JSON so the processor can reconstruct it.
        const rawContent = type === 'xml'
          ? buffer.toString('utf-8')
          : JSON.stringify({
              _source: 'EMAIL_PDF',
              _filename: attachment.filename,
              _from: payload.from,
              ...parsed,
              // Convert dates to ISO strings for JSON serialization
              invoiceDate: parsed.invoiceDate.toISOString(),
              dueDate: parsed.dueDate?.toISOString() ?? null,
            })

        // Create invoice record
        const invoice = await db.invoice.create({
          data: {
            clientId: client.id,
            invoiceNumber: parsed.invoiceNumber || `EMAIL-${Date.now()}`,
            invoiceDate: parsed.invoiceDate,
            dueDate: parsed.dueDate,
            currency: parsed.currency,
            netAmount: parsed.netAmount,
            vatAmount: parsed.vatAmount,
            grossAmount: parsed.grossAmount,
            rawXml: rawContent,
            status: 'PENDING',
          },
        })

        await db.auditLog.create({
          data: {
            invoiceId: invoice.id,
            action: 'RECEIVED',
            detail: JSON.stringify({
              source: 'EMAIL',
              from: payload.from,
              subject: payload.subject,
              filename: attachment.filename,
              fileType: type,
              supplierName: parsed.supplier.name,
              invoiceNumber: parsed.invoiceNumber,
            }),
          },
        })

        invoicesCreated.push(invoice.id)

        // Process asynchronously through the standard pipeline
        processInvoice(invoice.id).catch((err) => {
          console.error(`[email-ingest] Failed to process invoice ${invoice.id}:`, err)
        })
      }
    } catch (err) {
      errors.push(`Error processing ${attachment.filename}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  return {
    success: invoicesCreated.length > 0,
    clientId: client.id,
    invoicesCreated,
    errors,
  }
}
