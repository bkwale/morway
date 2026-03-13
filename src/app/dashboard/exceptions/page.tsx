'use client'

import { useEffect, useState, useCallback } from 'react'

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

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ succeeded: number; failed: number } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const USER_ID = ''

  useEffect(() => {
    fetch(`/api/invoices/exceptions`)
      .then((r) => r.json())
      .then(setInvoices)
      .finally(() => setLoading(false))
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  function selectInvoice(invoice: ExceptionInvoice) {
    if (bulkMode) {
      toggleBulkSelect(invoice.id)
      return
    }
    setSelected(invoice)
    const initial: Record<string, string> = {}
    invoice.lineItems.forEach((item) => {
      if (item.accountCode) initial[item.id] = item.accountCode
    })
    setOverrides(initial)
    setNotes('')
  }

  function toggleBulkSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(invoices.map((i) => i.id)))
    }
  }

  function enterBulkMode() {
    setBulkMode(true)
    setSelected(null)
    setSelectedIds(new Set())
    setBulkResult(null)
  }

  function exitBulkMode() {
    setBulkMode(false)
    setSelectedIds(new Set())
    setBulkResult(null)
  }

  async function handleBulkAction(action: 'approve' | 'reject') {
    if (selectedIds.size === 0) return
    setBulkSubmitting(true)
    setBulkResult(null)

    try {
      const res = await fetch('/api/invoices/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: Array.from(selectedIds),
          action,
          notes: action === 'reject' ? 'Bulk rejected' : undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setBulkResult({ succeeded: data.succeeded, failed: data.failed })

        const succeededIds = new Set(
          data.results
            .filter((r: { success: boolean }) => r.success)
            .map((r: { invoiceId: string }) => r.invoiceId)
        )
        setInvoices((prev) => prev.filter((i) => !succeededIds.has(i.id)))
        setSelectedIds(new Set())
        setToast({ message: `${data.succeeded} invoice${data.succeeded !== 1 ? 's' : ''} ${action === 'approve' ? 'approved' : 'rejected'}`, type: 'success' })
      }
    } finally {
      setBulkSubmitting(false)
    }
  }

  const handleApprove = useCallback(async () => {
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
        setToast({ message: `Invoice ${selected.invoiceNumber} approved & posted`, type: 'success' })
        setSelected(null)
      } else {
        const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
        setToast({ message: data.error || 'Approval failed', type: 'error' })
      }
    } catch (err) {
      setToast({ message: `Network error: ${err instanceof Error ? err.message : 'unknown'}`, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [selected, overrides, notes])

  const handleReject = useCallback(async () => {
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
        setToast({ message: `Invoice ${selected.invoiceNumber} rejected`, type: 'success' })
        setSelected(null)
      } else {
        const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
        setToast({ message: data.error || 'Rejection failed', type: 'error' })
      }
    } catch (err) {
      setToast({ message: `Network error: ${err instanceof Error ? err.message : 'unknown'}`, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [selected, notes])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'a' && selected && !submitting) {
        e.preventDefault()
        handleApprove()
      }
      if (e.key === 'r' && selected && !submitting) {
        e.preventDefault()
        handleReject()
      }
      if (e.key === 'Escape') {
        setSelected(null)
        if (bulkMode) exitBulkMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, submitting, handleApprove, handleReject, bulkMode])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400">Loading exceptions...</p>
      </div>
    )
  }

  const unmatchedCount = selected
    ? selected.lineItems.filter((i) => !overrides[i.id] && !i.accountCode).length
    : 0

  return (
    <div className="flex h-full relative">
      {/* Toast notification */}
      {toast && (
        <div className={`absolute top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Exception list */}
      <div className="w-[400px] border-r border-slate-200 overflow-auto bg-white flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-base font-semibold text-slate-900">
              Exceptions
              {invoices.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                  {invoices.length}
                </span>
              )}
            </h1>
            {invoices.length > 0 && (
              <button
                onClick={bulkMode ? exitBulkMode : enterBulkMode}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                {bulkMode ? 'Cancel' : 'Bulk Select'}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {invoices.length > 0
              ? 'Invoices that need manual review'
              : 'No exceptions to review'}
          </p>

          {/* Bulk action bar */}
          {bulkMode && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={selectAll}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  {selectedIds.size === invoices.length ? 'Deselect all' : 'Select all'}
                </button>
                <span className="text-xs text-slate-400">
                  {selectedIds.size} selected
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction('approve')}
                  disabled={selectedIds.size === 0 || bulkSubmitting}
                  className="flex-1 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                >
                  {bulkSubmitting ? 'Processing...' : `Approve ${selectedIds.size}`}
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  disabled={selectedIds.size === 0 || bulkSubmitting}
                  className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  Reject {selectedIds.size}
                </button>
              </div>

              {bulkResult && (
                <div className={`text-xs px-3 py-2 rounded-lg ${
                  bulkResult.failed > 0
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {bulkResult.succeeded} processed{bulkResult.failed > 0 ? `, ${bulkResult.failed} failed` : ''}
                </div>
              )}
            </div>
          )}
        </div>

        {invoices.length === 0 && (
          <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <span className="text-emerald-500 text-lg font-bold">&#10003;</span>
            </div>
            <p className="text-sm font-medium text-slate-700">All clear</p>
            <p className="text-xs text-slate-400 mt-1">No exceptions to review</p>
          </div>
        )}

        {invoices.map((invoice) => (
          <button
            key={invoice.id}
            onClick={() => selectInvoice(invoice)}
            className={`w-full text-left px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
              selected?.id === invoice.id ? 'bg-amber-50/50 border-l-2 border-l-amber-400' : ''
            } ${bulkMode && selectedIds.has(invoice.id) ? 'bg-slate-50' : ''}`}
          >
            <div className="flex items-center gap-3">
              {bulkMode && (
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedIds.has(invoice.id)
                      ? 'bg-slate-900 border-slate-900'
                      : 'border-slate-300'
                  }`}
                >
                  {selectedIds.has(invoice.id) && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {invoice.supplier?.name ?? 'Unknown supplier'}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0 ml-3">
                    {invoice.currency} {invoice.grossAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{invoice.client.name}</span>
                  <span className="text-xs text-slate-400 font-mono">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-amber-600 truncate max-w-[220px]">
                    {invoice.exception?.reason ?? 'Needs review'}
                  </span>
                  <span className={`text-[10px] tabular-nums font-medium ${
                    Math.round(invoice.confidenceScore * 100) >= 80 ? 'text-emerald-600' :
                    Math.round(invoice.confidenceScore * 100) >= 50 ? 'text-amber-600' : 'text-red-500'
                  }`}>
                    {Math.round(invoice.confidenceScore * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Review panel */}
      <div className="flex-1 p-6 lg:p-8 overflow-auto bg-slate-50">
        {!selected && !bulkMode && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-xs">
              <p className="text-sm text-slate-400 mb-2">Select an invoice to review</p>
              {invoices.length > 1 && (
                <p className="text-xs text-slate-300">
                  or use <span className="font-medium text-slate-400">Bulk Select</span> for batch processing
                </p>
              )}
            </div>
          </div>
        )}

        {bulkMode && !selected && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-slate-400 text-xl">&#9745;</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Bulk Mode</h2>
              <p className="text-sm text-slate-500">
                Select invoices from the list, then approve or reject them all at once.
                Only invoices where all line items have account codes can be bulk-approved.
              </p>
            </div>
          </div>
        )}

        {selected && (
          <div className="max-w-2xl">
            {/* Invoice header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selected.supplier?.name ?? 'Unknown Supplier'}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {selected.client.name} · <span className="font-mono">{selected.invoiceNumber}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {selected.currency} {selected.grossAmount.toFixed(2)}
                </p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        Math.round(selected.confidenceScore * 100) >= 80 ? 'bg-emerald-500' :
                        Math.round(selected.confidenceScore * 100) >= 50 ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${Math.round(selected.confidenceScore * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {Math.round(selected.confidenceScore * 100)}% confidence
                  </span>
                </div>
              </div>
            </div>

            {/* Flag reason */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
              <div className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5 shrink-0">&#9888;</span>
                <div>
                  <p className="text-sm font-medium text-amber-800">{selected.exception?.reason}</p>
                  {unmatchedCount > 0 && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      {unmatchedCount} line item{unmatchedCount !== 1 ? 's' : ''} need account codes
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Line items with account code inputs */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5">
              <div className="px-4 py-3 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider grid grid-cols-12 gap-2">
                <span className="col-span-4">Description</span>
                <span className="col-span-1 text-right">Qty</span>
                <span className="col-span-2 text-right">Amount</span>
                <span className="col-span-5">Account Code</span>
              </div>

              {selected.lineItems.map((item) => {
                const hasCode = !!(overrides[item.id] || item.accountCode)
                return (
                  <div key={item.id} className={`px-4 py-3 border-b border-slate-100 last:border-0 grid grid-cols-12 gap-2 items-center ${!hasCode ? 'bg-amber-50/30' : ''}`}>
                    <span className="col-span-4 text-sm text-slate-700 truncate" title={item.description}>
                      {item.description}
                    </span>
                    <span className="col-span-1 text-sm text-right text-slate-500 tabular-nums">
                      {item.quantity}
                    </span>
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
                        className={`w-full text-sm bg-white text-slate-900 border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400 ${
                          hasCode ? 'border-emerald-200' : 'border-amber-300'
                        }`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full text-sm bg-white text-slate-900 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400 resize-none"
                placeholder="Add a note for the audit trail..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Posting...' : 'Approve & Post'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="px-5 py-2.5 border border-slate-300 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">A</kbd> approve
                {' · '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">R</kbd> reject
                {' · '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">Esc</kbd> close
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
