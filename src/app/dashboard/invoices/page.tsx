import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const FIRM_ID = process.env.DEV_FIRM_ID ?? ''

const STATUS_STYLES: Record<string, string> = {
  AUTO_POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  EXCEPTION: 'bg-amber-50 text-amber-700 border border-amber-200',
  PENDING: 'bg-slate-50 text-slate-600 border border-slate-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border border-blue-200',
  REJECTED: 'bg-red-50 text-red-700 border border-red-200',
  FAILED: 'bg-red-50 text-red-700 border border-red-200',
}

async function getInvoices(firmId: string) {
  return db.invoice.findMany({
    where: { client: { firmId } },
    include: {
      client: { select: { name: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { receivedAt: 'desc' },
    take: 200,
  })
}

async function getStats(firmId: string) {
  const [total, autoPosted, exceptions, failed] = await Promise.all([
    db.invoice.count({ where: { client: { firmId } } }),
    db.invoice.count({ where: { client: { firmId }, status: 'AUTO_POSTED' } }),
    db.invoice.count({ where: { client: { firmId }, status: 'EXCEPTION' } }),
    db.invoice.count({ where: { client: { firmId }, status: 'FAILED' } }),
  ])
  return { total, autoPosted, exceptions, failed }
}

export default async function InvoicesPage() {
  const [invoices, stats] = await Promise.all([getInvoices(FIRM_ID), getStats(FIRM_ID)])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
        <p className="text-sm text-slate-500 mt-1">{stats.total} total · {stats.autoPosted} auto-posted · {stats.exceptions} exceptions · {stats.failed} failed</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Invoice #</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Supplier</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Confidence</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Received</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                  No invoices yet. Run the seed or wait for Peppol invoices.
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const confPct = Math.round(inv.confidenceScore * 100)
              return (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3.5">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="font-mono text-xs text-slate-700 hover:text-slate-900 font-medium">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-slate-900 font-medium">{inv.client.name}</td>
                  <td className="px-6 py-3.5 text-slate-600">{inv.supplier?.name ?? '—'}</td>
                  <td className="px-6 py-3.5 text-right font-medium text-slate-900 tabular-nums">
                    {inv.currency} {inv.grossAmount.toFixed(2)}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_STYLES[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {inv.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={`text-xs font-medium tabular-nums ${confPct >= 80 ? 'text-emerald-600' : confPct >= 50 ? 'text-amber-600' : confPct > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                      {confPct > 0 ? `${confPct}%` : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-slate-400 text-xs">
                    {new Date(inv.receivedAt).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors">
                      View →
                    </Link>
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
