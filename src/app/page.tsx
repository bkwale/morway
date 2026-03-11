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
          Accounting Automation for the Peppol Era
        </p>
        <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-6">
          Peppol invoices into Xero.
          <br />
          <span className="text-slate-400">Automatically.</span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Morway sits between Peppol e-invoices and your accounting software. It parses, categorises,
          and posts bills to Xero — so your accountants only touch the exceptions.
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
            <p className="text-3xl font-bold text-slate-900">5 min</p>
            <p className="text-sm text-slate-500 mt-1">saved per invoice</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-emerald-600">80%+</p>
            <p className="text-sm text-slate-500 mt-1">auto-post rate</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">0</p>
            <p className="text-sm text-slate-500 mt-1">manual data entry</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">30s</p>
            <p className="text-sm text-slate-500 mt-1">Peppol to Xero</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-4xl mx-auto px-8 py-20">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">How Morway Works</h2>

        <div className="grid grid-cols-3 gap-8">
          <StepCard
            number="1"
            title="Invoice arrives via Peppol"
            description="Your client receives a structured UBL e-invoice through the Peppol network. Morway's webhook catches it instantly."
          />
          <StepCard
            number="2"
            title="Rules engine categorises"
            description="Each line item is matched against your firm's rules — by supplier, keyword, or client. Confidence score determines what happens next."
          />
          <StepCard
            number="3"
            title="Posted to Xero (or flagged)"
            description="High-confidence invoices are posted as Bills in Xero automatically. Low-confidence ones go to your exception queue for review."
          />
        </div>
      </section>

      {/* For who */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-8 py-20">
          <h2 className="text-2xl font-bold mb-8 text-center">Built for Accounting Firms</h2>
          <div className="grid grid-cols-2 gap-8">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-base font-semibold mb-2">The Problem</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Mid-sized accounting firms manage 200-2,000 SME clients. Each client receives dozens of invoices monthly.
                Someone has to open each invoice, read it, type the supplier into Xero, pick the right account code, and post it.
                Every. Single. Time.
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-base font-semibold mb-2">The Morway Fix</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Peppol invoices arrive as structured data — not PDFs. Morway parses the XML, applies your categorisation rules,
                and posts bills to Xero in seconds. Your accountants only handle exceptions. The system gets smarter with every
                invoice.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="max-w-4xl mx-auto px-8 py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Simple Pricing</h2>
        <p className="text-slate-500 mb-8">Per client, per month. No setup fees. Cancel anytime.</p>
        <div className="inline-flex items-baseline gap-1">
          <span className="text-5xl font-bold text-slate-900">€3-5</span>
          <span className="text-slate-400">/client/month</span>
        </div>
        <p className="text-sm text-slate-400 mt-4 max-w-md mx-auto">
          Charged to the accounting firm, not the end client. A firm with 500 clients saves 40+ hours/month
          at less than €0.20 per invoice processed.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-8 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-slate-400">
          <span>Morway · Tech Sanctum OÜ</span>
          <span>Peppol → Xero, automated.</span>
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
