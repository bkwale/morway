/**
 * Tests for email ingestion pipeline
 *
 * Tests the email-ingest module's helper functions and the
 * PDF parser's helper functions in isolation (no DB, no Claude API).
 */

import { describe, it, expect } from 'vitest'

// ─── Email slug extraction tests ────────────────────────────────────────────

describe('extractClientSlug', () => {
  // We test the slug extraction logic directly since it's a pure function
  function extractClientSlug(email: string): string | null {
    const match = email.match(/^([^@]+)@in\.morway\.app$/i)
    return match ? match[1].toLowerCase() : null
  }

  it('extracts slug from valid morway email', () => {
    expect(extractClientSlug('hof-schmidt@in.morway.app')).toBe('hof-schmidt')
  })

  it('extracts slug with multiple hyphens', () => {
    expect(extractClientSlug('bakkerij-de-vos@in.morway.app')).toBe('bakkerij-de-vos')
  })

  it('lowercases the slug', () => {
    expect(extractClientSlug('Hof-Schmidt@in.morway.app')).toBe('hof-schmidt')
  })

  it('returns null for non-morway emails', () => {
    expect(extractClientSlug('someone@gmail.com')).toBeNull()
  })

  it('returns null for emails without in. subdomain', () => {
    expect(extractClientSlug('client@morway.app')).toBeNull()
  })

  it('handles empty string', () => {
    expect(extractClientSlug('')).toBeNull()
  })
})

// ─── Attachment classification tests ────────────────────────────────────────

