'use client'

import { useEffect, useState, useCallback } from 'react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  // Invite form state
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('ACCOUNTANT')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  const loadMembers = useCallback(() => {
    fetch('/api/team/invite')
      .then((r) => r.json())
      .then(setMembers)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadMembers() }, [loadMembers])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    setInviteLoading(true)

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setInviteError(data.error ?? 'Failed to send invite')
      } else {
        setInviteSuccess(data.message ?? 'Invite sent')
        setInviteName('')
        setInviteEmail('')
        setInviteRole('ACCOUNTANT')
        setShowInvite(false)
        loadMembers()
      }
    } catch {
      setInviteError('Something went wrong')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Team</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage who has access to your firm on Morway
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(!showInvite); setInviteError(null); setInviteSuccess(null) }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          + Invite member
        </button>
      </div>

      {/* Success toast */}
      {inviteSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center justify-between">
          {inviteSuccess}
          <button onClick={() => setInviteSuccess(null)} className="text-emerald-400 hover:text-emerald-600">&#10005;</button>
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Invite a team member</h2>

          {inviteError && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {inviteError}
            </div>
          )}

          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="inv-name" className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                <input
                  id="inv-name"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                  placeholder="Marie Dupont"
                  className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                />
              </div>
              <div>
                <label htmlFor="inv-email" className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                <input
                  id="inv-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="marie@firm.com"
                  className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="inv-role" className="block text-xs font-medium text-slate-500 mb-1">Role</label>
              <select
                id="inv-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              >
                <option value="ACCOUNTANT">Accountant</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={inviteLoading || !inviteName || !inviteEmail}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {inviteLoading ? 'Sending...' : 'Send invite'}
              </button>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">Loading team...</div>
        ) : members.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">No team members yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-900 font-medium">{m.name}</td>
                  <td className="px-5 py-3 text-slate-500">{m.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                      m.role === 'ADMIN'
                        ? 'bg-violet-50 text-violet-700 border border-violet-200'
                        : 'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs tabular-nums">
                    {new Date(m.createdAt).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
