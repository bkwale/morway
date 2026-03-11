import { XeroClient } from 'xero-node'
import { db } from './db'

const xero = new XeroClient({
  clientId: process.env.XERO_CLIENT_ID!,
  clientSecret: process.env.XERO_CLIENT_SECRET!,
  redirectUris: [process.env.XERO_REDIRECT_URI!],
  scopes: ['openid', 'profile', 'email', 'accounting.transactions', 'accounting.contacts', 'offline_access'],
})

export { xero }

// ─── TOKEN MANAGEMENT ────────────────────────────────────────────────────────

export async function getTokensForClient(clientId: string) {
  const token = await db.xeroToken.findUnique({ where: { clientId } })
  if (!token) throw new Error(`No Xero token found for client ${clientId}`)
  return token
}

export async function refreshTokenIfNeeded(clientId: string) {
  const token = await getTokensForClient(clientId)
  const now = new Date()
  const expiresAt = new Date(token.expiresAt)

  // Refresh if less than 5 minutes remaining
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    xero.setTokenSet({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    })

    const newTokenSet = await xero.refreshToken()

    await db.xeroToken.update({
      where: { clientId },
      data: {
        accessToken: newTokenSet.access_token!,
        refreshToken: newTokenSet.refresh_token!,
        expiresAt: new Date((newTokenSet.expires_at ?? 0) * 1000),
      },
    })

    return newTokenSet
  }

  return {
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expires_at: Math.floor(expiresAt.getTime() / 1000),
  }
}

async function initXeroForClient(clientId: string) {
  const tokenSet = await refreshTokenIfNeeded(clientId)
  xero.setTokenSet(tokenSet)
  const token = await getTokensForClient(clientId)
  return token.tenantId
}

// ─── CONTACTS ────────────────────────────────────────────────────────────────

export async function findOrCreateContact(
  clientId: string,
  supplier: { name: string; vatNumber: string | null }
) {
  const tenantId = await initXeroForClient(clientId)

  // Search by VAT number first, then by name
  const contacts = await xero.accountingApi.getContacts(tenantId, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, supplier.vatNumber ? `TaxNumber=="${supplier.vatNumber}"` : undefined)

  if (contacts.body.contacts && contacts.body.contacts.length > 0) {
    return contacts.body.contacts[0]
  }

  // Search by name
  const nameSearch = await xero.accountingApi.getContacts(tenantId, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, `Name.ToLower()==${JSON.stringify(supplier.name.toLowerCase())}`)

  if (nameSearch.body.contacts && nameSearch.body.contacts.length > 0) {
    return nameSearch.body.contacts[0]
  }

  // Create new contact
  const newContact = await xero.accountingApi.createContacts(tenantId, {
    contacts: [
      {
        name: supplier.name,
        taxNumber: supplier.vatNumber ?? undefined,
        isSupplier: true,
      },
    ],
  })

  return newContact.body.contacts?.[0] ?? null
}

// ─── INVOICES (BILLS) ────────────────────────────────────────────────────────

export interface XeroBillLine {
  description: string
  quantity: number
  unitAmount: number
  accountCode: string
  taxType?: string
}

export async function postBillToXero(
  clientId: string,
  xeroContactId: string,
  invoice: {
    invoiceNumber: string
    invoiceDate: Date
    dueDate: Date | null
    currency: string
    lineItems: XeroBillLine[]
  }
) {
  const tenantId = await initXeroForClient(clientId)

  const bill = await xero.accountingApi.createInvoices(tenantId, {
    invoices: [
      {
        type: 'ACCPAY' as any, // Accounts payable (bill)
        contact: { contactID: xeroContactId },
        date: invoice.invoiceDate.toISOString().split('T')[0],
        dueDate: invoice.dueDate?.toISOString().split('T')[0] ?? undefined,
        invoiceNumber: invoice.invoiceNumber,
        currencyCode: invoice.currency as any,
        lineItems: invoice.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitAmount: item.unitAmount,
          accountCode: item.accountCode,
          taxType: item.taxType ?? 'INPUT2',
        })),
        status: 'AUTHORISED' as any,
      },
    ],
  })

  return bill.body.invoices?.[0] ?? null
}

// ─── OAUTH HELPERS ───────────────────────────────────────────────────────────

export async function getXeroAuthUrl(): Promise<string> {
  return await xero.buildConsentUrl()
}

export async function handleXeroCallback(code: string, clientId: string) {
  const tokenSet = await xero.apiCallback(
    `${process.env.XERO_REDIRECT_URI}?code=${code}`
  )

  await xero.updateTenants()
  const tenants = xero.tenants

  if (!tenants || tenants.length === 0) {
    throw new Error('No Xero organisation connected')
  }

  const tenant = tenants[0]

  await db.xeroToken.upsert({
    where: { clientId },
    create: {
      clientId,
      tenantId: tenant.tenantId,
      accessToken: tokenSet.access_token!,
      refreshToken: tokenSet.refresh_token!,
      expiresAt: new Date((tokenSet.expires_at ?? 0) * 1000),
    },
    update: {
      tenantId: tenant.tenantId,
      accessToken: tokenSet.access_token!,
      refreshToken: tokenSet.refresh_token!,
      expiresAt: new Date((tokenSet.expires_at ?? 0) * 1000),
    },
  })

  await db.client.update({
    where: { id: clientId },
    data: {
      xeroTenantId: tenant.tenantId,
      xeroConnected: true,
    },
  })

  return tenant
}
