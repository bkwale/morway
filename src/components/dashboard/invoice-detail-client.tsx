'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  lineTotal: number
  accountCode: string | null
  vatExemptionReason?: string | null
}

interface VatBreakdownEntry {
  rate: number
  taxableAmount: number
  vatAmount: number
}

interface InvoiceDetailClientProps {
  invoiceId: string
  clientId: string
  status: string
  lineItems: LineItem[]
  currency: string
  grossAmount: number
  // VAT fields
  supplierVatNumber?: string | null
  buyerVatNumber?: string | null
  reverseCharge?: boolean
  vatExemptionReason?: string | null
  vatBreakdown?: VatBreakdownEntry[]
  // Payment fields
  paymentStatus?: string
  paidAmount?: number
  // Credit note linking
  linkedInvoiceId?: string | null
  linkedInvoiceNumber?: string | null
  documentType?: string
}

const ACTIONABLE_STATUSES = ['PENDING', 'EXCEPTION', 'FAILED']

// ─── ACCOUNT CODE AUTOCOMPLETE ──────────────────────────────────────────────

interface CodeSuggestion {
  code: string
  label: string
  source: 'learned' | 'reference'
  keyword?: string | null
}

function AccountCodeInput({
  value,
  onChange,
  clientId,
  placeholder = 'e.g. 601',
  hasCode,
}: {
  value: string
  onChange: (v: string) => void
  clientId: string
  placeholder?: string
  hasCode: boolean
}) {
  const [suggestions, setSuggestions] = useState<CodeSuggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const fetchSuggestions = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/account-codes?clientId=${clientId}&q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.codes ?? [])
      }
    } catch {
      // Fail silently — autocomplete is enhancement, not critical path
    } finally {
      setLoading(false)
    }
  }, [clientId])

  const handleInputChange = useCallback((newValue: string) => {
    onChange(newValue)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (newValue.trim().length >= 1) {
        fetchSuggestions(newValue.trim())
        setShowDropdown(true)
      } else {
        setShowDropdown(false)
      }
    }, 200)
  }, [onChange, fetchSuggestions])

  const handleSelect = useCallback((code: string) => {
    onChange(code)
    setShowDropdown(false)
  }, [onChange])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (value.trim().length >= 1) {
            fetchSuggestions(value.trim())
            setShowDropdown(true)
          }
        }}
        placeholder={placeholder}
        className={`w-24 px-2 py-1 rounded-md text-[12px] font-mono border focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent ${
          hasCode
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-amber-50 border-amber-200 text-amber-700 placeholder:text-amber-400'
        }`}
      />

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-400">Loading...</div>
          )}
          {suggestions.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => handleSelect(s.code)}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-xs border-b border-slate-50 last:border-0"
            >
              <span className="font-mono font-medium text-slate-900 min-w-[3.5rem]">{s.code}</span>
              <span className="text-slate-500 truncate">{s.label}</span>
              {s.source === 'learned' && (
                <span className="ml-auto text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full shrink-0">
                  learned
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── VAT EXEMPTION BADGE ────────────────────────────────────────────────────

const VAT_EXEMPTION_LABELS: Record<string, string> = {
  REVERSE_CHARGE: 'Reverse Charge',
  INTRA_COMMUNITY: 'Intra-Community',
  EXPORT: 'Export (0%)',
  EXEMPT_MEDICAL: 'Medical Exempt',
  EXEMPT_EDUCATION: 'Education Exempt',
  EXEMPT_FINANCIAL: 'Financial Exempt',
  SMALL_BUSINESS: 'Small Business',
  OTHER: 'VAT Exempt',
}

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  UNPAID: 'bg-red-50 text-red-700 border-red-200',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OVERDUE: 'bg-red-100 text-red-800 border-red-300',
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function InvoiceDetailClient({
  invoiceId,
  clientId,
  status,
  lineItems,
  currency,
  grossAmount,
  supplierVatNumber,
  buyerVatNumber,
  reverseCharge,
  vatExemptionReason,
  vatBreakdown,
  paymentStatus = 'UNPAID',
  paidAmount = 0,
  linkedInvoiceId,
  linkedInvoiceNumber,
  documentType,
}: InvoiceDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState(paymentStatus)
  const [currentPaidAmount, setCurrentPaidAmount] = useState(paidAmount)

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
  const canRecordPayment = ['APPROVED', 'AUTO_POSTED'].includes(status) && currentPaymentStatus !== 'PAID'

  const handleOverride = useCallback((lineItemId: string, value: string) => {
    setOverrides((prev) => ({ ...prev, [lineItemId]: value }))
  }, [])

  async function handleAction(action: 'approve' | 'reject' | 'delete') {
    setLoading(action)
    setError(null)

    try {
      const body: Record<string, unknown> = {}

      if (action === 'approve') {
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

  async function handleRecordPayment() {
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Enter a valid payment amount')
      return
    }

    setLoading('payment')
    setError(null)

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to record payment')
        return
      }

      setCurrentPaymentStatus(data.paymentStatus)
      setCurrentPaidAmount(data.paidAmount)
      setShowPaymentForm(false)
      setPaymentAmount('')
      router.refresh()
    } catch {
      setError('Network error — could not record payment')
    } finally {
      setLoading(null)
    }
  }

  const missingCount = lineItems.filter(
    (item) => !(overrides[item.id]?.trim())
  ).length

  const remaining = Math.round((grossAmount - currentPaidAmount) * 100) / 100

  return (
    <>
      {/* VAT + Payment info bar */}
      <div className="mb-6 flex flex-wrap gap-3">
        {/* Reverse charge badge */}
        {reverseCharge && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            Reverse Charge
          </span>
        )}

        {/* VAT exemption */}
        {vatExemptionReason && !reverseCharge && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {VAT_EXEMPTION_LABELS[vatExemptionReason] ?? vatExemptionReason}
          </span>
        )}

        {/* Credit note link */}
        {documentType === 'CREDIT_NOTE' && linkedInvoiceId && (
          <a
            href={`/dashboard/invoices/${linkedInvoiceId}`}
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors"
          >
            Credits: {linkedInvoiceNumber ?? linkedInvoiceId.slice(0, 8)}
          </a>
        )}

        {/* Payment status */}
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${PAYMENT_STATUS_STYLES[currentPaymentStatus] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
          {currentPaymentStatus === 'PAID'
            ? 'Paid'
            : currentPaymentStatus === 'PARTIALLY_PAID'
            ? `Partially paid (${currency} ${currentPaidAmount.toFixed(2)} / ${grossAmount.toFixed(2)})`
            : currentPaymentStatus === 'OVERDUE'
            ? 'Overdue'
            : 'Unpaid'}
        </span>

        {/* Record payment button */}
        {canRecordPayment && !showPaymentForm && (
          <button
            onClick={() => setShowPaymentForm(true)}
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            + Record payment
          </button>
        )}

        {/* VAT numbers */}
        {supplierVatNumber && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200">
            Supplier: {supplierVatNumber}
          </span>
        )}
        {buyerVatNumber && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200">
            Buyer: {buyerVatNumber}
          </span>
        )}
      </div>

      {/* Payment form */}
      {showPaymentForm && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
          <span className="text-xs text-slate-500">Amount ({currency}):</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={remaining}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder={remaining.toFixed(2)}
            className="w-32 px-3 py-1.5 rounded-md text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <button
            onClick={handleRecordPayment}
            disabled={loading === 'payment'}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {loading === 'payment' ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => { setShowPaymentForm(false); setPaymentAmount('') }}
            className="px-3 py-1.5 rounded-md text-sm text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

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

      {/* Line items table with editable account codes + autocomplete */}
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
                    <td className="px-5 py-3 text-slate-900">
                      {item.description}
                      {item.vatExemptionReason && (
                        <span className="ml-2 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                          {VAT_EXEMPTION_LABELS[item.vatExemptionReason] ?? 'Exempt'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{item.quantity}</td>
                    <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{item.unitPrice.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{item.vatRate}%</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900 tabular-nums">{item.lineTotal.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      {isEditable ? (
                        <AccountCodeInput
                          value={code}
                          onChange={(v) => handleOverride(item.id, v)}
                          clientId={clientId}
                          hasCode={hasCode}
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

      {/* VAT Breakdown */}
      {vatBreakdown && vatBreakdown.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">VAT Breakdown</h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">VAT Rate</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Taxable Amount</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">VAT Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vatBreakdown.map((entry, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-900">{entry.rate}%</td>
                    <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{currency} {entry.taxableAmount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900 tabular-nums">{currency} {entry.vatAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
