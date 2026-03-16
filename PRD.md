# Morway — Product Requirements Document v4

**Status:** MVP Built · Auth Live · 10 Accounting Systems · Seeking First Trial Customer
**Live URL:** morway.app
**Version:** 5.0
**Date:** 16 March 2026
**Author:** Walt Koleosho

---

## 1. Vision

Morway automates supplier invoice processing for EU accounting firms hit by e-invoicing mandates. Invoices arrive by email or Peppol, get parsed and categorised automatically, and land in the firm's accounting system — DATEV, Exact Online, or Xero. Accountants only touch what the system can't figure out on its own.

**One-liner:** Supplier invoices in, categorised ledger entries out. For any EU accounting system.

---

## 2. Problem Statement

EU e-invoicing mandates are rolling out across Europe. Germany's receiving mandate is live. Belgium's B2B mandate went live January 2026. France follows later in 2026. The Netherlands is expected in 2027.

Mid-sized accounting firms (50–2,000 SME clients) are about to drown in volume. Each client receives 20–50 supplier invoices per month. An accountant spends ~5 minutes per invoice: open the document, identify the supplier, pick the account code, create the bill in the accounting system. At 500 clients, that's 10,000 invoices/month and 833 hours of manual entry.

The mandates create a volume spike that manual processes can't absorb. Firms either hire more staff (expensive, slow) or automate the repetitive middle — parsing, categorisation, and posting. That's what Morway does.

### Phase 1 Scope Boundary

Phase 1 is exclusively about **supplier invoice processing** driven by EU e-invoicing mandates. Commission tracking, expense reconciliation, travel claims, and tax declaration exports are validated future use cases (see Phase 2 in roadmap) but are explicitly **out of scope** until the invoice pipeline has paying customers.

---

## 3. Customer & User

### Primary Customer
Mid-sized accounting firms (50–2,000 SME clients) in Germany, France, Netherlands, and Belgium — markets where e-invoicing mandates are live or imminent. Secondary: UK and international firms using Xero.

### Primary User
The accountant or bookkeeper inside the firm who currently spends hours per week on manual invoice data entry.

### User Personas

| Persona | Role | Pain | What They Want |
|---------|------|------|----------------|
| **The Bookkeeper** | Processes 200+ invoices/week | Repetitive data entry, typo risk, growing backlog as mandates increase volume | Invoices auto-categorised, only exceptions on their desk |
| **The Practice Manager** | Runs the firm | Can't scale without hiring, no visibility into processing status | Dashboard showing throughput, auto-post rates, bottlenecks |

---

## 4. Solution Overview

### 4.1 Document Ingestion

| Channel | Format | Status |
|---------|--------|--------|
| **Email forwarding** | PDF, XML, image attachments | **Built** — Resend inbound webhook, multi-format parsing |
| **Peppol (Storecove)** | UBL 2.1 XML | Built |
| **Manual upload** | PDF, CSV, image | Not built |

Each client gets a unique email address (e.g., `client-abc@in.morway.app`). Suppliers or the firm forward documents to it. Morway extracts, classifies, and routes.

### 4.2 Document Types (Phase 1)

| Type | What We Extract | Classification |
|------|----------------|----------------|
| **Supplier invoices** | Supplier, amounts, line items, VAT, dates | Account codes per line item via rules engine |
| **Credit notes** | Supplier, amounts, original invoice ref | Reversal entries linked to original |

### 4.3 Processing Pipeline

```
Document arrives (email / Peppol / upload)
    ↓
Parse & extract (XML parser / PDF OCR / AI extraction)
    ↓
Match or create supplier/source
    ↓
Apply rules engine (per-firm, per-client, per-supplier)
    ↓
Confidence >= threshold?
    ├── YES → Auto-post to accounting system
    └── NO  → Exception queue for human review
                ↓
            Accountant reviews, edits, approves/rejects
                ↓
            System learns from correction
```

### 4.4 Accounting System Support

