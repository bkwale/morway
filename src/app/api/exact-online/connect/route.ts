import { getExactAuthUrl } from '@/lib/accounting/exact-online'
import { NextResponse } from 'next/server'

/**
 * GET /api/exact-online/connect?clientId=xxx&region=NL
 * Redirects the user to Exact Online's OAuth consent screen.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const region = (searchParams.get('region') ?? 'NL') as 'NL' | 'BE' | 'DE' | 'UK'

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  // Store clientId + region in a cookie so we can retrieve it on callback
  const authUrl = getExactAuthUrl(region)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('exact_client_id', clientId, { httpOnly: true, maxAge: 600 })
  response.cookies.set('exact_region', region, { httpOnly: true, maxAge: 600 })

  return response
}
