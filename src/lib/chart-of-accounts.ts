/**
 * Chart of Accounts Reference Data
 *
 * Standard accounting codes per country/system.
 * Used for:
 *   - Autocomplete in the invoice detail UI
 *   - Validating suggested account codes
 *   - Providing context to Claude for smarter suggestions
 *
 * This is NOT the full chart (800+ codes per country).
 * It's the most commonly used purchase/expense codes
 * that Morway needs for invoice processing.
 */

export interface AccountCode {
  code: string
  label: string
  labelLocal: string  // Label in the native language
  category: string    // Broad grouping for UI
}

export interface ChartOfAccounts {
  system: string
  country: string
  label: string
  codes: AccountCode[]
}

// ─── FRENCH PCG (Plan Comptable Général) ──────────────────────────────────

const PCG_CODES: AccountCode[] = [
  // Class 6: Expenses (what Morway processes most)
  // 601 — Raw materials
  { code: '6011', label: 'Seeds and plants', labelLocal: 'Semences et plants', category: 'Raw Materials' },
  { code: '6012', label: 'Fertilizers and soil amendments', labelLocal: 'Engrais et amendements', category: 'Raw Materials' },
  { code: '6013', label: 'Animal feed', labelLocal: 'Aliments du bétail', category: 'Raw Materials' },
  { code: '6014', label: 'Livestock', labelLocal: 'Animaux d\'élevage', category: 'Raw Materials' },
  { code: '6015', label: 'Plant protection products', labelLocal: 'Produits phytosanitaires', category: 'Raw Materials' },
  { code: '6017', label: 'Packaging materials', labelLocal: 'Emballages', category: 'Raw Materials' },
  // 602 — Consumables
  { code: '6021', label: 'Fuel and lubricants', labelLocal: 'Carburants et lubrifiants', category: 'Consumables' },
  { code: '6022', label: 'Office and other consumables', labelLocal: 'Fournitures consommables', category: 'Consumables' },
  { code: '6024', label: 'Spare parts', labelLocal: 'Pièces détachées', category: 'Consumables' },
  { code: '6026', label: 'Packaging materials', labelLocal: 'Emballages', category: 'Consumables' },
  // 604 — Purchases of studies and services
  { code: '6041', label: 'Studies and research', labelLocal: 'Études et recherches', category: 'Services' },
  // 606 — Non-stocked purchases
  { code: '6061', label: 'Non-storable supplies (energy, water)', labelLocal: 'Fournitures non stockables (énergie, eau)', category: 'Utilities' },
  { code: '6063', label: 'Office supplies', labelLocal: 'Fournitures d\'entretien et petit équipement', category: 'Office' },
  { code: '6064', label: 'Admin and office supplies', labelLocal: 'Fournitures administratives', category: 'Office' },
  // 611 — Subcontracting
  { code: '6110', label: 'Subcontracting', labelLocal: 'Sous-traitance générale', category: 'Subcontracting' },
  // 612 — Leasing
  { code: '6122', label: 'Equipment leasing', labelLocal: 'Crédit-bail mobilier', category: 'Leasing' },
  // 613 — Rent
  { code: '6132', label: 'Building rent', labelLocal: 'Locations immobilières', category: 'Rent' },
  { code: '6135', label: 'Equipment rent', labelLocal: 'Locations mobilières', category: 'Rent' },
  // 615 — Maintenance
  { code: '6152', label: 'Building maintenance', labelLocal: 'Entretien immobilier', category: 'Maintenance' },
  { code: '6155', label: 'Equipment maintenance', labelLocal: 'Entretien matériel', category: 'Maintenance' },
  // 616 — Insurance
  { code: '6161', label: 'Multi-risk insurance', labelLocal: 'Assurance multirisques', category: 'Insurance' },
  // 617 — Research
  { code: '6171', label: 'Research expenses', labelLocal: 'Frais de recherche', category: 'Research' },
  // 621 — External staff
  { code: '6211', label: 'Temporary staff', labelLocal: 'Personnel intérimaire', category: 'Staff' },
  // 622 — Fees and commissions
  { code: '6221', label: 'Sales commissions', labelLocal: 'Commissions sur ventes', category: 'Fees' },
  { code: '6224', label: 'Freight and transport', labelLocal: 'Transports sur ventes', category: 'Transport' },
  { code: '6226', label: 'Accounting and legal fees', labelLocal: 'Honoraires comptables et juridiques', category: 'Fees' },
  { code: '6227', label: 'Bank fees', labelLocal: 'Frais d\'actes et de contentieux', category: 'Fees' },
  { code: '6228', label: 'Other external services', labelLocal: 'Divers services extérieurs', category: 'Fees' },
  // 623 — Advertising
  { code: '6231', label: 'Advertising', labelLocal: 'Annonces et insertions', category: 'Advertising' },
  // 625 — Travel
  { code: '6251', label: 'Travel and accommodation', labelLocal: 'Voyages et déplacements', category: 'Travel' },
  { code: '6256', label: 'Business entertaining', labelLocal: 'Missions et réceptions', category: 'Travel' },
  // 626 — Post and telecom
  { code: '6261', label: 'Post and shipping', labelLocal: 'Frais postaux', category: 'Telecom' },
  { code: '6262', label: 'Telecom', labelLocal: 'Télécommunications', category: 'Telecom' },
  // 627 — Banking
  { code: '6271', label: 'Bank charges', labelLocal: 'Frais bancaires', category: 'Banking' },
  // 63 — Taxes
  { code: '6311', label: 'Business tax (CFE)', labelLocal: 'Taxe professionnelle (CFE)', category: 'Taxes' },
  { code: '6351', label: 'Property tax (foncière)', labelLocal: 'Impôts fonciers', category: 'Taxes' },
  // 641 — Staff costs
  { code: '6411', label: 'Salaries', labelLocal: 'Salaires et appointements', category: 'Staff Costs' },
  { code: '6413', label: 'Bonuses', labelLocal: 'Primes et gratifications', category: 'Staff Costs' },
  { code: '6451', label: 'Social security (URSSAF)', labelLocal: 'Cotisations URSSAF', category: 'Staff Costs' },
  // 681 — Depreciation
  { code: '6811', label: 'Depreciation', labelLocal: 'Dotations aux amortissements', category: 'Depreciation' },
]

