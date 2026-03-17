/**
 * Reverse Charge Detection Tests
 *
 * Tests the heuristic that identifies EU intra-community reverse charge invoices.
 * Detection criteria: both parties have VAT numbers, different country prefixes,
 * and VAT amount is negligible (< 1% of net).
 */
import { describe, it, expect } from 'vitest'
import { detectReverseCharge } from '@/lib/invoice-processor'

function makeParsed(overrides: {
  supplierVat?: string | null
  buyerVat?: string | null
  netAmount?: number
  vatAmount?: number
}) {
  return {
    invoiceNumber: 'INV-001',
    invoiceDate: new Date(),
    dueDate: null,
    currency: 'EUR',
    documentType: 'INVOICE' as const,
    supplier: { name: 'Test GmbH', vatNumber: overrides.supplierVat ?? null, address: null },
    buyer: { name: 'Buyer SRL', vatNumber: overrides.buyerVat ?? null, peppolId: null },
    lineItems: [],
    netAmount: overrides.netAmount ?? 1000,
    vatAmount: overrides.vatAmount ?? 0,
    grossAmount: (overrides.netAmount ?? 1000) + (overrides.vatAmount ?? 0),
    errors: [],
    reverseCharge: false,
    vatExemptionReason: null,
    linkedInvoiceNumber: null,
    vatBreakdown: [],
  }
}

describe('detectReverseCharge', () => {
  it('detects cross-border reverse charge: DE supplier → NL buyer, zero VAT', () => {
    const parsed = makeParsed({
      supplierVat: 'DE123456789',
      buyerVat: 'NL123456789B01',
      netAmount: 5000,
      vatAmount: 0,
    })
    expect(detectReverseCharge(parsed)).toBe(true)
  })

  it('detects cross-border reverse charge: FR supplier → DE buyer, negligible VAT', () => {
    const parsed = makeParsed({
      supplierVat: 'FR12345678901',
      buyerVat: 'DE987654321',
      netAmount: 10000,
      vatAmount: 5, // 0.05% — negligible
    })
    expect(detectReverseCharge(parsed)).toBe(true)
  })

  it('returns false when same country (domestic transaction)', () => {
    const parsed = makeParsed({
      supplierVat: 'DE123456789',
      buyerVat: 'DE987654321',
      netAmount: 1000,
      vatAmount: 0,
    })
    expect(detectReverseCharge(parsed)).toBe(false)
  })

  it('returns false when VAT is substantial (not reverse charge)', () => {
    const parsed = makeParsed({
      supplierVat: 'DE123456789',
      buyerVat: 'NL123456789B01',
      netAmount: 1000,
      vatAmount: 190, // 19% — normal German VAT
    })
    expect(detectReverseCharge(parsed)).toBe(false)
  })

  it('returns false when supplier VAT is missing', () => {
    const parsed = makeParsed({
      supplierVat: null,
      buyerVat: 'NL123456789B01',
      netAmount: 1000,
      vatAmount: 0,
    })
    expect(detectReverseCharge(parsed)).toBe(false)
  })

  it('returns false when buyer VAT is missing', () => {
    const parsed = makeParsed({
      supplierVat: 'DE123456789',
      buyerVat: null,
      netAmount: 1000,
      vatAmount: 0,
    })
    expect(detectReverseCharge(parsed)).toBe(false)
  })

  it('returns false when net amount is zero (avoids division by zero)', () => {
    const parsed = makeParsed({
      supplierVat: 'DE123456789',
      buyerVat: 'NL123456789B01',
      netAmount: 0,
      vatAmount: 0,
    })
    expect(detectReverseCharge(parsed)).toBe(false)
  })

  it('handles case-insensitive country codes', () => {
    const parsed = makeParsed({
      supplierVat: 'de123456789',
      buyerVat: 'nl123456789B01',
      netAmount: 5000,
      vatAmount: 0,
    })
    expect(detectReverseCharge(parsed)).toBe(true)
  })
})
