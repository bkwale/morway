'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Rule {
  id: string
  keyword: string | null
  accountCode: string
  priority: number
  active: boolean
  clientId: string | null
  supplierId: string | null
  createdAt: string
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [keyword, setKeyword] = useState('')
  const [accountCode, setAccountCode] = useState('')
  const [priority, setPriority] = useState(10)

  useEffect(() => {
    fetch('/api/rules')
      .then((r) => r.json())
      .then(setRules)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword || null, accountCode, priority }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed (${res.status})`)
      }

      const newRule = await res.json()
      setRules((prev) => [newRule, ...prev])
      setKeyword('')
      setAccountCode('')
      setPriority(10)
      setShowForm(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function toggleRule(rule: Rule) {
    try {
      const res = await fetch('/api/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, active: !rule.active }),
      })
      if (res.ok) {
        setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)))
      }
    } catch {
      /* ignore */
    }
  }

  async function deleteRule(id: string) {
    try {
      const res = await fetch('/api/rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id))
      }
    } catch {
      /* ignore */
    }
  }

  function getScopeLabel(rule: Rule) {
    if (rule.supplierId) return 'Supplier'
    if (rule.clientId) return 'Client'
    return 'Firm-wide'
  }

  function getScopeStyle(rule: Rule) {
    if (rule.supplierId) return 'bg-violet-50 text-violet-700 border-violet-200'
    if (rule.clientId) return 'bg-blue-50 text-blue-700 border-blue-200'
    return 'bg-slate-50 text-slate-600 border-slate-200'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400">Loading rules...</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Rules</h1>
          <p className="text-sm text-slate-500 mt-1">
            {rules.filter((r) => r.active).length} active rule{rules.filter((r) => r.active).length !== 1 ? 's' : ''}
            {' · '}Rules determine how invoices are categorised automatically
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Rule'}
        </button>
      </div>

      {/* How rules work */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-xl px-5 py-4 mb-6">
        <p className="text-sm text-blue-800 font-medium mb-1">How rules work</p>
        <p className="text-xs text-blue-600 leading-relaxed">
          When an invoice arrives, Morway checks each line item description against your rules. If a keyword matches, the
          corresponding account code is applied automatically. Rules are evaluated by priority (highest first) and scope
          (supplier-specific beats client-specific beats firm-wide). Invoices with all line items matched at 80%+ confidence
          are auto-posted to Xero. The rest go to your exception queue for review.
        </p>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">New Rule</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Keyword</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. software, hosting, rent"
                  className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                />
                <p className="mt-1 text-xs text-slate-400">Leave empty for default/catch-all</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Account Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  required
                  placeholder="e.g. 429, 600, 300"
                  className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                />
                <p className="mt-1 text-xs text-slate-400">Xero chart of accounts code</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-slate-400">Higher = evaluated first</p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Create Rule'}
            </button>
          </form>
        </div>
      )}

      {/* Rules table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Keyword</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Account Code</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Scope</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Priority</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No rules yet. Add your first rule to start auto-categorising invoices.
                </td>
              </tr>
            )}
            {rules.map((rule) => (
              <tr key={rule.id} className={`hover:bg-slate-50/50 transition-colors ${!rule.active ? 'opacity-50' : ''}`}>
                <td className="px-6 py-3.5">
                  {rule.keyword ? (
                    <span className="font-mono text-sm text-slate-900">&quot;{rule.keyword}&quot;</span>
                  ) : (
                    <span className="text-slate-400 italic">Default / catch-all</span>
                  )}
                </td>
                <td className="px-6 py-3.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {rule.accountCode}
                  </span>
                </td>
                <td className="px-6 py-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${getScopeStyle(rule)}`}>
                    {getScopeLabel(rule)}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-right text-slate-600 tabular-nums">{rule.priority}</td>
                <td className="px-6 py-3.5">
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
                      rule.active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {rule.active ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="text-xs text-slate-400 hover:text-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
