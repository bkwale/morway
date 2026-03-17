/**
 * PDF Invoice Parser
 *
 * Extracts structured invoice data from PDF files.
 * Uses unpdf for text extraction, then Claude for structuring.
 *
 * Supports multi-invoice PDFs — returns an array of ParsedInvoice.
 * The rest of the pipeline creates one record per invoice found.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ParsedInvoice, ParsedLineItem, DocumentType } from './ubl-parser'

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // unpdf: serverless-compatible PDF text extraction (no DOM/DOMMatrix needed)
  const { extractText } = await import('unpdf')
  const result = await extractText(new Uint8Array(buffer))
  const text = result.text
  return Array.isArray(text) ? text.join('\n\n') : (text ?? '')
}

const EXTRACTION_PROMPT = `You are a multilingual invoice data extraction system used by EU accounting firms.
You MUST handle invoices in ANY language — German, French, Dutch, Italian, Spanish, Polish, Estonian, English, and others.

Common field names by language:
- Rechnung/Rechnungsnummer/Rechnungsdatum/Fälligkeitsdatum/MwSt/Nettobetrag/Bruttobetrag (German)
- Facture/Numéro/Date/Échéance/TVA/Montant HT/Montant TTC (French)
- Factuur/Factuurnummer/Factuurdatum/Vervaldatum/BTW/Netto/Bruto (Dutch)
- Fattura/Numero/Data/Scadenza/IVA/Imponibile/Totale (Italian)

The document may contain ONE or MULTIPLE invoices. It may also contain CREDIT NOTES (Gutschrift, Avoir, Creditnota, Nota di credito).

Return ONLY a JSON array (no markdown, no explanation, no code fences):

[
  {
    "documentType": "invoice" or "credit_note",
    "invoiceNumber": "string",
    "invoiceDate": "YYYY-MM-DD",
    "dueDate": "YYYY-MM-DD or null",
    "currency": "EUR/USD/GBP etc",
    "supplier": {
      "name": "string",
      "vatNumber": "string or null",
      "address": "string or null"
    },
    "buyer": {
      "name": "string or null",
      "vatNumber": "string or null"
    },
    "reverseCharge": boolean,
    "vatExemptionReason": "REVERSE_CHARGE" | "INTRA_COMMUNITY" | "EXPORT" | "EXEMPT_MEDICAL" | "EXEMPT_EDUCATION" | "EXEMPT_FINANCIAL" | "SMALL_BUSINESS" | "OTHER" | null,
    "linkedInvoiceNumber": "string or null — for credit notes, the original invoice number being credited",
    "lineItems": [
      {
        "description": "string (translate to English if needed)",
        "quantity": number,
        "unitPrice": number,
        "vatRate": number,
        "lineTotal": number,
        "vatExemptionReason": "same as above, or null if VAT applies normally",
        "suggestedAccountCode": "string — standard chart-of-accounts code (see below)",
        "accountCodeConfidence": number between 0.0 and 1.0
      }
    ],
    "vatBreakdown": [
      { "rate": number, "taxableAmount": number, "vatAmount": number }
    ],
    "netAmount": number,
    "vatAmount": number,
    "grossAmount": number
  }
]

Rules:
- All amounts as numbers (not strings), using period as decimal separator
- For credit notes: amounts should be POSITIVE — the system handles sign logic
- VAT rate as percentage (e.g., 19 not 0.19)
- If you can't find a field, use null for strings or 0 for numbers
- invoiceDate and dueDate in YYYY-MM-DD format
- If only one total is visible, put it in grossAmount and estimate net/VAT from context
- Extract ALL line items visible in each invoice
- Currency should be 3-letter ISO code
- If there is only ONE invoice, still return it inside an array: [{ ... }]
- Extract EVERY invoice and credit note found — do not skip any
- documentType: "credit_note" for Gutschrift, Avoir, Creditnota, credit memo, or negative totals
- reverseCharge: true if the invoice indicates reverse charge / Steuerschuldnerschaft / autoliquidation / verlegging. Common signals: 0% VAT on B2B cross-border, explicit "reverse charge" text, "TVA non applicable art. 259-1", "Steuerschuldnerschaft des Leistungsempfängers", "BTW verlegd"
- vatExemptionReason: classify why VAT is 0% or exempt — REVERSE_CHARGE (cross-border B2B), INTRA_COMMUNITY (EU goods), EXPORT (outside EU), EXEMPT_MEDICAL/EDUCATION/FINANCIAL (domestic exemptions), SMALL_BUSINESS (Kleinunternehmer), OTHER, or null if VAT applies normally
- linkedInvoiceNumber: for credit notes, extract the original invoice number being credited (often labelled "Bezug auf Rechnung", "Réf. facture", "Betreft factuur")
- vatBreakdown: group all line items by VAT rate and provide taxableAmount + vatAmount per rate. This is critical for VAT returns
- suggestedAccountCode: suggest a standard accounting code for each line item based on its description:
  - For French PCG (Plan Comptable Général): 601x (raw materials), 602x (consumables), 606x (services), 607x (goods for resale), 611x (subcontracting), 613x (rent), 615x (maintenance), 616x (insurance), 622x (fees/commissions), 625x (travel), 626x (postal/telecom), 627x (banking), 641x (staff costs), 681x (depreciation)
  - For German SKR03: 3xxx (materials), 4xxx (revenue), 6xxx (operating expenses), 7xxx (depreciation)
  - For Dutch RGS: similar mapping
  - Use the most specific code you can infer from the description (e.g. "fuel" → 6061, "fertilizer" → 6012, "seeds" → 6011, "accounting fees" → 6226)
  - If you cannot confidently map it, use the broadest applicable category
- accountCodeConfidence: 0.9+ if the description clearly maps to one code, 0.5-0.8 if reasonable guess, 0.3-0.5 if unsure
- Return ONLY the JSON array, nothing else`

/**
 * Parse a PDF that may contain one or more invoices.
 * Returns an array of ParsedInvoice (one per invoice found).
 */
