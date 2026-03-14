import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'
import { INVOICE_STATUS, EXCEPTION_ACTION, AUDIT_ACTION } from '@/lib/constants'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: invoiceId } = await params
  const { notes } = await req.json()

  // Use authenticated user's ID
  const userId = session.user.id

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { exception: true, client: { select: { firmId: true } } },
  })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Verify the invoice belongs to the user's firm
  if (invoice.client.firmId !== session.user.firmId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (invoice.status !== INVOICE_STATUS.EXCEPTION) {
    return NextResponse.json({ error: 'Invoice is not in exception queue' }, { status: 422 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txOps: any[] = [
    db.invoice.update({
      where: { id: invoiceId },
      data: { status: INVOICE_STATUS.REJECTED },
    }),
    db.auditLog.create({
      data: {
        invoiceId,
        action: AUDIT_ACTION.EXCEPTION_REJECTED,
        detail: JSON.stringify({ userId, notes }),
      },
    }),
  ]

  if (invoice.exception) {
    txOps.push(
      db.exception.update({
        where: { invoiceId },
        data: { resolvedAt: new Date(), resolution: EXCEPTION_ACTION.REJECTED },
      })
    )

    if (userId) {
      txOps.push(
        db.exceptionReview.create({
          data: { exceptionId: invoice.exception.id, userId, action: EXCEPTION_ACTION.REJECTED, notes },
        })
      )
    }
  }

  await db.$transaction(txOps)

  return NextResponse.json({ success: true })
}
