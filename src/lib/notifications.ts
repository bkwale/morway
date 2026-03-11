import { db } from './db'

/**
 * Email notification service using Resend API.
 * No library needed — just fetch.
 *
 * Env vars:
 *   RESEND_API_KEY — your Resend API key
 *   NOTIFICATION_FROM — sender email (default: notifications@morway.app)
 *   APP_URL — base URL for links in emails (default: http://localhost:3000)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL = process.env.NOTIFICATION_FROM ?? 'Morway <notifications@morway.app>'
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[notifications] No RESEND_API_KEY set. Would have sent: "${options.subject}" to ${options.to}`)
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[notifications] Resend error: ${res.status} ${err}`)
      return false
    }

    return true
  } catch (err) {
    console.error('[notifications] Send failed:', err)
    return false
  }
}

// ─── EXCEPTION NOTIFICATION ──────────────────────────────────────────────────

export async function notifyExceptionCreated(invoiceId: string, reason: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: { include: { firm: true } },
      supplier: { select: { name: true } },
    },
  })

  if (!invoice?.client?.firm) return

  // Get all users for this firm who should receive notifications
  const users = await db.user.findMany({
    where: { firmId: invoice.client.firmId },
  })

  if (users.length === 0) {
    // Fallback: send to firm email
    await sendExceptionEmail(
      invoice.client.firm.email,
      invoice.client.name,
      invoice.supplier?.name ?? 'Unknown Supplier',
      invoice.invoiceNumber,
      invoice.grossAmount,
      invoice.currency,
      reason,
      invoiceId
    )
    return
  }

  // Send to all firm users
  await Promise.allSettled(
    users.map((user) =>
      sendExceptionEmail(
        user.email,
        invoice.client.name,
        invoice.supplier?.name ?? 'Unknown Supplier',
        invoice.invoiceNumber,
        invoice.grossAmount,
        invoice.currency,
        reason,
        invoiceId
      )
    )
  )
}

async function sendExceptionEmail(
  to: string,
  clientName: string,
  supplierName: string,
  invoiceNumber: string,
  amount: number,
  currency: string,
  reason: string,
  invoiceId: string
) {
  const reviewUrl = `${APP_URL}/dashboard/exceptions`

  await sendEmail({
    to,
    subject: `Exception: ${supplierName} invoice ${invoiceNumber} needs review`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
        <div style="background: #0f172a; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; font-size: 18px; font-weight: 600;">Morway</h1>
          <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Invoice Exception Alert</p>
        </div>
        <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
          <p style="margin: 0 0 16px; font-size: 14px; color: #334155;">
            An invoice needs your attention.
          </p>

          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 500;">
              ${reason}
            </p>
          </div>

          <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 500; color: #94a3b8;">Client</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${clientName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 500; color: #94a3b8;">Supplier</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${supplierName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 500; color: #94a3b8;">Invoice #</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 500; color: #94a3b8;">Amount</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #0f172a;">${currency} ${amount.toFixed(2)}</td>
            </tr>
          </table>

          <a href="${reviewUrl}" style="display: block; margin-top: 24px; text-align: center; background: #0f172a; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
            Review Exception
          </a>

          <p style="margin: 20px 0 0; font-size: 11px; color: #94a3b8; text-align: center;">
            Morway · Tech Sanctum OU
          </p>
        </div>
      </div>
    `,
  })
}

// ─── DAILY DIGEST ────────────────────────────────────────────────────────────

export async function sendDailyDigest(firmId: string) {
  const firm = await db.firm.findUnique({ where: { id: firmId } })
  if (!firm) return

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [exceptions, autoPosted, failed] = await Promise.all([
    db.invoice.count({
      where: { status: 'EXCEPTION', client: { firmId }, receivedAt: { gte: today } },
    }),
    db.invoice.count({
      where: { status: 'AUTO_POSTED', client: { firmId }, receivedAt: { gte: today } },
    }),
    db.invoice.count({
      where: { status: 'FAILED', client: { firmId }, receivedAt: { gte: today } },
    }),
  ])

  const total = exceptions + autoPosted + failed

  if (total === 0) return // nothing to report

  const users = await db.user.findMany({ where: { firmId } })
  const recipients = users.length > 0 ? users.map((u) => u.email) : [firm.email]

  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  await Promise.allSettled(
    recipients.map((email) =>
      sendEmail({
        to: email,
        subject: `Morway Daily: ${total} invoice${total !== 1 ? 's' : ''} processed today`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
            <div style="background: #0f172a; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 18px; font-weight: 600;">Morway Daily Digest</h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">${dateStr}</p>
            </div>
            <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
              <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                <div style="flex: 1; text-align: center; padding: 16px; background: #f0fdf4; border-radius: 8px;">
                  <p style="margin: 0; font-size: 24px; font-weight: 700; color: #059669;">${autoPosted}</p>
                  <p style="margin: 4px 0 0; font-size: 11px; color: #6b7280;">Auto-posted</p>
                </div>
                <div style="flex: 1; text-align: center; padding: 16px; background: #fffbeb; border-radius: 8px;">
                  <p style="margin: 0; font-size: 24px; font-weight: 700; color: #d97706;">${exceptions}</p>
                  <p style="margin: 4px 0 0; font-size: 11px; color: #6b7280;">Exceptions</p>
                </div>
                <div style="flex: 1; text-align: center; padding: 16px; background: ${failed > 0 ? '#fef2f2' : '#f8fafc'}; border-radius: 8px;">
                  <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${failed > 0 ? '#dc2626' : '#94a3b8'};">${failed}</p>
                  <p style="margin: 4px 0 0; font-size: 11px; color: #6b7280;">Failed</p>
                </div>
              </div>

              ${exceptions > 0 ? `
                <a href="${APP_URL}/dashboard/exceptions" style="display: block; text-align: center; background: #0f172a; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
                  Review ${exceptions} Exception${exceptions !== 1 ? 's' : ''}
                </a>
              ` : `
                <p style="text-align: center; font-size: 14px; color: #059669; font-weight: 500; margin: 0;">
                  All clear — no exceptions today.
                </p>
              `}

              <p style="margin: 20px 0 0; font-size: 11px; color: #94a3b8; text-align: center;">
                Morway · Tech Sanctum OU
              </p>
            </div>
          </div>
        `,
      })
    )
  )
}
