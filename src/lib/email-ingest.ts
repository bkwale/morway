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
 *   4. For each attachment: parse (PDF, XML, or image) and create invoice(s)
 *   5. If no attachments: attempt to parse invoice data from email body
 *   6. Deduplicate against existing invoices before creating records
 *   7. Feed into the standard processing pipeline
 *
 * Production-grade features:
 *   - Multi-language invoice support (DE, FR, NL, IT, ES, PL, ET, EN)
 *   - Credit note detection (Gutschrift, Avoir, Creditnota, etc.)
 *   - Image attachment parsing via Claude vision API (JPG, PNG, WebP)
 *   - Email body fallback when no attachments present
 *   - Duplicate invoice detection (invoiceNumber + clientId + grossAmount + currency)
 *   - Forwarded email original sender extraction
 */

import { db } from './db'
import { parseUBLInvoice, type ParsedInvoice } from './ubl-parser'
import { parsePdfInvoices, parseImageInvoices, parseEmailBodyInvoices } from './pdf-parser'
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

// ─── FORWARDED EMAIL DETECTION ──────────────────────────────────────────────

/**
 * Extract the original sender from a forwarded email.
 *
 * Handles common forwarding patterns across email clients and languages:
 *   - "---------- Forwarded message ----------\nFrom: Name <email>"
 *   - "-------- Original Message --------\nFrom: Name <email>"
 *   - "Von: Name <email>" (German)
 *   - "De: Name <email>" (French/Spanish)
 *   - "Da: Name <email>" (Italian)
 *   - "Van: Name <email>" (Dutch)
 *
 * Returns the original sender email if found, otherwise null.
 */
function extractForwardedSender(subject: string, bodyText: string | undefined): string | null {
  if (!bodyText) return null

  // Check if this looks like a forwarded email
  const fwdSubject = /^(fwd?|wg|tr|rv|i|doorst):/i.test(subject)
  const fwdBodyMarker = /(forwarded message|original message|weitergeleitete nachricht|message transféré|messaggio inoltrato|doorgestuurd bericht)/i.test(bodyText)

  if (!fwdSubject && !fwdBodyMarker) return null

  // Try to extract the original "From:" line
  // Patterns: From: / Von: / De: / Da: / Van: / Från:
  const fromPatterns = [
    /(?:^|\n)\s*(?:From|Von|De|Da|Van|Från)\s*:\s*(?:.*?<([^>]+)>|([^\n<]+@[^\n\s>]+))/im,
  ]

  for (const pattern of fromPatterns) {
    const match = bodyText.match(pattern)
    if (match) {
      const email = (match[1] || match[2])?.trim()
      if (email && email.includes('@')) return email
    }
  }

  return null
}

// ─── ATTACHMENT CLASSIFICATION ──────────────────────────────────────────────

type SupportedType = 'pdf' | 'xml' | 'image' | 'unsupported'

/**
 * Image MIME type subset accepted by Claude's vision API.
 */
type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const IMAGE_MIME_TYPES: Set<string> = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
])

const IMAGE_EXTENSIONS: Set<string> = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif',
])

function classifyAttachment(filename: string, contentType: string): SupportedType {
  const ext = filename.toLowerCase().split('.').pop() ?? ''

  if (ext === 'pdf' || contentType === 'application/pdf') return 'pdf'
  if (ext === 'xml' || contentType === 'text/xml' || contentType === 'application/xml') return 'xml'
  if (IMAGE_EXTENSIONS.has(ext) || IMAGE_MIME_TYPES.has(contentType)) return 'image'

  return 'unsupported'
}

/**
 * Resolve a content_type string to a Claude-compatible image MIME type.
 * Falls back based on file extension if content_type is generic.
 */
function resolveImageMime(filename: string, contentType: string): ImageMimeType {
  if (IMAGE_MIME_TYPES.has(contentType)) return contentType as ImageMimeType

  const ext = filename.toLowerCase().split('.').pop() ?? ''
  const extMap: Record<string, ImageMimeType> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  }
  return extMap[ext] ?? 'image/jpeg'
}

// ─── ATTACHMENT DOWNLOAD ────────────────────────────────────────────────────

/**
 * Download attachment content from Resend API.
 * Resend inbound webhooks don't include attachment content inline —
 * we need to fetch it using the email_id and attachment filename.
 *
 * Resend API: GET /emails/receiving/{email_id}/attachments/{attachment_id}
 */
async function downloadAttachment(emailId: string, attachmentId: string): Promise<Buffer> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not set')

  const metaUrl = `https://api.resend.com/emails/receiving/${emailId}/attachments/${attachmentId}`
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!metaRes.ok) {
    const body = await metaRes.text()
    throw new Error(`Resend attachment metadata failed (${metaRes.status}): ${body}`)
  }

  const meta = await metaRes.json() as { download_url: string; filename: string; content_type: string }
  console.log(`[email-ingest] Got download URL for ${meta.filename}`)

  const fileRes = await fetch(meta.download_url)
  if (!fileRes.ok) {
    throw new Error(`Attachment file download failed (${fileRes.status})`)
  }

  const arrayBuffer = await fileRes.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ─── ATTACHMENT PARSING ─────────────────────────────────────────────────────

