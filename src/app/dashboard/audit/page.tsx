import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const FIRM_ID = process.env.DEV_FIRM_ID ?? ''

const ACTION_STYLES: Record<string, string> = {
  RECEIVED: 'bg-slate-50 text-slate-600 border border-slate-200',
  PARSED: 'bg-blue-50 text-blue-700 border border-blue-200',
  SUPPLIER_MATCHED: 'bg-blue-50 text-blue-700 border border-blue-200',
  SUPPLIER_CREATED: 'bg-violet-50 text-violet-700 border border-violet-200',
  RULE_APPLIED: 'bg-blue-50 text-blue-700 border border-blue-200',
  AUTO_POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  EXCEPTION_CREATED: 'bg-amber-50 text-amber-700 border border-amber-200',
  EXCEPTION_APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  EXCEPTION_REJECTED: 'bg-red-50 text-red-700 border border-red-200',
  PAYMENT_MATCHED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border border-red-200',
}

const ACTION_LABELS: Record<string, string> = {
  RECEIVED: 'Received',
  PARSED: 'Parsed',
  SUPPLIER_MATCHED: 'Supplier matched',
  SUPPLIER_CREATED: 'Supplier created',
  RULE_APPLIED: 'Rule applied',
  AUTO_POSTED: 'Auto-posted',
  EXCEPTION_CREATED: 'Exception flagged',
  EXCEPTION_APPROVED: 'Approved',
  EXCEPTION_REJECTED: 'Rejected',
  PAYMENT_MATCHED: 'Payment matched',
  FAILED: 'Failed',
}

const DOT_COLORS: Record<string, string> = {
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

async function getAuditLogs(firmId: string) {
  return db.auditLog.findMany({
    where: { invoice: { client: { firmId } } },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          grossAmount: true,
          currency: true,
          client: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
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

export default async function AuditPage() {
  const logs = await getAuditLogs(FIRM_ID)

  // Group logs by date
  const grouped: Record<string, typeof logs> = {}
  for (const log of logs) {
    const dateKey = new Date(log.createdAt).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(log)
  }

  return (
    <div className="p-6 lg:p-8 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Audit Trail</h1>
        <p className="text-sm text-slate-400 mt-0.5">Full history of every invoice action</p>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No audit logs yet</p>
          <p className="text-xs text-slate-400 mt-1">Logs will appear as invoices are processed</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateKey, dateLogs]) => (
            <div key={dateKey}>
              <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">{dateKey}</h2>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-50">
                  {dateLogs.map((log) => {
                    let detail: Record<string, unknown> = {}
                    try { detail = JSON.parse(log.detail ?? '{}') } catch { /* ignore */ }

                    return (
                      <div key={log.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${DOT_COLORS[log.action] ?? 'bg-slate-300'}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${ACTION_STYLES[log.action] ?? 'bg-slate-100 text-slate-600'}`}>
                              {ACTION_LABELS[log.action] ?? log.action.replace(/_/g, ' ')}
                            </span>
                            <Link
                              href={`/dashboard/invoices/${log.invoice.id}`}
                              className="text-xs font-mono text-slate-500 hover:text-slate-900 transition-colors"
                            >
                              {log.invoice.invoiceNumber}
                            </Link>
                          </div>

                          <p className="text-sm text-slate-700">
                            {log.invoice.supplier?.name ?? 'Unknown supplier'}
                            <span className="text-slate-400"> · </span>
                            <span className="text-slate-500">{log.invoice.client.name}</span>
                          </p>

                          {Object.keys(detail).length > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-lg">
                              {Object.entries(detail)
                                .filter(([k, v]) => v !== null && v !== undefined && !['source', 'invoiceNumber'].includes(k))
                                .slice(0, 4)
                                .map(([k, v]) => `${k}: ${typeof v === 'number' ? (k === 'confidence' ? `${Math.round(Number(v) * 100)}%` : v) : v}`)
                                .join(' · ')}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs text-slate-500 tabular-nums">
                            {log.invoice.currency} {log.invoice.grossAmount.toFixed(2)}
                          </span>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {timeAgo(new Date(log.createdAt))}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
