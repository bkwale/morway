import { NextRequest, NextResponse } from 'next/server'
import { getXeroAuthUrl } from '@/lib/xero'

/**
 * GET /api/xero/connect?clientId=xxx
 * Redirects the accountant to Xero's OAuth consent screen.
 */
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
  }

  // Store clientId in a short-lived cookie so the callback knows which client
  const authUrl = getXeroAuthUrl()
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('xero_connecting_client', clientId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
