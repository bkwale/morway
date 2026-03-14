import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Resend from 'next-auth/providers/resend'
import { db } from './db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db) as any,
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_EMAIL_FROM ?? 'Morway <noreply@morway.app>',
    }),
  ],
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/login/check-email',
    error: '/login/error',
  },
  callbacks: {
    async session({ session, user }) {
      // Attach firmId and role to the session so every page/API can use it
      if (user?.id) {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { firmId: true, role: true, name: true },
        })
        if (dbUser) {
          session.user.firmId = dbUser.firmId
          session.user.role = dbUser.role
          session.user.name = dbUser.name
        }
      }
      return session
    },
    async signIn({ user }) {
      // Only allow sign-in if the user exists in our DB with a firmId
      // This prevents random people from creating accounts via magic link
      if (!user?.email) return false

      const existingUser = await db.user.findUnique({
        where: { email: user.email },
        select: { firmId: true },
      })

      if (!existingUser) {
        // No account — reject sign-in
        return '/login/error?error=NoAccount'
      }

      return true
    },
  },
  trustHost: true,
})
