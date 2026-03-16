import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-8 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Image src="/logo.svg" alt="Morway" width={140} height={36} priority />
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Open Dashboard
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-8 pt-24 pb-16 text-center">
        <p className="text-sm font-medium text-emerald-600 uppercase tracking-wider mb-4">
          Invoice Automation for Accounting Firms
        </p>
        <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-6">
          Supplier invoices, processed.
          <br />
          <span className="text-slate-400">Hands-free.</span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Morway takes supplier invoices — PDFs, email attachments, or structured e-invoices — parses them,
          categorises each line item, and posts bills to your accounting system automatically. Your team only touches the exceptions.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            Try the Dashboard
          </Link>
          <a
            href="#how-it-works"
            className="px-6 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            How it works ↓
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-4xl mx-auto px-8 py-10 grid grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-3xl font-bold text-slate-900">12 min</p>
            <p className="text-sm text-slate-500 mt-1">saved per invoice</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-emerald-600">90%</p>
            <p className="text-sm text-slate-500 mt-1">less manual entry</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">PDF</p>
            <p className="text-sm text-slate-500 mt-1">email &amp; XML supported</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">30s</p>
            <p className="text-sm text-slate-500 mt-1">invoice to posted</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-4xl mx-auto px-8 py-20">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">How Morway Works</h2>

        <div className="grid grid-cols-3 gap-8">
          <StepCard
            number="1"
            title="Invoice arrives"
            description="Supplier invoices come in by email, upload, or structured e-invoice. Morway parses PDFs and XML automatically — no manual data entry."
          />
          <StepCard
            number="2"
            title="Rules engine categorises"
            description="Each line item is matched against your firm's rules — by supplier, keyword, or account code. Feed, fertiliser, equipment, fuel — all mapped automatically."
          />
          <StepCard
            number="3"
            title="Posted (or flagged)"
            description="High-confidence invoices post as bills automatically. Low-confidence ones go to your exception queue for review."
          />
        </div>
      </section>

      {/* For who */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-8 py-20">
          <h2 className="text-2xl font-bold mb-4 text-center">Built for Accounting Firms</h2>
          <p className="text-slate-400 text-center text-sm mb-10 max-w-lg mx-auto">
            Firms managing 50–2,000 SME clients across Germany, France, Netherlands, Belgium, and the UK.
          </p>
          <div className="grid grid-cols-2 gap-8">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-base font-semibold mb-2">The Problem</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Mid-sized firms manage hundreds of clients. Each client receives dozens of supplier invoices monthly —
                feed, fertiliser, equipment, vet bills, fuel. Someone has to open each one, read it, type the supplier
                into their accounting system, pick the right account code, and post it. Every. Single. Time.
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-base font-semibold mb-2">The Morway Fix</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Invoices arrive and get parsed automatically — PDF, email attachment, or XML.
                Morway applies your categorisation rules and posts bills in seconds.
                Your accountants only handle exceptions. The system gets smarter with every invoice.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Pricing That Scales With You</h2>
          <p className="text-slate-500 max-w-lg mx-auto">
            Per client, per month. No setup fees. Cancel anytime. Your firm saves 10-15x what you pay.
          </p>
        </div>

        {/* Tiers */}
        <div className="grid grid-cols-3 gap-6 mb-10">
          {/* Starter */}
          <div className="border border-slate-200 rounded-xl p-8 text-left flex flex-col">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Starter</p>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Small Portfolios</h3>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold text-slate-900">€19</span>
              <span className="text-slate-400 text-sm">/client/month</span>
            </div>
            <p className="text-xs text-slate-400 mb-5">Up to 50 invoices/month per client</p>
            <ul className="text-sm text-slate-500 space-y-2.5 flex-1">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Email &amp; PDF invoice parsing
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Auto-categorisation with custom rules
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Automatic bill posting
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Exception dashboard
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Email notifications
              </li>
            </ul>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400">Effective cost: ~€0.38/invoice</p>
            </div>
          </div>

          {/* Pro — highlighted */}
          <div className="border-2 border-emerald-500 rounded-xl p-8 text-left flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                Most Popular
              </span>
            </div>
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-2">Pro</p>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Growing Firms</h3>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold text-slate-900">€29</span>
              <span className="text-slate-400 text-sm">/client/month</span>
            </div>
            <p className="text-xs text-slate-400 mb-5">Up to 150 invoices/month per client</p>
            <ul className="text-sm text-slate-500 space-y-2.5 flex-1">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Everything in Starter
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Peppol e-invoice reception
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                UBL &amp; Factur-X auto-parsing
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                EU e-invoicing mandate ready
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Priority exception handling
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Audit trail &amp; compliance reports
              </li>
            </ul>
            <div className="mt-6 pt-4 border-t border-emerald-100">
              <p className="text-xs text-emerald-600 font-medium">Effective cost: ~€0.19/invoice</p>
            </div>
          </div>

          {/* Enterprise */}
          <div className="border border-slate-200 rounded-xl p-8 text-left flex flex-col bg-slate-50/50">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Enterprise</p>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Large Practices</h3>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold text-slate-900">Custom</span>
            </div>
            <p className="text-xs text-slate-400 mb-5">500+ clients, volume pricing</p>
            <ul className="text-sm text-slate-500 space-y-2.5 flex-1">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Everything in Pro
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Volume discounts from €15/client
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Unlimited invoices per client
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Dedicated onboarding &amp; support
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                Custom accounting system integrations
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                SLA &amp; data residency options
              </li>
            </ul>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <a href="mailto:walt@morway.app" className="text-sm font-medium text-slate-900 hover:text-emerald-600 transition-colors">
                Talk to us →
              </a>
            </div>
          </div>
        </div>

        {/* ROI callout */}
        <div className="bg-slate-900 rounded-xl p-8 text-center">
          <div className="grid grid-cols-3 gap-8">
            <div>
              <p className="text-3xl font-bold text-white">€300+</p>
              <p className="text-sm text-slate-400 mt-1">monthly cost of manual entry per client</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-400">€29</p>
              <p className="text-sm text-slate-400 mt-1">with Morway Pro</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">10x</p>
              <p className="text-sm text-slate-400 mt-1">return on investment</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-6">
            Based on 67 invoices/month at 15 min manual entry each, at a blended rate of €18/hour.
          </p>
        </div>
      </section>

      {/* Integrations */}
      <section className="border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-8 py-20">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-3">
            Works With Your Accounting System
          </h2>
          <p className="text-sm text-slate-500 text-center mb-12 max-w-lg mx-auto">
            Morway connects to the systems your firm already uses — across Germany, France, Netherlands, Belgium, and the UK.
          </p>

          <div className="grid grid-cols-3 gap-6 mb-10">
            <IntegrationCard
              country="Germany"
              flag="DE"
              systems={[
                { name: 'DATEV', status: 'live', detail: 'Buchungsstapel export' },
                { name: 'Lexware', status: 'live', detail: 'Buchungsdaten export' },
              ]}
            />
            <IntegrationCard
              country="France"
              flag="FR"
              systems={[
                { name: 'FEC', status: 'live', detail: 'Fichier des Ecritures Comptables' },
                { name: 'Pennylane', status: 'soon', detail: 'API integration' },
              ]}
            />
            <IntegrationCard
              country="Netherlands"
              flag="NL"
              systems={[
                { name: 'Exact Online', status: 'live', detail: 'OAuth + auto-post' },
                { name: 'Moneybird', status: 'soon', detail: 'API integration' },
                { name: 'Twinfield', status: 'soon', detail: 'API integration' },
              ]}
            />
          </div>
          <div className="grid grid-cols-3 gap-6">
            <IntegrationCard
              country="Belgium"
              flag="BE"
              systems={[
                { name: 'Exact Online', status: 'live', detail: 'OAuth + auto-post' },
                { name: 'Octopus', status: 'soon', detail: 'API integration' },
              ]}
            />
            <IntegrationCard
              country="UK &amp; International"
              flag="GB"
              systems={[
                { name: 'Xero', status: 'live', detail: 'OAuth + auto-post' },
              ]}
            />
            <div className="border border-dashed border-slate-200 rounded-xl p-6 flex items-center justify-center">
              <p className="text-sm text-slate-400 text-center">
                Don&apos;t see your system?<br />
                <a href="mailto:walt@morway.app" className="text-slate-600 hover:text-slate-900 font-medium">
                  Let us know →
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* E-invoicing timeline */}
      <section className="border-t border-slate-100 bg-slate-50/50">
        <div className="max-w-4xl mx-auto px-8 py-16">
          <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
            E-Invoicing Mandates Are Coming
          </h2>
          <p className="text-sm text-slate-500 text-center mb-10">
            Automation isn&apos;t optional — it&apos;s how you stay ahead of the volume increase.
          </p>
          <div className="grid grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-sm font-bold text-slate-900">Germany</p>
              <p className="text-lg font-bold text-amber-500">Jan 2025</p>
              <p className="text-xs text-emerald-600 font-medium">Live</p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Belgium</p>
              <p className="text-lg font-bold text-amber-500">Jan 2026</p>
              <p className="text-xs text-emerald-600 font-medium">Live</p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">France</p>
              <p className="text-lg font-bold text-amber-500">Sep 2026</p>
              <p className="text-xs text-slate-500">Full mandate</p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">EU-wide</p>
              <p className="text-lg font-bold text-amber-500">2028-30</p>
              <p className="text-xs text-slate-500">ViDA directive</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-8 py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          Ready to automate invoice processing?
        </h2>
        <p className="text-slate-500 mb-8 max-w-lg mx-auto">
          We&apos;re onboarding a small number of accounting firms to shape the product around real workflows.
          No commitment — just a conversation.
        </p>
        <a
          href="mailto:walt@morway.app"
          className="inline-block px-8 py-3 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Get in Touch → walt@morway.app
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-8 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-slate-400">
          <span>© {new Date().getFullYear()} Morway</span>
          <span>Invoice processing, automated.</span>
        </div>
      </footer>
    </div>
  )
}

function IntegrationCard({
  country,
  flag,
  systems,
}: {
  country: string
  flag: string
  systems: { name: string; status: 'live' | 'soon'; detail: string }[]
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{flag === 'DE' ? '🇩🇪' : flag === 'FR' ? '🇫🇷' : flag === 'NL' ? '🇳🇱' : flag === 'BE' ? '🇧🇪' : '🇬🇧'}</span>
        <h3 className="text-sm font-semibold text-slate-900">{country}</h3>
      </div>
      <div className="space-y-2.5">
        {systems.map((sys) => (
          <div key={sys.name} className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">{sys.name}</p>
              <p className="text-xs text-slate-400">{sys.detail}</p>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              sys.status === 'live'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-600'
            }`}>
              {sys.status === 'live' ? 'Live' : 'Coming Soon'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  )
}
