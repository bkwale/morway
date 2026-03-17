/**
 * Auth Boundary Tests for Morway
 *
 * These tests verify:
 * 1. Every protected API route returns 401 without a session
 * 2. Every protected API route returns 401/403 for cross-firm access
 * 3. Session-based firmId is used instead of query params / request body
 * 4. Middleware redirects unauthenticated dashboard access to /login
 *
 * Strategy: We statically analyze the route files to verify auth patterns
 * rather than spinning up a full Next.js server. This catches:
 * - Missing getSessionOrNull / requireSession calls
 * - Routes that still reference DEV_FIRM_ID
 * - Routes that trust firmId from request body or query params
 * - Missing firmId validation on mutation endpoints
 */

import { describe, test, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const SRC_DIR = path.join(process.cwd(), 'src')
const API_DIR = path.join(SRC_DIR, 'app', 'api')
const DASHBOARD_DIR = path.join(SRC_DIR, 'app', 'dashboard')

// Recursively find all route.ts files
function findRouteFiles(dir: string): string[] {
  const files: string[] = []
  if (!fs.existsSync(dir)) return files

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath))
    } else if (entry.name === 'route.ts') {
      files.push(fullPath)
    }
  }
  return files
}

// Find all page.tsx files
function findPageFiles(dir: string): string[] {
  const files: string[] = []
  if (!fs.existsSync(dir)) return files

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findPageFiles(fullPath))
    } else if (entry.name === 'page.tsx') {
      files.push(fullPath)
    }
  }
  return files
}

function routeRelPath(filePath: string): string {
  return path.relative(SRC_DIR, filePath)
}

// ──────────────────────────────────────────────────────────
// 1. API Routes: Must use session-based auth
// ──────────────────────────────────────────────────────────

// Routes that are exempt from auth (webhooks, callbacks, public)
const EXEMPT_ROUTES = [
  'app/api/auth', // NextAuth handler
  'app/api/email/inbound', // Webhook — protected by Resend signature
  'app/api/peppol/webhook', // Webhook — protected by Storecove secret
  'app/api/xero/callback', // OAuth callback
  'app/api/xero/connect', // OAuth initiation
  'app/api/exact-online/callback', // OAuth callback
  'app/api/exact-online/connect', // OAuth initiation
  'app/api/dev/seed', // Dev-only, env-gated
]

function isExempt(filePath: string): boolean {
  const rel = path.relative(SRC_DIR, filePath)
  return EXEMPT_ROUTES.some((exempt) => rel.startsWith(exempt))
}

describe('API Route Auth', () => {
  const apiRoutes = findRouteFiles(API_DIR)

  test('found API route files', () => {
    expect(apiRoutes.length).toBeGreaterThan(0)
  })

  for (const routeFile of apiRoutes) {
    const rel = routeRelPath(routeFile)

    if (isExempt(routeFile)) {
      test(`[EXEMPT] ${rel} — webhook/callback, auth not required`, () => {
        // Just document that this route is intentionally exempt
        expect(true).toBe(true)
      })
      continue
    }

    const content = fs.readFileSync(routeFile, 'utf-8')

    test(`${rel} — imports auth helper`, () => {
      const hasAuth =
        content.includes('getSessionOrNull') || content.includes('requireSession')
      expect(hasAuth).toBe(true)
    })

    test(`${rel} — does NOT use DEV_FIRM_ID`, () => {
      expect(content).not.toContain('DEV_FIRM_ID')
    })

    test(`${rel} — does NOT accept firmId from query params`, () => {
      // Check for patterns like: searchParams.get('firmId') or body.firmId
      const acceptsFirmIdFromQuery =
        content.includes("searchParams.get('firmId')") ||
        content.includes('searchParams.get("firmId")')
      expect(acceptsFirmIdFromQuery).toBe(false)
    })

    test(`${rel} — does NOT accept firmId from request body`, () => {
      const acceptsFirmIdFromBody =
        content.includes('body.firmId') || content.includes('body?.firmId')
      expect(acceptsFirmIdFromBody).toBe(false)
    })

    // Mutation endpoints (POST/PATCH/DELETE) should return 401 early
    if (content.includes('export async function POST') ||
        content.includes('export async function PATCH') ||
        content.includes('export async function DELETE')) {
      test(`${rel} — mutation handler checks auth before processing`, () => {
        // The getSessionOrNull call should come before any db operations
        const authCallIndex = content.indexOf('getSessionOrNull')
        const firstDbCallIndex = content.indexOf('db.')
        if (authCallIndex !== -1 && firstDbCallIndex !== -1) {
          expect(authCallIndex).toBeLessThan(firstDbCallIndex)
        }
      })
    }
  }
})

// ──────────────────────────────────────────────────────────
// 2. Dashboard Pages: Must use requireSession
// ──────────────────────────────────────────────────────────

