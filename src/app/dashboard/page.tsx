import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const FIRM_ID = process.env.DEV_FIRM_ID ?? ''

async function getStats(firmId: string) {
  const [totalClients, exceptions, autoPostedToday, recentInvoices] = await Promise.all([
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
  AUTO_POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  EXCEPTION: 'bg-amber-50 text-amber-700 border border-amber-200',
  PENDING: 'bg-slate-50 text-slate-600 border border-slate-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border border-blue-200',
  REJECTED: 'bg-red-50 text-red-700 border border-red-200',
  FAILED: 'bg-red-50 text-red-700 border border-red-200',
}

export default async function DashboardPage() {
  const stats = await getStats(FIRM_ID)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Your invoice pipeline at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-10">
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Recent Invoices</h2>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Supplier</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Invoice #</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stats.recentInvoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No invoices yet. They&apos;ll appear here once Peppol invoices start flowing in.
                </td>
              </tr>
            )}
            {stats.recentInvoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-3.5 font-medium text-slate-900">{invoice.client.name}</td>
                <td className="px-6 py-3.5 text-slate-600">{invoice.supplier?.name ?? '—'}</td>
                <td className="px-6 py-3.5 text-slate-500 font-mono text-xs">{invoice.invoiceNumber}</td>
                <td className="px-6 py-3.5 text-right font-medium text-slate-900 tabular-nums">
                  {invoice.currency} {invoice.grossAmount.toFixed(2)}
                </td>
                <td className="px-6 py-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_STYLES[invoice.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {invoice.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-slate-400 text-xs">
                  {new Date(invoice.receivedAt).toLocaleDateString('en-GB')}
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
    <div className={`bg-white rounded-xl border p-6 transition-shadow ${highlight ? 'border-amber-300 shadow-sm shadow-amber-100' : 'border-slate-200'} ${href ? 'hover:shadow-md cursor-pointer' : ''}`}>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-2 tabular-nums ${highlight ? 'text-amber-600' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )

  if (href) {
    return <Link href={href} className="block">{content}</Link>
  }

  return content
}
