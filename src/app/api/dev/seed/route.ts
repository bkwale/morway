import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processInvoice } from '@/lib/invoice-processor'
import { AUDIT_ACTION } from '@/lib/constants'

/**
 * POST /api/dev/seed
 * Creates test invoices and rules, then runs them through the full pipeline.
 * Protected: only works when DEV_FIRM_ID is set.
 *
 * Query params:
 *   ?mode=full     — creates rules + 2 invoices (1 auto-posts, 1 exception)
 *   ?mode=exception — creates 1 invoice with no rules (goes to exception queue)
 *   ?mode=autopost  — creates 1 rule + 1 invoice (auto-posts to Xero)
 */
export async function POST(req: NextRequest) {
  const firmId = process.env.DEV_FIRM_ID
  if (!firmId) {
    return NextResponse.json({ error: 'DEV_FIRM_ID not set' }, { status: 400 })
  }

  // Block in production unless DEV_SEED_ENABLED=true
  if (process.env.NODE_ENV === 'production' && process.env.DEV_SEED_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Seed disabled in production. Set DEV_SEED_ENABLED=true' }, { status: 403 })
  }

  const mode = req.nextUrl.searchParams.get('mode') ?? 'full'

  try {
    // ── SETUP MODE: Create firm + admin user + demo client ────────────
    if (mode === 'setup') {
      const firm = await db.firm.upsert({
        where: { email: 'walt@morway.app' },
        create: {
          id: firmId,
          name: 'Morway Demo',
          email: 'walt@morway.app',
          plan: 'STARTER',
        },
        update: {},
      })

      const user = await db.user.upsert({
        where: { email: 'walt@morway.app' },
        create: {
          firmId: firm.id,
          email: 'walt@morway.app',
          name: 'Walt',
          role: 'ADMIN',
        },
        update: {},
      })

      // Create a demo client for the firm (FEC / France)
      const demoClient = await db.client.upsert({
        where: { id: `demo-client-${firmId}` },
        create: {
          id: `demo-client-${firmId}`,
          firmId: firm.id,
          name: 'Fiteco Demo Client',
          accountingSystem: 'FEC',
          active: true,
        },
        update: {},
      })

      return NextResponse.json({
        success: true,
        mode: 'setup',
        firm: { id: firm.id, name: firm.name },
        user: { id: user.id, email: user.email, role: user.role },
        client: { id: demoClient.id, name: demoClient.name },
        next: 'Sign in with walt@morway.app',
      })
    }

    // Find the first client with Xero connected
    const client = await db.client.findFirst({
      where: { firmId, xeroConnected: true },
    })

    if (!client) {
      return NextResponse.json(
        { error: 'No Xero-connected client found. Connect Xero first.' },
        { status: 400 }
      )
    }

    const results: Array<{ invoiceNumber: string; status: string; id: string }> = []

    // ── CREATE RULES (for full and autopost modes) ──────────────────────
    if (mode === 'full' || mode === 'autopost') {
      // Firm-wide rule: "software" → 429 (Computer & IT)
      await db.rule.upsert({
        where: { id: `seed-rule-software-${firmId}` },
        create: {
          id: `seed-rule-software-${firmId}`,
          firmId,
          keyword: 'software',
          accountCode: '429',
          priority: 10,
        },
        update: { active: true },
      })

      // Firm-wide rule: "consulting" → 600 (Consulting & Accounting)
      await db.rule.upsert({
        where: { id: `seed-rule-consulting-${firmId}` },
        create: {
          id: `seed-rule-consulting-${firmId}`,
          firmId,
          keyword: 'consulting',
          accountCode: '600',
          priority: 10,
        },
        update: { active: true },
      })

      // Firm-wide rule: "hosting" → 429
      await db.rule.upsert({
        where: { id: `seed-rule-hosting-${firmId}` },
        create: {
          id: `seed-rule-hosting-${firmId}`,
          firmId,
          keyword: 'hosting',
          accountCode: '429',
          priority: 10,
        },
        update: { active: true },
      })
    }

    // ── INVOICE 1: Software bill (should auto-post with rules) ──────────
    if (mode === 'full' || mode === 'autopost') {
      const inv1 = await createTestInvoice(client.id, {
        number: `INV-SEED-${Date.now()}-A`,
        supplierName: 'CloudStack GmbH',
        supplierVat: 'DE987654321',
        lineItems: [
          { description: 'Annual software license — CloudStack Pro', quantity: 1, unitPrice: 2400.00, vatRate: 19 },
          { description: 'Cloud hosting — 12 months', quantity: 12, unitPrice: 89.00, vatRate: 19 },
        ],
        currency: 'EUR',
        net: 3468.00,
        vat: 658.92,
        gross: 4126.92,
      })

      await db.auditLog.create({
        data: { invoiceId: inv1.id, action: AUDIT_ACTION.RECEIVED, detail: JSON.stringify({ source: 'seed', mode }) },
      })

      try {
        await processInvoice(inv1.id)
      } catch (err) {
        console.error('Seed invoice 1 processing error:', err)
      }

      const updated1 = await db.invoice.findUnique({ where: { id: inv1.id }, select: { status: true } })
      results.push({ invoiceNumber: inv1.invoiceNumber, status: updated1?.status ?? 'UNKNOWN', id: inv1.id })
    }

    // ── INVOICE 2: Unrecognised bill (should go to exceptions) ──────────
    if (mode === 'full' || mode === 'exception') {
      const inv2 = await createTestInvoice(client.id, {
        number: `INV-SEED-${Date.now()}-B`,
        supplierName: 'Büro Schmidt & Partner',
        supplierVat: 'DE111222333',
        lineItems: [
          { description: 'Ergonomic office furniture — standing desk', quantity: 2, unitPrice: 750.00, vatRate: 19 },
          { description: 'Installation and delivery', quantity: 1, unitPrice: 120.00, vatRate: 19 },
          { description: 'Cable management kit', quantity: 2, unitPrice: 35.00, vatRate: 19 },
        ],
        currency: 'EUR',
        net: 1690.00,
        vat: 321.10,
        gross: 2011.10,
      })

      await db.auditLog.create({
        data: { invoiceId: inv2.id, action: AUDIT_ACTION.RECEIVED, detail: JSON.stringify({ source: 'seed', mode }) },
      })

      try {
        await processInvoice(inv2.id)
      } catch (err) {
        console.error('Seed invoice 2 processing error:', err)
      }

      const updated2 = await db.invoice.findUnique({ where: { id: inv2.id }, select: { status: true } })
      results.push({ invoiceNumber: inv2.invoiceNumber, status: updated2?.status ?? 'UNKNOWN', id: inv2.id })
    }

    return NextResponse.json({
      success: true,
      mode,
      clientId: client.id,
      clientName: client.name,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Seed error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

interface TestInvoiceInput {
  number: string
  supplierName: string
  supplierVat: string
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; vatRate: number }>
  currency: string
  net: number
  vat: number
  gross: number
}

async function createTestInvoice(clientId: string, input: TestInvoiceInput) {
  const invoiceDate = new Date()
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 days

  // Generate realistic UBL 2.1 XML
  const rawXml = generateUBL(input, invoiceDate, dueDate)

  return db.invoice.create({
    data: {
      clientId,
      invoiceNumber: input.number,
      invoiceDate,
      dueDate,
      currency: input.currency,
      netAmount: input.net,
      vatAmount: input.vat,
      grossAmount: input.gross,
      rawXml,
      status: 'PENDING',
    },
  })
}

function generateUBL(input: TestInvoiceInput, invoiceDate: Date, dueDate: Date): string {
  const dateStr = invoiceDate.toISOString().split('T')[0]
  const dueDateStr = dueDate.toISOString().split('T')[0]

  const lineItemsXml = input.lineItems
    .map(
      (item, i) => `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="EA">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${input.currency}">${(item.quantity * item.unitPrice).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${item.description}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:Percent>${item.vatRate}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${input.currency}">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>${input.number}</cbc:ID>
  <cbc:IssueDate>${dateStr}</cbc:IssueDate>
  <cbc:DueDate>${dueDateStr}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${input.currency}</cbc:DocumentCurrencyCode>

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${input.supplierName}</cbc:Name>
      </cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${input.supplierVat}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>Tech Sanctum OÜ</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${input.currency}">${input.vat.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="${input.currency}">${input.net.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${input.currency}">${input.gross.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${input.currency}">${input.gross.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  ${lineItemsXml}
</Invoice>`
}