/**
 * Parse attachment into one or more invoices.
 * PDFs and images may contain multiple invoices; XML always returns one.
 */
async function parseAttachment(
  buffer: Buffer,
  type: SupportedType,
  filename: string,
  contentType: string
): Promise<ParsedInvoice[]> {
  if (type === 'xml') {
    const xml = buffer.toString('utf-8')
    return [parseUBLInvoice(xml)]
  }

  if (type === 'pdf') {
    return parsePdfInvoices(buffer)
  }

  if (type === 'image') {
    const mimeType = resolveImageMime(filename, contentType)
    return parseImageInvoices(buffer, mimeType)
  }

  return []
}

// ─── DUPLICATE DETECTION ────────────────────────────────────────────────────

/**
 * Check if an invoice already exists for this client.
 *
 * Dedup key: invoiceNumber + clientId + currency + grossAmount
 *
 * This catches:
 *   - Same invoice forwarded twice by the accountant
 *   - Resend webhook retries (at-least-once delivery)
 *   - Same PDF attached to multiple emails
 *
 * We use a composite check rather than a unique constraint because
 * different suppliers may reuse invoice numbers (e.g., "001").
 * Adding grossAmount + currency makes collisions near-impossible.
 *
 * Returns the existing invoice ID if duplicate, null if new.
 */
async function checkDuplicate(
  clientId: string,
  invoiceNumber: string,
  currency: string,
  grossAmount: number
): Promise<string | null> {
  if (!invoiceNumber) return null // Can't dedup without an invoice number

  // Normalize: round to 2 decimal places for float comparison
  const amount = Math.round(grossAmount * 100) / 100

  const existing = await db.invoice.findFirst({
    where: {
      clientId,
      invoiceNumber,
      currency,
      grossAmount: {
        gte: amount - 0.01,
        lte: amount + 0.01,
      },
    },
    select: { id: true },
  })

  return existing?.id ?? null
}

// ─── MAIN INGEST FUNCTION ───────────────────────────────────────────────────

export interface IngestResult {
  success: boolean
  clientId: string | null
  invoicesCreated: string[]
  duplicatesSkipped: string[]
  errors: string[]
}

/**
 * Process an inbound email and create invoices from its attachments.
 * Accepts the unwrapped email data (caller extracts from envelope).
 *
 * Pipeline:
 *   1. Find client from "to" address
 *   2. Detect forwarded emails → extract original sender
 *   3. Classify + download attachments
 *   4. Parse each attachment (PDF, XML, image)
 *   5. If no processable attachments → try email body fallback
 *   6. Deduplicate each parsed invoice against existing records
 *   7. Create invoice records + audit logs
 *   8. Fire async processing pipeline
 */
