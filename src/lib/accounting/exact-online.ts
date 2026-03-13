/**
 * Exact Online integration.
 *
 * Exact Online is the dominant accounting software in NL and BE.
 * Uses OAuth2 with regional endpoints and a REST API.
 *
 * Key concepts:
 *   - Regional base URLs (NL, BE, DE, UK)
 *   - Every API call needs a "division" (like a tenant)
 *   - Purchase entries = supplier invoices / bills
 *   - Rate limits: 60/min, 5000/day
 *
 * Docs: https://support.exactonline.com/community/s/knowledge-base
 * Guide: https://www.apideck.com/blog/guide-to-exact-online-api-integration
 */

import { db } from '../db'
import { EXACT_ONLINE_REGIONS, type ExactOnlineRegion } from '../constants'
import type { AccountingAdapter, BillPayload, PostResult, ContactResult } from './types'

// ─── CONFIG ─────────────────────────────────────────────────────────────────

const EXACT_CLIENT_ID = process.env.EXACT_ONLINE_CLIENT_ID ?? ''
const EXACT_CLIENT_SECRET = process.env.EXACT_ONLINE_CLIENT_SECRET ?? ''
const EXACT_REDIRECT_URI = process.env.EXACT_ONLINE_REDIRECT_URI ?? ''
const EXACT_REGION: ExactOnlineRegion = (process.env.EXACT_ONLINE_REGION ?? 'NL') as ExactOnlineRegion

function getBaseUrl(region?: ExactOnlineRegion): string {
  return EXACT_ONLINE_REGIONS[region ?? EXACT_REGION].auth
}

// ─── TOKEN MANAGEMENT ───────────────────────────────────────────────────────

async function getTokenForClient(clientId: string) {
  const token = await db.exactOnlineToken.findUnique({ where: { clientId } })
  if (!token) throw new Error(`No Exact Online token found for client ${clientId}`)
  return token
}

async function refreshTokenIfNeeded(clientId: string) {
  const token = await getTokenForClient(clientId)
  const now = new Date()
  const expiresAt = new Date(token.expiresAt)

  // Refresh if less than 5 minutes remaining
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const baseUrl = getBaseUrl()
    const resp = await fetch(`${baseUrl}/api/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: EXACT_CLIENT_ID,
        client_secret: EXACT_CLIENT_SECRET,
      }),
    })

    if (!resp.ok) {
      throw new Error(`Exact Online token refresh failed: ${resp.status}`)
    }

    const data = await resp.json()

    await db.exactOnlineToken.update({
      where: { clientId },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    })

    return data.access_token as string
  }

  return token.accessToken
}

// ─── API HELPER ─────────────────────────────────────────────────────────────

async function exactApi(
  division: string,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: Record<string, unknown>
    accessToken: string
  }
) {
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}/api/v1/${division}/${path}`

  const resp = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Exact Online API error ${resp.status}: ${text.slice(0, 500)}`)
  }

  const json = await resp.json()
  return json?.d ?? json
}

// ─── OAUTH FLOW ─────────────────────────────────────────────────────────────

export function getExactAuthUrl(region?: ExactOnlineRegion): string {
  const baseUrl = getBaseUrl(region)
  const params = new URLSearchParams({
    client_id: EXACT_CLIENT_ID,
    redirect_uri: EXACT_REDIRECT_URI,
    response_type: 'code',
    force_login: '0',
  })
  return `${baseUrl}/api/oauth2/auth?${params.toString()}`
}

export async function handleExactCallback(
  code: string,
  clientId: string,
  region?: ExactOnlineRegion
) {
  const baseUrl = getBaseUrl(region)

  // Exchange code for tokens
  const tokenResp = await fetch(`${baseUrl}/api/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: EXACT_REDIRECT_URI,
      client_id: EXACT_CLIENT_ID,
      client_secret: EXACT_CLIENT_SECRET,
    }),
  })

  if (!tokenResp.ok) {
    throw new Error(`Exact Online token exchange failed: ${tokenResp.status}`)
  }

  const tokenData = await tokenResp.json()
  const accessToken = tokenData.access_token as string

  // Get current division via /api/v1/current/Me
  const meResp = await fetch(`${baseUrl}/api/v1/current/Me?$select=CurrentDivision`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!meResp.ok) {
    throw new Error('Failed to fetch Exact Online division')
  }

  const meData = await meResp.json()
  const division = String(meData?.d?.results?.[0]?.CurrentDivision ?? '')

  if (!division) {
    throw new Error('No division found in Exact Online account')
  }

  // Save token
  await db.exactOnlineToken.upsert({
    where: { clientId },
    create: {
      clientId,
      division,
      accessToken,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    },
    update: {
      division,
      accessToken,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    },
  })

  // Update client
  await db.client.update({
    where: { id: clientId },
    data: {
      exactDivision: division,
      exactConnected: true,
      accountingSystem: 'EXACT_ONLINE',
    },
  })

  return { division }
}

