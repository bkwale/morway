import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'

/**
 * GET /api/clients/[id]
 * Get a single client (only if it belongs to the user's firm).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const client = await db.client.findFirst({
    where: { id, firmId: session.user.firmId },
  })

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  return NextResponse.json(client)
}

/**
 * PATCH /api/clients/[id]
 * Update a client's accounting system config (only if it belongs to the user's firm).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify client belongs to user's firm
  const existing = await db.client.findFirst({
    where: { id, firmId: session.user.firmId },
  })
  if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

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

  const client = await db.client.update({
    where: { id },
    data,
  })
  return NextResponse.json(client)
}
