'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  currency: string
  grossAmount: number
  netAmount: number
  vatAmount: number
  status: string
  confidenceScore: number
  receivedAt: string
  client: { name: string }
  supplier: { name: string } | null
}

const STATUS_STYLES: Record<string, string> = {
  AUTO_POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  EXCEPTION: 'bg-amber-50 text-amber-700 border border-amber-200',
  PENDING: 'bg-slate-50 text-slate-600 border border-slate-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border border-blue-200',
  REJECTED: 'bg-red-50 text-red-700 border border-red-200',
  FAILED: 'bg-red-50 text-red-700 border border-red-200',
}

const FILTER_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'AUTO_POSTED', label: 'Posted' },
  { key: 'EXCEPTION', label: 'Exceptions' },
  { key: 'FAILED', label: 'Failed' },
] as const

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/invoices')
      .then((r) => r.json())
      .then(setInvoices)
      .finally(() => setLoading(false))
  }, [])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: invoices.length }
    for (const inv of invoices) {
      counts[inv.status] = (counts[inv.status] ?? 0) + 1
    }
    return counts
  }, [invoices])

  const filtered = useMemo(() => {
    let result = invoices
    if (filter !== 'ALL') {
      // "Posted" tab shows AUTO_POSTED, APPROVED, and POSTED
      if (filter === 'AUTO_POSTED') {
        result = result.filter((i) => ['AUTO_POSTED', 'APPROVED', 'POSTED'].includes(i.status))
      } else {
        result = result.filter((i) => i.status === filter)
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.client.name.toLowerCase().includes(q) ||
          (i.supplier?.name ?? '').toLowerCase().includes(q)
      )
    }
    return result
  }, [invoices, filter, search])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400">Loading invoices...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-400 mt-0.5">{invoices.length} total</p>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {FILTER_TABS.map((tab) => {
            const count = tab.key === 'AUTO_POSTED'
              ? (statusCounts['AUTO_POSTED'] ?? 0) + (statusCounts['APPROVED'] ?? 0) + (statusCounts['POSTED'] ?? 0)
              : (statusCounts[tab.key] ?? 0)
            const active = filter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`ml-1.5 ${active ? 'text-slate-400' : 'text-slate-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoices..."
          className="w-64 px-3 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Invoice</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Supplier</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Confidence</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                  {search ? 'No invoices match your search' : 'No invoices yet'}
                </td>
              </tr>
            )}
            {filtered.map((inv) => {
              const confPct = Math.round(inv.confidenceScore * 100)
              return (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="font-mono text-xs text-slate-700 hover:text-slate-900 font-medium"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-900">{inv.supplier?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{inv.client.name}</td>
                  <td className="px-5 py-3 text-right font-medium text-slate-900 tabular-nums">
                    {inv.currency} {Number(inv.grossAmount).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_STYLES[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {inv.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {confPct > 0 ? (
                      <div className="inline-flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${confPct >= 80 ? 'bg-emerald-500' : confPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${confPct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium tabular-nums ${confPct >= 80 ? 'text-emerald-600' : confPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                          {confPct}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs tabular-nums">
                    {new Date(inv.receivedAt).toLocaleDateString('en-GB')}
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
