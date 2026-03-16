/**
 * Lexware buchhalter Buchungsdaten (booking data) export.
 *
 * Generates a standards-compliant text file that can be imported via
 * Lexware buchhalter's "Datei → Import → Text/ASCII" interface.
 *
 * Format spec: Lexware Importschnittstelle Personenkonten und Buchungsdaten
 * Source:      https://media.haufe-group.com/ShopData/media/pegasus/attachments/2/
 *              Import%20Personenkonten%20und%20Buchungsdaten%20Standard.pdf
 *
 * Key decisions:
 *   - Semicolon-delimited (most common for Lexware imports)
 *   - ANSI encoding (Windows-1252, Lexware expects this for Windows programs)
 *   - Amounts use comma as decimal separator (German locale)
 *   - Dates in DD.MM.YYYY format (TT.MM.JJJJ)
 *   - First row contains field names (so user can tick "Feldnamen" in import wizard)
 *   - Gross amounts with Steuerschlüssel — Lexware auto-calculates VAT
 *   - Sollkonto = expense account, Habenkonto = creditor account
 *
 * Steuerschlüssel (DATEV-compatible tax keys used by Lexware):
 *   2 = Umsatzsteuer 7%
 *   3 = Umsatzsteuer 19%
 *   8 = Vorsteuer 7%
 *   9 = Vorsteuer 19%
 *   18 = I.g.E. 7%  (Innergemeinschaftlicher Erwerb)
 *   19 = I.g.E. 19% (Innergemeinschaftlicher Erwerb)
 *   40 = Steuerfrei (Aufhebung Steuerautomatik)
 */

import { db } from '../db'
import type { AccountingAdapter, BillPayload, PostResult, ContactResult } from './types'

// ─── LEXWARE COLUMN HEADERS ──────────────────────────────────────────────────

const BUCHUNGSDATEN_COLUMNS = [
  'Belegdatum',
  'Buchungsdatum',
  'Belegnummernkreis',
  'Belegnummer',
  'Buchungstext',
  'Buchungsbetrag',
  'Sollkonto',
  'Habenkonto',
  'Steuerschlüssel',
  'Kostenstelle 1',
  'Buchungsbetrag Euro',
  'Währung',
] as const

// ─── STEUERSCHLÜSSEL MAPPING ─────────────────────────────────────────────────

/**
 * Map VAT rate to Lexware/DATEV Steuerschlüssel.
 * For purchase invoices (Eingangsrechnungen), we use Vorsteuer keys.
 */
function getSteuerschluessel(vatRate: number, isEU: boolean): string {
  if (isEU) {
    // Innergemeinschaftlicher Erwerb
    if (vatRate <= 7) return '18'
    return '19'
  }

  // Domestic Vorsteuer (input tax for purchase invoices)
  if (vatRate === 0) return '40'  // Tax-free
  if (vatRate <= 7) return '8'    // Vorsteuer 7%
  return '9'                      // Vorsteuer 19%
}

// ─── FORMAT HELPERS ──────────────────────────────────────────────────────────

/** Format amount with comma as decimal separator (German locale) */
function formatAmount(amount: number): string {
  return Math.abs(amount).toFixed(2).replace('.', ',')
}

/** Format date as DD.MM.YYYY (Lexware date format) */
function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0')
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const y = date.getFullYear()
  return `${d}.${m}.${y}`
}

