/**
 * PDF Invoice Parser
 *
 * Extracts structured invoice data from PDF files.
 * Uses pdfjs-dist (Mozilla PDF.js) for text extraction, then Claude for structuring.
 *
 * Returns the same ParsedInvoice shape as the UBL parser so the rest
 * of the pipeline doesn't care where the invoice came from.
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

const EXTRACTION_PROMPT = `You are an invoice data extraction system. Extract structured data from this invoice text.

Return a JSON object with EXACTLY this shape (no markdown, no explanation, just the JSON):

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

Rules:
- All amounts as numbers (not strings), using period as decimal separator
- VAT rate as percentage (e.g., 19 not 0.19)
- If you can't find a field, use null for strings or 0 for numbers
- invoiceDate and dueDate in YYYY-MM-DD format
- If only one total is visible, put it in grossAmount and estimate net/VAT from context
- Extract ALL line items visible in the invoice
- Currency should be 3-letter ISO code
- If the PDF contains multiple invoices, extract only the FIRST one
- Return exactly ONE JSON object, nothing else — no arrays, no multiple objects, no explanation`

/**
 * Parse a PDF invoice into structured data using AI extraction.
 */
export async function parsePdfInvoice(pdfBuffer: Buffer): Promise<ParsedInvoice> {
  const errors: string[] = []

  // Step 1: Extract raw text
  let rawText: string
  try {
    rawText = await extractTextFromPdf(pdfBuffer)
  } catch (err) {
    return emptyInvoice([`PDF text extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])
  }

  if (!rawText || rawText.trim().length < 20) {
    return emptyInvoice(['PDF contains no readable text — may be a scanned image'])
  }

  // Step 2: Use Claude to structure the data
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return emptyInvoice(['ANTHROPIC_API_KEY not configured — cannot parse PDF invoices'])
  }

  const anthropic = new Anthropic({ apiKey })

  let extracted: Record<string, unknown>
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\nInvoice text:\n\n${rawText.slice(0, 8000)}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract the first complete JSON object from the response
    // (handles markdown wrapping, multiple objects, or trailing commentary)
    const jsonStr = extractFirstJsonObject(text)
    if (!jsonStr) {
      return emptyInvoice(['AI extraction returned no JSON'])
    }

    extracted = JSON.parse(jsonStr)
  } catch (err) {
    return emptyInvoice([`AI extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`])
  }

  // Step 3: Map to ParsedInvoice
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

/**
 * Extract the first balanced JSON object from a string.
 * Handles markdown code fences, trailing text, and multiple JSON objects.
 */
function extractFirstJsonObject(text: string): string | null {
  // First, try to extract from a markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (fenceMatch) {
    try {
      JSON.parse(fenceMatch[1])
      return fenceMatch[1]
    } catch {
      // Fall through to brace-counting approach
    }
  }

  // Find the first '{' and count braces to find the matching '}'
  const start = text.indexOf('{')
  if (start === -1) return null

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

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  return null
}

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