| System | Market | Integration Type | Status |
|--------|--------|-----------------|--------|
| **DATEV** | Germany (large firms, Steuerberater) | Buchungsstapel EXTF export | Built |
| **Lexware** | Germany (SMEs, freelancers) | Buchungsdaten + Kreditoren text import | Built |
| **FEC** | France (all firms — mandatory) | Fichier des Ecritures Comptables export | Built |
| **Exact Online** | Netherlands, Belgium | REST API (OAuth2) | Built |
| **Xero** | UK, Australia, NZ | REST API (OAuth2) | Built |
| **Pennylane** | France (fast-growing) | REST API (OAuth2) | Stub — adapter ready, API not yet implemented |
| **Moneybird** | Netherlands (freelancers, SMEs) | REST API (OAuth2) | Stub — adapter ready, API not yet implemented |
| **Twinfield** | Netherlands (mid-market, Wolters Kluwer) | SOAP/XML API | Stub — adapter ready, API not yet implemented |
| **Octopus** | Belgium (1 in 6 firms) | REST API (partner agreement) | Stub — adapter ready, API not yet implemented |

### 4.5 Rules Engine

The rules engine is the core IP. It learns how each firm categorises documents.

**Rule hierarchy (highest confidence first):**

| Priority | Rule Type | Confidence |
|----------|-----------|-----------|
| 1 | Supplier + keyword match | 95% |
| 2 | Supplier default account | 85% |
| 3 | Client-level keyword | 75% |
| 4 | Firm-wide keyword | 60% |

Rules are set once and apply automatically to every future document. The system gets smarter as accountants approve exceptions — each approval can generate a new rule.

---

## 5. Features

### 5.1 Built (MVP)

- Dashboard with value metrics (hours saved, auto-post rate, active rules)
- Invoice pipeline with full lifecycle tracking (PENDING → PROCESSING → AUTO_POSTED / EXCEPTION → APPROVED / REJECTED)
- Invoice detail view with line items, confidence scores, audit timeline
- Rules management UI (create, toggle, delete, priority ordering)
- Client management with onboarding wizard
- Multi-system onboarding (DATEV, Exact Online, Xero, or None)
- Exception queue with split-view review panel and account code overrides
- DATEV Buchungsstapel export (116-column EXTF format)
- Exact Online OAuth + purchase entry posting
- Xero OAuth + bill posting
- Accounting adapter pattern (system-agnostic processing)
- Audit trail with colour-coded action log
- Email notifications for exceptions (via Resend)
- Landing page
- **Email ingestion** — Resend inbound webhook, multi-format attachment parsing (PDF, XML, images), email body fallback, forwarded sender extraction
- **PDF parsing** — Claude AI extraction with multilingual support (DE/FR/NL/IT), line-item-level parsing
- **Image invoice parsing** — Claude vision API for photographed/scanned invoices (JPEG, PNG, WebP, GIF)
- **Credit note detection** — UBL root element + InvoiceTypeCode=381, documentType field on all invoices
- **Duplicate invoice detection** — composite key dedup (invoiceNumber + clientId + currency + grossAmount)
- **Lexware export** — Buchungsdaten (booking entries) + Kreditoren (supplier master data) export following official Lexware buchhalter import spec, with Steuerschlüssel mapping (7%/19% Vorsteuer, i.g.E.)
- **FEC export** — Fichier des Ecritures Comptables, 18-column pipe-delimited export for French tax compliance. Double-entry: expense debit + TVA déductible + supplier credit. PCG account mapping.
- **Pennylane adapter** — Stub ready for France's fastest-growing accounting platform (API not yet implemented)
- **Moneybird adapter** — Stub ready for Dutch freelancer/SME market (API not yet implemented)
- **Twinfield adapter** — Stub ready for Dutch mid-market / Wolters Kluwer (API not yet implemented)
- **Octopus adapter** — Stub ready for Belgian market (API not yet implemented)
- **Multi-country onboarding** — Accounting system selection organized by country (DE/FR/NL/BE/UK) with flag indicators
- **Integrations landing page section** — Country-by-country integration cards with Live/Coming Soon status badges
- **Authentication** — NextAuth.js v5 with email magic link (Resend), session-based auth, firm-scoped data access
- **Route protection** — Middleware protects all /dashboard and /api routes, only webhooks are public
- **Firm-scoped data isolation** — Every query, page, and API endpoint scoped to authenticated user's firm. No cross-firm data access.
- **Login page** — Magic link sign-in, check-email confirmation, error handling for unknown accounts

