import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/dev/diagnose
 * Tests each piece of the auth flow independently to find what's broken.
 */
export async function GET() {
  const results: Record<string, any> = {}

  // 1. Check env vars
  results.env = {
    RESEND_API_KEY: !!process.env.RESEND_API_KEY ? 'SET' : 'MISSING',
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM ?? 'MISSING (will default to noreply@morway.app)',
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.substring(0, 30) + '...)' : 'MISSING',
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING',
    AUTH_SECRET: !!process.env.AUTH_SECRET ? 'SET' : 'MISSING',
  }

  // 2. Check user exists in DB
  try {
    const user = await db.user.findUnique({
      where: { email: 'walt@morway.app' },
      select: { id: true, email: true, firmId: true, role: true, name: true, emailVerified: true },
    })
    results.user = user ?? 'NOT FOUND'
  } catch (e: any) {
    results.user = { error: e.message }
  }

  // 3. Check firm exists
  try {
    const firm = await db.firm.findFirst({
      select: { id: true, name: true, email: true, plan: true },
    })
    results.firm = firm ?? 'NOT FOUND'
  } catch (e: any) {
    results.firm = { error: e.message }
  }

  // 4. Check verification_tokens table exists
  try {
    const tokens = await db.verificationToken.findMany({ take: 1 })
    results.verificationTokens = { tableExists: true, count: tokens.length }
  } catch (e: any) {
    results.verificationTokens = { tableExists: false, error: e.message }
  }

  // 5. Check sessions table exists
  try {
    const sessions = await db.session.findMany({ take: 1 })
    results.sessions = { tableExists: true, count: sessions.length }
  } catch (e: any) {
    results.sessions = { tableExists: false, error: e.message }
  }

  // 6. Check accounts table exists
  try {
    const accounts = await db.account.findMany({ take: 1 })
    results.accounts = { tableExists: true, count: accounts.length }
  } catch (e: any) {
    results.accounts = { tableExists: false, error: e.message }
  }

  // 7. Test Resend API directly
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? 'Morway <noreply@morway.app>',
        to: 'walt@morway.app',
        subject: 'Morway Diagnostic Test',
        text: 'If you received this, Resend is working correctly.',
      }),
    })
    const resendResult = await res.json()
    results.resend = {
      status: res.status,
      ok: res.ok,
      response: resendResult,
    }
  } catch (e: any) {
    results.resend = { error: e.message }
  }

  // 8. Check AUTH_SECRET vs NEXTAUTH_SECRET
  // Auth.js v5 uses AUTH_SECRET, older versions use NEXTAUTH_SECRET
  results.authSecretNote = process.env.AUTH_SECRET
    ? 'AUTH_SECRET is set (Auth.js v5 standard)'
    : process.env.NEXTAUTH_SECRET
    ? 'Only NEXTAUTH_SECRET is set — Auth.js v5 may need AUTH_SECRET instead'
    : 'NO SECRET SET — this will break everything'

  return NextResponse.json(results, { status: 200 })
}