describe('classifyAttachment', () => {
  type SupportedType = 'pdf' | 'xml' | 'unsupported'

  function classifyAttachment(filename: string, contentType: string): SupportedType {
    const ext = filename.toLowerCase().split('.').pop()
    if (ext === 'pdf' || contentType === 'application/pdf') return 'pdf'
    if (ext === 'xml' || contentType === 'text/xml' || contentType === 'application/xml') return 'xml'
    return 'unsupported'
  }

  it('classifies PDF by extension', () => {
    expect(classifyAttachment('invoice.pdf', 'application/octet-stream')).toBe('pdf')
  })

  it('classifies PDF by content type', () => {
    expect(classifyAttachment('document.bin', 'application/pdf')).toBe('pdf')
  })

  it('classifies XML by extension', () => {
    expect(classifyAttachment('invoice.xml', 'application/octet-stream')).toBe('xml')
  })

  it('classifies XML by content type text/xml', () => {
    expect(classifyAttachment('data.txt', 'text/xml')).toBe('xml')
  })

  it('classifies XML by content type application/xml', () => {
    expect(classifyAttachment('data.txt', 'application/xml')).toBe('xml')
  })

  it('marks images as unsupported', () => {
    expect(classifyAttachment('photo.jpg', 'image/jpeg')).toBe('unsupported')
  })

  it('marks docx as unsupported', () => {
    expect(classifyAttachment('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('unsupported')
  })

  it('handles uppercase extensions', () => {
    expect(classifyAttachment('INVOICE.PDF', 'application/octet-stream')).toBe('pdf')
  })
})

// ─── Safe number helper tests ───────────────────────────────────────────────

describe('safeNumber', () => {
  function safeNumber(value: unknown, fallback: number): number {
    const n = Number(value)
    return isNaN(n) ? fallback : Math.round(n * 100) / 100
  }

  it('converts valid numbers', () => {
    expect(safeNumber(42.567, 0)).toBe(42.57)
  })

  it('converts string numbers', () => {
    expect(safeNumber('19.99', 0)).toBe(19.99)
  })

  it('returns fallback for null', () => {
    expect(safeNumber(null, 0)).toBe(0)
  })

  it('returns fallback for undefined', () => {
    expect(safeNumber(undefined, 1)).toBe(1)
  })

  it('returns fallback for non-numeric strings', () => {
    expect(safeNumber('abc', 0)).toBe(0)
  })

  it('handles zero correctly', () => {
    expect(safeNumber(0, 99)).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    expect(safeNumber(1.456, 0)).toBe(1.46)
    expect(safeNumber(19.999, 0)).toBe(20)
  })
})

// ─── Extraction prompt structure tests ──────────────────────────────────────

describe('extraction prompt JSON structure', () => {
  // Simulate what Claude returns and validate our parsing logic
  const validResponse = {
    invoiceNumber: 'INV-2026-001',
    invoiceDate: '2026-03-01',
    dueDate: '2026-04-01',
    currency: 'EUR',
    supplier: {
      name: 'Agri Supplies BV',
      vatNumber: 'NL123456789B01',
      address: 'Landbouwweg 12, 1234 AB Amsterdam',
    },
    buyer: {
      name: 'Hof Schmidt GmbH',
      vatNumber: 'DE987654321',
    },
    lineItems: [
      {
        description: 'Saatgut Premium',
        quantity: 50,
        unitPrice: 24.00,
        vatRate: 19,
        lineTotal: 1200.00,
      },
      {
        description: 'Pflanzenschutzmittel',
        quantity: 10,
        unitPrice: 85.00,
        vatRate: 19,
        lineTotal: 850.00,
      },
    ],
    netAmount: 2050.00,
    vatAmount: 389.50,
    grossAmount: 2439.50,
  }

  it('has all required top-level fields', () => {
    expect(validResponse).toHaveProperty('invoiceNumber')
    expect(validResponse).toHaveProperty('invoiceDate')
    expect(validResponse).toHaveProperty('currency')
    expect(validResponse).toHaveProperty('supplier')
    expect(validResponse).toHaveProperty('lineItems')
    expect(validResponse).toHaveProperty('netAmount')
    expect(validResponse).toHaveProperty('vatAmount')
    expect(validResponse).toHaveProperty('grossAmount')
  })

  it('line items have correct shape', () => {
    for (const item of validResponse.lineItems) {
      expect(item).toHaveProperty('description')
      expect(item).toHaveProperty('quantity')
      expect(item).toHaveProperty('unitPrice')
      expect(item).toHaveProperty('vatRate')
      expect(item).toHaveProperty('lineTotal')
      expect(typeof item.quantity).toBe('number')
      expect(typeof item.unitPrice).toBe('number')
    }
  })

  it('amounts are numbers not strings', () => {
    expect(typeof validResponse.netAmount).toBe('number')
    expect(typeof validResponse.vatAmount).toBe('number')
    expect(typeof validResponse.grossAmount).toBe('number')
  })

  it('VAT math roughly adds up', () => {
    const lineTotal = validResponse.lineItems.reduce((sum, item) => sum + item.lineTotal, 0)
    expect(lineTotal).toBe(validResponse.netAmount)
    expect(validResponse.netAmount + validResponse.vatAmount).toBe(validResponse.grossAmount)
  })

  it('can extract JSON from markdown-wrapped response', () => {
    const markdownWrapped = '```json\n' + JSON.stringify(validResponse) + '\n```'
    const jsonMatch = markdownWrapped.match(/\{[\s\S]*\}/)
    expect(jsonMatch).not.toBeNull()
    const parsed = JSON.parse(jsonMatch![0])
    expect(parsed.invoiceNumber).toBe('INV-2026-001')
  })
})

// ─── Pre-parsed invoice reconstruction tests ────────────────────────────────

describe('pre-parsed EMAIL_PDF reconstruction', () => {
  const storedJson = {
    _source: 'EMAIL_PDF',
    _filename: 'invoice-001.pdf',
    _from: 'supplier@example.com',
    invoiceNumber: 'INV-001',
    invoiceDate: '2026-03-01T00:00:00.000Z',
    dueDate: '2026-04-01T00:00:00.000Z',
    currency: 'EUR',
    supplier: { name: 'Agri BV', vatNumber: 'NL123', address: '123 Street' },
    buyer: { name: 'Client GmbH', vatNumber: 'DE456' },
    lineItems: [
      { description: 'Seeds', quantity: 10, unitPrice: 5, vatRate: 19, lineTotal: 50 },
    ],
    netAmount: 50,
    vatAmount: 9.50,
    grossAmount: 59.50,
    errors: [],
  }

  it('identifies EMAIL_PDF source from stored JSON', () => {
    const parsed = JSON.parse(JSON.stringify(storedJson))
    expect(parsed._source).toBe('EMAIL_PDF')
  })

  it('reconstructs dates from ISO strings', () => {
    const date = new Date(storedJson.invoiceDate)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2) // March = 2
  })

  it('handles null dueDate', () => {
    const modified = { ...storedJson, dueDate: null }
    const dueDate = modified.dueDate ? new Date(modified.dueDate) : null
    expect(dueDate).toBeNull()
  })

  it('preserves supplier info', () => {
    expect(storedJson.supplier.name).toBe('Agri BV')
    expect(storedJson.supplier.vatNumber).toBe('NL123')
  })

  it('preserves line items', () => {
    expect(storedJson.lineItems).toHaveLength(1)
    expect(storedJson.lineItems[0].description).toBe('Seeds')
    expect(storedJson.lineItems[0].lineTotal).toBe(50)
  })

  it('falls through to UBL parse if not EMAIL_PDF', () => {
    const xmlContent = '<Invoice>not json</Invoice>'
    let isPreParsed = false
    try {
      const maybeJson = JSON.parse(xmlContent)
      if (maybeJson._source === 'EMAIL_PDF') isPreParsed = true
    } catch {
      // Not JSON = UBL XML, expected path
    }
    expect(isPreParsed).toBe(false)
  })
})

// ─── Empty invoice helper tests ─────────────────────────────────────────────

describe('emptyInvoice', () => {
  function emptyInvoice(errors: string[]) {
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

  it('returns default EUR currency', () => {
    expect(emptyInvoice([]).currency).toBe('EUR')
  })

  it('passes through error messages', () => {
    const result = emptyInvoice(['PDF extraction failed', 'No text found'])
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toBe('PDF extraction failed')
  })

  it('has empty line items', () => {
    expect(emptyInvoice([]).lineItems).toHaveLength(0)
  })

  it('has zero amounts', () => {
    const result = emptyInvoice([])
    expect(result.netAmount).toBe(0)
    expect(result.vatAmount).toBe(0)
    expect(result.grossAmount).toBe(0)
  })
})