### 5.2 Not Built — Critical Path

| Feature | Why It Matters | Priority |
|---------|---------------|----------|
| **Manual upload UI** | Fallback for invoices that don't arrive by email | P1 |
| **Rule learning from approvals** | Each exception approval should auto-suggest a new rule | P1 |
| **Webhook signature validation** | Resend inbound webhook should verify signatures to prevent spoofed invoices | P1 |
| **Rate limiting** | API and webhook endpoints need rate limiting to prevent abuse | P1 |
| **Data retention policy** | GDPR requires defined retention periods. Raw invoice data stored indefinitely today. | P1 |
| **GDPR data export/erasure** | Right to erasure — no way to export or delete a client's data today | P1 |
| **Bulk exception handling** | Review and approve multiple invoices at once | P2 |
| **Multi-currency** | EUR, CHF, GBP for cross-border firms | P2 |
| **Client portal** | Let SME clients see their own invoice status | P3 |

---

## 6. Use Cases

### UC1: Supplier Invoice (Core)

**Actor:** Bookkeeper at a Dutch accounting firm
**Trigger:** Supplier sends invoice to client's Morway email

1. Invoice PDF arrives at `bakkerij-vos@in.morway.app`
2. Morway extracts: supplier (Agri Supplies BV), amounts (€2,400 net, €504 VAT), 3 line items
3. Rules engine matches: "Saatgut" → account 3400 (95%), "Pflanzenschutz" → 3410 (95%), "Beratung" → 4900 (60%)
4. Overall confidence: 83% → auto-post threshold met
5. Bill posted to Exact Online automatically
6. Bookkeeper sees it in dashboard as AUTO_POSTED with full audit trail

### UC2: Exception Review

**Actor:** Senior accountant
**Trigger:** Invoice with unknown supplier and no matching rules

1. Invoice arrives from new supplier "TechServ GmbH"
2. Morway extracts data but rules engine returns 40% confidence
3. Invoice routed to exception queue, email notification sent
4. Accountant opens exception, sees suggested codes, overrides line 2 from 4900 → 4120
5. Approves — bill posts to DATEV export queue
6. System suggests new rule: "TechServ + IT-Dienstleistung → 4120" — accountant confirms

### UC3: DATEV Export (German Firm)

**Actor:** German Steuerberater (tax advisor)
**Trigger:** End of month, batch export needed

1. Firm has processed 340 invoices this month for client "Hof Schmidt GmbH"
2. 290 auto-posted, 50 reviewed and approved
3. Accountant clicks "Export Buchungsstapel" on client page
4. Downloads 116-column EXTF CSV with proper Beraternummer/Mandantennummer
5. Imports directly into DATEV Rechnungswesen — no manual keying

### UC4: Multi-Client Overview (Practice Manager)

**Actor:** Firm owner managing 200 clients
**Trigger:** Monday morning — needs status overview

1. Opens Morway dashboard
2. Sees: 1,240 invoices processed last week, 89% auto-post rate, 134 exceptions pending
3. Drills into exceptions: sorted by age, 12 are older than 3 days
4. Assigns overdue exceptions to team members
5. Checks client "Hof Schmidt" — all invoices current, DATEV export ready

---

## 7. Technical Architecture

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Database** | SQLite (local) / Turso libsql (production) |
| **ORM** | Prisma 5 with driver adapters |
| **Hosting** | Vercel (serverless) |
| **Accounting** | Adapter pattern — 10 systems: DATEV, Lexware, FEC, Exact Online, Xero, Pennylane*, Moneybird*, Twinfield*, Octopus* (*stub) |
| **Peppol** | Storecove (webhook) |
| **Email** | Resend (outbound notifications + inbound webhook) |
| **Email Ingestion** | Resend inbound webhook → parse attachments → process pipeline |
| **PDF Parsing** | Claude AI extraction (multilingual, line-item-level) |
| **Image Parsing** | Claude vision API (base64, JPEG/PNG/WebP/GIF) |
| **Auth** | NextAuth.js v5, email magic link, Prisma adapter, session-based |
| **XML Parsing** | xmldom + xpath (UBL 2.1) |
| **Styling** | Tailwind CSS |

