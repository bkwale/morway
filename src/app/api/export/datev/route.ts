import { generateDatevExport } from '@/lib/accounting/datev'
import { NextResponse } from 'next/server'

/**
 * GET /api/export/datev?clientId=xxx
 * Downloads a DATEV Buchungsstapel CSV file for all approved invoices.
 *
 * Optional query params:
 *   - invoiceIds: comma-separated list of specific invoice IDs
 *   - consultantNumber: DATEV Beraternummer (defaults to client setting)
 *   - clientNumber: DATEV Mandantennummer (defaults to client setting)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  const invoiceIdsParam = searchParams.get('invoiceIds')
  const invoiceIds = invoiceIdsParam ? invoiceIdsParam.split(',') : undefined
  const consultantNumber = searchParams.get('consultantNumber') ?? undefined
  const clientNumber = searchParams.get('clientNumber') ?? undefined

  try {
    const csv = await generateDatevExport({
      clientId,
      invoiceIds,
      consultantNumber,
      clientNumber,
    })

    // Return as downloadable CSV
    const filename = `morway-datev-export-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=windows-1252',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
