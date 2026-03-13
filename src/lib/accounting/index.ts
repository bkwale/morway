/**
 * Accounting adapter registry.
 * Returns the right adapter based on the client's configured accounting system.
 */

import { db } from '../db'
import { ACCOUNTING_SYSTEM, type AccountingSystem } from '../constants'
import type { AccountingAdapter } from './types'

// Lazy imports to avoid loading all SDKs at once
async function getXeroAdapter(): Promise<AccountingAdapter> {
  const { findOrCreateContact, postBillToXero } = await import('../xero')

  return {
    name: 'Xero',
    isRealTime: true,

    async isConnected(clientId: string): Promise<boolean> {
      const token = await db.xeroToken.findUnique({ where: { clientId } })
      if (!token) return false
      const expiry = new Date(token.expiresAt)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return expiry > dayAgo
    },

    async findOrCreateContact(clientId, supplier) {
      const contact = await findOrCreateContact(clientId, supplier)
      if (!contact?.contactID) return null
      return { contactId: contact.contactID, name: contact.name ?? supplier.name }
    },

    async postBill(clientId, contactId, bill) {
      try {
        const result = await postBillToXero(clientId, contactId, {
          invoiceNumber: bill.invoiceNumber,
          invoiceDate: bill.invoiceDate,
          dueDate: bill.dueDate,
          currency: bill.currency,
          lineItems: bill.lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitAmount: item.unitAmount,
            accountCode: item.accountCode,
            taxType: item.taxType,
          })),
        })

        return {
          success: !!result?.invoiceID,
          externalId: result?.invoiceID ?? null,
          externalRef: result?.invoiceID ? `XERO:${result.invoiceID}` : undefined,
        }
      } catch (err) {
        return {
          success: false,
          externalId: null,
          error: err instanceof Error ? err.message : 'Unknown Xero error',
        }
      }
    },
  }
}

/**
 * Get the appropriate accounting adapter for a client.
 * Returns null if no accounting system is configured.
 */
export async function getAdapter(clientId: string): Promise<AccountingAdapter | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { accountingSystem: true },
  })

  if (!client) return null

  const system = client.accountingSystem as AccountingSystem

  switch (system) {
    case ACCOUNTING_SYSTEM.XERO:
      return getXeroAdapter()

    case ACCOUNTING_SYSTEM.EXACT_ONLINE: {
      const { exactOnlineAdapter } = await import('./exact-online')
      return exactOnlineAdapter
    }

    case ACCOUNTING_SYSTEM.DATEV: {
      const { datevAdapter } = await import('./datev')
      return datevAdapter
    }

    case ACCOUNTING_SYSTEM.NONE:
    default:
      return null
  }
}

/**
 * Get adapter by system name (for explicit lookups, e.g., from onboarding).
 */
export function getAdapterBySystem(system: AccountingSystem): Promise<AccountingAdapter | null> {
  switch (system) {
    case ACCOUNTING_SYSTEM.XERO:
      return getXeroAdapter()
    case ACCOUNTING_SYSTEM.EXACT_ONLINE:
      return import('./exact-online').then((m) => m.exactOnlineAdapter)
    case ACCOUNTING_SYSTEM.DATEV:
      return import('./datev').then((m) => m.datevAdapter)
    default:
      return Promise.resolve(null)
  }
}

export type { AccountingAdapter, BillPayload, PostResult, ContactResult } from './types'
