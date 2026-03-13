import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const FIRM_ID = process.env.DEV_FIRM_ID ?? ''

export async function GET() {
  try {
    const invoices = await db.invoice.findMany({
      where: { client: { firmId: FIRM_ID } },
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
