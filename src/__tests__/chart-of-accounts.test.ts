/**
 * Chart of Accounts Tests
 *
 * Tests that chart-of-accounts context generation works correctly
 * for different accounting systems and countries.
 */
import { describe, it, expect } from 'vitest'
import { getCodeList, getChartForClient, getChartPromptContext } from '@/lib/chart-of-accounts'

describe('getCodeList', () => {
  it('returns SKR03 codes for DATEV', () => {
    const codes = getCodeList('DATEV', 'DE')
    expect(codes.length).toBeGreaterThan(0)
    // SKR03 uses 4-digit codes
    codes.forEach((code) => {
      expect(code.code).toMatch(/^\d{4}$/)
      expect(code.label).toBeTruthy()
    })
  })

  it('returns SKR03 codes for LEXWARE', () => {
    const codes = getCodeList('LEXWARE', 'DE')
    expect(codes.length).toBeGreaterThan(0)
  })

  it('returns PCG codes for FEC', () => {
    const codes = getCodeList('FEC', 'FR')
    expect(codes.length).toBeGreaterThan(0)
    // PCG uses 4-digit codes starting with 6 (expenses)
    const expenseCodes = codes.filter((c) => c.code.startsWith('6'))
    expect(expenseCodes.length).toBeGreaterThan(0)
  })

  it('returns RGS codes for EXACT_ONLINE with NL country', () => {
    const codes = getCodeList('EXACT_ONLINE', 'NL')
    expect(codes.length).toBeGreaterThan(0)
  })

  it('falls back to a chart for unknown system (never empty)', () => {
    // getChartForClient falls back to PCG when no match
    const codes = getCodeList('NONEXISTENT', 'DE')
    expect(codes.length).toBeGreaterThan(0)
  })
})

describe('getChartForClient', () => {
  it('returns DATEV chart for DATEV system', () => {
    const chart = getChartForClient('DATEV', 'DE')
    expect(chart).toBeDefined()
    expect(chart!.system).toBe('DATEV')
    expect(chart!.label).toContain('SKR03')
  })

  it('returns LEXWARE chart matching DATEV/SKR03', () => {
    const chart = getChartForClient('LEXWARE', 'DE')
    expect(chart).toBeDefined()
    expect(chart!.label).toContain('SKR03')
  })

  it('falls back to country chart for XERO (no direct match)', () => {
    // XERO has no chart in CHARTS array, falls back to country or PCG
    const chart = getChartForClient('XERO', 'UK')
    expect(chart).toBeDefined()
    // Should still return something — either country fallback or PCG
    expect(chart!.codes.length).toBeGreaterThan(0)
  })

  it('always returns a chart (never null due to PCG fallback)', () => {
    const chart = getChartForClient('NONE')
    expect(chart).toBeDefined()
  })
})

describe('getChartPromptContext', () => {
  it('generates prompt context for DATEV/DE/general with SKR03 reference', () => {
    const context = getChartPromptContext('DATEV', 'DE', 'general')
    expect(context).toContain('SKR03')
    // Should contain actual account codes
    expect(context).toMatch(/\d{4}/)
  })

  it('generates prompt context for FEC/FR/general with PCG reference', () => {
    const context = getChartPromptContext('FEC', 'FR', 'general')
    expect(context).toContain('PCG')
  })

  it('generates non-empty context for XERO (fallback chart)', () => {
    const context = getChartPromptContext('XERO', 'UK', 'general')
    // Falls back to a chart, so context is not empty
    expect(context.length).toBeGreaterThan(0)
  })

  it('includes industry in context string', () => {
    const context = getChartPromptContext('DATEV', 'DE', 'agriculture')
    expect(context).toContain('agriculture')
  })
})
