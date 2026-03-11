import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/clients?firmId=xxx
 * List all clients for a firm with invoice stats.
 */
export async function GET(req: NextRequest) {
  const firmId = req.nextUrl.searchParams.get('firmId')
  if (!firmId) return NextResponse.json({ error: 'Missing firmId' }, { status: 400 })

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
 * Create a new client for a firm.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const firmId = body.firmId ?? process.env.DEV_FIRM_ID ?? ''
  const { name, vatNumber, peppolId } = body

  if (!firmId || !name) {
    return NextResponse.json({ error: 'firmId and name are required' }, { status: 400 })
  }

  const client = await db.client.create({
    data: { firmId, name, vatNumber, peppolId },
  })

  return NextResponse.json(client, { status: 201 })
}
