import { db } from '@/lib/db'
import Link from 'next/link'

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
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <Link
          href="/dashboard/clients/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
        >
          Add Client
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Peppol ID</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Xero</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Invoices</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Exceptions</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                  No clients yet. Add your first client.
                </td>
              </tr>
            )}
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 font-medium text-gray-900">{client.name}</td>
                <td className="px-6 py-3 text-gray-500 font-mono text-xs">
                  {client.peppolId ?? <span className="text-gray-300">Not set</span>}
                </td>
                <td className="px-6 py-3">
                  {client.xeroConnected ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Connected
                    </span>
                  ) : (
                    <Link
                      href={`/api/xero/connect?clientId=${client.id}`}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      Connect Xero
                    </Link>
                  )}
                </td>
                <td className="px-6 py-3 text-right text-gray-700">{client._count.invoices}</td>
                <td className="px-6 py-3 text-right">
                  {client.invoices.length > 0 ? (
                    <span className="font-semibold text-yellow-600">{client.invoices.length}</span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="text-xs text-gray-500 hover:text-gray-900"
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
