'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Step = 'details' | 'accounting' | 'rules' | 'done'

const STEPS: { key: Step; label: string; number: number }[] = [
  { key: 'details', label: 'Client Details', number: 1 },
  { key: 'accounting', label: 'Accounting System', number: 2 },
  { key: 'rules', label: 'Set Up Rules', number: 3 },
  { key: 'done', label: 'Ready', number: 4 },
]

type AccountingSystem = 'NONE' | 'XERO' | 'EXACT_ONLINE' | 'DATEV'

const ACCOUNTING_OPTIONS: { key: AccountingSystem; name: string; description: string; flag: string; regions: string }[] = [
  {
    key: 'EXACT_ONLINE',
    name: 'Exact Online',
    description: 'Connect via OAuth. Auto-post bills directly.',
    flag: '🇳🇱🇧🇪',
    regions: 'Netherlands, Belgium, Germany',
  },
  {
    key: 'DATEV',
    name: 'DATEV',
    description: 'Export Buchungsstapel CSV. Import into DATEV.',
    flag: '🇩🇪',
    regions: 'Germany',
  },
  {
    key: 'XERO',
    name: 'Xero',
    description: 'Connect via OAuth. Auto-post bills directly.',
    flag: '🇬🇧🇦🇺',
    regions: 'UK, Australia, New Zealand',
  },
  {
    key: 'NONE',
    name: 'Other / Not yet',
    description: 'Invoices will be parsed and categorised. You can export or connect later.',
    flag: '🌍',
    regions: 'All countries',
  },
]

interface RuleEntry {
  keyword: string
  accountCode: string
}

export default function OnboardPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading...</div>}>
      <OnboardPage />
    </Suspense>
  )
}

function OnboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('details')
  const [error, setError] = useState<string | null>(null)

  // Step 1: Client details
  const [clientName, setClientName] = useState('')
  const [peppolId, setPeppolId] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)

  // If clientId is passed as query param, skip step 1 (existing client setup)
  useEffect(() => {
    const qClientId = searchParams.get('clientId')
    const qClientName = searchParams.get('clientName')
    if (qClientId) {
      setClientId(qClientId)
      setClientName(qClientName ?? '')
      setStep('accounting')
    }
  }, [searchParams])

  // Step 2: Accounting system
  const [selectedSystem, setSelectedSystem] = useState<AccountingSystem | null>(null)
  const [datevConsultNo, setDatevConsultNo] = useState('')
  const [datevClientNo, setDatevClientNo] = useState('')
  const [exactRegion, setExactRegion] = useState<'NL' | 'BE' | 'DE' | 'UK'>('NL')
  const [connectingSystem, setConnectingSystem] = useState(false)

  // Step 3: Rules
  const [rules, setRules] = useState<RuleEntry[]>([
    { keyword: '', accountCode: '' },
  ])
  const [savingRules, setSavingRules] = useState(false)
  const [rulesCreated, setRulesCreated] = useState(0)

  const currentStepIndex = STEPS.findIndex((s) => s.key === step)

  // ── STEP 1: Create client ──────────────────────────────────────────────────

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault()
    if (!clientName.trim()) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clientName.trim(),
          peppolId: peppolId.trim() || undefined,
          vatNumber: vatNumber.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed (${res.status})`)
      }

      const client = await res.json()
      setClientId(client.id)
      setStep('accounting')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ── STEP 2: Connect accounting system ────────────────────────────────────

  async function handleConnectSystem() {
    if (!clientId || !selectedSystem) return
    setConnectingSystem(true)
    setError(null)

    try {
      if (selectedSystem === 'XERO') {
        window.location.href = `/api/xero/connect?clientId=${clientId}`
        return
      }

      if (selectedSystem === 'EXACT_ONLINE') {
        window.location.href = `/api/exact-online/connect?clientId=${clientId}&region=${exactRegion}`
        return
      }

      if (selectedSystem === 'DATEV') {
        // DATEV doesn't need OAuth — just save the config
        const res = await fetch(`/api/clients/${clientId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountingSystem: 'DATEV',
            datevConsultNo: datevConsultNo.trim() || undefined,
            datevClientNo: datevClientNo.trim() || undefined,
          }),
        })

        if (!res.ok) throw new Error('Failed to save DATEV config')
        setStep('rules')
        return
      }

      // NONE — just update and move on
      await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountingSystem: 'NONE' }),
      })
      setStep('rules')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnectingSystem(false)
    }
  }

  function handleSkipAccounting() {
    setStep('rules')
  }

  // ── STEP 3: Rules ──────────────────────────────────────────────────────────

  function addRule() {
    setRules((prev) => [...prev, { keyword: '', accountCode: '' }])
  }

  function updateRule(index: number, field: keyof RuleEntry, value: string) {
    setRules((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSaveRules() {
    const validRules = rules.filter((r) => r.keyword.trim() && r.accountCode.trim())
    if (validRules.length === 0) {
      setStep('done')
      return
    }

    setSavingRules(true)
    setError(null)
    let created = 0

    try {
      for (const rule of validRules) {
        const res = await fetch('/api/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword: rule.keyword.trim(),
            accountCode: rule.accountCode.trim(),
            clientId: clientId,
            priority: 10,
          }),
        })
        if (res.ok) created++
      }
      setRulesCreated(created)
      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save rules')
    } finally {
      setSavingRules(false)
    }
  }

  function handleSkipRules() {
    setStep('done')
  }

  // Get account code examples based on selected system
  const accountCodeExamples = selectedSystem === 'DATEV'
    ? [
        ['4940', 'Fachliteratur (books/publications)'],
        ['4930', 'Bürobedarf (office supplies)'],
        ['3400', 'Wareneingang (goods received)'],
        ['4210', 'Miete (rent)'],
        ['4520', 'Kfz-Kosten (vehicle costs)'],
        ['4910', 'Porto (postage)'],
      ]
    : [
        ['429', 'Software / IT'],
        ['600', 'Consulting'],
        ['310', 'Office Supplies'],
        ['445', 'Rent'],
        ['461', 'Insurance'],
        ['200', 'Purchases'],
      ]

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Back link */}
      <div className="mb-8">
        <Link href="/dashboard/clients" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
          ← Back to Clients
        </Link>
      </div>

      {/* Progress bar */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  i < currentStepIndex
                    ? 'bg-emerald-500 text-white'
                    : i === currentStepIndex
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {i < currentStepIndex ? (
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                    <path d="M1 5L5 9L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  s.number
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-16 sm:w-24 h-0.5 mx-2 transition-colors ${
                    i < currentStepIndex ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          {STEPS.map((s) => (
            <span key={s.key} className="text-[11px] text-slate-500 w-20 text-center">
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── STEP 1: CLIENT DETAILS ──────────────────────────────────────────── */}
      {step === 'details' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">Add your client</h2>
          <p className="text-sm text-slate-500 mb-6">Start by entering their basic details. You can update these later.</p>

          <form onSubmit={handleCreateClient} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                Client Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                autoFocus
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                placeholder="e.g. Acme Corp"
              />
            </div>

            <div>
              <label htmlFor="peppolId" className="block text-sm font-medium text-slate-700 mb-1.5">
                Peppol Participant ID
              </label>
              <input
                id="peppolId"
                type="text"
                value={peppolId}
                onChange={(e) => setPeppolId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                placeholder="e.g. 0106:12345678"
              />
              <p className="mt-1.5 text-xs text-slate-400">Optional — needed for Peppol e-invoice reception</p>
            </div>

            <div>
              <label htmlFor="vatNumber" className="block text-sm font-medium text-slate-700 mb-1.5">
                VAT Number
              </label>
              <input
                id="vatNumber"
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                placeholder="e.g. DE123456789"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={saving || !clientName.trim()}
                className="px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Continue'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── STEP 2: ACCOUNTING SYSTEM ─────────────────────────────────────────── */}
      {step === 'accounting' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">Connect accounting system</h2>
          <p className="text-sm text-slate-500 mb-6">
            Which system does {clientName} use? This tells Morway where to post approved invoices.
          </p>

          <div className="space-y-3 mb-6">
            {ACCOUNTING_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setSelectedSystem(option.key)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedSystem === option.key
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{option.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{option.flag} {option.regions}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    selectedSystem === option.key
                      ? 'border-slate-900'
                      : 'border-slate-300'
                  }`}>
                    {selectedSystem === option.key && (
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* DATEV config fields */}
          {selectedSystem === 'DATEV' && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl space-y-4">
              <p className="text-xs font-medium text-slate-500">DATEV Configuration (optional — can be set later)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Beraternummer (Consultant No.)</label>
                  <input
                    type="text"
                    value={datevConsultNo}
                    onChange={(e) => setDatevConsultNo(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                    placeholder="e.g. 1001"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Mandantennummer (Client No.)</label>
                  <input
                    type="text"
                    value={datevClientNo}
                    onChange={(e) => setDatevClientNo(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                    placeholder="e.g. 456"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Exact Online region selector */}
          {selectedSystem === 'EXACT_ONLINE' && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl">
              <p className="text-xs font-medium text-slate-500 mb-3">Select your Exact Online region</p>
              <div className="flex gap-2">
                {(['NL', 'BE', 'DE', 'UK'] as const).map((region) => (
                  <button
                    key={region}
                    onClick={() => setExactRegion(region)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      exactRegion === region
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleConnectSystem}
              disabled={!selectedSystem || connectingSystem}
              className="px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {connectingSystem
                ? 'Connecting...'
                : selectedSystem === 'XERO' || selectedSystem === 'EXACT_ONLINE'
                ? `Connect ${selectedSystem === 'XERO' ? 'Xero' : 'Exact Online'}`
                : selectedSystem === 'DATEV'
                ? 'Save DATEV Config'
                : 'Continue'}
            </button>
            <button
              onClick={handleSkipAccounting}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: SET UP RULES ────────────────────────────────────────────── */}
      {step === 'rules' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">Set up categorisation rules</h2>
          <p className="text-sm text-slate-500 mb-6">
            Rules map invoice line items to account codes. When a line item description contains the keyword, Morway assigns the account code automatically.
          </p>

          <div className="space-y-3 mb-6">
            {rules.map((rule, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={rule.keyword}
                    onChange={(e) => updateRule(index, 'keyword', e.target.value)}
                    placeholder="Keyword (e.g. fertiliser)"
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                  />
                </div>
                <span className="text-slate-300 text-sm">&#8594;</span>
                <div className="w-32">
                  <input
                    type="text"
                    value={rule.accountCode}
                    onChange={(e) => updateRule(index, 'accountCode', e.target.value)}
                    placeholder={selectedSystem === 'DATEV' ? 'e.g. 4940' : 'e.g. 429'}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                  />
                </div>
                {rules.length > 1 && (
                  <button
                    onClick={() => removeRule(index)}
                    className="text-slate-300 hover:text-red-500 transition-colors text-lg"
                  >
                    &#10005;
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addRule}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-8 block"
          >
            + Add another rule
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveRules}
              disabled={savingRules}
              className="px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {savingRules ? 'Saving...' : 'Save & Continue'}
            </button>
            <button
              onClick={handleSkipRules}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Skip — I&apos;ll add rules later
            </button>
          </div>

          <div className="mt-8 p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-medium text-slate-500 mb-2">
              {selectedSystem === 'DATEV' ? 'Common DATEV account codes (SKR03):' : 'Common account codes:'}
            </p>
            <div className="grid grid-cols-2 gap-1 text-xs text-slate-500">
              {accountCodeExamples.map(([code, label]) => (
                <span key={code}>{code} — {label}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: DONE ────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M6 14L12 20L22 8" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            {clientName} is ready
          </h2>
          <p className="text-sm text-slate-500 mb-2 max-w-sm mx-auto">
            Client created{rulesCreated > 0 ? ` with ${rulesCreated} categorisation rule${rulesCreated !== 1 ? 's' : ''}` : ''}.
            {selectedSystem === 'DATEV' && ' DATEV export will be available once invoices are processed.'}
            {selectedSystem === 'EXACT_ONLINE' && ' Approved invoices will auto-post to Exact Online.'}
            {selectedSystem === 'XERO' && ' Approved invoices will auto-post to Xero.'}
            {(!selectedSystem || selectedSystem === 'NONE') && ' Connect an accounting system later to enable auto-posting.'}
          </p>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => router.push(`/dashboard/clients/${clientId}`)}
              className="w-full max-w-xs mx-auto px-6 py-3 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors block"
            >
              View Client
            </button>
            <button
              onClick={() => {
                // Reset state for new onboarding
                setStep('details')
                setClientName('')
                setPeppolId('')
                setVatNumber('')
                setClientId(null)
                setSelectedSystem(null)
                setRules([{ keyword: '', accountCode: '' }])
                setRulesCreated(0)
                setError(null)
              }}
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors block mx-auto"
            >
              + Onboard another client
            </button>
          </div>

          <div className="mt-8 p-4 bg-slate-50 rounded-xl text-left">
            <p className="text-xs font-medium text-slate-500 mb-2">Next steps:</p>
            <div className="space-y-1.5 text-xs text-slate-500">
              <p>1. Forward supplier invoices to the client&apos;s dedicated email address</p>
              <p>2. Add more categorisation rules as invoices come in</p>
              <p>3. Review any exceptions that land in the queue</p>
              {selectedSystem === 'DATEV' && (
                <p>4. Download DATEV export from the client dashboard when ready</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
