import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function getInvoice(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true, vatNumber: true } },
      lineItems: { orderBy: { id: 'asc' } },
      exception: { include: { reviews: { include: { user: { select: { name: true } } } } } },
      auditLogs: { orderBy: { createdAt: 'asc' } },
    },
  })
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-slate-50 text-slate-600 border border-slate-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border border-blue-200',
  AUTO_POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  EXCEPTION: 'bg-amber-50 text-amber-700 border border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border border-red-200',
  FAILED: 'bg-red-50 text-red-700 border border-red-200',
  POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

const AUDIT_DOTS: Record<string, string> = {
  RECEIVED: 'bg-slate-400',
  PARSED: 'bg-blue-400',
  SUPPLIER_MATCHED: 'bg-blue-400',
  SUPPLIER_CREATED: 'bg-violet-400',
  RULE_APPLIED: 'bg-blue-400',
  AUTO_POSTED: 'bg-emerald-500',
  EXCEPTION_CREATED: 'bg-amber-400',
  EXCEPTION_APPROVED: 'bg-emerald-500',
  EXCEPTION_REJECTED: 'bg-red-400',
  FAILED: 'bg-red-500',
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const invoice = await getInvoice(id)

  if (!invoice) notFound()

  const confidencePct = Math.round(invoice.confidenceScore * 100)

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-5">
        <Link href="/dashboard/invoices" className="text-sm text-slate-400 hover:text-slate-900 transition-colors">
          &#8592; Invoices
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold text-slate-900 font-mono">{invoice.invoiceNumber}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${STATUS_STYLES[invoice.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {invoice.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            From <span className="font-medium text-slate-700">{invoice.supplier?.name ?? 'Unknown'}</span>
            {' '}&#8594;{' '}
            <Link href={`/dashboard/clients/${invoice.client.id}`} className="font-medium text-slate-700 hover:text-slate-900">
              {invoice.client.name}
            </Link>
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-slate-900 tabular-nums">
            {invoice.currency} {invoice.grossAmount.toFixed(2)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Net: {invoice.currency} {invoice.netAmount.toFixed(2)} · VAT: {invoice.currency} {invoice.vatAmount.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Invoice details + line items (2 cols) */}
        <div className="col-span-2 space-y-5">
          {/* Key info */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Invoice Date</p>
                <p className="text-slate-900 font-medium">{new Date(invoice.invoiceDate).toLocaleDateString('en-GB')}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Due Date</p>
                <p className="text-slate-900 font-medium">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Supplier VAT</p>
                <p className="text-slate-700 font-mono text-xs">{invoice.supplier?.vatNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
                    <div
                      className={`h-full rounded-full ${confidencePct >= 80 ? 'bg-emerald-500' : confidencePct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${confidencePct}%` }}
                    />
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${confidencePct >= 80 ? 'text-emerald-700' : confidencePct >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
                    {confidencePct}%
                  </span>
                </div>
              </div>
              {invoice.externalRef && (
                <div className="col-span-2">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">External Reference</p>
                  <p className="text-slate-700 font-mono text-xs">{invoice.externalRef}</p>
                </div>
              )}
              {invoice.xeroInvoiceId && (
                <div className="col-span-2">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">External Bill ID</p>
                  <p className="text-slate-700 font-mono text-xs">{invoice.xeroInvoiceId}</p>
                </div>
              )}
              {invoice.failureReason && (
                <div className="col-span-2">
                  <p className="text-red-400 text-xs uppercase tracking-wider mb-1">Failure Reason</p>
                  <p className="text-red-700 text-sm">{invoice.failureReason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Exception banner */}
          {invoice.exception && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <div className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5 shrink-0">&#9888;</span>
                <div>
                  <p className="text-sm font-medium text-amber-800">{invoice.exception.reason}</p>
                  {invoice.exception.resolution && (
                    <p className="text-xs text-amber-600 mt-1">
                      Resolved: {invoice.exception.resolution}
                      {invoice.exception.resolvedAt && ` on ${new Date(invoice.exception.resolvedAt).toLocaleDateString('en-GB')}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Line items */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Line Items</h2>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/60">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Qty</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Unit Price</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">VAT %</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 text-slate-900">{item.description}</td>
                      <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{item.quantity}</td>
                      <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{item.unitPrice.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{item.vatRate}%</td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900 tabular-nums">{item.lineTotal.toFixed(2)}</td>
                      <td className="px-5 py-3">
                        {item.accountCode ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {item.accountCode}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            Unmatched
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Timeline (1 col) */}
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Timeline</h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="space-y-4">
              {invoice.auditLogs.map((log, i) => {
                let detail: Record<string, unknown> = {}
                try { detail = JSON.parse(log.detail ?? '{}') } catch { /* ignore */ }

                return (
                  <div key={log.id} className="relative">
                    {i < invoice.auditLogs.length - 1 && (
                      <div className="absolute left-[5px] top-5 bottom-0 w-px bg-slate-200" />
                    )}
                    <div className="flex gap-3">
                      <div className={`w-[10px] h-[10px] rounded-full mt-1 shrink-0 ${AUDIT_DOTS[log.action] ?? 'bg-slate-300'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {log.action.replace(/_/g, ' ')}
                        </p>
                        {Object.keys(detail).length > 0 && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {Object.entries(detail)
                              .filter(([, v]) => v !== null && v !== undefined)
                              .slice(0, 3)
                              .map(([k, v]) => `${k}: ${typeof v === 'number' ? (k === 'confidence' ? `${Math.round(Number(v) * 100)}%` : v) : v}`)
                              .join(' · ')}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-300 mt-1">
                          {new Date(log.createdAt).toLocaleString('en-GB')}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
              {invoice.auditLogs.length === 0 && (
                <p className="text-sm text-slate-400">No audit entries</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