// Pages that are client-side only and rely on API routes for data
const CLIENT_SIDE_PAGES = [
  'app/dashboard/exceptions/page.tsx', // Client component, fetches from /api
  'app/dashboard/invoices/page.tsx', // Client component, fetches from /api
  'app/dashboard/rules/page.tsx', // Client component, fetches from /api
  'app/dashboard/clients/new/page.tsx', // Client component
  'app/dashboard/clients/onboard/page.tsx', // Client component
  'app/dashboard/settings/team/page.tsx', // Client component, fetches from /api/team/invite
]

function isClientSidePage(filePath: string): boolean {
  const rel = path.relative(SRC_DIR, filePath)
  return CLIENT_SIDE_PAGES.some((p) => rel === p)
}

describe('Dashboard Page Auth', () => {
  const dashboardPages = findPageFiles(DASHBOARD_DIR)

  test('found dashboard page files', () => {
    expect(dashboardPages.length).toBeGreaterThan(0)
  })

  for (const pageFile of dashboardPages) {
    const rel = routeRelPath(pageFile)
    const content = fs.readFileSync(pageFile, 'utf-8')

    if (isClientSidePage(pageFile)) {
      test(`${rel} — client-side page, protected by middleware + API auth`, () => {
        // Client-side pages are protected by:
        // 1. Middleware redirecting unauthenticated users
        // 2. API routes returning 401
        expect(content.includes("'use client'")).toBe(true)
      })
      continue
    }

    // Server-rendered pages must call requireSession
    test(`${rel} — server page uses requireSession`, () => {
      const hasAuth = content.includes('requireSession')
      expect(hasAuth).toBe(true)
    })

    test(`${rel} — does NOT use DEV_FIRM_ID`, () => {
      expect(content).not.toContain('DEV_FIRM_ID')
    })
  }
})

// ──────────────────────────────────────────────────────────
// 3. Middleware exists and protects correct paths
// ──────────────────────────────────────────────────────────

describe('Middleware', () => {
  const middlewarePath = path.join(SRC_DIR, 'middleware.ts')

  test('middleware.ts exists', () => {
    expect(fs.existsSync(middlewarePath)).toBe(true)
  })

  test('middleware protects /dashboard routes', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8')
    expect(content).toContain('/dashboard')
  })

  test('middleware protects /api routes', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8')
    expect(content).toContain('/api/')
  })

  test('middleware exempts /api/auth', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8')
    expect(content).toContain('/api/auth/')
  })

  test('middleware exempts /api/email (webhooks)', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8')
    expect(content).toContain('/api/email/')
  })

  test('middleware redirects unauthenticated users to /login', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8')
    expect(content).toContain('/login')
  })
})

// ──────────────────────────────────────────────────────────
// 4. Auth config validates sign-in
// ──────────────────────────────────────────────────────────

describe('Auth Config', () => {
  const authPath = path.join(SRC_DIR, 'lib', 'auth.ts')

  test('auth.ts exists', () => {
    expect(fs.existsSync(authPath)).toBe(true)
  })

  test('auth uses PrismaAdapter', () => {
    const content = fs.readFileSync(authPath, 'utf-8')
    expect(content).toContain('PrismaAdapter')
  })

  test('auth has signIn callback to block unknown users', () => {
    const content = fs.readFileSync(authPath, 'utf-8')
    expect(content).toContain('signIn')
    expect(content).toContain('existingUser')
    expect(content).toContain('NoAccount')
  })

  test('auth session callback attaches firmId', () => {
    const content = fs.readFileSync(authPath, 'utf-8')
    expect(content).toContain('session.user.firmId')
  })

  test('auth session callback attaches role', () => {
    const content = fs.readFileSync(authPath, 'utf-8')
    expect(content).toContain('session.user.role')
  })
})

// ──────────────────────────────────────────────────────────
// 5. Firm-scoped queries: mutation endpoints validate firmId
// ──────────────────────────────────────────────────────────

describe('Firm Scope Validation', () => {
  const approveRoute = path.join(API_DIR, 'invoices', '[id]', 'approve', 'route.ts')
  const rejectRoute = path.join(API_DIR, 'invoices', '[id]', 'reject', 'route.ts')
  const bulkActionRoute = path.join(API_DIR, 'invoices', 'bulk-action', 'route.ts')

  test('approve endpoint validates invoice belongs to user firm', () => {
    const content = fs.readFileSync(approveRoute, 'utf-8')
    expect(content).toContain('invoice.client.firmId !== session.user.firmId')
    expect(content).toContain('Forbidden')
  })

  test('reject endpoint validates invoice belongs to user firm', () => {
    const content = fs.readFileSync(rejectRoute, 'utf-8')
    expect(content).toContain('invoice.client.firmId !== session.user.firmId')
    expect(content).toContain('Forbidden')
  })

  test('bulk-action validates invoice belongs to user firm', () => {
    const content = fs.readFileSync(bulkActionRoute, 'utf-8')
    expect(content).toContain('invoice.client.firmId !== firmId')
    expect(content).toContain('Forbidden')
  })

  test('approve uses session userId, not request body userId', () => {
    const content = fs.readFileSync(approveRoute, 'utf-8')
    expect(content).toContain('const userId = session.user.id')
    expect(content).not.toContain('body.userId')
    expect(content).not.toMatch(/\{ .*userId.*\} = body/)
  })

  test('reject uses session userId, not request body userId', () => {
    const content = fs.readFileSync(rejectRoute, 'utf-8')
    expect(content).toContain('const userId = session.user.id')
  })
})

