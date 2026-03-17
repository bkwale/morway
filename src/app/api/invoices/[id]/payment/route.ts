/**
 * Invoice Payment Status
 *
 * POST /api/invoices/[id]/payment
 * Records a payment against an invoice. Supports partial payments.
 *
 * Body: { amount: number, note?: string }
 *
 * Logic:
 *   - If paidAmount >= grossAmount → PAID
 *   - If paidAmount > 0 but < grossAmount → PARTIALLY_PAID
 *   - Creates audit log entry
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'
import { PAYMENT_STATUS, AUDIT_ACTION } from '@/lib/constants'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionOrNull()
  if (!session?.user?.firmId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { amount, note } = body as { amount: number; note?: string }

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
  }

  // Verify invoice belongs to this firm
  const invoice = await db.invoice.findFirst({
    where: { id, client: { firmId: session.user.firmId } },
    select: { id: true, grossAmount: true, paidAmount: true, currency: true },
  })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const newPaidAmount = Math.round((invoice.paidAmount + amount) * 100) / 100
  const isPaid = newPaidAmount >= invoice.grossAmount

  const paymentStatus = isPaid
    ? PAYMENT_STATUS.PAID
    : PAYMENT_STATUS.PARTIALLY_PAID

  await db.invoice.update({
    where: { id },
    data: {
      paidAmount: newPaidAmount,
      paymentStatus,
      paidAt: isPaid ? new Date() : null,
    },
  })

  await db.auditLog.create({
    data: {
      invoiceId: id,
      action: AUDIT_ACTION.PAYMENT_RECORDED,
      detail: JSON.stringify({
        amount,
        currency: invoice.currency,
        totalPaid: newPaidAmount,
        grossAmount: invoice.grossAmount,
        paymentStatus,
        note: note ?? null,
      }),
    },
  })

  return NextResponse.json({
    paymentStatus,
    paidAmount: newPaidAmount,
    grossAmount: invoice.grossAmount,
    remaining: Math.round((invoice.grossAmount - newPaidAmount) * 100) / 100,
  })
}
