import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Self-serve firm registration.
 *
 * Creates: Firm (14-day trial) + Admin User
 * Then the user signs in via the normal magic link flow.
 *
 * POST /api/auth/signup
 * Body: { firmName, email, name }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { firmName, email, name } = body as {
      firmName?: string
      email?: string
      name?: string
    }

    // Validate
    if (!firmName?.trim()) {
      return NextResponse.json({ error: 'Firm name is required' }, { status: 400 })
    }
    if (!email?.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Your name is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check if email is already registered
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    })
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
      )
    }

    // Check if firm email is taken
    const existingFirm = await db.firm.findUnique({
      where: { email: normalizedEmail },
    })
    if (existingFirm) {
      return NextResponse.json(
        { error: 'A firm with this email already exists.' },
        { status: 409 }
      )
    }

    // Create firm with 14-day trial
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    const firm = await db.firm.create({
      data: {
        name: firmName.trim(),
        email: normalizedEmail,
        plan: 'STARTER',
        trialEndsAt,
      },
    })

    // Create admin user
    await db.user.create({
      data: {
        firmId: firm.id,
        email: normalizedEmail,
        name: name.trim(),
        role: 'ADMIN',
      },
    })

    return NextResponse.json({
      success: true,
      firmId: firm.id,
      trialEndsAt: trialEndsAt.toISOString(),
    })
  } catch (err) {
    console.error('[signup] Error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
