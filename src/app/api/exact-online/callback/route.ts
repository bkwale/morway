import { handleExactCallback } from '@/lib/accounting/exact-online'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/exact-online/callback?code=xxx
 * Exact Online redirects here after the user authorises the connection.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'No authorisation code received' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const clientId = cookieStore.get('exact_client_id')?.value
  const region = (cookieStore.get('exact_region')?.value ?? 'NL') as 'NL' | 'BE' | 'DE' | 'UK'

  if (!clientId) {
    return NextResponse.json(
      { error: 'No client ID found. Please start the connection flow again.' },
      { status: 400 }
    )
  }

  try {
    await handleExactCallback(code, clientId, region)

    // Redirect back to client page
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
    return NextResponse.redirect(`${appUrl}/dashboard/clients/${clientId}?exact=connected`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Exact Online callback error:', message, err)
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
    return NextResponse.redirect(`${appUrl}/dashboard/clients/${clientId}?exact=error&message=${encodeURIComponent(message)}`)
  }
}
