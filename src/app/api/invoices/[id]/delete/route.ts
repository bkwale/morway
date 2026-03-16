import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'
import { INVOICE_STATUS, AUDIT_ACTION } from '@/lib/constants'

/**
 * Soft-delete an invoice.
 * Sets status to DELETED and records an audit log.
 * Invoice remains in the database but is hidden from default views.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionOrNull()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: invoiceId } = await params
  const body = await req.json().catch(() => ({}))
  const { reason } = body as { reason?: string }

  const userId = session.user.id

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: { select: { firmId: true } } },
  })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Verify the invoice belongs to the user's firm
  if (invoice.client.firmId !== session.user.firmId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Don't allow deleting already-posted invoices (they exist in external systems)
  if (invoice.status === INVOICE_STATUS.AUTO_POSTED || invoice.status === INVOICE_STATUS.APPROVED) {
    return NextResponse.json(
      { error: 'Cannot delete a posted invoice. Reverse it in your accounting system first.' },
      { status: 422 }
    )
  }

  if (invoice.status === INVOICE_STATUS.DELETED) {
    return NextResponse.json({ error: 'Invoice already deleted' }, { status: 422 })
  }

  await db.$transaction([
    db.invoice.update({
      where: { id: invoiceId },
      data: { status: INVOICE_STATUS.DELETED },
    }),
    db.auditLog.create({
      data: {
        invoiceId,
        action: AUDIT_ACTION.DELETED,
        detail: JSON.stringify({ userId, reason: reason ?? 'Manual deletion', previousStatus: invoice.status }),
      },
    }),
  ])

  return NextResponse.json({ success: true })
}
