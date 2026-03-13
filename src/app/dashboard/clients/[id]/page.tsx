import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function getClient(id: string) {
  return db.client.findUnique({
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
          receivedAt: true,
          supplier: { select: { name: true } },
        },
      },
      suppliers: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, vatNumber: true },
      },
      _count: { select: { invoices: true } },
    },
  })
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = await getClient(id)

  if (!client) notFound()

  const exceptions = client.invoices.filter((i) => i.status === 'EXCEPTION').length

  const STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-slate-50 text-slate-600 border border-slate-200',
    PROCESSING: 'bg-blue-50 text-blue-700 border border-blue-200',
    AUTO_POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    EXCEPTION: 'bg-amber-50 text-amber-700 border border-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    REJECTED: 'bg-red-50 text-red-700 border border-red-200',
    POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/dashboard/clients"
          className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Clients
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{client.name}</h1>
          {client.peppolId && (
            <p className="mt-1 text-sm text-slate-400 font-mono">{client.peppolId}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Accounting system badge + actions */}
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
          {client.accountingSystem === 'NONE' && (
            <Link
              href="/dashboard/clients/onboard"
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              Set Up Accounting
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Invoices</p>
          <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">{client._count.invoices}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Exceptions</p>
          <p className="text-2xl font-bold text-amber-600 mt-2 tabular-nums">{exceptions}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Suppliers</p>
          <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">{client.suppliers.length}</p>
        </div>
      </div>

      {/* Recent Invoices */}
      <h2 className="text-base font-semibold text-slate-900 mb-3">Recent Invoices</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Invoice #</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Supplier</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {client.invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  No invoices yet.
                </td>
              </tr>
            )}
            {client.invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-3.5 font-mono text-xs text-slate-700">{inv.invoiceNumber ?? '—'}</td>
                <td className="px-6 py-3.5 text-slate-900">{inv.supplier?.name ?? '—'}</td>
                <td className="px-6 py-3.5 text-right text-slate-700 tabular-nums">
                  {inv.currency} {Number(inv.grossAmount).toLocaleString('en', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_STYLES[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {inv.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-slate-400 text-xs">
                  {new Date(inv.receivedAt).toLocaleDateString('en-GB')}
                </td>
              </tr>
            ))}
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
                <div key={s.id} className="px-6 py-3.5 flex items-center justify-between">
                  <span className="text-sm text-slate-900">{s.name}</span>
                  {s.vatNumber && (
                    <span className="text-xs text-slate-400 font-mono">{s.vatNumber}</span>
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
