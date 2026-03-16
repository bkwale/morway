import { generateLexwareExport, generateLexwareSupplierExport } from '@/lib/accounting/lexware'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'
import { NextResponse } from 'next/server'

/**
 * GET /api/export/lexware?clientId=xxx&type=bookings|suppliers
 * Downloads a Lexware buchhalter import file (.txt).
 *
 * Query params:
 *   - clientId: (required) the client to export for
 *   - type: "bookings" (default) or "suppliers"
 *   - invoiceIds: comma-separated list of specific invoice IDs
 *   - creditorStartNo: starting creditor account number (default 70000)
 */
export async function GET(request: Request) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const exportType = searchParams.get('type') ?? 'bookings'

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

  const creditorStartNo = parseInt(searchParams.get('creditorStartNo') ?? '70000', 10)

  try {
    let content: string
    let filename: string
    const dateStr = new Date().toISOString().slice(0, 10)

    if (exportType === 'suppliers') {
      content = await generateLexwareSupplierExport({
        clientId,
        startingAccountNumber: creditorStartNo,
      })
      filename = `morway-lexware-kreditoren-${dateStr}.txt`
    } else {
      const invoiceIdsParam = searchParams.get('invoiceIds')
      const invoiceIds = invoiceIdsParam ? invoiceIdsParam.split(',') : undefined

      content = await generateLexwareExport({
        clientId,
        invoiceIds,
        creditorStartNo,
      })
      filename = `morway-lexware-buchungen-${dateStr}.txt`
    }

    // Return as downloadable text file (ANSI encoding)
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=windows-1252',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
