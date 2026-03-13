'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: '◎' },
  { href: '/dashboard/invoices', label: 'Invoices', icon: '◉' },
  { href: '/dashboard/exceptions', label: 'Exceptions', icon: '⚡' },
  { href: '/dashboard/rules', label: 'Rules', icon: '⚙' },
  { href: '/dashboard/clients', label: 'Clients', icon: '◈' },
  { href: '/dashboard/audit', label: 'Audit Trail', icon: '◷' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 text-white flex flex-col">
        <div className="px-5 py-5">
          <Image src="/icon.svg" alt="Morway" width={36} height={36} className="rounded-lg" />
          <p className="text-xs text-slate-400 mt-2">Invoice Automation</p>
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
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-6 py-4 border-t border-slate-800">
          <p className="text-[11px] text-slate-500">Morway v1.0 · Tech Sanctum</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
