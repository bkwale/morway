/**
 * DATEV Buchungsstapel (EXTF) export.
 *
 * Generates a standards-compliant DATEV CSV file that any German accountant
 * can import directly into DATEV Rechnungswesen. This is the "mother of all
 * interfaces" in German accounting — every tool supports it.
 *
 * Format spec: https://developer.datev.de/datev/platform/en/dtvf
 * Reference:   https://github.com/ledermann/datev
 *
 * Key decisions:
 *   - Semicolon-delimited (DATEV standard)
 *   - Windows-1252 encoding (DATEV expects this)
 *   - Amounts use comma as decimal separator (German locale)
 *   - "H" = Haben (credit), "S" = Soll (debit) — for purchase invoices
 *     we credit the supplier (Kreditor) and debit the expense account
 */

import { db } from '../db'
import type { AccountingAdapter, BillPayload, PostResult, ContactResult } from './types'

// ─── DATEV CONSTANTS ────────────────────────────────────────────────────────

// The 116 column headers in the Buchungsstapel format
const BUCHUNGSSTAPEL_COLUMNS = [
  'Umsatz (ohne Soll/Haben-Kz)',
  'Soll/Haben-Kennzeichen',
  'WKZ Umsatz',
  'Kurs',
  'Basisumsatz',
  'WKZ Basisumsatz',
  'Konto',
  'Gegenkonto (ohne BU-Schlüssel)',
  'BU-Schlüssel',
  'Belegdatum',
  'Belegfeld 1',
  'Belegfeld 2',
  'Skonto',
  'Buchungstext',
  'Postensperre',
  'Diverse Adressnummer',
  'Geschäftspartnerbank',
  'Sachverhalt',
  'Zinssperre',
  'Beleglink',
  ...Array.from({ length: 8 }, (_, i) => [`Beleginfo – Art ${i + 1}`, `Beleginfo – Inhalt ${i + 1}`]).flat(),
  'KOST1 – Kostenstelle',
  'KOST2 – Kostenstelle',
  'Kost Menge',
  'EU-Land u. USt-IdNr.',
  'EU-Steuersatz',
  'Abw. Versteuerungsart',
  'Sachverhalt L+L',
  'Funktionsergänzung L+L',
  'BU 49 Hauptfunktionstyp',
  'BU 49 Hauptfunktionsnummer',
  'BU 49 Funktionsergänzung',
  ...Array.from({ length: 20 }, (_, i) => [`Zusatzinformation – Art ${i + 1}`, `Zusatzinformation – Inhalt ${i + 1}`]).flat(),
  'Stück',
  'Gewicht',
  'Zahlweise',
  'Forderungsart',
  'Veranlagungsjahr',
  'Zugeordnete Fälligkeit',
  'Skontotyp',
  'Auftragsnummer',
  'Buchungstyp',
  'USt-Schlüssel (Anzahlungen)',
  'EU-Mitgliedstaat (Anzahlungen)',
  'Sachverhalt L+L (Anzahlungen)',
  'EU-Steuersatz (Anzahlungen)',
  'Erlöskonto (Anzahlungen)',
  'Herkunft-Kz',
  'Leerfeld',
  'KOST-Datum',
  'SEPA-Mandatsreferenz',
  'Skontosperre',
  'Gesellschaftername',
  'Beteiligtennummer',
  'Identifikationsnummer',
  'Zeichnernummer',
  'Postensperre bis',
  'Bezeichnung',
  'Kennzeichen',
  'Festschreibung',
  'Leistungsdatum',
  'Datum Zuord.',
  'Fälligkeit',
  'Generalumkehr',
  'Steuersatz',
  'Land',
  'Abrechnungsreferent',
  'BVV-Position',
  'EU-Mitgliedstaat u. UStID (Ursprung)',
  'EU-Steuersatz (Ursprung)',
  'Abw. Skontokonto',
]

// ─── FORMAT HELPERS ─────────────────────────────────────────────────────────

/** Format amount with comma as decimal separator (German locale) */
function formatAmount(amount: number): string {
  return amount.toFixed(2).replace('.', ',')
}

/** Format date as DDMM (DATEV short date for Belegdatum) */
function formatBelegdatum(date: Date): string {
  const d = date.getDate().toString()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${d}${m}`
}

/** Format date as YYYYMMDD for header */
function formatDateLong(date: Date): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}${m}${d}`
}

/** Escape a field for DATEV CSV (semicolon-delimited, quote strings) */
function escapeField(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'number') return formatAmount(value)
  // Quote strings that contain semicolons, quotes, or newlines
  const str = String(value)
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// ─── DATEV HEADER LINE (LINE 1) ─────────────────────────────────────────────

interface DatevHeaderParams {
  consultantNumber: string   // Beraternummer (DATEV consultant ID)
  clientNumber: string       // Mandantennummer (client number in DATEV)
  fiscalYearStart: Date      // Start of fiscal year
  periodStart: Date          // Start of posting period
  periodEnd: Date            // End of posting period
  label?: string             // Batch label
}

