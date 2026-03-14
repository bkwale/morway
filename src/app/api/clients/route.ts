import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'

/**
 * GET /api/clients
 * List all clients for the authenticated user's firm.
 */
export async function GET() {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const firmId = session.user.firmId

  const clients = await db.client.findMany({
    where: { firmId, active: true },
    include: {
      _count: {
        select: {
          invoices: true,
        },
      },
      invoices: {
        where: { status: 'EXCEPTION' },
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(
    clients.map((c) => ({
      id: c.id,
      name: c.name,
      vatNumber: c.vatNumber,
      peppolId: c.peppolId,
      xeroConnected: c.xeroConnected,
      invoiceCount: c._count.invoices,
      exceptionCount: c.invoices.length,
      createdAt: c.createdAt,
    }))
  )
}

/**
 * POST /api/clients
 * Create a new client for the authenticated user's firm.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const firmId = session.user.firmId
  const body = await req.json()
  const { name, vatNumber, peppolId } = body

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const client = await db.client.create({
    data: { firmId, name, vatNumber, peppolId },
  })

  return NextResponse.json(client, { status: 201 })
}
