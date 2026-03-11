import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const FIRM_ID = process.env.DEV_FIRM_ID ?? ''

// Average minutes an accountant spends manually processing one invoice
const AVG_MINUTES_PER_INVOICE = 5

async function getStats(firmId: string) {
  const [
    totalClients,
    totalInvoices,
    autoPosted,
    exceptions,
    failed,
    autoPostedToday,
    activeRules,
    recentInvoices,
  ] = await Promise.all([
    db.client.count({ where: { firmId, active: true } }),
    db.invoice.count({ where: { client: { firmId } } }),
    db.invoice.count({ where: { client: { firmId }, status: 'AUTO_POSTED' } }),
    db.invoice.count({ where: { client: { firmId }, status: 'EXCEPTION' } }),
    db.invoice.count({ where: { client: { firmId }, status: 'FAILED' } }),
    db.invoice.count({
      where: {
        client: { firmId },
        status: 'AUTO_POSTED',
        postedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    db.rule.count({ where: { firmId, active: true } }),
    db.invoice.findMany({
      where: { client: { firmId } },
      include: { client: { select: { name: true } }, supplier: { select: { name: true } } },
      orderBy: { receivedAt: 'desc' },
      take: 10,
    }),
  ])

  const autoPostRate = totalInvoices > 0 ? Math.round((autoPosted / totalInvoices) * 100) : 0
  const hoursSaved = Math.round((autoPosted * AVG_MINUTES_PER_INVOICE) / 60 * 10) / 10

  return {
    totalClients,
    totalInvoices,
    autoPosted,
    exceptions,
    failed,
    autoPostedToday,
    activeRules,
    autoPostRate,
    hoursSaved,
    recentInvoices,
  }
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
  const s = await getStats(FIRM_ID)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Your invoice automation at a glance</p>
      </div>

      {/* Value metrics — the row that sells */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <ValueCard label="Hours Saved" value={`${s.hoursSaved}h`} sub={`${s.autoPosted} invoices auto-posted`} color="emerald" />
        <ValueCard label="Auto-post Rate" value={`${s.autoPostRate}%`} sub={`${s.totalInvoices} total invoices`} color={s.autoPostRate >= 70 ? 'emerald' : 'amber'} />
        <ValueCard label="Active Rules" value={String(s.activeRules)} sub="categorisation rules" color="blue" href="/dashboard/rules" />
        <ValueCard label="Active Clients" value={String(s.totalClients)} sub="connected to Morway" color="slate" href="/dashboard/clients" />
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Exceptions to Review" value={s.exceptions} highlight={s.exceptions > 0} href="/dashboard/exceptions" />
        <StatCard label="Auto-posted Today" value={s.autoPostedToday} />
        <StatCard label="Failed" value={s.failed} highlight={s.failed > 0} />
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Invoices</h2>
          <Link href="/dashboard/invoices" className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors">
            View all →
          </Link>
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
            {s.recentInvoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No invoices yet. They&apos;ll appear here once Peppol invoices start flowing in.
                </td>
              </tr>
            )}
            {s.recentInvoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-3.5 font-medium text-slate-900">{inv.client.name}</td>
                <td className="px-6 py-3.5 text-slate-600">{inv.supplier?.name ?? '—'}</td>
                <td className="px-6 py-3.5">
                  <Link href={`/dashboard/invoices/${inv.id}`} className="font-mono text-xs text-slate-500 hover:text-slate-900">
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td className="px-6 py-3.5 text-right font-medium text-slate-900 tabular-nums">
                  {inv.currency} {inv.grossAmount.toFixed(2)}
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
    </div>
  )
}

function ValueCard({
  label,
  value,
  sub,
  color,
  href,
}: {
  label: string
  value: string
  sub: string
  color: 'emerald' | 'amber' | 'blue' | 'slate'
  href?: string
}) {
  const colorMap = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    slate: 'text-slate-700 bg-white border-slate-200',
  }

  const valueColorMap = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    blue: 'text-blue-700',
    slate: 'text-slate-900',
  }

  const content = (
    <div className={`rounded-xl border p-5 ${colorMap[color]} ${href ? 'hover:shadow-md cursor-pointer' : ''} transition-shadow`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-60 mb-2">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${valueColorMap[color]}`}>{value}</p>
      <p className="text-xs mt-1 opacity-50">{sub}</p>
    </div>
  )

  if (href) return <Link href={href} className="block">{content}</Link>
  return content
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
    <div className={`bg-white rounded-xl border p-5 transition-shadow ${highlight ? 'border-amber-300 shadow-sm shadow-amber-100' : 'border-slate-200'} ${href ? 'hover:shadow-md cursor-pointer' : ''}`}>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${highlight ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )

  if (href) return <Link href={href} className="block">{content}</Link>
  return content
}
