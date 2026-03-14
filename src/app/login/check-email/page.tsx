import Image from 'next/image'
import Link from 'next/link'

export default function CheckEmailPage() {
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
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">&#9993;</span>
          </div>

          <h1 className="text-lg font-semibold text-slate-900 mb-2">Check your email</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            We sent a magic link to your email address.
            Click the link to sign in — it expires in 24 hours.
          </p>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Didn&apos;t receive it? Check your spam folder, or{' '}
              <Link href="/login" className="text-slate-700 underline hover:text-slate-900">
                try again
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