// ──────────────────────────────────────────────────────────
// 6. No remaining DEV_FIRM_ID references in production code
// ──────────────────────────────────────────────────────────

describe('No DEV_FIRM_ID leaks', () => {
  function findAllTsFiles(dir: string, exclude: string[] = []): string[] {
    const files: string[] = []
    if (!fs.existsSync(dir)) return files

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (exclude.some((e) => entry.name.includes(e))) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...findAllTsFiles(fullPath, exclude))
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        files.push(fullPath)
      }
    }
    return files
  }

  const allFiles = findAllTsFiles(SRC_DIR, ['__tests__', 'generated'])

  // Only the dev seed route should reference DEV_FIRM_ID
  for (const file of allFiles) {
    const rel = routeRelPath(file)
    if (rel.includes('dev/seed')) continue // allowed

    test(`${rel} — no DEV_FIRM_ID reference`, () => {
      const content = fs.readFileSync(file, 'utf-8')
      expect(content).not.toContain('DEV_FIRM_ID')
    })
  }
})

// ──────────────────────────────────────────────────────────
// 7. Session provider + type declarations
// ──────────────────────────────────────────────────────────

describe('Session Infrastructure', () => {
  test('root layout wraps children in SessionProvider', () => {
    const content = fs.readFileSync(
      path.join(SRC_DIR, 'app', 'layout.tsx'),
      'utf-8'
    )
    expect(content).toContain('Providers')
  })

  test('providers.tsx includes SessionProvider', () => {
    const content = fs.readFileSync(
      path.join(SRC_DIR, 'app', 'providers.tsx'),
      'utf-8'
    )
    expect(content).toContain('SessionProvider')
  })

  test('session type includes firmId', () => {
    const content = fs.readFileSync(
      path.join(SRC_DIR, 'types', 'next-auth.d.ts'),
      'utf-8'
    )
    expect(content).toContain('firmId: string')
    expect(content).toContain('role: string')
  })

  test('dashboard sidebar shows user info and sign-out', () => {
    const content = fs.readFileSync(
      path.join(SRC_DIR, 'app', 'dashboard', 'layout.tsx'),
      'utf-8'
    )
    expect(content).toContain('useSession')
    expect(content).toContain('signOut')
    expect(content).toContain('session.user.name')
  })
})

// ──────────────────────────────────────────────────────────
// 8. Login pages exist
// ──────────────────────────────────────────────────────────

describe('Login Pages', () => {
  test('/login page exists', () => {
    expect(
      fs.existsSync(path.join(SRC_DIR, 'app', 'login', 'page.tsx'))
    ).toBe(true)
  })

  test('/login/check-email page exists', () => {
    expect(
      fs.existsSync(path.join(SRC_DIR, 'app', 'login', 'check-email', 'page.tsx'))
    ).toBe(true)
  })

  test('/login/error page exists', () => {
    expect(
      fs.existsSync(path.join(SRC_DIR, 'app', 'login', 'error', 'page.tsx'))
    ).toBe(true)
  })

  test('login page uses signIn from next-auth', () => {
    const content = fs.readFileSync(
      path.join(SRC_DIR, 'app', 'login', 'page.tsx'),
      'utf-8'
    )
    expect(content).toContain('signIn')
    expect(content).toContain('resend')
  })

  test('error page handles NoAccount error', () => {
    const content = fs.readFileSync(
      path.join(SRC_DIR, 'app', 'login', 'error', 'page.tsx'),
      'utf-8'
    )
    expect(content).toContain('NoAccount')
  })
})

// ──────────────────────────────────────────────────────────
// 9. Prisma schema has auth models
// ──────────────────────────────────────────────────────────

describe('Prisma Schema Auth Models', () => {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
  const schema = fs.readFileSync(schemaPath, 'utf-8')

  test('User model has emailVerified field', () => {
    expect(schema).toContain('emailVerified')
  })

  test('Account model exists', () => {
    expect(schema).toContain('model Account')
  })

  test('Session model exists', () => {
    expect(schema).toContain('model Session')
  })

  test('VerificationToken model exists', () => {
    expect(schema).toContain('model VerificationToken')
  })

  test('User has accounts relation', () => {
    expect(schema).toMatch(/accounts\s+Account\[\]/)
  })

  test('User has sessions relation', () => {
    expect(schema).toMatch(/sessions\s+Session\[\]/)
  })
})
