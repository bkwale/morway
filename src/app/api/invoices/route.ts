import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'

export async function GET() {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const invoices = await db.invoice.findMany({
      where: { client: { firmId: session.user.firmId }, status: { not: 'DELETED' } },
      include: {
        client: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take: 200,
    })

    return NextResponse.json(invoices)
  } catch (err) {
    console.error('[api/invoices] Error:', err)
    return NextResponse.json([], { status: 500 })
  }
}