export async function parsePdfInvoices(pdfBuffer: Buffer, chartContext?: string): Promise<ParsedInvoice[]> {
  // Step 1: Extract raw text
  let rawText: string
  try {
    rawText = await extractTextFromPdf(pdfBuffer)
  } catch (err) {
    return [emptyInvoice([`PDF text extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])]
  }

  if (!rawText || rawText.trim().length < 20) {
    return [emptyInvoice(['PDF contains no readable text — may be a scanned image'])]
  }

  // Step 2: Use Claude to structure the data
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return [emptyInvoice(['ANTHROPIC_API_KEY not configured — cannot parse PDF invoices'])]
  }

  const anthropic = new Anthropic({ apiKey })

  let rawItems: Array<Record<string, unknown>>
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}${chartContext ? `\n\nCLIENT CONTEXT:\n${chartContext}` : ''}\n\nInvoice text:\n\n${rawText.slice(0, 12000)}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Try to parse as array first
    const parsed = extractJsonFromResponse(text)
    if (!parsed) {
      return [emptyInvoice(['AI extraction returned no parseable JSON'])]
    }

    // Normalize: if Claude returned a single object, wrap it
    rawItems = Array.isArray(parsed) ? parsed : [parsed]
  } catch (err) {
    return [emptyInvoice([`AI extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])]
  }

  if (rawItems.length === 0) {
    return [emptyInvoice(['AI extraction returned empty array'])]
  }

  // Step 3: Map each raw item to ParsedInvoice
  return rawItems.map((extracted) => mapToParsedInvoice(extracted))
}

/**
 * Backwards-compatible single-invoice parser.
 * Returns just the first invoice found.
 */
export async function parsePdfInvoice(pdfBuffer: Buffer): Promise<ParsedInvoice> {
  const results = await parsePdfInvoices(pdfBuffer)
  return results[0] ?? emptyInvoice(['No invoices found in PDF'])
}

// ─── IMAGE INVOICE PARSING ───────────────────────────────────────────────────

/**
 * Parse invoice data from an image (JPG, PNG, TIFF, WebP).
 * Uses Claude's vision API to extract structured data from photographed/scanned invoices.
 * Small suppliers often send photos of handwritten or printed invoices.
 */
