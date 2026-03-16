import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL = process.env.NOTIFICATION_FROM ?? process.env.AUTH_EMAIL_FROM ?? 'Morway <onboarding@resend.dev>'
const APP_URL = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'https://morway.app'

/**
 * Invite a team member to the firm.
 *
 * Creates the User record + sends a branded invite email with magic link.
 * The invited user clicks the link → lands on /login → enters email → gets magic link → signs in.
 *
 * POST /api/team/invite
 * Body: { email, name, role? }
 */
export async function POST(req: NextRequest) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only admins can invite
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can invite team members' }, { status: 403 })
  }

  const body = await req.json()
  const { email, name, role } = body as {
    email?: string
    name?: string
    role?: string
  }

  if (!email?.trim() || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const userRole = role === 'ADMIN' ? 'ADMIN' : 'ACCOUNTANT'

  // Check if already exists
  const existing = await db.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json(
      { error: 'A user with this email already exists' },
      { status: 409 }
    )
  }

  // Get the firm name for the invite email
  const firm = await db.firm.findUnique({
    where: { id: session.user.firmId },
    select: { name: true },
  })

  // Create user
  await db.user.create({
    data: {
      firmId: session.user.firmId,
      email: normalizedEmail,
      name: name.trim(),
      role: userRole,
    },
  })

  // Send branded invite email
  const loginUrl = `${APP_URL}/login`
  const inviterName = session.user.name ?? 'Your colleague'
  const firmName = firm?.name ?? 'your firm'

  if (RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: normalizedEmail,
          subject: `You've been invited to ${firmName} on Morway`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 20px; color: #0f172a; margin: 0;">You're invited to Morway</h1>
              </div>
              <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                ${inviterName} has invited you to join <strong>${firmName}</strong> on Morway — the invoice automation platform for accounting firms.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${loginUrl}" style="display: inline-block; padding: 12px 32px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
                  Sign in to Morway
                </a>
              </div>
              <p style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
                Click the button above and enter your email (<strong>${normalizedEmail}</strong>) to receive a secure sign-in link. No password needed.
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="font-size: 11px; color: #cbd5e1; text-align: center;">
                Morway · Automated invoice processing for accounting firms
              </p>
            </div>
          `,
        }),
      })
    } catch (err) {
      console.error('[invite] Failed to send invite email:', err)
      // Don't fail the invite — user was created, they can sign in manually
    }
  }

  return NextResponse.json({
    success: true,
    message: `Invite sent to ${normalizedEmail}`,
  })
}

/**
 * GET /api/team/invite — list team members
 */
export async function GET() {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const members = await db.user.findMany({
    where: { firmId: session.user.firmId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(members)
}
