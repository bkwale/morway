import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200">
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Morway
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem href="/dashboard" label="Overview" />
          <NavItem href="/dashboard/exceptions" label="Exceptions" />
          <NavItem href="/dashboard/clients" label="Clients" />
          <NavItem href="/dashboard/audit" label="Audit Trail" />
        </nav>

        <div className="px-4 py-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">Morway v1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      {label}
    </Link>
  )
}