### Data Model

16 core tables: Firm, User, Client, Supplier, Invoice, LineItem, Rule, Exception, ExceptionReview, AuditLog, XeroToken, ExactOnlineToken, Account, Session, VerificationToken.

Invoice model includes `documentType` (INVOICE / CREDIT_NOTE) and confidence scoring. Auth tables follow NextAuth.js Prisma adapter schema.

---

## 8. Business Model

| Metric | Value |
|--------|-------|
| **Pricing** | €3–5 per client/month |
| **Charged to** | The accounting firm |
| **Example** | Firm with 500 clients = €1,500–2,500/month |
| **Cost per document** | < €0.20 |
| **Value delivered** | 5 min saved per document, 40+ hours/month for a 500-client firm |
| **Breakeven** | At €80/hr accountant cost, pays for itself at ~20 clients |

### Future expansion pricing

- Commission & expense module (Phase 2): +€2/client/month
- Tax declaration export: +€1/client/month

---

## 9. Competitive Landscape

| Competitor | What They Do | Gap Morway Fills |
|-----------|-------------|-----------------|
| **Dext / AutoEntry** | PDF receipt scanning | Not Peppol-native. No structured XML parsing. UK-focused. |
| **GetMyInvoices** | Document collection | Collects but doesn't categorise or post. No rules engine. |
| **DATEV Unternehmen Online** | Document upload for DATEV | DATEV-only. No multi-system. Clunky UX. No auto-categorisation. |
| **Xero native** | Built-in invoice processing | No Peppol ingestion (coming 2027–28). No cross-system support. |
| **Basecone (Wolters Kluwer)** | Invoice processing for NL/BE | Enterprise pricing. No DATEV support. |

**Defensibility:** The rules engine. Not the parsing (anyone can parse a PDF), but the per-firm, per-client, per-supplier categorisation logic that compounds with every processed document. Each firm's ruleset becomes their institutional knowledge, encoded — and switching away means losing it.

---

## 10. Roadmap

### Phase 1: Trial-Ready (Now → 1 week)

- [x] Email ingestion (inbound email → parse attachments → process)
- [x] PDF invoice parsing (extract supplier, amounts, line items from PDF)
- [x] Image invoice parsing (photographed invoices via Claude vision)
- [x] Credit note detection (UBL + InvoiceTypeCode)
- [x] Duplicate invoice detection
- [x] Authentication (magic link login, firm-scoped data, route protection)
- [x] Fix: client creation flow on production
- [x] Lexware buchhalter export (Buchungsdaten + Kreditoren)
- [x] FEC export (French tax-compliant, 18-column pipe-delimited)
- [x] Multi-country onboarding (DE/FR/NL/BE/UK system selection)
- [x] Adapter stubs for Pennylane, Moneybird, Twinfield, Octopus
- [x] Landing page: integrations section with country cards
- [ ] Pre-production environment + end-to-end testing
- [ ] Webhook signature validation (Resend inbound)
- [ ] End-to-end test: onboard client → send invoice by email → see it processed → export DATEV/Lexware
- [ ] German trial customer onboarded

### Phase 2: Deepen & Expand (Weeks 2–5)

- [ ] Manual invoice upload UI
- [ ] Rule learning from approved exceptions
- [ ] Rate limiting on API/webhook endpoints
- [ ] GDPR data retention policy + erasure endpoint
- [ ] Email notification when invoice is processed
- [ ] Commission & expense module (validated demand — see appendix)

### Phase 3: Growth (Months 2–4)

- [ ] Rule learning from approved exceptions
- [ ] Bulk exception handling
- [ ] Pennylane API integration (covers French cloud-native firms)
- [ ] Moneybird API integration (covers Dutch freelancer/SME market)
- [ ] Twinfield API integration (covers Dutch mid-market)
- [ ] Octopus API integration (covers Belgian market)
- [ ] Client self-service portal
- [ ] Multi-currency support
- [ ] Daily/weekly digest emails for firm managers
- [ ] API for firm-level integrations

