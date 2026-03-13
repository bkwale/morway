import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const FIRM_ID = process.env.DEV_FIRM_ID ?? ''

async function getClients(firmId: string) {
  return db.client.findMany({
    where: { firmId, active: true },
    include: {
      _count: { select: { invoices: true } },
      invoices: {
        where: { status: 'EXCEPTION' },
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' },
  })
}

function clientSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function getAccountingBadge(client: {
  accountingSystem: string
  xeroConnected: boolean
  exactConnected: boolean
  datevConsultNo: string | null
  datevClientNo: string | null
}) {
  if (client.accountingSystem === 'NONE') {
    return { label: 'Not configured', style: 'bg-slate-100 text-slate-500 border-slate-200' }
  }
  if (client.accountingSystem === 'XERO') {
    return client.xeroConnected
      ? { label: 'Xero', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      : { label: 'Xero (disconnected)', style: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  if (client.accountingSystem === 'EXACT_ONLINE') {
    return client.exactConnected
      ? { label: 'Exact Online', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      : { label: 'Exact (disconnected)', style: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  if (client.accountingSystem === 'DATEV') {
    return { label: `DATEV${client.datevConsultNo ? ` (${client.datevConsultNo}/${client.datevClientNo})` : ''}`, style: 'bg-violet-50 text-violet-700 border-violet-200' }
  }
  return { label: client.accountingSystem, style: 'bg-slate-100 text-slate-500 border-slate-200' }
}

export default async function ClientsPage() {
  const clients = await getClients(FIRM_ID)

  const totalExceptions = clients.reduce((sum, c) => sum + c.invoices.length, 0)

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {clients.length} active · {totalExceptions} pending exception{totalExceptions !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/dashboard/clients/onboard"
          className="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          + Onboard Client
        </Link>
      </div>

      {/* Client cards */}
      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-slate-500 mb-2">No clients yet</p>
          <p className="text-xs text-slate-400 mb-4">Add your first client to get started</p>
          <Link
            href="/dashboard/clients/onboard"
            className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            + Onboard Client
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {clients.map((client) => {
            const badge = getAccountingBadge(client)
            const slug = clientSlug(client.name)
            const inboundEmail = `${slug}@in.morway.app`
            const hasExceptions = client.invoices.length > 0

            return (
              <Link
                key={client.id}
                href={`/dashboard/clients/${client.id}`}
                className="block"
              >
                <div className={`bg-white rounded-xl border shadow-sm p-5 hover:border-slate-300 transition-all ${
                  hasExceptions ? 'border-amber-200' : 'border-slate-200'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{client.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{inboundEmail}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${badge.style}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-lg font-bold text-slate-900 tabular-nums">{client._count.invoices}</span>
                      <span className="text-xs text-slate-400 ml-1">invoices</span>
                    </div>
                    {hasExceptions && (
                      <div>
                        <span className="text-lg font-bold text-amber-600 tabular-nums">{client.invoices.length}</span>
                        <span className="text-xs text-amber-500 ml-1">exception{client.invoices.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {client.peppolId && (
                      <div className="ml-auto">
                        <span className="text-[11px] text-slate-400 font-mono">{client.peppolId}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
