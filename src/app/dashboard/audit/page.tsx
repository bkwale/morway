import { db } from '@/lib/db'

const FIRM_ID = process.env.DEV_FIRM_ID ?? ''

const ACTION_STYLES: Record<string, string> = {
  RECEIVED: 'bg-gray-100 text-gray-700',
  PARSED: 'bg-blue-100 text-blue-700',
  SUPPLIER_MATCHED: 'bg-blue-100 text-blue-700',
  SUPPLIER_CREATED: 'bg-purple-100 text-purple-700',
  RULE_APPLIED: 'bg-blue-100 text-blue-700',
  AUTO_POSTED: 'bg-green-100 text-green-800',
  EXCEPTION_CREATED: 'bg-yellow-100 text-yellow-800',
  EXCEPTION_APPROVED: 'bg-green-100 text-green-800',
  EXCEPTION_REJECTED: 'bg-red-100 text-red-700',
  PAYMENT_MATCHED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-700',
}

async function getAuditLogs(firmId: string) {
  return db.auditLog.findMany({
    where: { invoice: { client: { firmId } } },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          client: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

export default async function AuditPage() {
  const logs = await getAuditLogs(FIRM_ID)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Trail</h1>

      <div className="bg-white rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                  No audit logs yet
                </td>
              </tr>
            )}
            {logs.map((log) => {
              let detail: Record<string, unknown> = {}
              try { detail = JSON.parse(log.detail ?? '{}') } catch { /* ignore */ }

              return (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-gray-700">
                    {log.invoice.client.name}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-600">
                    {log.invoice.invoiceNumber}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_STYLES[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500 max-w-xs truncate">
                    {Object.entries(detail)
                      .filter(([, v]) => v !== null && v !== undefined)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
