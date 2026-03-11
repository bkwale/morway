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
    await handleXeroCallback(code, clientId)

    const response = NextResponse.redirect(
      new URL(`/dashboard/clients/${clientId}?connected=true`, req.url)
    )
    response.cookies.delete('xero_connecting_client')
    return response
  } catch (err) {
    console.error('Xero callback error:', err)
    return NextResponse.redirect(
      new URL(`/dashboard/clients/${clientId}?error=xero_connection_failed`, req.url)
    )
  }
}
