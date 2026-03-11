import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/rules?firmId=xxx&clientId=xxx
 * List rules for a firm, optionally filtered by client.
 */
export async function GET(req: NextRequest) {
  const firmId = req.nextUrl.searchParams.get('firmId') || process.env.DEV_FIRM_ID
  const clientId = req.nextUrl.searchParams.get('clientId')

  if (!firmId) return NextResponse.json({ error: 'Missing firmId' }, { status: 400 })

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
 * Create a new categorisation rule.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const firmId = body.firmId ?? process.env.DEV_FIRM_ID ?? ''
  const { clientId, supplierId, keyword, accountCode, vatRate, priority } = body

  if (!firmId || !accountCode) {
    return NextResponse.json({ error: 'firmId and accountCode are required' }, { status: 400 })
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
 * Update a rule.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'Missing rule id' }, { status: 400 })

  const rule = await db.rule.update({
    where: { id },
    data: updates,
  })

  return NextResponse.json(rule)
}

/**
 * DELETE /api/rules
 * Delete a rule by id (sent in body).
 */
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const id = body.id

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await db.rule.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
