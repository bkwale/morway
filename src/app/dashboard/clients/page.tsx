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

export default async function ClientsPage() {
  const clients = await getClients(FIRM_ID)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">{clients.length} active client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/dashboard/clients/onboard"
          className="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          + Onboard Client
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Peppol ID</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Xero</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Invoices</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Exceptions</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No clients yet. Add your first client to get started.
                </td>
              </tr>
            )}
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-3.5 font-medium text-slate-900">{client.name}</td>
                <td className="px-6 py-3.5 text-slate-500 font-mono text-xs">
                  {client.peppolId ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-6 py-3.5">
                  {client.xeroConnected ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Connected
                    </span>
                  ) : (
                    <Link
                      href={`/api/xero/connect?clientId=${client.id}`}
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-colors"
                    >
                      Connect
                    </Link>
                  )}
                </td>
                <td className="px-6 py-3.5 text-right text-slate-700 tabular-nums">{client._count.invoices}</td>
                <td className="px-6 py-3.5 text-right">
                  {client.invoices.length > 0 ? (
                    <span className="font-semibold text-amber-600 tabular-nums">{client.invoices.length}</span>
                  ) : (
                    <span className="text-slate-300">0</span>
                  )}
                </td>
                <td className="px-6 py-3.5 text-right">
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
