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

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/dashboard/clients"
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Clients
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          {client.peppolId && (
            <p className="mt-1 text-sm text-gray-500 font-mono">{client.peppolId}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {client.xeroConnected ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
              Xero Connected
            </span>
          ) : (
            <Link
              href={`/api/xero/connect?clientId=${client.id}`}
              className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-700 transition-colors"
            >
              Connect Xero
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Invoices</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{client._count.invoices}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Exceptions</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{exceptions}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Suppliers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{client.suppliers.length}</p>
        </div>
      </div>

      {/* Recent Invoices */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Invoices</h2>
      <div className="bg-white rounded-lg border border-gray-200 mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {client.invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                  No invoices yet.
                </td>
              </tr>
            )}
            {client.invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 font-mono text-xs text-gray-700">{inv.invoiceNumber ?? '—'}</td>
                <td className="px-6 py-3 text-gray-900">{inv.supplier?.name ?? '—'}</td>
                <td className="px-6 py-3 text-right text-gray-700">
                  {inv.currency} {Number(inv.grossAmount).toLocaleString('en', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-3">
                  <StatusBadge status={inv.status} />
                </td>
                <td className="px-6 py-3 text-gray-500 text-xs">
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
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Known Suppliers</h2>
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="divide-y divide-gray-100">
              {client.suppliers.map((s) => (
                <div key={s.id} className="px-6 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-900">{s.name}</span>
                  {s.vatNumber && (
                    <span className="text-xs text-gray-400 font-mono">{s.vatNumber}</span>
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-700',
    PROCESSING: 'bg-blue-100 text-blue-700',
    AUTO_POSTED: 'bg-green-100 text-green-700',
    EXCEPTION: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-700',
    POSTED: 'bg-green-100 text-green-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
