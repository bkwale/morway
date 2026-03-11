'use client'

import { useEffect, useState } from 'react'

interface ExceptionInvoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  currency: string
  grossAmount: number
  confidenceScore: number
  supplier: { name: string } | null
  client: { name: string }
  exception: { reason: string } | null
  lineItems: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    vatRate: number
    lineTotal: number
    accountCode: string | null
  }>
}

export default function ExceptionsPage() {
  const [invoices, setInvoices] = useState<ExceptionInvoice[]>([])
  const [selected, setSelected] = useState<ExceptionInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')

  // TODO: get from session
  const USER_ID = ''

  useEffect(() => {
    fetch(`/api/invoices/exceptions`)
      .then((r) => r.json())
      .then(setInvoices)
      .finally(() => setLoading(false))
  }, [])

  function selectInvoice(invoice: ExceptionInvoice) {
    setSelected(invoice)
    const initial: Record<string, string> = {}
    invoice.lineItems.forEach((item) => {
      if (item.accountCode) initial[item.id] = item.accountCode
    })
    setOverrides(initial)
    setNotes('')
  }

  async function handleApprove() {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/invoices/${selected.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, accountCodeOverrides: overrides, notes }),
      })
      if (res.ok) {
        setInvoices((prev) => prev.filter((i) => i.id !== selected.id))
        setSelected(null)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReject() {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/invoices/${selected.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, notes }),
      })
      if (res.ok) {
        setInvoices((prev) => prev.filter((i) => i.id !== selected.id))
        setSelected(null)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400">Loading exceptions...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Exception list */}
      <div className="w-[380px] border-r border-slate-200 overflow-auto bg-white">
        <div className="px-5 py-4 border-b border-slate-100">
          <h1 className="text-base font-semibold text-slate-900">
            Exceptions
            {invoices.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                {invoices.length}
              </span>
            )}
          </h1>
        </div>

        {invoices.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400">No exceptions to review</p>
            <p className="text-xs text-slate-300 mt-1">All invoices are processing normally</p>
          </div>
        )}

        {invoices.map((invoice) => (
          <button
            key={invoice.id}
            onClick={() => selectInvoice(invoice)}
            className={`w-full text-left px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
              selected?.id === invoice.id ? 'bg-amber-50/50 border-l-2 border-l-amber-400' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-900">{invoice.client.name}</span>
              <span className="text-sm font-semibold text-slate-900 tabular-nums">
                {invoice.currency} {invoice.grossAmount.toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-slate-500">{invoice.supplier?.name ?? 'Unknown supplier'}</div>
            <div className="text-xs text-amber-600 mt-1.5 truncate">{invoice.exception?.reason}</div>
          </button>
        ))}
      </div>

      {/* Review panel */}
      <div className="flex-1 p-8 overflow-auto bg-slate-50">
        {!selected && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-400">Select an invoice to review</p>
          </div>
        )}

        {selected && (
          <div className="max-w-2xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selected.supplier?.name ?? 'Unknown Supplier'}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {selected.client.name} · Invoice {selected.invoiceNumber}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {selected.currency} {selected.grossAmount.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Confidence: {Math.round(selected.confidenceScore * 100)}%
                </p>
              </div>
            </div>

            {/* Flag reason */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
              <strong className="font-medium">Flagged:</strong> {selected.exception?.reason}
            </div>

            {/* Line items with account code inputs */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider grid grid-cols-12 gap-2">
                <span className="col-span-5">Description</span>
                <span className="col-span-2 text-right">Amount</span>
                <span className="col-span-5">Account Code</span>
              </div>

              {selected.lineItems.map((item) => (
                <div key={item.id} className="px-4 py-3 border-b border-slate-100 last:border-0 grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-5 text-sm text-slate-700 truncate">{item.description}</span>
                  <span className="col-span-2 text-sm text-right font-medium text-slate-900 tabular-nums">
                    {item.lineTotal.toFixed(2)}
                  </span>
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={overrides[item.id] ?? ''}
                      onChange={(e) =>
                        setOverrides((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="e.g. 429"
                      className="w-full text-sm bg-white text-slate-900 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full text-sm bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                placeholder="Add a note..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Posting...' : 'Approve & Post to Xero'}
              </button>
              <button
                onClick={handleReject}
                disabled={submitting}
                className="px-5 py-2.5 border border-slate-300 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
