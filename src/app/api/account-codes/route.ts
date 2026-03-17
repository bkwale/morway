/**
 * Account Code Autocomplete
 *
 * GET /api/account-codes?clientId=xxx&q=fuel
 *
 * Returns matching account codes from two sources:
 *   1. Chart of accounts reference data (based on client's accounting system + country)
 *   2. Previously used codes from the rules engine (learned patterns)
 *
 * Results are deduplicated and sorted: learned codes first, then reference codes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrNull } from '@/lib/get-session'
import { getCodeList } from '@/lib/chart-of-accounts'

export async function GET(request: NextRequest) {
  const session = await getSessionOrNull()
  if (!session?.user?.firmId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const query = (searchParams.get('q') ?? '').toLowerCase().trim()

  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  // Verify client belongs to this firm
  const client = await db.client.findFirst({
    where: { id: clientId, firmId: session.user.firmId },
    select: { accountingSystem: true, country: true },
  })

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // 1. Reference codes from chart of accounts
  const referenceCodes = getCodeList(client.accountingSystem, client.country)
  const matchingReference = query
    ? referenceCodes.filter(
        (c) =>
          c.code.toLowerCase().includes(query) ||
          c.label.toLowerCase().includes(query)
      )
    : referenceCodes

  // 2. Learned codes from rules engine
  const learnedRules = await db.rule.findMany({
    where: {
      firmId: session.user.firmId,
      clientId,
      active: true,
      accountCode: query ? { contains: query } : undefined,
    },
    select: {
      accountCode: true,
      keyword: true,
      vatRate: true,
    },
    take: 20,
  })

  // Also search by keyword match if query is text (not a number)
  let keywordRules: typeof learnedRules = []
  if (query && !/^\d+$/.test(query)) {
    keywordRules = await db.rule.findMany({
      where: {
        firmId: session.user.firmId,
        clientId,
        active: true,
        keyword: { contains: query },
      },
      select: {
        accountCode: true,
        keyword: true,
        vatRate: true,
      },
      take: 20,
    })
  }

  // Deduplicate and merge
  const seen = new Set<string>()
  const results: Array<{
    code: string
    label: string
    source: 'learned' | 'reference'
    keyword?: string | null
  }> = []

  // Learned rules first (they're more relevant — accountant-confirmed)
  for (const rule of [...learnedRules, ...keywordRules]) {
    if (seen.has(rule.accountCode)) continue
    seen.add(rule.accountCode)

    // Try to find a label from reference data
    const ref = referenceCodes.find((c) => c.code === rule.accountCode)
    results.push({
      code: rule.accountCode,
      label: ref?.label ?? `Learned from: "${rule.keyword}"`,
      source: 'learned',
      keyword: rule.keyword,
    })
  }

  // Then reference codes
  for (const ref of matchingReference) {
    if (seen.has(ref.code)) continue
    seen.add(ref.code)
    results.push({
      code: ref.code,
      label: ref.label,
      source: 'reference',
    })
  }

  return NextResponse.json({ codes: results.slice(0, 30) })
}
