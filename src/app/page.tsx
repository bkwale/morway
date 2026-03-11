import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-8 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="text-xl font-bold text-slate-900 tracking-tight">Morway</span>
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
            Especially those managing agricultural clients — dairy farms, arable operations, horticulture businesses.
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
      <section className="max-w-4xl mx-auto px-8 py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Simple Pricing</h2>
        <p className="text-slate-500 mb-8">Per client, per month. No setup fees. Cancel anytime.</p>

        <div className="flex justify-center gap-8 mb-8">
          {/* Core */}
          <div className="border border-slate-200 rounded-xl p-8 max-w-xs text-left">
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-2">Core</p>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Invoice Automation</h3>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-4xl font-bold text-slate-900">€3-5</span>
              <span className="text-slate-400 text-sm">/client/month</span>
            </div>
            <ul className="text-sm text-slate-500 space-y-2">
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
          </div>

          {/* Add-on */}
          <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-8 max-w-xs text-left">
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-2">Add-on</p>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Peppol e-Invoice Reception</h3>
            <p className="text-sm text-slate-500 mb-3">For firms needing EU mandate compliance</p>
            <ul className="text-sm text-slate-500 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">✓</span>
                Receive structured e-invoices via Peppol
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">✓</span>
                UBL XML auto-parsing
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">✓</span>
                EU e-invoicing mandate ready
              </li>
            </ul>
          </div>
        </div>

        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Charged to the accounting firm, not the end client. A firm with 500 clients saves 40+ hours/month
          at less than €0.20 per invoice processed.
        </p>
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