function buildHeaderLine(params: DatevHeaderParams): string {
  const now = new Date()
  const timestamp = formatDateLong(now) + now.toTimeString().slice(0, 8).replace(/:/g, '') + '000'

  // EXTF header fields (30 fields, semicolon-separated)
  const fields = [
    '"EXTF"',                                         // 1: Format identifier
    '700',                                            // 2: Version
    '21',                                             // 3: Data category (21 = Buchungsstapel)
    '"Buchungsstapel"',                               // 4: Format name
    '13',                                             // 5: Format version
    timestamp,                                        // 6: Created timestamp
    '',                                               // 7: Reserved
    '"MO"',                                           // 8: Creator initials (Morway)
    '"Morway"',                                       // 9: Creator name
    '',                                               // 10: Reserved
    params.consultantNumber,                          // 11: Beraternummer
    params.clientNumber,                              // 12: Mandantennummer
    formatDateLong(params.fiscalYearStart),            // 13: Fiscal year start
    String(params.fiscalYearStart.getFullYear() === params.periodStart.getFullYear()
      ? params.periodStart.getMonth() + 1 : ''),      // 14: Account length / period
    formatDateLong(params.periodStart),                // 15: Period start
    formatDateLong(params.periodEnd),                  // 16: Period end
    `"${params.label ?? 'Morway Export'}"`,            // 17: Label
    '',                                               // 18: Dictation initials
    '1',                                              // 19: Booking type (1 = Finanzbuchführung)
    '',                                               // 20: Reserved
    '0',                                              // 21: Festschreibung (0 = nicht festgeschrieben)
    '"EUR"',                                          // 22: Currency
    '', '', '', '', '', '', '', '',                    // 23-30: Reserved
  ]

  return fields.join(';')
}

// ─── EXPORT FUNCTION ────────────────────────────────────────────────────────

export interface DatevExportOptions {
  clientId: string
  invoiceIds?: string[]       // If empty, exports all exportable invoices
  consultantNumber?: string   // Defaults to client's datevConsultNo
  clientNumber?: string       // Defaults to client's datevClientNo
}

/**
 * Generate a DATEV Buchungsstapel CSV for approved/auto-posted invoices.
 * Returns the CSV content as a string (Windows-1252-compatible ASCII).
 */
export async function generateDatevExport(options: DatevExportOptions): Promise<string> {
  const client = await db.client.findUnique({ where: { id: options.clientId } })
  if (!client) throw new Error(`Client ${options.clientId} not found`)

  const consultNo = options.consultantNumber ?? client.datevConsultNo ?? '1001'
  const clientNo = options.clientNumber ?? client.datevClientNo ?? '1'

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

  // Determine period from invoices
  const dates = invoices.map((i) => i.invoiceDate)
  const earliest = new Date(Math.min(...dates.map((d) => d.getTime())))
  const latest = new Date(Math.max(...dates.map((d) => d.getTime())))
  const fiscalYearStart = new Date(earliest.getFullYear(), 0, 1)

  // Build header
  const headerLine = buildHeaderLine({
    consultantNumber: consultNo,
    clientNumber: clientNo,
    fiscalYearStart,
    periodStart: earliest,
    periodEnd: latest,
    label: `Morway Export – ${client.name}`,
  })

  // Build column header line
  const columnLine = BUCHUNGSSTAPEL_COLUMNS.join(';')

  // Build data rows
  const dataRows: string[] = []

  for (const invoice of invoices) {
    for (const line of invoice.lineItems) {
      if (!line.accountCode) continue

      // Build a row with 116 columns (most empty)
      const row = new Array(BUCHUNGSSTAPEL_COLUMNS.length).fill('')

      row[0] = formatAmount(Math.abs(line.lineTotal))           // Umsatz
      row[1] = '"S"'                                            // Soll (debit expense account)
      row[6] = line.accountCode                                 // Konto (expense account)
      row[7] = invoice.supplier?.vatNumber
        ? `"${invoice.supplier.vatNumber}"`
        : '70000'                                                // Gegenkonto (creditor/supplier)
      row[9] = formatBelegdatum(invoice.invoiceDate)             // Belegdatum
      row[10] = `"${(invoice.invoiceNumber ?? '').slice(0, 36)}"` // Belegfeld 1 (max 36 chars)
      row[13] = `"${(line.description ?? '').slice(0, 60)}"`     // Buchungstext (max 60 chars)

      // EU VAT info if supplier has VAT number
      if (invoice.supplier?.vatNumber) {
        const vatNo = invoice.supplier.vatNumber
        const countryCode = vatNo.slice(0, 2).toUpperCase()
        if (countryCode !== 'DE') {
          row[39] = `"${vatNo}"`                                 // EU-Land u. USt-IdNr.
        }
      }

      dataRows.push(row.join(';'))
    }
  }

  // Combine: header + column headers + data
  return [headerLine, columnLine, ...dataRows].join('\r\n') + '\r\n'
}

// ─── DATEV ADAPTER (implements AccountingAdapter) ───────────────────────────

export const datevAdapter: AccountingAdapter = {
  name: 'DATEV',
  isRealTime: false,

  async isConnected(clientId: string): Promise<boolean> {
    // DATEV doesn't need a live connection — it exports files
    const client = await db.client.findUnique({ where: { id: clientId } })
    return client?.accountingSystem === 'DATEV'
  },

  async findOrCreateContact(
    _clientId: string,
    supplier: { name: string; vatNumber: string | null }
  ): Promise<ContactResult | null> {
    // DATEV uses account numbers, not contact IDs
    // We use the supplier's VAT number or a generated creditor number
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
    // DATEV doesn't post in real-time — invoices are batched into an export file
    // The invoice processor marks them as "ready for export" and the firm
    // downloads the Buchungsstapel when ready
    return {
      success: true,
      externalId: null,
      externalRef: 'DATEV_EXPORT_PENDING',
    }
  },
}
