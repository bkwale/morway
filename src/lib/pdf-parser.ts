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
import type { ParsedInvoice, ParsedLineItem } from './ubl-parser'

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // unpdf: serverless-compatible PDF text extraction (no DOM/DOMMatrix needed)
  const { extractText } = await import('unpdf')
  const result = await extractText(new Uint8Array(buffer))
  const text = result.text
  return Array.isArray(text) ? text.join('\n\n') : (text ?? '')
}

const EXTRACTION_PROMPT = `You are an invoice data extraction system. Extract structured data from invoice text.

The PDF may contain ONE or MULTIPLE invoices. Return a JSON array of invoice objects.

Return ONLY a JSON array (no markdown, no explanation, no code fences), like this:

[
  {
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
    "lineItems": [
      {
        "description": "string",
        "quantity": number,
        "unitPrice": number,
        "vatRate": number,
        "lineTotal": number
      }
    ],
    "netAmount": number,
    "vatAmount": number,
    "grossAmount": number
  }
]

Rules:
- All amounts as numbers (not strings), using period as decimal separator
- VAT rate as percentage (e.g., 19 not 0.19)
- If you can't find a field, use null for strings or 0 for numbers
- invoiceDate and dueDate in YYYY-MM-DD format
- If only one total is visible, put it in grossAmount and estimate net/VAT from context
- Extract ALL line items visible in each invoice
- Currency should be 3-letter ISO code
- If there is only ONE invoice, still return it inside an array: [{ ... }]
- Extract EVERY invoice found in the text — do not skip any
- Return ONLY the JSON array, nothing else`

/**
 * Parse a PDF that may contain one or more invoices.
 * Returns an array of ParsedInvoice (one per invoice found).
 */
export async function parsePdfInvoices(pdfBuffer: Buffer): Promise<ParsedInvoice[]> {
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
          content: `${EXTRACTION_PROMPT}\n\nInvoice text:\n\n${rawText.slice(0, 12000)}`,
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
  }))

  if (lineItems.length === 0) errors.push('No line items extracted')

  return {
    invoiceNumber,
    invoiceDate: isNaN(invoiceDate.getTime()) ? new Date() : invoiceDate,
    dueDate: dueDate && !isNaN(dueDate.getTime()) ? dueDate : null,
    currency: String(extracted.currency ?? 'EUR'),
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
    lineItems,
    netAmount: safeNumber(extracted.netAmount, 0),
    vatAmount: safeNumber(extracted.vatAmount, 0),
    grossAmount: safeNumber(extracted.grossAmount, 0),
    errors,
  }
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
    supplier: { name: '', vatNumber: null, address: null },
    buyer: { name: '', vatNumber: null, peppolId: null },
    lineItems: [],
    netAmount: 0,
    vatAmount: 0,
    grossAmount: 0,
    errors,
  }
}