### Phase 4: Scale (Months 4–8)

- [ ] White-label for accounting networks
- [ ] Payment matching (invoice to bank transaction)
- [ ] SOC 2 compliance
- [ ] Self-serve sign-up with Stripe billing
- [ ] ML-assisted categorisation (learn from all firms, anonymised)

---

## 11. Key Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Accounting platforms build native automation | Medium | High | Move fast. Lock in 50 firms before 2028. Multi-system support means no single vendor kills us. |
| PDF parsing accuracy insufficient | Medium | Medium | Use AI extraction as fallback. Conservative auto-post threshold. Human always has final say. |
| E-invoicing mandates delayed | Low | Medium | Germany is already live. Belgium is live. Even if NL delays, DE+BE are enough to start. |
| Data privacy / GDPR concerns | Medium | High | All data in EU (Turso EU region). No data sharing between firms. SOC 2 in Phase 4. |
| Can't get first trial customer | Medium | High | German contact warm. Offer free trial with hands-on onboarding. One firm proves the model. |

---

## 12. Success Metrics

| Metric | Target | Timeframe |
|--------|--------|-----------|
| First trial customer live | 1 | 2 weeks |
| Auto-post rate | 80%+ | Within 30 days of onboarding |
| Time to first auto-post | < 10 minutes from document receipt | From day 1 |
| Exception review time | < 60 seconds per document | From day 1 |
| Paying firms | 5–10 | 3 months |
| Paying firms | 20–50 | 6 months |
| NPS from accountant users | 50+ | 3 months |
| Revenue from invoice processing | €500+/month | 6 months |

---

## 13. What Changed in v5

| Area | v4 (Previous) | v5 (Now) |
|------|----------|----------|
| **Accounting systems** | 3 (DATEV, Exact Online, Xero) | 10 — added Lexware, FEC, Pennylane*, Moneybird*, Twinfield*, Octopus* (*stub) |
| **Lexware** | Not supported | Built — Buchungsdaten + Kreditoren export, Steuerschlüssel mapping |
| **FEC (France)** | Not supported | Built — 18-column pipe-delimited export, double-entry PCG mapping |
| **French market** | No coverage | FEC export unlocks all French firms; Pennylane stub ready |
| **Belgian market** | Exact Online only | Added Octopus stub (1 in 6 Belgian firms) |
| **Dutch market** | Exact Online only | Added Moneybird + Twinfield stubs |
| **Onboarding** | 3 system choices | 10 systems organized by country with flags |
| **Landing page** | No integrations section | Country-by-country integration cards with Live/Coming Soon badges |
| **Target markets** | DE, NL, BE | DE, FR, NL, BE, UK |

### What Changed in v4

| Area | v3 (Previous) | v4 (Now) |
|------|----------|----------|
| **Email ingestion** | Not built | Built — Resend inbound webhook, multi-format parsing, forwarded sender extraction |
| **PDF/Image parsing** | Not built | Built — Claude AI extraction, multilingual, image support via vision API |
| **Credit notes** | Not built | Built — detection via UBL root element + InvoiceTypeCode |
| **Duplicate detection** | Not built | Built — composite key dedup (invoiceNumber + clientId + currency + grossAmount) |
| **Authentication** | No login, no auth, DEV_FIRM_ID env var | NextAuth.js v5 magic link, firm-scoped sessions, middleware protection |
| **Data isolation** | Single-firm dev mode | Full multi-tenant: every query scoped to authenticated user's firmId |
| **Approve/reject** | No auth check, userId from request body | Session-authenticated, firmId validation, userId from session |
| **Security** | No route protection | Middleware on all /dashboard and /api routes. Webhooks exempted. |

---

## Appendix: Phase 2 — Commission & Expense Module

Validated via early customer feedback. Financial consultants earn commissions rather than writing invoices. Their accountants need to reconcile commission statements against contracts, track expenses by category (travel, office, personnel), and produce tax-ready declarations. Same document-to-ledger pattern as invoices, different input format.

This module is explicitly **out of Phase 1 scope** but represents a natural expansion once the invoice pipeline has paying customers.

---

*Morway. Invoices in, ledger entries out.*