export async function ingestEmail(payload: ResendInboundPayload): Promise<IngestResult> {
  const errors: string[] = []
  const invoicesCreated: string[] = []
  const duplicatesSkipped: string[] = []

  // Step 1: Find the client
  const { client, slug } = await findClientByEmail(payload.to)

  if (!client) {
    return {
      success: false,
      clientId: null,
      invoicesCreated: [],
      duplicatesSkipped: [],
      errors: [`No client found for address: ${payload.to.join(', ')} (slug: ${slug})`],
    }
  }

  // Step 2: Detect forwarded email and extract original sender
  const originalSender = extractForwardedSender(payload.subject, payload.text)
  const effectiveSender = originalSender ?? payload.from

  if (originalSender) {
    console.log(`[email-ingest] Forwarded email detected. Original sender: ${originalSender}, forwarder: ${payload.from}`)
  }

  // Step 3: Process attachments
  const attachments = payload.attachments ?? []
  const processableAttachments = attachments.filter(
    (a) => classifyAttachment(a.filename, a.content_type) !== 'unsupported'
  )

  // Step 4: If no processable attachments, try email body fallback
  if (processableAttachments.length === 0) {
    console.log(`[email-ingest] No processable attachments (${attachments.length} total). Trying email body fallback.`)

    const bodyText = payload.text ?? ''
    const bodyParsed = await parseEmailBodyInvoices(payload.subject, bodyText)

    if (bodyParsed.length === 0 || (bodyParsed.length === 1 && bodyParsed[0].errors.length > 0 && !bodyParsed[0].invoiceNumber)) {
      const bodyError = bodyParsed[0]?.errors[0] ?? 'No invoice data found'
      return {
        success: false,
        clientId: client.id,
        invoicesCreated: [],
        duplicatesSkipped: [],
        errors: [
          attachments.length > 0
            ? `No supported attachments (${attachments.map((a) => a.filename).join(', ')}). Email body fallback: ${bodyError}`
            : `Email has no attachments. Email body fallback: ${bodyError}`,
        ],
      }
    }

    // Process invoices found in email body
    for (const parsed of bodyParsed) {
      const result = await createInvoiceRecord(parsed, client, {
        source: 'EMAIL_BODY',
        from: effectiveSender,
        subject: payload.subject,
        filename: null,
        fileType: 'text',
      }, errors, invoicesCreated, duplicatesSkipped)
      if (!result) continue
    }

    return {
      success: invoicesCreated.length > 0,
      clientId: client.id,
      invoicesCreated,
      duplicatesSkipped,
      errors,
    }
  }

  // Step 5: Process each attachment
  for (const attachment of attachments) {
    const type = classifyAttachment(attachment.filename, attachment.content_type)

    if (type === 'unsupported') {
      // Only log if there are also processable ones (otherwise we already handled above)
      if (processableAttachments.length > 0) {
        errors.push(`Skipped unsupported file: ${attachment.filename} (${attachment.content_type})`)
      }
      continue
    }

    try {
      console.log(`[email-ingest] Downloading attachment: ${attachment.filename} (${attachment.id})`)
      const buffer = await downloadAttachment(payload.email_id, attachment.id)

      const parsedList = await parseAttachment(buffer, type, attachment.filename, attachment.content_type)
      if (parsedList.length === 0) {
        errors.push(`Failed to parse: ${attachment.filename}`)
        continue
      }

      console.log(`[email-ingest] Found ${parsedList.length} invoice(s) in ${attachment.filename}`)

      for (const parsed of parsedList) {
        await createInvoiceRecord(parsed, client, {
          source: 'EMAIL',
          from: effectiveSender,
          subject: payload.subject,
          filename: attachment.filename,
          fileType: type,
        }, errors, invoicesCreated, duplicatesSkipped)
      }
    } catch (err) {
      errors.push(`Error processing ${attachment.filename}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  return {
    success: invoicesCreated.length > 0,
    clientId: client.id,
    invoicesCreated,
    duplicatesSkipped,
    errors,
  }
}

// ─── INVOICE RECORD CREATION ────────────────────────────────────────────────

interface InvoiceSource {
  source: string
  from: string
  subject: string
  filename: string | null
  fileType: string
}

/**
 * Create a single invoice record from parsed data.
 * Handles validation, deduplication, and audit logging.
 * Returns the invoice ID if created, null if skipped.
 */
async function createInvoiceRecord(
  parsed: ParsedInvoice,
  client: { id: string; name: string; firmId: string },
  source: InvoiceSource,
  errors: string[],
  invoicesCreated: string[],
  duplicatesSkipped: string[]
): Promise<string | null> {
  // Validate: skip if we couldn't extract any meaningful data
  if (parsed.errors.length > 0 && !parsed.invoiceNumber && !parsed.supplier.name) {
    const filename = source.filename ?? 'email body'
    errors.push(`Could not extract data from ${filename}: ${parsed.errors.join(', ')}`)
    return null
  }

  // Dedup check
  const existingId = await checkDuplicate(
    client.id,
    parsed.invoiceNumber,
    parsed.currency,
    parsed.grossAmount
  )

  if (existingId) {
    console.log(`[email-ingest] Duplicate detected: ${parsed.invoiceNumber} (${parsed.currency} ${parsed.grossAmount}) → existing ${existingId}`)
    duplicatesSkipped.push(parsed.invoiceNumber || 'unknown')

    // Log the duplicate attempt for audit trail
    await db.auditLog.create({
      data: {
        invoiceId: existingId,
        action: 'DUPLICATE_SKIPPED',
        detail: JSON.stringify({
          source: source.source,
          from: source.from,
          subject: source.subject,
          filename: source.filename,
          reason: 'Duplicate invoice detected during email ingestion',
        }),
      },
    })
    return null
  }

  // Build raw content for storage
  const rawContent = JSON.stringify({
    _source: source.source,
    _filename: source.filename,
    _from: source.from,
    _documentType: parsed.documentType,
    ...parsed,
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
      documentType: parsed.documentType,
      netAmount: parsed.netAmount,
      vatAmount: parsed.vatAmount,
      grossAmount: parsed.grossAmount,
      rawXml: rawContent,
      status: 'PENDING',
    },
  })

  // Create line item records
  if (parsed.lineItems.length > 0) {
    await db.lineItem.createMany({
      data: parsed.lineItems.map((item) => ({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        lineTotal: item.lineTotal,
        accountCode: null,
      })),
    })
  }

  await db.auditLog.create({
    data: {
      invoiceId: invoice.id,
      action: 'RECEIVED',
      detail: JSON.stringify({
        source: source.source,
        from: source.from,
        subject: source.subject,
        filename: source.filename,
        fileType: source.fileType,
        documentType: parsed.documentType,
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

  return invoice.id
}
