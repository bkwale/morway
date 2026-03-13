'use client'

import { useEffect, useState } from 'react'

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

  const activeRules = rules.filter((r) => r.active)
  const disabledRules = rules.filter((r) => !r.active)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400">Loading rules...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1000px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Rules</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {activeRules.length} active · {disabledRules.length} disabled
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
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 mb-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          When an invoice arrives, Morway checks each line item description against your rules.
          If a keyword matches, the account code is applied automatically. Rules are evaluated by
          priority (highest first) and scope (supplier &gt; client &gt; firm-wide). Invoices with
          all items matched at 80%+ confidence are auto-posted. The rest go to exceptions.
        </p>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-5">
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
                  placeholder="e.g. 4200, 6300, 3000"
                  className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                />
                <p className="mt-1 text-xs text-slate-400">Chart of accounts code</p>
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

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-slate-500 mb-2">No rules yet</p>
          <p className="text-xs text-slate-400 mb-4">Add your first rule to start auto-categorising invoices</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            + Add Rule
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules
            .sort((a, b) => b.priority - a.priority)
            .map((rule) => (
              <div
                key={rule.id}
                className={`bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-center gap-4 transition-all ${
                  !rule.active ? 'opacity-50' : ''
                }`}
              >
                {/* Priority badge */}
                <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-slate-400 tabular-nums">{rule.priority}</span>
                </div>

                {/* Rule info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {rule.keyword ? (
                      <span className="font-mono text-sm text-slate-900 font-medium">&quot;{rule.keyword}&quot;</span>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Default / catch-all</span>
                    )}
                    <span className="text-slate-300">&#8594;</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {rule.accountCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${getScopeStyle(rule)}`}>
                      {getScopeLabel(rule)}
                    </span>
                    <span className="text-xs text-slate-400">
                      Created {new Date(rule.createdAt).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      rule.active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {rule.active ? 'Active' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="px-2 py-1.5 text-xs text-slate-400 hover:text-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
