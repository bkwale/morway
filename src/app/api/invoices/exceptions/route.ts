import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/invoices/exceptions?firmId=xxx
 * Returns all invoices in the exception queue for a firm.
 */
export async function GET(req: NextRequest) {
  const firmId = req.nextUrl.searchParams.get('firmId') || process.env.DEV_FIRM_ID
  if (!firmId) return NextResponse.json({ error: 'Missing firmId' }, { status: 400 })

  const invoices = await db.invoice.findMany({
    where: {
      status: 'EXCEPTION',
      client: { firmId },
    },
    include: {
      client: { select: { name: true } },
      supplier: { select: { name: true } },
      exception: { select: { reason: true } },
      lineItems: true,
    },
    orderBy: { receivedAt: 'asc' },
  })

  return NextResponse.json(invoices)
}
