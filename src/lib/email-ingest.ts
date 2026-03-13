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
import { parsePdfInvoice } from './pdf-parser'
import { processInvoice } from './invoice-processor'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface ResendInboundPayload {
  /** The Resend email ID */
  id: string
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
  /** Attachments metadata */
  attachments?: ResendAttachment[]
  /** When the email was created */
  created_at: string
}

export interface ResendAttachment {
  /** Filename */
  filename: string
  /** MIME type */
  content_type: string
  /** Base64-encoded content (included in webhook payload) */
  content: string
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

async function parseAttachment(
  content: string,
  type: SupportedType
): Promise<ParsedInvoice | null> {
  const buffer = Buffer.from(content, 'base64')

  if (type === 'xml') {
    const xml = buffer.toString('utf-8')
    return parseUBLInvoice(xml)
  }

  if (type === 'pdf') {
    return parsePdfInvoice(buffer)
  }

  return null
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
      // Parse the attachment
      const parsed = await parseAttachment(attachment.content, type)
      if (!parsed) {
        errors.push(`Failed to parse: ${attachment.filename}`)
        continue
      }

      if (parsed.errors.length > 0 && !parsed.invoiceNumber && !parsed.supplier.name) {
        errors.push(`Could not extract data from ${attachment.filename}: ${parsed.errors.join(', ')}`)
        continue
      }

      // Store raw content — for XML we keep the full document, for PDF we store
      // the parsed data as JSON so the processor can reconstruct it.
      const rawContent = type === 'xml'
        ? Buffer.from(attachment.content, 'base64').toString('utf-8')
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