// ─── GERMAN SKR03 (Standardkontenrahmen 03) ───────────────────────────────

const SKR03_CODES: AccountCode[] = [
  // Class 3: Materials / Purchases
  { code: '3000', label: 'Raw materials (general)', labelLocal: 'Roh-, Hilfs- und Betriebsstoffe', category: 'Raw Materials' },
  { code: '3100', label: 'Raw materials 7% VAT', labelLocal: 'Roh- und Hilfsstoffe 7%', category: 'Raw Materials' },
  { code: '3300', label: 'Raw materials 19% VAT', labelLocal: 'Roh- und Hilfsstoffe 19%', category: 'Raw Materials' },
  { code: '3400', label: 'Goods for resale', labelLocal: 'Wareneingang', category: 'Goods' },
  // Class 4: Revenue (rarely used for purchase invoices)
  // Class 6: Operating expenses
  { code: '6000', label: 'Office supplies', labelLocal: 'Aufwendungen für Roh-, Hilfs- und Betriebsstoffe', category: 'Office' },
  { code: '6100', label: 'Packing materials', labelLocal: 'Verpackungsmaterial', category: 'Packaging' },
  { code: '6300', label: 'Freight in', labelLocal: 'Fremdleistungen', category: 'Freight' },
  { code: '6310', label: 'Subcontracting', labelLocal: 'Subunternehmer-Leistungen', category: 'Subcontracting' },
  { code: '6400', label: 'Salaries', labelLocal: 'Löhne und Gehälter', category: 'Staff Costs' },
  { code: '6800', label: 'Phone and internet', labelLocal: 'Telefon', category: 'Telecom' },
  { code: '6805', label: 'Post', labelLocal: 'Porto', category: 'Telecom' },
  { code: '6810', label: 'IT services', labelLocal: 'EDV-Kosten', category: 'IT' },
  { code: '6815', label: 'Legal and consulting fees', labelLocal: 'Rechts- und Beratungskosten', category: 'Fees' },
  { code: '6820', label: 'Accounting fees', labelLocal: 'Steuerberatung', category: 'Fees' },
  { code: '6825', label: 'Bookkeeping costs', labelLocal: 'Buchführungskosten', category: 'Fees' },
  { code: '6830', label: 'Advertising', labelLocal: 'Werbekosten', category: 'Advertising' },
  { code: '6835', label: 'Entertainment', labelLocal: 'Bewirtungskosten', category: 'Travel' },
  { code: '6840', label: 'Travel expenses', labelLocal: 'Reisekosten', category: 'Travel' },
  { code: '6855', label: 'Vehicle costs', labelLocal: 'Kfz-Kosten', category: 'Vehicle' },
  { code: '6860', label: 'Rent (premises)', labelLocal: 'Mietaufwendungen', category: 'Rent' },
  { code: '6870', label: 'Insurance', labelLocal: 'Versicherungen', category: 'Insurance' },
  { code: '6880', label: 'Repairs and maintenance', labelLocal: 'Reparatur und Instandhaltung', category: 'Maintenance' },
  { code: '6890', label: 'Electricity and utilities', labelLocal: 'Energiekosten', category: 'Utilities' },
  { code: '6900', label: 'Bank charges', labelLocal: 'Bankgebühren', category: 'Banking' },
  { code: '6920', label: 'Depreciation', labelLocal: 'Abschreibungen', category: 'Depreciation' },
]

// ─── DUTCH RGS (Referentie Grootboekschema) ───────────────────────────────

