'use client'

import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { useState } from 'react'
import Link from 'next/link'

export default function SignupPage() {
  const [step, setStep] = useState<'form' | 'sending' | 'sent'>('form')
  const [firmName, setFirmName] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Step 1: Create firm + user
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmName, email, name }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setLoading(false)
        return
      }

      // Step 2: Trigger magic link sign-in
      setStep('sending')
      const result = await signIn('resend', {
        email,
        callbackUrl: '/dashboard',
        redirect: false,
      })

      if (result?.error) {
        setError('Account created but failed to send magic link. Try signing in.')
        setStep('form')
        setLoading(false)
      } else {
        setStep('sent')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (step === 'sent') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Image
            src="/icon.svg"
            alt="Morway"
            width={48}
            height={48}
            className="mx-auto rounded-xl mb-4"
          />
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Check your email</h1>
          <p className="text-sm text-slate-500 mb-6">
            We sent a sign-in link to <span className="font-medium text-slate-700">{email}</span>
          </p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 text-sm text-emerald-700 mb-6">
            Your 14-day free trial has started. Full access, no credit card needed.
          </div>
          <Link href="/login" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    )
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
          <h1 className="text-xl font-semibold text-slate-900">Start your free trial</h1>
          <p className="text-sm text-slate-500 mt-1">
            14 days, full access. No credit card.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="firmName" className="block text-sm font-medium text-slate-700 mb-1.5">
                Firm name
              </label>
              <input
                id="firmName"
                type="text"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                required
                autoFocus
                placeholder="e.g. Fiteco, Baker Tilly, BDO"
                className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                Your name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Marie Dupont"
                className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Work email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@yourfirm.com"
                className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !firmName || !email || !name}
              className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? step === 'sending'
                  ? 'Sending magic link...'
                  : 'Creating your account...'
                : 'Start free trial'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-slate-600 hover:text-slate-900 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
