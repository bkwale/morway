/**
 * Octopus adapter (Belgium).
 *
 * Octopus is a 100% Belgian online accounting software used by 1 in 6
 * Belgian accounting firms (2,200+ offices). Strong in the Flemish market.
 *
 * API: REST API available for integration partners
 * Auth: API key or OAuth2 (partner agreement required)
 * Website: https://www.octopus.be
 *
 * Key operations:
 *   - Create purchase invoice (boekhouding/aankoopfacturen)
 *   - Manage suppliers (leveranciers)
 *   - Chart of accounts (rekeningschema)
 *
 * Belgium context: As of January 2026, Belgium mandates B2B e-invoicing via
 * Peppol. Octopus has built-in Peppol support. Morway's value-add is the
 * rules engine and auto-categorisation layer on top.
 *
 * Status: STUB — API integration not yet implemented.
 * Full implementation requires:
 *   1. Partner agreement with Octopus for API access
 *   2. Authentication setup
 *   3. Supplier/leverancier lookup and creation
 *   4. Purchase invoice posting with line items
 */

import { db } from '../db'
import type { AccountingAdapter, BillPayload, PostResult, ContactResult } from './types'

export const octopusAdapter: AccountingAdapter = {
  name: 'Octopus',
  isRealTime: true,

  async isConnected(clientId: string): Promise<boolean> {
    // TODO: Check for valid Octopus API credentials
    const client = await db.client.findUnique({ where: { id: clientId } })
    return client?.accountingSystem === 'OCTOPUS'
  },

  async findOrCreateContact(
    _clientId: string,
    supplier: { name: string; vatNumber: string | null }
  ): Promise<ContactResult | null> {
    // TODO: Call Octopus API to find/create leverancier
    return {
      contactId: supplier.vatNumber ?? 'pending-octopus',
      name: supplier.name,
    }
  },

  async postBill(
    _clientId: string,
    _contactId: string,
    _bill: BillPayload
  ): Promise<PostResult> {
    // TODO: Call Octopus API to create aankoopfactuur
    return {
      success: false,
      externalId: null,
      error: 'Octopus API integration not yet implemented.',
    }
  },
}