const RGS_CODES: AccountCode[] = [
  { code: '4000', label: 'Cost of goods sold', labelLocal: 'Kostprijs omzet', category: 'COGS' },
  { code: '4100', label: 'Raw materials', labelLocal: 'Grondstoffen', category: 'Raw Materials' },
  { code: '4200', label: 'Subcontracting', labelLocal: 'Uitbesteed werk', category: 'Subcontracting' },
  { code: '4300', label: 'Staff costs', labelLocal: 'Personeelskosten', category: 'Staff Costs' },
  { code: '4400', label: 'Social security', labelLocal: 'Sociale lasten', category: 'Staff Costs' },
  { code: '4500', label: 'Depreciation', labelLocal: 'Afschrijvingen', category: 'Depreciation' },
  { code: '4600', label: 'Premises costs', labelLocal: 'Huisvestingskosten', category: 'Rent' },
  { code: '4700', label: 'Vehicle costs', labelLocal: 'Vervoerskosten', category: 'Vehicle' },
  { code: '4800', label: 'Office costs', labelLocal: 'Kantoorkosten', category: 'Office' },
  { code: '4810', label: 'Phone and internet', labelLocal: 'Telefoon en internet', category: 'Telecom' },
  { code: '4820', label: 'Post', labelLocal: 'Porti', category: 'Telecom' },
  { code: '4830', label: 'IT costs', labelLocal: 'Automatiseringskosten', category: 'IT' },
  { code: '4840', label: 'Accounting fees', labelLocal: 'Administratiekosten', category: 'Fees' },
  { code: '4850', label: 'Legal fees', labelLocal: 'Juridische kosten', category: 'Fees' },
  { code: '4860', label: 'Insurance', labelLocal: 'Verzekeringen', category: 'Insurance' },
  { code: '4870', label: 'Advertising', labelLocal: 'Reclamekosten', category: 'Advertising' },
  { code: '4880', label: 'Maintenance', labelLocal: 'Onderhoud en reparatie', category: 'Maintenance' },
  { code: '4890', label: 'Bank charges', labelLocal: 'Bankkosten', category: 'Banking' },
  { code: '4900', label: 'Other operating costs', labelLocal: 'Overige bedrijfskosten', category: 'Other' },
]

// ─── CHART REGISTRY ─────────────────────────────────────────────────────────

export const CHARTS: ChartOfAccounts[] = [
  { system: 'FEC', country: 'FR', label: 'Plan Comptable Général (PCG)', codes: PCG_CODES },
  { system: 'PENNYLANE', country: 'FR', label: 'Plan Comptable Général (PCG)', codes: PCG_CODES },
  { system: 'DATEV', country: 'DE', label: 'SKR03 (Standardkontenrahmen)', codes: SKR03_CODES },
  { system: 'LEXWARE', country: 'DE', label: 'SKR03 (Standardkontenrahmen)', codes: SKR03_CODES },
  { system: 'EXACT_ONLINE', country: 'NL', label: 'RGS (Referentie Grootboekschema)', codes: RGS_CODES },
  { system: 'MONEYBIRD', country: 'NL', label: 'RGS (Referentie Grootboekschema)', codes: RGS_CODES },
  { system: 'TWINFIELD', country: 'NL', label: 'RGS (Referentie Grootboekschema)', codes: RGS_CODES },
  // Xero/Octopus use custom charts — fall back to country
  { system: 'XERO', country: 'EU', label: 'Xero (custom chart)', codes: [] },
  { system: 'OCTOPUS', country: 'BE', label: 'MAR/PCMN (Belgium)', codes: [] },
]

/**
 * Get chart of accounts for a client's accounting system.
 * Falls back to country-based chart if system not found.
 */
export function getChartForClient(accountingSystem: string, country?: string): ChartOfAccounts | null {
  // Direct system match
  const bySystem = CHARTS.find((c) => c.system === accountingSystem)
  if (bySystem && bySystem.codes.length > 0) return bySystem

  // Country fallback
  if (country) {
    const byCountry = CHARTS.find((c) => c.country === country && c.codes.length > 0)
    if (byCountry) return byCountry
  }

  // Default to French PCG (Morway's primary market)
  return CHARTS.find((c) => c.system === 'FEC') ?? null
}

/**
 * Get a flat list of account codes for autocomplete.
 */
export function getCodeList(accountingSystem: string, country?: string): AccountCode[] {
  const chart = getChartForClient(accountingSystem, country)
  return chart?.codes ?? []
}

/**
 * Build a prompt snippet describing the relevant chart for Claude.
 * Injected into the extraction prompt for accurate code suggestions.
 */
export function getChartPromptContext(accountingSystem: string, country: string, industry: string): string {
  const chart = getChartForClient(accountingSystem, country)
  if (!chart || chart.codes.length === 0) {
    return `This client uses ${accountingSystem} in ${country}. Suggest standard accounting codes for this country.`
  }

  // Group codes by category for a more readable prompt
  const byCategory: Record<string, string[]> = {}
  for (const code of chart.codes) {
    if (!byCategory[code.category]) byCategory[code.category] = []
    byCategory[code.category].push(`${code.code} = ${code.label}`)
  }

  const codeList = Object.entries(byCategory)
    .map(([cat, codes]) => `  ${cat}: ${codes.join(', ')}`)
    .join('\n')

  return `This client uses the ${chart.label} chart of accounts (${country}, ${industry} industry).
Use ONLY these codes when suggesting account codes for line items:
${codeList}

Pick the most specific code that matches the line item description.`
}
