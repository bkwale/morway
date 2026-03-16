import { db } from '@/lib/db'
import { requireSession } from '@/lib/get-session'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function getClient(id: string, firmId: string) {
  const client = await db.client.findUnique({
    where: { id },
    include: {
      invoices: {
        orderBy: { receivedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          invoiceNumber: true,
          grossAmount: true,
          currency: true,
          status: true,
          confidenceScore: true,
          receivedAt: true,
          supplier: { select: { name: true } },
        },
      },
      suppliers: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, vatNumber: true, defaultAccount: true },
      },
      _count: { select: { invoices: true } },
    },
  })
  // Scope check
  if (client && client.firmId !== firmId) return null
  return client
}

function clientSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-slate-50 text-slate-600 border border-slate-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border border-blue-200',
  AUTO_POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  EXCEPTION: 'bg-amber-50 text-amber-700 border border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border border-red-200',
  POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border border-red-200',
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireSession()
  const { id } = await params
  const client = await getClient(id, session.user.firmId)

  if (!client) notFound()

  const exceptions = client.invoices.filter((i) => i.status === 'EXCEPTION').length
  const autoPosted = client.invoices.filter((i) => ['AUTO_POSTED', 'APPROVED', 'POSTED'].includes(i.status)).length
  const slug = clientSlug(client.name)
  const inboundEmail = `${slug}@in.morway.app`

  return (
    <div className="p-6 lg:p-8">
      {/* Breadcrumb */}
      <div className="mb-5">
        <Link href="/dashboard/clients" className="text-sm text-slate-400 hover:text-slate-900 transition-colors">
          &#8592; Clients
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{client.name}</h1>
          <p className="mt-1 text-sm text-slate-400 font-mono">{inboundEmail}</p>
          {client.peppolId && (
            <p className="mt-0.5 text-xs text-slate-400">Peppol: {client.peppolId}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {client.accountingSystem === 'XERO' && (
            client.xeroConnected ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Xero Connected
              </span>
            ) : (
              <Link
                href={`/api/xero/connect?clientId=${client.id}`}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                Connect Xero
              </Link>
            )
          )}
          {client.accountingSystem === 'EXACT_ONLINE' && (
            client.exactConnected ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Exact Online Connected
              </span>
            ) : (
              <Link
                href={`/api/exact-online/connect?clientId=${client.id}`}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Connect Exact Online
              </Link>
            )
          )}
          {client.accountingSystem === 'DATEV' && (
            <>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                DATEV {client.datevConsultNo ? `(${client.datevConsultNo}/${client.datevClientNo})` : ''}
              </span>
              <Link
                href={`/api/export/datev?clientId=${client.id}`}
                className="px-4 py-2 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors"
              >
                Export Buchungsstapel
              </Link>
            </>
          )}
          {client.accountingSystem === 'LEXWARE' && (
            <>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                Lexware
              </span>
              <Link
                href={`/api/export/lexware?clientId=${client.id}&type=suppliers`}
                className="px-3 py-2 bg-white text-red-700 text-xs font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
              >
                Export Kreditoren
              </Link>
              <Link
                href={`/api/export/lexware?clientId=${client.id}`}
                className="px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Export Buchungen
              </Link>
            </>
          )}
          {client.accountingSystem === 'FEC' && (
            <>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                FEC (France)
              </span>
              <Link
                href={`/api/export/fec?clientId=${client.id}`}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Export FEC
              </Link>
            </>
          )}
          {['PENNYLANE', 'MONEYBIRD', 'TWINFIELD', 'OCTOPUS'].includes(client.accountingSystem) && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              {client.accountingSystem.charAt(0) + client.accountingSystem.slice(1).toLowerCase()} (coming soon)
            </span>
          )}
          {client.accountingSystem === 'NONE' && (
            <Link
              href={`/dashboard/clients/onboard?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              Set Up Accounting
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Invoices</p>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{client._count.invoices}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Auto-posted</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1.5 tabular-nums">{autoPosted}</p>
        </div>
        <div className={`bg-white rounded-xl border p-5 ${exceptions > 0 ? 'border-amber-200' : 'border-slate-200'}`}>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Exceptions</p>
          <p className={`text-2xl font-bold mt-1.5 tabular-nums ${exceptions > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{exceptions}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Suppliers</p>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{client.suppliers.length}</p>
        </div>
      </div>

      {/* Inbound email info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 mb-6">
        <p className="text-sm text-slate-600">
          Forward invoices for {client.name} to{' '}
          <span className="font-mono font-medium text-slate-900">{inboundEmail}</span>
          {' '}and they will be automatically processed.
        </p>
      </div>

      {/* Recent Invoices */}
      <h2 className="text-base font-semibold text-slate-900 mb-3">Recent Invoices</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Invoice #</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Supplier</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Confidence</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {client.invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                  No invoices yet. Forward invoices to {inboundEmail} to get started.
                </td>
              </tr>
            )}
            {client.invoices.map((inv) => {
              const confPct = Math.round(inv.confidenceScore * 100)
              return (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="font-mono text-xs text-slate-700 hover:text-slate-900 font-medium">
                      {inv.invoiceNumber ?? '—'}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-900">{inv.supplier?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-right text-slate-700 tabular-nums">
                    {inv.currency} {Number(inv.grossAmount).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_STYLES[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {inv.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {confPct > 0 ? (
                      <span className={`text-xs font-medium tabular-nums ${confPct >= 80 ? 'text-emerald-600' : confPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {confPct}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {new Date(inv.receivedAt).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Suppliers */}
      {client.suppliers.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-slate-900 mb-3">Known Suppliers</h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {client.suppliers.map((s) => (
                <div key={s.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-sm text-slate-900 font-medium">{s.name}</span>
                    {s.vatNumber && (
                      <span className="text-xs text-slate-400 font-mono ml-3">{s.vatNumber}</span>
                    )}
                  </div>
                  {s.defaultAccount && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {s.defaultAccount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
