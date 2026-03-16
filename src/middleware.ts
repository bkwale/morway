import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Protect all dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!req.auth?.user) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Protect API routes (except auth, webhooks, and inbound email)
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/email/') && !pathname.startsWith('/api/xero/callback') && !pathname.startsWith('/api/exact-online/callback') && !pathname.startsWith('/api/dev/')) {
    if (!req.auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
