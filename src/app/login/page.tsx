'use client'

import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'
  const urlError = searchParams.get('error')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signIn('resend', {
        email,
        callbackUrl,
        redirect: false,
      })

      if (result?.error) {
        setError('Something went wrong. Please try again.')
        setLoading(false)
      } else {
        // Redirect to check-email page
        window.location.href = '/login/check-email'
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/icon.svg"
            alt="Morway"
            width={48}
            height={48}
            className="mx-auto rounded-xl mb-4"
          />
          <h1 className="text-xl font-semibold text-slate-900">Sign in to Morway</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter your email to receive a magic link
          </p>
        </div>

        {/* Error messages */}
        {(error || urlError) && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {urlError === 'NoAccount'
              ? 'No account found for this email. Contact your firm administrator.'
              : urlError === 'Verification'
              ? 'The magic link has expired. Please request a new one.'
              : error ?? 'An error occurred. Please try again.'}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@yourfirm.de"
                className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending link...' : 'Continue with email'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          No password needed — we send a secure link to your email.
        </p>
        <p className="text-center text-xs text-slate-400 mt-2">
          New to Morway?{' '}
          <a href="/signup" className="text-slate-600 hover:text-slate-900 transition-colors">
            Start your free trial
          </a>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
