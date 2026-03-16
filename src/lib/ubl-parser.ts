import { DOMParser } from 'xmldom'
import * as xpath from 'xpath'

export type DocumentType = 'INVOICE' | 'CREDIT_NOTE'

export interface ParsedInvoice {
  invoiceNumber: string
  invoiceDate: Date
  dueDate: Date | null
  currency: string
  documentType: DocumentType
  supplier: {
    name: string
    vatNumber: string | null
    address: string | null
  }
  buyer: {
    name: string
    vatNumber: string | null
    peppolId: string | null
  }
  lineItems: ParsedLineItem[]
  netAmount: number
  vatAmount: number
  grossAmount: number
  errors: string[]
}

export interface ParsedLineItem {
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  lineTotal: number
  suggestedAccountCode?: string | null
  accountCodeConfidence?: number | null
}

// UBL 2.1 namespaces
const NS = {
  ubl: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
}

function select(doc: Document, xpathExpr: string): string {
  try {
    const select = xpath.useNamespaces({
      ubl: NS.ubl,
      cbc: NS.cbc,
      cac: NS.cac,
    })
    const result = select(xpathExpr, doc, true) as xpath.SelectedValue
    if (!result) return ''
    return (result as any).textContent?.trim() ?? (result as any).nodeValue?.trim() ?? ''
  } catch {
    return ''
  }
}

function selectAll(doc: Document, xpathExpr: string): Node[] {
  try {
    const selectFn = xpath.useNamespaces({
      ubl: NS.ubl,
      cbc: NS.cbc,
      cac: NS.cac,
    })
    return selectFn(xpathExpr, doc) as Node[]
  } catch {
    return []
  }
}

function parseAmount(value: string): number {
  const n = parseFloat(value)
  return isNaN(n) ? 0 : Math.round(n * 100) / 100
}

function parseDate(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export function parseUBLInvoice(xml: string): ParsedInvoice {
  const errors: string[] = []
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')

  // Check for parse errors
  const parseError = doc.getElementsByTagName('parsererror')
  if (parseError.length > 0) {
    return {
      invoiceNumber: '',
      invoiceDate: new Date(),
      dueDate: null,
      currency: 'EUR',
      documentType: 'INVOICE' as const,
      supplier: { name: '', vatNumber: null, address: null },
      buyer: { name: '', vatNumber: null, peppolId: null },
      lineItems: [],
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0,
      errors: ['Invalid XML: ' + parseError[0].textContent],
    }
  }

  // Invoice number
  const invoiceNumber = select(doc, '//cbc:ID')
  if (!invoiceNumber) errors.push('Missing invoice number')

  // Dates
  const invoiceDateStr = select(doc, '//cbc:IssueDate')
  const dueDateStr = select(doc, '//cbc:DueDate')
  const invoiceDate = parseDate(invoiceDateStr) ?? new Date()
  if (!invoiceDateStr) errors.push('Missing invoice date')

  // Currency
  const currency = select(doc, '//cbc:DocumentCurrencyCode') || 'EUR'

  // Supplier (AccountingSupplierParty)
  const supplierName = select(doc, '//cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name')
  const supplierVat = select(doc, '//cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID')
  const supplierAddress = select(doc, '//cac:AccountingSupplierParty/cac:Party/cac:PostalAddress/cbc:CityName')
  if (!supplierName) errors.push('Missing supplier name')

  // Buyer (AccountingCustomerParty)
  const buyerName = select(doc, '//cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name')
  const buyerVat = select(doc, '//cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID')
  const buyerPeppolId = select(doc, '//cac:AccountingCustomerParty/cac:Party/cbc:EndpointID')

  // Totals
  const netAmount = parseAmount(select(doc, '//cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount'))
  const grossAmount = parseAmount(select(doc, '//cac:LegalMonetaryTotal/cbc:PayableAmount'))
  const vatAmount = parseAmount(select(doc, '//cac:TaxTotal/cbc:TaxAmount'))

  // Line items
  const lineItemNodes = selectAll(doc, '//cac:InvoiceLine')
  const lineItems: ParsedLineItem[] = lineItemNodes.map((node) => {
    const lineDoc = node as unknown as Document
    const lineSelect = (expr: string) => {
      try {
        const selectFn = xpath.useNamespaces({ cbc: NS.cbc, cac: NS.cac })
        const result = selectFn(expr, lineDoc, true) as xpath.SelectedValue
        return (result as any)?.textContent?.trim() ?? ''
      } catch {
        return ''
      }
    }

    return {
      description: lineSelect('cac:Item/cbc:Name') || lineSelect('cbc:Note') || 'No description',
      quantity: parseAmount(lineSelect('cbc:InvoicedQuantity')),
      unitPrice: parseAmount(lineSelect('cac:Price/cbc:PriceAmount')),
      vatRate: parseAmount(lineSelect('cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:Percent')),
      lineTotal: parseAmount(lineSelect('cbc:LineExtensionAmount')),
    }
  })

  // Detect credit notes from UBL root element or InvoiceTypeCode
  const rootTag = doc.documentElement?.localName?.toLowerCase() ?? ''
  const typeCode = select(doc, '//cbc:InvoiceTypeCode')
  const isCreditNote = rootTag === 'creditnote' || typeCode === '381'

  return {
    invoiceNumber,
    invoiceDate,
    dueDate: parseDate(dueDateStr),
    currency,
    documentType: isCreditNote ? 'CREDIT_NOTE' : 'INVOICE',
    supplier: {
      name: supplierName,
      vatNumber: supplierVat || null,
      address: supplierAddress || null,
    },
    buyer: {
      name: buyerName,
      vatNumber: buyerVat || null,
      peppolId: buyerPeppolId || null,
    },
    lineItems,
    netAmount,
    vatAmount,
    grossAmount,
    errors,
  }
}
