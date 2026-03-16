'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface InvoiceActionsProps {
  invoiceId: string
  status: string
}

const ACTIONABLE_STATUSES = ['PENDING', 'EXCEPTION', 'FAILED']

export default function InvoiceActions({ invoiceId, status }: InvoiceActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!ACTIONABLE_STATUSES.includes(status) && status !== 'REJECTED') return null

  async function handleAction(action: 'approve' | 'reject' | 'delete') {
    setLoading(action)
    setError(null)

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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

  const canApprove = ACTIONABLE_STATUSES.includes(status)
  const canReject = ACTIONABLE_STATUSES.includes(status)
  const canDelete = status !== 'AUTO_POSTED' && status !== 'APPROVED' && status !== 'DELETED'

  return (
    <div className="space-y-3">
      {/* Action buttons */}
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

      {/* Error message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </div>
      )}
    </div>
  )
}
