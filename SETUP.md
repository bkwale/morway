# Morway — Setup Guide

## Prerequisites
- Node.js 18+
- A Xero developer account (developer.xero.com)
- A Storecove account for Peppol Access Point (storecove.com)

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Fill in:
- `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET` from your Xero developer app
- `XERO_REDIRECT_URI` — set to `http://localhost:3000/api/xero/callback` for dev
- `STORECOVE_API_KEY` and `STORECOVE_WEBHOOK_SECRET` from Storecove
- `NEXTAUTH_SECRET` — generate with: `openssl rand -base64 32`

### 3. Set up the database
```bash
npx prisma db push
```

This creates `prisma/dev.db` (SQLite for local dev).

### 4. Run the app
```bash
npm run dev
```

Open http://localhost:3000

---

## Project Structure

```
src/
  app/
    api/
      peppol/webhook/    — Receives Peppol e-invoices
      xero/connect/      — Initiates Xero OAuth
      xero/callback/     — Handles Xero OAuth callback
      invoices/
        exceptions/      — List exception queue
        [id]/approve/    — Approve exception
        [id]/reject/     — Reject exception
      clients/           — CRUD clients
      rules/             — CRUD categorisation rules
    dashboard/
      page.tsx           — Overview (stats + recent invoices)
      exceptions/        — Exception review queue
      clients/           — Client list + management
      audit/             — Audit trail
  lib/
    db.ts                — Prisma client singleton
    constants.ts         — Status enums, thresholds
    ubl-parser.ts        — UBL 2.1 XML parser
    rules-engine.ts      — Categorisation rules engine
    xero.ts              — Xero API wrapper
    invoice-processor.ts — Main processing pipeline
  generated/
    prisma/              — Generated Prisma client (gitignored)
```

## Key Flows

### Invoice Processing
1. Peppol webhook receives UBL 2.1 XML
2. Invoice saved to DB
3. `processInvoice()` runs asynchronously:
   - Parses XML
   - Matches/creates supplier
   - Applies rules engine
   - Confidence >= 0.8: auto-posts to Xero
   - Confidence < 0.8: sends to exception queue

### Exception Review
1. Accountant opens Exceptions page
2. Reviews flagged invoice + suggested categories
3. Edits account codes if needed
4. Approves (posts to Xero) or rejects

### Xero Connection
1. Firm admin clicks "Connect Xero" for a client
2. Redirects to Xero OAuth consent screen
3. On callback, tokens stored in `xero_tokens` table
4. Client marked as `xeroConnected: true`

---

## Confidence Threshold
Default: 0.8 (80%). Set `AUTO_POST_CONFIDENCE_THRESHOLD` in `.env` to adjust.

## Production (Turso)
Update `DATABASE_URL` to your Turso connection string.
For async invoice processing at scale, replace inline `processInvoice()` call in the webhook with a job queue (Inngest or BullMQ recommended).
