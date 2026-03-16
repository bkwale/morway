/**
 * FEC (Fichier des Écritures Comptables) export for France.
 *
 * Since 1 January 2014, every French company with computerised accounting
 * must be able to produce an FEC file for tax audits (contrôle fiscal).
 * Non-compliance = €5,000 fine per fiscal year.
 *
 * Format: Pipe-delimited (|) flat file with 18 mandatory columns.
 * Encoding: UTF-8 (recommended by DGFIP since 2020)
 * Dates: YYYYMMDD (without separator)
 * Amounts: Comma decimal separator (French locale), no thousands separator
 * File naming: {SIREN}FEC{YYYYMMDD}.txt — where YYYYMMDD is fiscal year end
 *
 * Reference: Article A47 A-1 du Livre des Procédures Fiscales
 * Spec: https://www.legifrance.gouv.fr/
 *
 * The 18 columns:
 *   1. JournalCode     — Journal code (e.g., "ACH" for achats/purchases)
 *   2. JournalLib      — Journal label
 *   3. EcritureNum     — Entry number (unique, sequential)
 *   4. EcritureDate    — Entry date (YYYYMMDD)
 *   5. CompteNum       — Account number (PCG — Plan Comptable Général)
 *   6. CompteLib       — Account label
 *   7. CompAuxNum      — Auxiliary account number (supplier/customer)
 *   8. CompAuxLib      — Auxiliary account label
 *   9. PieceRef        — Supporting document reference
 *  10. PieceDate       — Supporting document date (YYYYMMDD)
 *  11. EcritureLib     — Entry description
 *  12. Debit           — Debit amount (comma decimal)
 *  13. Credit          — Credit amount (comma decimal)
 *  14. EcritureLet     — Lettering code (reconciliation)
 *  15. DateLet         — Lettering date
 *  16. ValidDate       — Validation date (YYYYMMDD)
 *  17. Montantdevise   — Amount in foreign currency
 *  18. Idevise         — Currency code (ISO 4217)
 */

import { db } from '../db'
import type { AccountingAdapter, BillPayload, PostResult, ContactResult } from './types'

// ─── FEC COLUMN HEADERS ──────────────────────────────────────────────────────

const FEC_COLUMNS = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
] as const

// ─── PCG (Plan Comptable Général) — COMMON PURCHASE ACCOUNTS ─────────────────

/**
 * Standard French chart of accounts (PCG) mappings.
 * For purchase invoices (achats fournisseurs):
 *   - Class 6: Charges (expenses)
 *   - Class 4: Fournisseurs (supplier accounts start at 401)
 *   - 445660: TVA déductible sur ABS (input VAT on goods/services)
 */
const SUPPLIER_ACCOUNT_PREFIX = '401'  // Fournisseurs
const TVA_DEDUCTIBLE_ACCOUNT = '445660'  // TVA déductible sur ABS

// ─── FORMAT HELPERS ──────────────────────────────────────────────────────────

/** Format amount with comma as decimal separator (French locale) */
function formatAmount(amount: number): string {
  if (amount === 0) return '0,00'
  return Math.abs(amount).toFixed(2).replace('.', ',')
}

