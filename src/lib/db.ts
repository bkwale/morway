import { PrismaClient } from '../generated/prisma'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function buildClient(): PrismaClient {
  // Production: connect to Turso via libsql adapter
  if (process.env.DATABASE_URL?.startsWith('libsql://')) {
    const libsql = createClient({
      url: process.env.DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter } as any)
  }

  // Local dev: use SQLite file
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? buildClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
