import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'

/**
 * GET /api/invoices/exceptions
 * Returns all invoices in the exception queue for the authenticated user's firm.
 */
export async function GET() {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const firmId = session.user.firmId

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
