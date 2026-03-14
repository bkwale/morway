'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const messages: Record<string, { title: string; body: string }> = {
    NoAccount: {
      title: 'No account found',
      body: 'There is no Morway account associated with this email address. If you believe this is an error, contact your firm administrator.',
    },
    Verification: {
      title: 'Link expired',
      body: 'The magic link has expired or has already been used. Please request a new one.',
    },
    Default: {
      title: 'Something went wrong',
      body: 'An unexpected error occurred during sign-in. Please try again.',
    },
  }

  const msg = messages[error ?? ''] ?? messages.Default

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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">&#10006;</span>
          </div>

          <h1 className="text-lg font-semibold text-slate-900 mb-2">{msg.title}</h1>
          <p className="text-sm text-slate-500 leading-relaxed">{msg.body}</p>

          <Link
            href="/login"
            className="inline-block mt-5 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
