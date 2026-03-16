/**
 * Pennylane adapter (France).
 *
 * Pennylane is the fastest-growing accounting platform in France — 500K+ companies.
 * Used by both expert-comptables and SMEs. REST API with OAuth2 authentication.
 *
 * API docs: https://pennylane.readme.io/
 * Auth: OAuth2 (authorization code flow)
 * Base URL: https://app.pennylane.com/api/external/v2
 *
 * Key endpoints:
 *   - POST /supplier_invoices — Create supplier invoice
 *   - GET /suppliers — List suppliers
 *   - POST /suppliers — Create supplier
 *
 * Status: STUB — OAuth flow and API calls not yet implemented.
 * This adapter registers Pennylane in the system so clients can be configured
 * for it during onboarding. Full implementation requires:
 *   1. OAuth2 flow (connect button → Pennylane authorization → callback → store tokens)
 *   2. Token refresh logic
 *   3. Supplier mapping (findOrCreateContact)
 *   4. Invoice posting (postBill)
 */

import { db } from '../db'
import type { AccountingAdapter, BillPayload, PostResult, ContactResult } from './types'

export const pennylaneAdapter: AccountingAdapter = {
  name: 'Pennylane',
  isRealTime: true,

  async isConnected(clientId: string): Promise<boolean> {
    // TODO: Check for valid Pennylane OAuth token
    const client = await db.client.findUnique({ where: { id: clientId } })
    return client?.accountingSystem === 'PENNYLANE'
  },

  async findOrCreateContact(
    _clientId: string,
    supplier: { name: string; vatNumber: string | null }
  ): Promise<ContactResult | null> {
    // TODO: Call Pennylane API to find or create supplier
    // GET /suppliers?filter[name]={name}
    // POST /suppliers { name, vat_number, ... }
    return {
      contactId: supplier.vatNumber ?? 'pending-pennylane',
      name: supplier.name,
    }
  },

  async postBill(
    _clientId: string,
    _contactId: string,
    _bill: BillPayload
  ): Promise<PostResult> {
    // TODO: Call Pennylane API to create supplier invoice
    // POST /supplier_invoices { supplier_id, date, due_date, currency, line_items_section_attributes }
    return {
      success: false,
      externalId: null,
      error: 'Pennylane API integration not yet implemented. Use FEC export as fallback.',
    }
  },
}
