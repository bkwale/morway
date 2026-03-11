import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// TODO: Replace with session-based firmId
const FIRM_ID = process.env.DEV_FIRM_ID ?? ''

async function getStats(firmId: string) {
  const [
    totalClients,
    exceptions,
    autoPostedToday,
    recentInvoices,
  ] = await Promise.all([
    db.client.count({ where: { firmId, active: true } }),
    db.invoice.count({ where: { client: { firmId }, status: 'EXCEPTION' } }),
    db.invoice.count({
      where: {
        client: { firmId },
        status: 'AUTO_POSTED',
        postedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    db.invoice.findMany({
      where: { client: { firmId } },
      include: { client: { select: { name: true } }, supplier: { select: { name: true } } },
      orderBy: { receivedAt: 'desc' },
      take: 10,
    }),
  ])

  return { totalClients, exceptions, autoPostedToday, recentInvoices }
}

const STATUS_STYLES: Record<string, string> = {
  AUTO_POSTED: 'bg-green-100 text-green-800',
  APPROVED: 'bg-green-100 text-green-800',
  EXCEPTION: 'bg-yellow-100 text-yellow-800',
  PENDING: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-blue-100 text-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
  FAILED: 'bg-red-100 text-red-800',
}

export default async function DashboardPage() {
  const stats = await getStats(FIRM_ID)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Active Clients" value={stats.totalClients} />
        <StatCard
          label="Exceptions to Review"
          value={stats.exceptions}
          highlight={stats.exceptions > 0}
          href="/dashboard/exceptions"
        />
        <StatCard label="Auto-posted Today" value={stats.autoPostedToday} />
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Recent Invoices</h2>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stats.recentInvoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                  No invoices yet
                </td>
              </tr>
            )}
            {stats.recentInvoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 font-medium text-gray-900">{invoice.client.name}</td>
                <td className="px-6 py-3 text-gray-600">{invoice.supplier?.name ?? '—'}</td>
                <td className="px-6 py-3 text-gray-600 font-mono text-xs">{invoice.invoiceNumber}</td>
                <td className="px-6 py-3 text-right font-medium text-gray-900">
                  {invoice.currency} {invoice.grossAmount.toFixed(2)}
                </td>
                <td className="px-6 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[invoice.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {invoice.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-3 text-gray-500 text-xs">
                  {new Date(invoice.receivedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight,
  href,
}: {
  label: string
  value: number
  highlight?: boolean
  href?: string
}) {
  const content = (
    <div className={`bg-white rounded-lg border p-5 ${highlight ? 'border-yellow-300' : 'border-gray-200'}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${highlight ? 'text-yellow-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )

  if (href) {
    return <Link href={href} className="block hover:shadow-sm transition-shadow">{content}</Link>
  }

  return content
}
