/**
 * VAT Breakdown Computation Tests
 *
 * Tests the function that groups line items by VAT rate
 * and computes taxable amounts + VAT per rate.
 * Used for Umsatzsteuervoranmeldung preparation.
 */
import { describe, it, expect } from 'vitest'
import { computeVatBreakdown } from '@/lib/pdf-parser'

function makeLineItem(overrides: {
  vatRate: number
  lineTotal: number
  description?: string
}) {
  return {
    description: overrides.description ?? 'Test item',
    quantity: 1,
    unitPrice: overrides.lineTotal,
    vatRate: overrides.vatRate,
    lineTotal: overrides.lineTotal,
    accountCode: null,
    accountCodeConfidence: null,
    vatExemptionReason: null,
  }
}

describe('computeVatBreakdown', () => {
  it('groups line items by VAT rate', () => {
    const items = [
      makeLineItem({ vatRate: 19, lineTotal: 1000 }),
      makeLineItem({ vatRate: 7, lineTotal: 500 }),
      makeLineItem({ vatRate: 19, lineTotal: 2000 }),
    ]

    const breakdown = computeVatBreakdown(items)

    expect(breakdown).toHaveLength(2)

    const rate19 = breakdown.find((b) => b.rate === 19)
    expect(rate19).toBeDefined()
    expect(rate19!.taxableAmount).toBe(3000)
    expect(rate19!.vatAmount).toBe(570) // 3000 * 0.19

    const rate7 = breakdown.find((b) => b.rate === 7)
    expect(rate7).toBeDefined()
    expect(rate7!.taxableAmount).toBe(500)
    expect(rate7!.vatAmount).toBe(35) // 500 * 0.07
  })

  it('handles zero-rate items (reverse charge / exempt)', () => {
    const items = [
      makeLineItem({ vatRate: 0, lineTotal: 5000 }),
      makeLineItem({ vatRate: 19, lineTotal: 200 }),
    ]

    const breakdown = computeVatBreakdown(items)

    const rate0 = breakdown.find((b) => b.rate === 0)
    expect(rate0).toBeDefined()
    expect(rate0!.taxableAmount).toBe(5000)
    expect(rate0!.vatAmount).toBe(0)
  })

  it('returns empty array for no line items', () => {
    expect(computeVatBreakdown([])).toEqual([])
  })

  it('rounds to 2 decimal places', () => {
    const items = [
      makeLineItem({ vatRate: 19, lineTotal: 33.33 }),
      makeLineItem({ vatRate: 19, lineTotal: 66.67 }),
    ]

    const breakdown = computeVatBreakdown(items)
    const rate19 = breakdown.find((b) => b.rate === 19)

    expect(rate19!.taxableAmount).toBe(100)
    expect(rate19!.vatAmount).toBe(19) // 33.33*0.19 + 66.67*0.19 = 6.33 + 12.67 = 19.00
  })

  it('handles single line item', () => {
    const items = [makeLineItem({ vatRate: 7, lineTotal: 100 })]

    const breakdown = computeVatBreakdown(items)

    expect(breakdown).toHaveLength(1)
    expect(breakdown[0]).toEqual({
      rate: 7,
      taxableAmount: 100,
      vatAmount: 7,
    })
  })
})
