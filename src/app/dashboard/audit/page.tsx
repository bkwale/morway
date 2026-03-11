import { db } from '@/lib/db'

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

async function getAuditLogs(firmId: string) {
  return db.auditLog.findMany({
    where: { invoice: { client: { firmId } } },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          client: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

export default async function AuditPage() {
  const logs = await getAuditLogs(FIRM_ID)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Audit Trail</h1>
        <p className="text-sm text-slate-500 mt-1">Full history of every invoice action</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Invoice</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  No audit logs yet. Logs will appear as invoices are processed.
                </td>
              </tr>
            )}
            {logs.map((log) => {
              let detail: Record<string, unknown> = {}
              try { detail = JSON.parse(log.detail ?? '{}') } catch { /* ignore */ }

              return (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                    {new Date(log.createdAt).toLocaleString('en-GB')}
                  </td>
                  <td className="px-6 py-3.5 text-slate-700 font-medium">
                    {log.invoice.client.name}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-xs text-slate-500">
                    {log.invoice.invoiceNumber}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${ACTION_STYLES[log.action] ?? 'bg-slate-100 text-slate-600'}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-400 max-w-xs truncate">
                    {Object.entries(detail)
                      .filter(([, v]) => v !== null && v !== undefined)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
