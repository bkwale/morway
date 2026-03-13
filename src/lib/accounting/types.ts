/**
 * Shared types for accounting system adapters.
 * Each adapter (Xero, Exact Online, DATEV) implements the same interface
 * so the invoice processor doesn't care which system is connected.
 */

export interface BillLineItem {
  description: string
  quantity: number
  unitAmount: number
  accountCode: string
  taxType?: string
  vatRate?: number
}

export interface BillPayload {
  invoiceNumber: string
  invoiceDate: Date
  dueDate: Date | null
  currency: string
  supplierName: string
  supplierVatNumber: string | null
  lineItems: BillLineItem[]
}

export interface PostResult {
  success: boolean
  externalId: string | null
  externalRef?: string
  error?: string
}

export interface ContactResult {
  contactId: string
  name: string
}

/**
 * Every accounting adapter must implement this interface.
 * DATEV is special — it exports files instead of posting via API.
 */
export interface AccountingAdapter {
  /** Display name for UI */
  name: string

  /** Whether this adapter posts in real-time (Xero, Exact) or exports files (DATEV) */
  isRealTime: boolean

  /** Check if the connection is still valid */
  isConnected(clientId: string): Promise<boolean>

  /** Find or create a supplier/contact in the external system */
  findOrCreateContact(
    clientId: string,
    supplier: { name: string; vatNumber: string | null }
  ): Promise<ContactResult | null>

  /** Post a bill to the external system */
  postBill(
    clientId: string,
    contactId: string,
    bill: BillPayload
  ): Promise<PostResult>
}
