// Invoice statuses
export const INVOICE_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  AUTO_POSTED: 'AUTO_POSTED',
  EXCEPTION: 'EXCEPTION',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
  DELETED: 'DELETED',
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
  FEC: 'FEC',
  PENNYLANE: 'PENNYLANE',
  MONEYBIRD: 'MONEYBIRD',
  TWINFIELD: 'TWINFIELD',
  OCTOPUS: 'OCTOPUS',
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

// Payment statuses
export const PAYMENT_STATUS = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]

// VAT exemption reasons (EU standard codes)
export const VAT_EXEMPTION = {
  REVERSE_CHARGE: 'REVERSE_CHARGE',
  INTRA_COMMUNITY: 'INTRA_COMMUNITY',
  EXPORT: 'EXPORT',
  EXEMPT_MEDICAL: 'EXEMPT_MEDICAL',
  EXEMPT_EDUCATION: 'EXEMPT_EDUCATION',
  EXEMPT_FINANCIAL: 'EXEMPT_FINANCIAL',
  SMALL_BUSINESS: 'SMALL_BUSINESS',
  OTHER: 'OTHER',
} as const

export type VatExemption = (typeof VAT_EXEMPTION)[keyof typeof VAT_EXEMPTION]

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
  PAYMENT_RECORDED: 'PAYMENT_RECORDED',
  CREDIT_NOTE_LINKED: 'CREDIT_NOTE_LINKED',
  REVERSE_CHARGE_DETECTED: 'REVERSE_CHARGE_DETECTED',
  RULE_LEARNED: 'RULE_LEARNED',
  FAILED: 'FAILED',
  DELETED: 'DELETED',
} as const
