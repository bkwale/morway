import { NextRequest, NextResponse } from 'next/server'
import { handleXeroCallback } from '@/lib/xero'

/**
 * GET /api/xero/callback
 * Xero redirects here after the user authorises the connection.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const clientId = req.cookies.get('xero_connecting_client')?.value

  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard?error=xero_no_code', req.url)
    )
  }

  if (!clientId) {
    return NextResponse.redirect(
      new URL('/dashboard?error=xero_session_expired', req.url)
    )
  }

  try {
    // Pass the full callback URL to Xero (includes code, scope, state params)
    const fullCallbackUrl = req.nextUrl.toString()
    await handleXeroCallback(fullCallbackUrl, clientId)

    const response = NextResponse.redirect(
      new URL(`/dashboard/clients/${clientId}?connected=true`, req.url)
    )
    response.cookies.delete('xero_connecting_client')
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Xero callback error:', message, err)
    return NextResponse.redirect(
      new URL(`/dashboard?error=xero_failed&detail=${encodeURIComponent(message)}`, req.url)
    )
  }
}