// ─── CONTACTS (ACCOUNTS) ───────────────────────────────────────────────────

async function findOrCreateExactContact(
  clientId: string,
  supplier: { name: string; vatNumber: string | null }
): Promise<ContactResult | null> {
  const accessToken = await refreshTokenIfNeeded(clientId)
  const token = await getTokenForClient(clientId)
  const div = token.division

  // Search by VAT number first
  if (supplier.vatNumber) {
    const vatSearch = await exactApi(div, `crm/Accounts?$filter=VATNumber eq '${supplier.vatNumber}'&$select=ID,Name&$top=1`, {
      accessToken,
    })
    const results = vatSearch?.results ?? []
    if (results.length > 0) {
      return { contactId: results[0].ID, name: results[0].Name }
    }
  }

  // Search by name
  const nameSearch = await exactApi(div, `crm/Accounts?$filter=Name eq '${supplier.name.replace(/'/g, "''")}'&$select=ID,Name&$top=1`, {
    accessToken,
  })
  const nameResults = nameSearch?.results ?? []
  if (nameResults.length > 0) {
    return { contactId: nameResults[0].ID, name: nameResults[0].Name }
  }

  // Create new account (supplier)
  const newAccount = await exactApi(div, 'crm/Accounts', {
    method: 'POST',
    accessToken,
    body: {
      Name: supplier.name,
      VATNumber: supplier.vatNumber ?? undefined,
      Status: 'S', // Supplier
    },
  })

  return {
    contactId: newAccount?.ID ?? '',
    name: supplier.name,
  }
}

// ─── PURCHASE ENTRIES ───────────────────────────────────────────────────────

async function postPurchaseEntry(
  clientId: string,
  contactId: string,
  bill: BillPayload
): Promise<PostResult> {
  const accessToken = await refreshTokenIfNeeded(clientId)
  const token = await getTokenForClient(clientId)
  const div = token.division

  try {
    const entry = await exactApi(div, 'purchaseentry/PurchaseEntries', {
      method: 'POST',
      accessToken,
      body: {
        Supplier: contactId,
        Currency: bill.currency,
        EntryDate: bill.invoiceDate.toISOString(),
        DueDate: bill.dueDate?.toISOString() ?? undefined,
        YourRef: bill.invoiceNumber,
        Description: `Invoice ${bill.invoiceNumber} from ${bill.supplierName}`,
        PurchaseEntryLines: bill.lineItems.map((line) => ({
          GLAccount: line.accountCode, // This needs to be a GUID in Exact — see note below
          Description: line.description,
          AmountFC: line.quantity * line.unitAmount,
          VATCode: line.taxType ?? undefined,
        })),
      },
    })

    return {
      success: true,
      externalId: entry?.EntryNumber ?? entry?.EntryID ?? null,
      externalRef: `EXACT:${entry?.EntryNumber ?? ''}`,
    }
  } catch (err) {
    return {
      success: false,
      externalId: null,
      error: err instanceof Error ? err.message : 'Unknown Exact Online error',
    }
  }
}

// ─── GL ACCOUNT LOOKUP (needed because Exact uses GUIDs) ────────────────────

/**
 * Look up GL account GUID by account code.
 * Exact Online uses GUIDs for everything — we need to map human-readable
 * account codes (like "4940") to their internal GUIDs.
 */
export async function lookupGLAccount(
  clientId: string,
  accountCode: string
): Promise<string | null> {
  const accessToken = await refreshTokenIfNeeded(clientId)
  const token = await getTokenForClient(clientId)
  const div = token.division

  const result = await exactApi(div, `financial/GLAccounts?$filter=Code eq '${accountCode}'&$select=ID,Code,Description&$top=1`, {
    accessToken,
  })

  const accounts = result?.results ?? []
  return accounts.length > 0 ? accounts[0].ID : null
}

// ─── ADAPTER ────────────────────────────────────────────────────────────────

export const exactOnlineAdapter: AccountingAdapter = {
  name: 'Exact Online',
  isRealTime: true,

  async isConnected(clientId: string): Promise<boolean> {
    try {
      const token = await db.exactOnlineToken.findUnique({ where: { clientId } })
      if (!token) return false
      const expiry = new Date(token.expiresAt)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return expiry > dayAgo // Refreshable if not expired by more than 24h
    } catch {
      return false
    }
  },

  findOrCreateContact: findOrCreateExactContact,
  postBill: postPurchaseEntry,
}
