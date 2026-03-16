'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  lineTotal: number
  accountCode: string | null
}

interface InvoiceDetailClientProps {
  invoiceId: string
  status: string
  lineItems: LineItem[]
}

const ACTIONABLE_STATUSES = ['PENDING', 'EXCEPTION', 'FAILED']

export default function InvoiceDetailClient({
  invoiceId,
  status,
  lineItems,
}: InvoiceDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Track account code overrides (lineItemId → accountCode)
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const item of lineItems) {
      initial[item.id] = item.accountCode ?? ''
    }
    return initial
  })

  const isEditable = ACTIONABLE_STATUSES.includes(status)
  const canApprove = ACTIONABLE_STATUSES.includes(status)
  const canReject = ACTIONABLE_STATUSES.includes(status)
  const canDelete = status !== 'AUTO_POSTED' && status !== 'APPROVED' && status !== 'DELETED'
  const showActions = ACTIONABLE_STATUSES.includes(status) || status === 'REJECTED'

  const handleOverride = useCallback((lineItemId: string, value: string) => {
    setOverrides((prev) => ({ ...prev, [lineItemId]: value }))
  }, [])

  async function handleAction(action: 'approve' | 'reject' | 'delete') {
    setLoading(action)
    setError(null)

    try {
      // Build request body
      const body: Record<string, unknown> = {}

      if (action === 'approve') {
        // Collect account code overrides — only changed values
        const changed: Record<string, string> = {}
        for (const item of lineItems) {
          const newCode = overrides[item.id]?.trim()
          if (newCode && newCode !== (item.accountCode ?? '')) {
            changed[item.id] = newCode
          }
        }
        if (Object.keys(changed).length > 0) {
          body.accountCodeOverrides = changed
        }
      }

      const res = await fetch(`/api/invoices/${invoiceId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? `Failed to ${action}`)
        return
      }

      if (action === 'delete') {
        router.push('/dashboard/invoices')
      } else {
        router.refresh()
      }
    } catch {
      setError(`Network error — could not ${action}`)
    } finally {
      setLoading(null)
      setShowDeleteConfirm(false)
    }
  }

  // Count how many line items are still missing account codes
  const missingCount = lineItems.filter(
    (item) => !(overrides[item.id]?.trim())
  ).length

  return (
    <>
      {/* Action bar */}
      {showActions && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            {canApprove && (
              <button
                onClick={() => handleAction('approve')}
                disabled={loading !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading === 'approve' ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>&#10003;</span>
                )}
                Approve
              </button>
            )}

            {canReject && (
              <button
                onClick={() => handleAction('reject')}
                disabled={loading !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading === 'reject' ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : (
                  <span>&#10007;</span>
                )}
                Reject
              </button>
            )}

            {canApprove && missingCount > 0 && (
              <span className="text-xs text-amber-600 ml-2">
                {missingCount} line item{missingCount !== 1 ? 's' : ''} missing account codes
              </span>
            )}

            {canDelete && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
              >
                Delete
              </button>
            )}

            {showDeleteConfirm && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-red-600">Are you sure?</span>
                <button
                  onClick={() => handleAction('delete')}
                  disabled={loading !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {loading === 'delete' ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Line items table with editable account codes */}
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
              {lineItems.map((item) => {
                const code = overrides[item.id] ?? item.accountCode ?? ''
                const hasCode = code.trim().length > 0

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-900">{item.description}</td>
                    <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{item.quantity}</td>
                    <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{item.unitPrice.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{item.vatRate}%</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900 tabular-nums">{item.lineTotal.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      {isEditable ? (
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => handleOverride(item.id, e.target.value)}
                          placeholder="e.g. 601"
                          className={`w-20 px-2 py-1 rounded-md text-[12px] font-mono border focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent ${
                            hasCode
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700 placeholder:text-amber-400'
                          }`}
                        />
                      ) : hasCode ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {code}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          Unmatched
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
