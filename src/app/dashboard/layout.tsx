'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '◎' },
  { href: '/dashboard/invoices', label: 'Invoices', icon: '◉' },
  { href: '/dashboard/exceptions', label: 'Exceptions', icon: '⚡' },
  { href: '/dashboard/rules', label: 'Rules', icon: '⚙' },
  { href: '/dashboard/clients', label: 'Clients', icon: '◈' },
  { href: '/dashboard/audit', label: 'Audit Trail', icon: '◷' },
  { href: '/dashboard/settings/team', label: 'Team', icon: '◇' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="px-5 py-5">
          <Image src="/icon.svg" alt="Morway" width={32} height={32} className="rounded-lg" />
          <p className="text-[11px] text-slate-500 mt-2">Invoice Automation</p>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <span className="text-base opacity-60">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User info + sign out */}
        <div className="px-4 py-3 border-t border-slate-800">
          {session?.user && (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-300 truncate">{session.user.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{session.user.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="ml-2 p-1.5 text-slate-500 hover:text-white rounded-md hover:bg-slate-800 transition-colors shrink-0"
                title="Sign out"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
          <p className="text-[11px] text-slate-600 mt-2">Morway v1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