/** Escape a field for Lexware CSV (semicolon-delimited, quote strings with special chars) */
function escapeField(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return ''
  const str = String(value)
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// ─── PERSONENKONTEN (SUPPLIER ACCOUNTS) EXPORT ──────────────────────────────

const PERSONENKONTEN_COLUMNS = [
  'Kontonummer',
  'Kontobezeichnung',
  'Kunden- oder Lieferantennummer',
  'Anrede',
  'Firma',
  'Name',
  'Vorname',
  'Zusatz',
  'Land',
  'Straße, Hausnummer',
  'Postleitzahl',
  'Ort',
  'E-Mail',
  'IBAN',
  'BIC',
] as const

/**
 * Generate a Lexware Personenkonten (supplier/creditor accounts) text file.
 * Lexware requires suppliers to be imported as Kreditoren first,
 * then bookings can reference their account numbers.
 */
export async function generateLexwareSupplierExport(options: {
  clientId: string
  startingAccountNumber?: number  // Default creditor range starts at 70000
}): Promise<string> {
  const startNo = options.startingAccountNumber ?? 70000

  const suppliers = await db.supplier.findMany({
    where: { clientId: options.clientId },
    orderBy: { name: 'asc' },
  })

  if (suppliers.length === 0) {
    throw new Error('No suppliers to export')
  }

  const rows: string[] = []

  // Header row with field names
  rows.push(PERSONENKONTEN_COLUMNS.join(';'))

  for (let i = 0; i < suppliers.length; i++) {
    const s = suppliers[i]
    const accountNo = startNo + i

    const row = [
      accountNo.toString(),                         // Kontonummer
      escapeField(s.name.slice(0, 79)),             // Kontobezeichnung
      '',                                            // Kunden-/Lieferantennummer
      '',                                            // Anrede
      escapeField(s.name.slice(0, 59)),             // Firma
      '',                                            // Name
      '',                                            // Vorname
      '',                                            // Zusatz
      '',                                            // Land
      '',                                            // Straße
      '',                                            // PLZ
      '',                                            // Ort
      '',                                            // E-Mail
      '',                                            // IBAN
      '',                                            // BIC
    ]

    rows.push(row.join(';'))
  }

  return rows.join('\r\n') + '\r\n'
}

// ─── BUCHUNGSDATEN (BOOKING DATA) EXPORT ─────────────────────────────────────

export interface LexwareExportOptions {
  clientId: string
  invoiceIds?: string[]       // If empty, exports all exportable invoices
  creditorStartNo?: number    // Starting creditor account number (default 70000)
}

/**
 * Generate a Lexware buchhalter Buchungsdaten text file for approved/auto-posted invoices.
 * Returns the text content as a string (ANSI/Windows-1252 compatible).
 *
 * For purchase invoices (Eingangsrechnungen):
 *   Sollkonto = expense account (e.g., 4200 Wareneingang)
 *   Habenkonto = creditor account (e.g., 70000+ for suppliers)
 *
 * The Steuerschlüssel tells Lexware how to handle VAT automatically.
 */
export async function generateLexwareExport(options: LexwareExportOptions): Promise<string> {
  const client = await db.client.findUnique({ where: { id: options.clientId } })
  if (!client) throw new Error(`Client ${options.clientId} not found`)

  const creditorStart = options.creditorStartNo ?? 70000

  // Fetch invoices to export
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

  // Build a supplier → creditor account number map
  const supplierAccountMap = new Map<string, number>()
  const uniqueSuppliers = [...new Set(
    invoices
      .filter((i) => i.supplierId)
      .map((i) => i.supplierId!)
  )]

  const suppliers = await db.supplier.findMany({
    where: { id: { in: uniqueSuppliers } },
    orderBy: { name: 'asc' },
  })

  suppliers.forEach((s, idx) => {
    supplierAccountMap.set(s.id, creditorStart + idx)
  })

  // Build rows
  const rows: string[] = []

  // Header row with field names
  rows.push(BUCHUNGSDATEN_COLUMNS.join(';'))

  const today = formatDate(new Date())

  for (const invoice of invoices) {
    // Determine creditor account
    const creditorAccount = invoice.supplierId
      ? (supplierAccountMap.get(invoice.supplierId) ?? creditorStart)
      : creditorStart

    // Check if supplier is EU (non-DE)
    const isEU = invoice.supplier?.vatNumber
      ? !invoice.supplier.vatNumber.startsWith('DE')
      : false

    for (const line of invoice.lineItems) {
      if (!line.accountCode) continue

      const steuerschluessel = getSteuerschluessel(line.vatRate, isEU)

      const row = [
        formatDate(invoice.invoiceDate),              // Belegdatum (DD.MM.YYYY)
        today,                                         // Buchungsdatum
        'ER',                                          // Belegnummernkreis (ER = Eingangsrechnung)
        escapeField((invoice.invoiceNumber ?? '').slice(0, 10)),  // Belegnummer
        escapeField((line.description ?? '').slice(0, 79)),       // Buchungstext
        formatAmount(line.lineTotal),                  // Buchungsbetrag (gross)
        line.accountCode,                              // Sollkonto (expense)
        creditorAccount.toString(),                    // Habenkonto (creditor)
        steuerschluessel,                              // Steuerschlüssel
        '',                                            // Kostenstelle 1
        invoice.currency === 'EUR'
          ? ''
          : formatAmount(line.lineTotal),              // Buchungsbetrag Euro (only if foreign currency)
        invoice.currency === 'EUR' ? '' : invoice.currency,  // Währung
      ]

      rows.push(row.join(';'))
    }
  }

  // Combine: header + data
  return rows.join('\r\n') + '\r\n'
}

// ─── LEXWARE ADAPTER (implements AccountingAdapter) ──────────────────────────

export const lexwareAdapter: AccountingAdapter = {
  name: 'Lexware',
  isRealTime: false,

  async isConnected(clientId: string): Promise<boolean> {
    // Lexware doesn't need a live connection — it exports files
    const client = await db.client.findUnique({ where: { id: clientId } })
    return client?.accountingSystem === 'LEXWARE'
  },

  async findOrCreateContact(
    _clientId: string,
    supplier: { name: string; vatNumber: string | null }
  ): Promise<ContactResult | null> {
    // Lexware uses creditor account numbers, not contact IDs
    return {
      contactId: supplier.vatNumber ?? '70000',
      name: supplier.name,
    }
  },

  async postBill(
    _clientId: string,
    _contactId: string,
    _bill: BillPayload
  ): Promise<PostResult> {
    // Lexware doesn't post in real-time — invoices are batched into an export file
    return {
      success: true,
      externalId: null,
      externalRef: 'LEXWARE_EXPORT_PENDING',
    }
  },
}
