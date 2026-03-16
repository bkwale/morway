/**
 * Moneybird adapter (Netherlands).
 *
 * Moneybird is the most popular accounting platform for Dutch freelancers and
 * micro-SMEs — ~88% Dutch user base. REST API with OAuth2 authentication.
 *
 * API docs: https://developer.moneybird.com/
 * Auth: OAuth2 (authorization code flow)
 * Base URL: https://moneybird.com/api/v2/{administration_id}
 *
 * Key endpoints:
 *   - POST /documents/purchase_invoices.json — Create purchase invoice
 *   - GET /contacts.json — List contacts
 *   - POST /contacts.json — Create contact
 *
 * Important: Moneybird requires .json extension in URL paths.
 *
 * Status: STUB — OAuth flow and API calls not yet implemented.
 * Full implementation requires:
 *   1. OAuth2 flow (connect → Moneybird auth → callback → store tokens)
 *   2. Administration ID selection (user may have multiple)
 *   3. Contact mapping (findOrCreateContact)
 *   4. Purchase invoice posting (postBill)
 */

import { db } from '../db'
import type { AccountingAdapter, BillPayload, PostResult, ContactResult } from './types'

export const moneybirdAdapter: AccountingAdapter = {
  name: 'Moneybird',
  isRealTime: true,

  async isConnected(clientId: string): Promise<boolean> {
    // TODO: Check for valid Moneybird OAuth token
    const client = await db.client.findUnique({ where: { id: clientId } })
    return client?.accountingSystem === 'MONEYBIRD'
  },

  async findOrCreateContact(
    _clientId: string,
    supplier: { name: string; vatNumber: string | null }
  ): Promise<ContactResult | null> {
    // TODO: Call Moneybird API
    // GET /contacts.json?query={name}
    // POST /contacts.json { contact: { company_name, tax_number } }
    return {
      contactId: supplier.vatNumber ?? 'pending-moneybird',
      name: supplier.name,
    }
  },

  async postBill(
    _clientId: string,
    _contactId: string,
    _bill: BillPayload
  ): Promise<PostResult> {
    // TODO: Call Moneybird API
    // POST /documents/purchase_invoices.json
    // { purchase_invoice: { contact_id, reference, date, due_date, currency, details_attributes } }
    return {
      success: false,
      externalId: null,
      error: 'Moneybird API integration not yet implemented.',
    }
  },
}
