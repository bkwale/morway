import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const FIRM_ID = process.env.DEV_FIRM_ID ?? ''
const AVG_MINUTES_PER_INVOICE = 5

async function getDashboardData(firmId: string) {
  const now = new Date()
  const todayStart = new Date(now.setHours(0, 0, 0, 0))
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalClients,
    totalInvoices,
    autoPosted,
    exceptions,
    failed,
    pending,
    processing,
    autoPostedToday,
    activeRules,
    recentActivity,
    recentExceptions,
  ] = await Promise.all([
    db.client.count({ where: { firmId, active: true } }),
    db.invoice.count({ where: { client: { firmId } } }),
    db.invoice.count({ where: { client: { firmId }, status: 'AUTO_POSTED' } }),
    db.invoice.count({ where: { client: { firmId }, status: 'EXCEPTION' } }),
    db.invoice.count({ where: { client: { firmId }, status: 'FAILED' } }),
    db.invoice.count({ where: { client: { firmId }, status: 'PENDING' } }),
    db.invoice.count({ where: { client: { firmId }, status: 'PROCESSING' } }),
    db.invoice.count({
      where: {
        client: { firmId },
        status: 'AUTO_POSTED',
        postedAt: { gte: todayStart },
      },
    }),
    db.rule.count({ where: { firmId, active: true } }),
    db.auditLog.findMany({
      where: { invoice: { client: { firmId } } },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            grossAmount: true,
            currency: true,
            client: { select: { name: true } },
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    db.invoice.findMany({
      where: { client: { firmId }, status: 'EXCEPTION' },
      include: {
        client: { select: { name: true } },
        supplier: { select: { name: true } },
        exception: { select: { reason: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take: 5,
    }),
  ])

  const autoPostRate = totalInvoices > 0 ? Math.round((autoPosted / totalInvoices) * 100) : 0
  const hoursSaved = Math.round((autoPosted * AVG_MINUTES_PER_INVOICE) / 60 * 10) / 10

  // Weekly trend (invoices received in last 7 days)
  const weeklyInvoices = await db.invoice.count({
    where: { client: { firmId }, receivedAt: { gte: sevenDaysAgo } },
  })

  return {
    totalClients,
    totalInvoices,
    autoPosted,
    exceptions,
    failed,
    pending,
    processing,
    autoPostedToday,
    activeRules,
    autoPostRate,
    hoursSaved,
    weeklyInvoices,
    recentActivity,
    recentExceptions,
  }
}

const ACTION_LABELS: Record<string, string> = {
  RECEIVED: 'Invoice received',
  PARSED: 'Invoice parsed',
  SUPPLIER_MATCHED: 'Supplier matched',
  SUPPLIER_CREATED: 'New supplier created',
  RULE_APPLIED: 'Rule applied',
  AUTO_POSTED: 'Auto-posted',
  EXCEPTION_CREATED: 'Exception flagged',
  EXCEPTION_APPROVED: 'Exception approved',
  EXCEPTION_REJECTED: 'Exception rejected',
  PAYMENT_MATCHED: 'Payment matched',
  FAILED: 'Processing failed',
}

const ACTION_COLORS: Record<string, string> = {
  RECEIVED: 'bg-slate-400',
  PARSED: 'bg-blue-400',
  SUPPLIER_MATCHED: 'bg-blue-400',
  SUPPLIER_CREATED: 'bg-violet-400',
  RULE_APPLIED: 'bg-blue-400',
  AUTO_POSTED: 'bg-emerald-500',
  EXCEPTION_CREATED: 'bg-amber-400',
  EXCEPTION_APPROVED: 'bg-emerald-500',
  EXCEPTION_REJECTED: 'bg-red-400',
  PAYMENT_MATCHED: 'bg-emerald-500',
  FAILED: 'bg-red-500',
}

export default async function DashboardPage() {
  const d = await getDashboardData(FIRM_ID)

  const queueDepth = d.pending + d.processing

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      {/* System status bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {d.weeklyInvoices} invoice{d.weeklyInvoices !== 1 ? 's' : ''} this week
          </p>
        </div>
        <div className="flex items-center gap-4">
          {queueDepth > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {queueDepth} processing
            </span>
          )}
          {d.failed > 0 && (
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {d.failed} failed
            </Link>
          )}
          {queueDepth === 0 && d.failed === 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              All systems operational
            </span>
          )}
        </div>
      </div>

      {/* Exceptions alert — the thing that matters most */}
      {d.exceptions > 0 && (
        <Link href="/dashboard/exceptions" className="block mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between hover:bg-amber-100/60 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <span className="text-lg font-bold text-amber-700 tabular-nums">{d.exceptions}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {d.exceptions} exception{d.exceptions !== 1 ? 's' : ''} need{d.exceptions === 1 ? 's' : ''} review
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Invoices flagged for missing account codes, low confidence, or validation issues
                </p>
              </div>
            </div>
            <span className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors shrink-0">
              Review now
            </span>
          </div>
        </Link>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Auto-post Rate</p>
          <p className={`text-2xl font-bold mt-1.5 tabular-nums ${d.autoPostRate >= 70 ? 'text-emerald-700' : d.autoPostRate >= 40 ? 'text-amber-700' : 'text-slate-900'}`}>
            {d.autoPostRate}%
          </p>
          <p className="text-xs text-slate-400 mt-1">{d.autoPosted} of {d.totalInvoices} invoices</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Hours Saved</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1.5 tabular-nums">{d.hoursSaved}h</p>
          <p className="text-xs text-slate-400 mt-1">{d.autoPosted} invoices automated</p>
        </div>

        <Link href="/dashboard/rules" className="block">
          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors h-full">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Active Rules</p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{d.activeRules}</p>
            <p className="text-xs text-slate-400 mt-1">categorisation rules</p>
          </div>
        </Link>

        <Link href="/dashboard/clients" className="block">
          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors h-full">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Clients</p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{d.totalClients}</p>
            <p className="text-xs text-slate-400 mt-1">{d.autoPostedToday} posted today</p>
          </div>
        </Link>
      </div>

      {/* Two-column: Exceptions queue + Activity feed */}
      <div className="grid grid-cols-5 gap-6">
        {/* Exceptions queue */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Exception Queue</h2>
              <Link href="/dashboard/exceptions" className="text-xs font-medium text-slate-400 hover:text-slate-900 transition-colors">
                View all
              </Link>
            </div>

            {d.recentExceptions.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-emerald-600 font-medium">All clear</p>
                <p className="text-xs text-slate-400 mt-1">No exceptions to review</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {d.recentExceptions.map((inv) => (
                  <Link
                    key={inv.id}
                    href="/dashboard/exceptions"
                    className="block px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900 truncate">{inv.supplier?.name ?? 'Unknown'}</span>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0 ml-3">
                        {inv.currency} {inv.grossAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-600 truncate max-w-[180px]">
                        {inv.exception?.reason ?? 'Needs review'}
                      </span>
                      <span className="text-xs text-slate-400">{inv.client.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity feed */}
        <div className="col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
              <Link href="/dashboard/audit" className="text-xs font-medium text-slate-400 hover:text-slate-900 transition-colors">
                Full audit trail
              </Link>
            </div>

            {d.recentActivity.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-xs text-slate-400">Activity will appear as invoices are processed</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {d.recentActivity.map((log) => (
                  <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ACTION_COLORS[log.action] ?? 'bg-slate-300'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">{ACTION_LABELS[log.action] ?? log.action.replace(/_/g, ' ')}</span>
                        {' — '}
                        <span className="text-slate-500">{log.invoice.supplier?.name ?? 'Unknown'}</span>
                        {' '}
                        <span className="text-slate-400 font-mono text-xs">{log.invoice.invoiceNumber}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {log.invoice.client.name}
                        {' · '}
                        {timeAgo(new Date(log.createdAt))}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums shrink-0">
                      {log.invoice.currency} {log.invoice.grossAmount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-GB')
}
