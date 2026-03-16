/**
 * Twinfield adapter (Netherlands).
 *
 * Twinfield (Wolters Kluwer) is a major cloud accounting platform for Dutch
 * mid-sized firms and accounting offices. Strong in the accountant/advisor market.
 *
 * API docs: https://accounting.twinfield.com/webservices/documentation/
 * Auth: OAuth2 via Twinfield Identity
 * Base URL: https://accounting.twinfield.com
 *
 * Key endpoints:
 *   - POST /webservices/TransactionService.svc — Create transactions
 *   - POST /webservices/FinderService.svc — Search suppliers
 *   - POST /webservices/ProcessXmlService.svc — Process XML documents
 *
 * Note: Twinfield uses SOAP/XML-based API (not REST). Requires XML message
 * construction for transactions. Newer REST API available for some operations.
 *
 * Status: STUB — OAuth flow and API calls not yet implemented.
 * Full implementation requires:
 *   1. OAuth2 flow via Twinfield Identity
 *   2. Company/Office selection (user picks their organisation)
 *   3. SOAP XML message construction for purchase transactions
 *   4. Dimension (supplier) lookup/creation
 *   5. Transaction posting
 */

import { db } from '../db'
import type { AccountingAdapter, BillPayload, PostResult, ContactResult } from './types'

export const twinfieldAdapter: AccountingAdapter = {
  name: 'Twinfield',
  isRealTime: true,

  async isConnected(clientId: string): Promise<boolean> {
    // TODO: Check for valid Twinfield OAuth token
    const client = await db.client.findUnique({ where: { id: clientId } })
    return client?.accountingSystem === 'TWINFIELD'
  },

  async findOrCreateContact(
    _clientId: string,
    supplier: { name: string; vatNumber: string | null }
  ): Promise<ContactResult | null> {
    // TODO: Call Twinfield FinderService to search for supplier dimension
    // If not found, create via ProcessXmlService
    return {
      contactId: supplier.vatNumber ?? 'pending-twinfield',
      name: supplier.name,
    }
  },

  async postBill(
    _clientId: string,
    _contactId: string,
    _bill: BillPayload
  ): Promise<PostResult> {
    // TODO: Construct SOAP XML transaction and post via TransactionService
    return {
      success: false,
      externalId: null,
      error: 'Twinfield API integration not yet implemented.',
    }
  },
}
