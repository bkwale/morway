import { db } from './db'
import { ParsedInvoice, ParsedLineItem } from './ubl-parser'

export interface RuleMatch {
  accountCode: string
  ruleId: string
  confidence: number
  reason: string
}

export interface RulesEngineResult {
  lineItems: Array<ParsedLineItem & { accountCode: string | null; ruleId: string | null }>
  overallConfidence: number
  matches: RuleMatch[]
  unmatched: number
}

/**
 * Apply categorisation rules to a parsed invoice.
 * Rules are evaluated in priority order (highest first).
 * Hierarchy: supplier-specific > client-specific > firm-wide
 */
export async function applyRules(
  firmId: string,
  clientId: string,
  supplierId: string | null,
  invoice: ParsedInvoice
): Promise<RulesEngineResult> {
  // Load all active rules for this firm, ordered by priority (desc)
  const rules = await db.rule.findMany({
    where: {
      firmId,
      active: true,
      OR: [
        { clientId: null, supplierId: null },           // firm-wide
        { clientId, supplierId: null },                  // client-specific
        { supplierId: supplierId ?? undefined },         // supplier-specific
      ],
    },
    orderBy: { priority: 'desc' },
  })

  const matches: RuleMatch[] = []
  let matchedCount = 0

  const enrichedLineItems = invoice.lineItems.map((item) => {
    // Try to find a matching rule for this line item
    const match = findBestRule(rules, item, supplierId)

    if (match) {
      matchedCount++
      matches.push(match)
      return { ...item, accountCode: match.accountCode, ruleId: match.ruleId }
    }

    return { ...item, accountCode: null, ruleId: null }
  })

  // If no line items, check if we have a supplier-level default
  if (enrichedLineItems.length === 0 && supplierId) {
    const supplierRule = rules.find(
      (r) => r.supplierId === supplierId && !r.keyword
    )
    if (supplierRule) {
      matches.push({
        accountCode: supplierRule.accountCode,
        ruleId: supplierRule.id,
        confidence: 0.9,
        reason: `Supplier default account: ${supplierRule.accountCode}`,
      })
    }
  }

  const totalItems = Math.max(enrichedLineItems.length, 1)
  const overallConfidence = matchedCount / totalItems

  return {
    lineItems: enrichedLineItems,
    overallConfidence,
    matches,
    unmatched: totalItems - matchedCount,
  }
}

function findBestRule(
  rules: Awaited<ReturnType<typeof db.rule.findMany>>,
  item: ParsedLineItem,
  supplierId: string | null
): RuleMatch | null {
  // 1. Supplier + keyword match (highest specificity)
  if (supplierId) {
    const supplierKeywordMatch = rules.find(
      (r) =>
        r.supplierId === supplierId &&
        r.keyword &&
        item.description.toLowerCase().includes(r.keyword.toLowerCase())
    )
    if (supplierKeywordMatch) {
      return {
        accountCode: supplierKeywordMatch.accountCode,
        ruleId: supplierKeywordMatch.id,
        confidence: 0.95,
        reason: `Supplier + keyword match: "${supplierKeywordMatch.keyword}"`,
      }
    }

    // 2. Supplier default (no keyword)
    const supplierDefault = rules.find(
      (r) => r.supplierId === supplierId && !r.keyword
    )
    if (supplierDefault) {
      return {
        accountCode: supplierDefault.accountCode,
        ruleId: supplierDefault.id,
        confidence: 0.85,
        reason: `Supplier default: ${supplierDefault.accountCode}`,
      }
    }
  }

  // 3. Client keyword match
  const clientKeywordMatch = rules.find(
    (r) =>
      !r.supplierId &&
      r.clientId &&
      r.keyword &&
      item.description.toLowerCase().includes(r.keyword.toLowerCase())
  )
  if (clientKeywordMatch) {
    return {
      accountCode: clientKeywordMatch.accountCode,
      ruleId: clientKeywordMatch.id,
      confidence: 0.75,
      reason: `Client keyword match: "${clientKeywordMatch.keyword}"`,
    }
  }

  // 4. Firm-wide keyword match
  const firmKeywordMatch = rules.find(
    (r) =>
      !r.supplierId &&
      !r.clientId &&
      r.keyword &&
      item.description.toLowerCase().includes(r.keyword.toLowerCase())
  )
  if (firmKeywordMatch) {
    return {
      accountCode: firmKeywordMatch.accountCode,
      ruleId: firmKeywordMatch.id,
      confidence: 0.6,
      reason: `Firm keyword match: "${firmKeywordMatch.keyword}"`,
    }
  }

  return null
}