export async function parseImageInvoices(
  imageBuffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  chartContext?: string
): Promise<ParsedInvoice[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return [emptyInvoice(['ANTHROPIC_API_KEY not configured — cannot parse image invoices'])]
  }

  const anthropic = new Anthropic({ apiKey })

  try {
    const base64 = imageBuffer.toString('base64')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT + (chartContext ? `\n\nCLIENT CONTEXT:\n${chartContext}` : '') + '\n\nExtract invoice data from this image. The image may be a scan, photo, or screenshot of one or more invoices.',
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = extractJsonFromResponse(text)
    if (!parsed) {
      return [emptyInvoice(['Vision extraction returned no parseable JSON'])]
    }

    const rawItems = Array.isArray(parsed)
      ? (parsed as Array<Record<string, unknown>>)
      : [parsed as Record<string, unknown>]

    if (rawItems.length === 0) {
      return [emptyInvoice(['Vision extraction returned empty array'])]
    }

    return rawItems.map((extracted) => mapToParsedInvoice(extracted))
  } catch (err) {
    return [emptyInvoice([`Vision extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])]
  }
}

// ─── EMAIL BODY PARSING ─────────────────────────────────────────────────────

/**
 * Parse invoice data from email body text.
 * Fallback when an email has no attachments but contains invoice details inline.
 * Common with small suppliers who paste invoice details directly in the email.
 */
export async function parseEmailBodyInvoices(
  subject: string,
  bodyText: string,
  chartContext?: string
): Promise<ParsedInvoice[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return [emptyInvoice(['ANTHROPIC_API_KEY not configured — cannot parse email body'])]
  }

  // Heuristic: skip if body is too short or looks like a generic email
  const text = bodyText.trim()
  if (text.length < 50) {
    return [emptyInvoice(['Email body too short to contain invoice data'])]
  }

  // Check for invoice-like signals in subject + body
  const invoiceSignals = /invoice|rechnung|factur|fattura|credit.?note|gutschrift|avoir|amount|total|€|\$|£|¥|betrag|montant/i
  if (!invoiceSignals.test(subject) && !invoiceSignals.test(text)) {
    return [emptyInvoice(['Email body does not appear to contain invoice data'])]
  }

  const anthropic = new Anthropic({ apiKey })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}${chartContext ? `\n\nCLIENT CONTEXT:\n${chartContext}` : ''}\n\nEmail subject: ${subject}\n\nEmail body:\n\n${text.slice(0, 8000)}`,
        },
      ],
    })

    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = extractJsonFromResponse(responseText)
    if (!parsed) {
      return [emptyInvoice(['Email body extraction returned no parseable JSON'])]
    }

    const rawItems = Array.isArray(parsed)
      ? (parsed as Array<Record<string, unknown>>)
      : [parsed as Record<string, unknown>]

    if (rawItems.length === 0) {
      return [emptyInvoice(['Email body extraction returned empty array'])]
    }

    return rawItems.map((extracted) => mapToParsedInvoice(extracted))
  } catch (err) {
    return [emptyInvoice([`Email body extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])]
  }
}

// ─── DOCX INVOICE PARSING ───────────────────────────────────────────────────

/**
 * Parse invoice data from a Word document (.docx).
 * Uses mammoth for text extraction, then Claude for structuring.
 * Common with small suppliers who create invoices in Word.
 */
export async function parseDocxInvoices(docxBuffer: Buffer, chartContext?: string): Promise<ParsedInvoice[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return [emptyInvoice(['ANTHROPIC_API_KEY not configured — cannot parse DOCX invoices'])]
  }

  let rawText: string
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: docxBuffer })
    rawText = result.value
  } catch (err) {
    return [emptyInvoice([`DOCX text extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])]
  }

  if (!rawText || rawText.trim().length < 20) {
    return [emptyInvoice(['DOCX contains no readable text'])]
  }

  const anthropic = new Anthropic({ apiKey })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}${chartContext ? `\n\nCLIENT CONTEXT:\n${chartContext}` : ''}\n\nInvoice text (extracted from Word document):\n\n${rawText.slice(0, 12000)}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = extractJsonFromResponse(text)
    if (!parsed) {
      return [emptyInvoice(['DOCX extraction returned no parseable JSON'])]
    }

    const rawItems = Array.isArray(parsed)
      ? (parsed as Array<Record<string, unknown>>)
      : [parsed as Record<string, unknown>]

    if (rawItems.length === 0) {
      return [emptyInvoice(['DOCX extraction returned empty array'])]
    }

    return rawItems.map((extracted) => mapToParsedInvoice(extracted))
  } catch (err) {
    return [emptyInvoice([`DOCX extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])]
  }
}

// ─── XLSX / CSV INVOICE PARSING ─────────────────────────────────────────────

/**
 * Parse invoice data from an Excel spreadsheet (.xlsx, .xls) or CSV.
 * Uses xlsx (SheetJS) for extraction, then Claude for structuring.
 * Common with suppliers who send billing summaries or multi-invoice spreadsheets.
 */
export async function parseSpreadsheetInvoices(buffer: Buffer, filename: string, chartContext?: string): Promise<ParsedInvoice[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return [emptyInvoice(['ANTHROPIC_API_KEY not configured — cannot parse spreadsheet invoices'])]
  }

  let rawText: string
  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Convert all sheets to text, separated by headers
    const sheets: string[] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet)
      if (csv.trim().length > 10) {
        sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`)
      }
    }
    rawText = sheets.join('\n\n')
  } catch (err) {
    return [emptyInvoice([`Spreadsheet parsing failed: ${err instanceof Error ? err.message : 'unknown error'}`])]
  }

  if (!rawText || rawText.trim().length < 20) {
    return [emptyInvoice(['Spreadsheet contains no readable data'])]
  }

  const anthropic = new Anthropic({ apiKey })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}${chartContext ? `\n\nCLIENT CONTEXT:\n${chartContext}` : ''}\n\nInvoice data (extracted from spreadsheet "${filename}"):\n\n${rawText.slice(0, 12000)}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = extractJsonFromResponse(text)
    if (!parsed) {
      return [emptyInvoice(['Spreadsheet extraction returned no parseable JSON'])]
    }

    const rawItems = Array.isArray(parsed)
      ? (parsed as Array<Record<string, unknown>>)
      : [parsed as Record<string, unknown>]

    if (rawItems.length === 0) {
      return [emptyInvoice(['Spreadsheet extraction returned empty array'])]
    }

    return rawItems.map((extracted) => mapToParsedInvoice(extracted))
  } catch (err) {
    return [emptyInvoice([`Spreadsheet extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])]
  }
}

// ─── JSON EXTRACTION ──────────────────────────────────────────────────────────

/**
 * Extract JSON (array or object) from Claude's response.
 * Handles markdown code fences, trailing text, arrays, and objects.
 */
function extractJsonFromResponse(text: string): unknown | null {
  // Strip markdown code fences if present
  const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim()

  // Try direct parse first (ideal case: clean JSON)
  try {
    return JSON.parse(stripped)
  } catch {
    // Fall through
  }

  // Try to find a JSON array
  const arrayStr = extractFirstJsonArray(stripped)
  if (arrayStr) {
    try {
      return JSON.parse(arrayStr)
    } catch {
      // Fall through
    }
  }

  // Try to find a JSON object
  const objStr = extractFirstJsonObject(stripped)
  if (objStr) {
    try {
      return JSON.parse(objStr)
    } catch {
      // Fall through
    }
  }

  return null
}

/**
 * Extract the first balanced JSON array [...] from text using bracket counting.
 */
function extractFirstJsonArray(text: string): string | null {
  const start = text.indexOf('[')
  if (start === -1) return null
  return extractBalanced(text, start, '[', ']')
}

/**
 * Extract the first balanced JSON object {...} from text using brace counting.
 */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  return extractBalanced(text, start, '{', '}')
}

/**
 * Generic balanced bracket extractor.
 * Handles strings (won't count brackets inside "...") and escapes.
 */
function extractBalanced(text: string, start: number, open: string, close: string): string | null {
  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (ch === '\\' && inString) {
      escape = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  return null
}

// ─── MAPPING ──────────────────────────────────────────────────────────────────

function mapToParsedInvoice(extracted: Record<string, unknown>): ParsedInvoice {
  const errors: string[] = []

  // Document type detection
  const rawDocType = String(extracted.documentType ?? 'invoice').toLowerCase()
  const documentType: DocumentType = rawDocType === 'credit_note' ? 'CREDIT_NOTE' : 'INVOICE'

  const invoiceNumber = String(extracted.invoiceNumber ?? '')
  if (!invoiceNumber) errors.push('Could not extract invoice number')

  const invoiceDateStr = String(extracted.invoiceDate ?? '')
  const invoiceDate = invoiceDateStr ? new Date(invoiceDateStr) : new Date()
  if (isNaN(invoiceDate.getTime())) errors.push('Invalid invoice date')

  const dueDateStr = extracted.dueDate ? String(extracted.dueDate) : null
  const dueDate = dueDateStr ? new Date(dueDateStr) : null

  const supplier = extracted.supplier as Record<string, unknown> | undefined
  const buyer = extracted.buyer as Record<string, unknown> | undefined
  const rawLineItems = (extracted.lineItems as Array<Record<string, unknown>>) ?? []

  const lineItems: ParsedLineItem[] = rawLineItems.map((item) => ({
    description: String(item.description ?? 'No description'),
    quantity: safeNumber(item.quantity, 1),
    unitPrice: safeNumber(item.unitPrice, 0),
    vatRate: safeNumber(item.vatRate, 0),
    lineTotal: safeNumber(item.lineTotal, 0),
    vatExemptionReason: item.vatExemptionReason ? String(item.vatExemptionReason) : null,
    suggestedAccountCode: item.suggestedAccountCode ? String(item.suggestedAccountCode) : null,
    accountCodeConfidence: item.accountCodeConfidence ? safeNumber(item.accountCodeConfidence, 0) : null,
  }))

  if (lineItems.length === 0) errors.push('No line items extracted')

  // VAT breakdown
  const rawVatBreakdown = (extracted.vatBreakdown as Array<Record<string, unknown>>) ?? []
  const vatBreakdown = rawVatBreakdown.map((entry) => ({
    rate: safeNumber(entry.rate, 0),
    taxableAmount: safeNumber(entry.taxableAmount, 0),
    vatAmount: safeNumber(entry.vatAmount, 0),
  }))

  // If AI didn't provide vatBreakdown, compute from line items
  const finalVatBreakdown = vatBreakdown.length > 0 ? vatBreakdown : computeVatBreakdown(lineItems)

  return {
    invoiceNumber,
    invoiceDate: isNaN(invoiceDate.getTime()) ? new Date() : invoiceDate,
    dueDate: dueDate && !isNaN(dueDate.getTime()) ? dueDate : null,
    currency: String(extracted.currency ?? 'EUR'),
    documentType,
    supplier: {
      name: String(supplier?.name ?? ''),
      vatNumber: supplier?.vatNumber ? String(supplier.vatNumber) : null,
      address: supplier?.address ? String(supplier.address) : null,
    },
    buyer: {
      name: String(buyer?.name ?? ''),
      vatNumber: buyer?.vatNumber ? String(buyer.vatNumber) : null,
      peppolId: null,
    },
    reverseCharge: Boolean(extracted.reverseCharge),
    vatExemptionReason: extracted.vatExemptionReason ? String(extracted.vatExemptionReason) : null,
    linkedInvoiceNumber: extracted.linkedInvoiceNumber ? String(extracted.linkedInvoiceNumber) : null,
    vatBreakdown: finalVatBreakdown,
    lineItems,
    netAmount: safeNumber(extracted.netAmount, 0),
    vatAmount: safeNumber(extracted.vatAmount, 0),
    grossAmount: safeNumber(extracted.grossAmount, 0),
    errors,
  }
}

/**
 * Compute VAT breakdown from line items when AI doesn't provide one.
 * Groups by VAT rate and sums taxable amounts + VAT.
 */
function computeVatBreakdown(lineItems: ParsedLineItem[]): Array<{ rate: number; taxableAmount: number; vatAmount: number }> {
  const grouped = new Map<number, { taxableAmount: number; vatAmount: number }>()
  for (const item of lineItems) {
    const existing = grouped.get(item.vatRate) ?? { taxableAmount: 0, vatAmount: 0 }
    existing.taxableAmount += item.lineTotal
    existing.vatAmount += Math.round(item.lineTotal * (item.vatRate / 100) * 100) / 100
    grouped.set(item.vatRate, existing)
  }
  return Array.from(grouped.entries()).map(([rate, { taxableAmount, vatAmount }]) => ({
    rate,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
  }))
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function safeNumber(value: unknown, fallback: number): number {
  const n = Number(value)
  return isNaN(n) ? fallback : Math.round(n * 100) / 100
}

function emptyInvoice(errors: string[]): ParsedInvoice {
  return {
    invoiceNumber: '',
    invoiceDate: new Date(),
    dueDate: null,
    currency: 'EUR',
    documentType: 'INVOICE',
    supplier: { name: '', vatNumber: null, address: null },
    buyer: { name: '', vatNumber: null, peppolId: null },
    reverseCharge: false,
    vatExemptionReason: null,
    linkedInvoiceNumber: null,
    vatBreakdown: [],
    lineItems: [],
    netAmount: 0,
    vatAmount: 0,
    grossAmount: 0,
    errors,
  }
}
