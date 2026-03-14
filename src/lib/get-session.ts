import { auth } from './auth'
import { redirect } from 'next/navigation'

/**
 * Get the authenticated session or redirect to login.
 * Use in server components and server actions.
 */
export async function requireSession() {
  const session = await auth()

  if (!session?.user?.firmId) {
    redirect('/login')
  }

  return session
}

/**
 * Get the authenticated session or return null.
 * Use in API routes where you want to return 401 instead of redirecting.
 */
export async function getSessionOrNull() {
  const session = await auth()
  if (!session?.user?.firmId) return null
  return session
}
