import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ingestEmail, type ResendWebhookEnvelope } from '@/lib/email-ingest'

// Allow up to 60s for PDF download + AI parsing (Pro plan limit)
export const maxDuration = 60

/**
 * POST /api/email/inbound
 *
 * Receives inbound emails from Resend webhook.
 * Resend sends: { created_at, type: "email.received", data: { ...email } }
 *
 * Processing involves downloading attachments, extracting PDF text, and
 * calling Claude for structuring — this can take 15-30s total.
 * We return 200 immediately and process in the background using waitUntil.
 *
 * Setup:
 *   1. Add MX record for in.morway.app pointing to Resend's inbound SMTP
 *   2. Configure Resend inbound webhook to POST to https://morway.app/api/email/inbound
 *   3. Set RESEND_WEBHOOK_SECRET env var for signature verification
 *   4. Set RESEND_API_KEY env var for downloading attachments
 *   5. Set ANTHROPIC_API_KEY env var for Claude PDF extraction
 */
export async function POST(req: NextRequest) {
  // ── Verify webhook signature ──────────────────────────────────────────────
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

  const rawBody = await req.text()

  if (webhookSecret && svixId && svixTimestamp && svixSignature) {
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
    const secretBytes = Buffer.from(webhookSecret.replace('whsec_', ''), 'base64')
    const expected = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64')

    const signatures = svixSignature.split(' ').map((s) => s.replace('v1,', ''))
    const valid = signatures.some((sig) => {
      try {
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      } catch {
        return false
      }
    })

    if (!valid) {
      console.error('[email-inbound] Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  // ── Parse payload (unwrap Resend envelope) ──────────────────────────────
  let envelope: ResendWebhookEnvelope
  try {
    envelope = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only process email.received events
  if (envelope.type !== 'email.received') {
    console.log(`[email-inbound] Ignoring event type: ${envelope.type}`)
    return NextResponse.json({ received: true, skipped: true })
  }

  const payload = envelope.data

  // ── Log receipt ───────────────────────────────────────────────────────────
  console.log(`[email-inbound] Received email from ${payload.from} to ${payload.to?.join(', ')} — subject: "${payload.subject}" — ${payload.attachments?.length ?? 0} attachment(s)`)

  // ── Process (with timeout protection) ───────────────────────────────────
  // We still await the result but have maxDuration=60 set above.
  // On hobby plan (10s limit), consider moving to a queue.
  try {
    const result = await ingestEmail(payload)

    if (!result.success) {
      console.warn(`[email-inbound] Ingest failed:`, result.errors)
      return NextResponse.json(
        {
          received: true,
          processed: false,
          errors: result.errors,
        },
        { status: 200 }
      )
    }

    console.log(`[email-inbound] Created ${result.invoicesCreated.length} invoice(s) for client ${result.clientId}`)

    return NextResponse.json({
      received: true,
      processed: true,
      clientId: result.clientId,
      invoicesCreated: result.invoicesCreated,
      duplicatesSkipped: result.duplicatesSkipped,
      errors: result.errors,
    })
  } catch (err) {
    console.error('[email-inbound] Unhandled error:', err)
    return NextResponse.json(
      { error: 'Internal processing error' },
      { status: 500 }
    )
  }
}
