import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'

/**
 * GET /api/rules?clientId=xxx
 * List rules for the authenticated user's firm, optionally filtered by client.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const firmId = session.user.firmId
  const clientId = req.nextUrl.searchParams.get('clientId')

  const rules = await db.rule.findMany({
    where: {
      firmId,
      ...(clientId ? { clientId } : {}),
    },
    orderBy: { priority: 'desc' },
  })

  return NextResponse.json(rules)
}

/**
 * POST /api/rules
 * Create a new categorisation rule for the authenticated user's firm.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const firmId = session.user.firmId
  const body = await req.json()
  const { clientId, supplierId, keyword, accountCode, vatRate, priority } = body

  if (!accountCode) {
    return NextResponse.json({ error: 'accountCode is required' }, { status: 400 })
  }

  const rule = await db.rule.create({
    data: {
      firmId,
      clientId: clientId ?? null,
      supplierId: supplierId ?? null,
      keyword: keyword ?? null,
      accountCode,
      vatRate: vatRate ?? null,
      priority: priority ?? 0,
    },
  })

  return NextResponse.json(rule, { status: 201 })
}

/**
 * PATCH /api/rules
 * Update a rule (only if it belongs to the user's firm).
 */
export async function PATCH(req: NextRequest) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'Missing rule id' }, { status: 400 })

  // Verify the rule belongs to the user's firm
  const existing = await db.rule.findFirst({ where: { id, firmId: session.user.firmId } })
  if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

  const rule = await db.rule.update({
    where: { id },
    data: updates,
  })

  return NextResponse.json(rule)
}

/**
 * DELETE /api/rules
 * Delete a rule (only if it belongs to the user's firm).
 */
export async function DELETE(req: NextRequest) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const id = body.id

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Verify the rule belongs to the user's firm
  const existing = await db.rule.findFirst({ where: { id, firmId: session.user.firmId } })
  if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

  await db.rule.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
