import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/clients/[id]
 * Get a single client.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = await db.client.findUnique({ where: { id } })

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  return NextResponse.json(client)
}

/**
 * PATCH /api/clients/[id]
 * Update a client's accounting system config.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const allowedFields = [
    'name',
    'vatNumber',
    'peppolId',
    'accountingSystem',
    'datevConsultNo',
    'datevClientNo',
    'exactDivision',
  ]

  const data: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) {
      data[field] = body[field]
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const client = await db.client.update({
      where: { id },
      data,
    })
    return NextResponse.json(client)
  } catch {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
}
