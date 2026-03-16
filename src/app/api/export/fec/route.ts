import { generateFECExport } from '@/lib/accounting/fec'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'
import { NextResponse } from 'next/server'

/**
 * GET /api/export/fec?clientId=xxx
 * Downloads an FEC-compliant file (.txt) for French tax compliance.
 *
 * Query params:
 *   - clientId: (required) the client to export for
 *   - invoiceIds: comma-separated list of specific invoice IDs
 *   - sirenNumber: company SIREN number (for filename)
 */
export async function GET(request: Request) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  // Verify client belongs to user's firm
  const client = await db.client.findFirst({
    where: { id: clientId, firmId: session.user.firmId },
  })
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  try {
    const invoiceIdsParam = searchParams.get('invoiceIds')
    const invoiceIds = invoiceIdsParam ? invoiceIdsParam.split(',') : undefined
    const sirenNumber = searchParams.get('sirenNumber') ?? undefined

    const { content, filename } = await generateFECExport({
      clientId,
      invoiceIds,
      sirenNumber,
    })

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
