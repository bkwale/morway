// Invoice statuses
export const INVOICE_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  AUTO_POSTED: 'AUTO_POSTED',
  EXCEPTION: 'EXCEPTION',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
} as const

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS]

// Exception actions
export const EXCEPTION_ACTION = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EDITED_AND_APPROVED: 'EDITED_AND_APPROVED',
} as const

export type ExceptionAction = (typeof EXCEPTION_ACTION)[keyof typeof EXCEPTION_ACTION]

// User roles
export const USER_ROLE = {
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

// Plans
export const PLAN = {
  STARTER: 'STARTER',
  GROWTH: 'GROWTH',
  SCALE: 'SCALE',
} as const

// Accounting systems
export const ACCOUNTING_SYSTEM = {
  NONE: 'NONE',
  XERO: 'XERO',
  EXACT_ONLINE: 'EXACT_ONLINE',
  DATEV: 'DATEV',
  LEXWARE: 'LEXWARE',
} as const

export type AccountingSystem = (typeof ACCOUNTING_SYSTEM)[keyof typeof ACCOUNTING_SYSTEM]

// Exact Online regional endpoints
export const EXACT_ONLINE_REGIONS = {
  NL: { auth: 'https://start.exactonline.nl', label: 'Netherlands' },
  BE: { auth: 'https://start.exactonline.be', label: 'Belgium' },
  DE: { auth: 'https://start.exactonline.de', label: 'Germany' },
  UK: { auth: 'https://start.exactonline.co.uk', label: 'United Kingdom' },
} as const

export type ExactOnlineRegion = keyof typeof EXACT_ONLINE_REGIONS

// Confidence threshold for auto-posting
export const AUTO_POST_THRESHOLD = parseFloat(
  process.env.AUTO_POST_CONFIDENCE_THRESHOLD ?? '0.8'
)

// Audit actions
export const AUDIT_ACTION = {
  RECEIVED: 'RECEIVED',
  PARSED: 'PARSED',
  SUPPLIER_MATCHED: 'SUPPLIER_MATCHED',
  SUPPLIER_CREATED: 'SUPPLIER_CREATED',
  RULE_APPLIED: 'RULE_APPLIED',
  AUTO_POSTED: 'AUTO_POSTED',
  EXCEPTION_CREATED: 'EXCEPTION_CREATED',
  EXCEPTION_APPROVED: 'EXCEPTION_APPROVED',
  EXCEPTION_REJECTED: 'EXCEPTION_REJECTED',
  PAYMENT_MATCHED: 'PAYMENT_MATCHED',
  FAILED: 'FAILED',
} as const