/** Format date as YYYYMMDD (FEC date format) */
function formatDateFEC(date: Date): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}${m}${d}`
}

/** Escape a field for FEC (pipe-delimited — pipes in content must be removed) */
function escapeField(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return ''
  return String(value).replace(/\|/g, ' ').replace(/\n/g, ' ')
}

// ─── FEC EXPORT FUNCTION ─────────────────────────────────────────────────────

export interface FECExportOptions {
  clientId: string
  invoiceIds?: string[]
  sirenNumber?: string          // Company SIREN number (for filename)
  fiscalYearEnd?: Date          // End of fiscal year (for filename)
}

/**
 * Generate an FEC-compliant file for approved/auto-posted purchase invoices.
 *
 * For each invoice, generates 2-3 entry lines (double-entry bookkeeping):
 *   1. Debit: Expense account (class 6) for net amount
 *   2. Debit: TVA déductible (445660) for VAT amount
 *   3. Credit: Supplier account (401xxx) for gross amount
 */
export async function generateFECExport(options: FECExportOptions): Promise<{
  content: string
  filename: string
}> {
  const client = await db.client.findUnique({ where: { id: options.clientId } })
  if (!client) throw new Error(`Client ${options.clientId} not found`)

  // Fetch invoices
  const where: Record<string, unknown> = {
    clientId: options.clientId,
    status: { in: ['AUTO_POSTED', 'APPROVED'] },
  }
  if (options.invoiceIds?.length) {
    where.id = { in: options.invoiceIds }
  }

  const invoices = await db.invoice.findMany({
    where,
    include: {
      lineItems: true,
      supplier: true,
    },
    orderBy: { invoiceDate: 'asc' },
  })

  if (invoices.length === 0) {
    throw new Error('No invoices to export')
  }

  // Build rows
  const rows: string[] = []

  // Header row
  rows.push(FEC_COLUMNS.join('|'))

  let entryNum = 1
  const today = formatDateFEC(new Date())

  for (const invoice of invoices) {
    const supplierName = invoice.supplier?.name ?? 'Fournisseur inconnu'
    const supplierAccount = `${SUPPLIER_ACCOUNT_PREFIX}${String(entryNum).padStart(5, '0')}`
    const invoiceRef = (invoice.invoiceNumber ?? `MRW-${entryNum}`).slice(0, 20)
    const invoiceDate = formatDateFEC(invoice.invoiceDate)
    const entryNumStr = String(entryNum).padStart(6, '0')

    // Line items — debit expense accounts
    for (const line of invoice.lineItems) {
      const accountCode = line.accountCode || '607000'  // Default: Achats de marchandises
      const accountLabel = escapeField(line.description ?? 'Achat')
      const netAmount = Math.abs(line.lineTotal - (line.lineTotal * line.vatRate / (100 + line.vatRate)))

      // Debit: Expense account (net amount)
      rows.push([
        'ACH',                                          // JournalCode
        'Journal des achats',                           // JournalLib
        entryNumStr,                                    // EcritureNum
        invoiceDate,                                    // EcritureDate
        escapeField(accountCode),                       // CompteNum
        escapeField(accountLabel.slice(0, 50)),         // CompteLib
        '',                                             // CompAuxNum
        '',                                             // CompAuxLib
        escapeField(invoiceRef),                        // PieceRef
        invoiceDate,                                    // PieceDate
        escapeField(`${supplierName} - ${line.description ?? ''}`.slice(0, 100)),  // EcritureLib
        formatAmount(netAmount),                        // Debit
        '0,00',                                         // Credit
        '',                                             // EcritureLet
        '',                                             // DateLet
        today,                                          // ValidDate
        invoice.currency !== 'EUR' ? formatAmount(netAmount) : '',  // Montantdevise
        invoice.currency !== 'EUR' ? invoice.currency : '',         // Idevise
      ].join('|'))

      // Debit: TVA déductible (VAT amount) — only if VAT > 0
      const vatAmount = Math.abs(line.lineTotal * line.vatRate / (100 + line.vatRate))
      if (vatAmount > 0.005) {
        rows.push([
          'ACH',
          'Journal des achats',
          entryNumStr,
          invoiceDate,
          TVA_DEDUCTIBLE_ACCOUNT,
          `TVA deductible ${line.vatRate}%`,
          '',
          '',
          escapeField(invoiceRef),
          invoiceDate,
          escapeField(`TVA - ${supplierName}`.slice(0, 100)),
          formatAmount(vatAmount),
          '0,00',
          '',
          '',
          today,
          '',
          '',
        ].join('|'))
      }
    }

    // Credit: Supplier account (gross amount)
    rows.push([
      'ACH',
      'Journal des achats',
      entryNumStr,
      invoiceDate,
      supplierAccount,
      escapeField(supplierName.slice(0, 50)),
      supplierAccount,
      escapeField(supplierName.slice(0, 50)),
      escapeField(invoiceRef),
      invoiceDate,
      escapeField(`Facture ${invoiceRef} - ${supplierName}`.slice(0, 100)),
      '0,00',
      formatAmount(invoice.grossAmount),
      '',
      '',
      today,
      invoice.currency !== 'EUR' ? formatAmount(invoice.grossAmount) : '',
      invoice.currency !== 'EUR' ? invoice.currency : '',
    ].join('|'))

    entryNum++
  }

  // Generate filename per FEC naming convention: {SIREN}FEC{YYYYMMDD}.txt
  const siren = options.sirenNumber ?? '000000000'
  const fyEnd = options.fiscalYearEnd
    ? formatDateFEC(options.fiscalYearEnd)
    : formatDateFEC(new Date(new Date().getFullYear(), 11, 31))
  const filename = `${siren}FEC${fyEnd}.txt`

  return {
    content: rows.join('\r\n') + '\r\n',
    filename,
  }
}

// ─── FEC ADAPTER (implements AccountingAdapter) ──────────────────────────────

export const fecAdapter: AccountingAdapter = {
  name: 'FEC (France)',
  isRealTime: false,

  async isConnected(clientId: string): Promise<boolean> {
    const client = await db.client.findUnique({ where: { id: clientId } })
    return client?.accountingSystem === 'FEC'
  },

  async findOrCreateContact(
    _clientId: string,
    supplier: { name: string; vatNumber: string | null }
  ): Promise<ContactResult | null> {
    return {
      contactId: supplier.vatNumber ?? SUPPLIER_ACCOUNT_PREFIX,
      name: supplier.name,
    }
  },

  async postBill(
    _clientId: string,
    _contactId: string,
    _bill: BillPayload
  ): Promise<PostResult> {
    return {
      success: true,
      externalId: null,
      externalRef: 'FEC_EXPORT_PENDING',
    }
  },
}
