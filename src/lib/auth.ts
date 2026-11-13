import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from './db'

// EduQuest LMS — NextAuth config (credentials provider, JWT sessions with role)
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/' },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'EduQuest',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        const email = creds?.email?.trim().toLowerCase()
        const password = creds?.password ?? ''
        if (!email || !password) return null
        const user = await db.user.findUnique({ where: { email } })
        if (!user) return null
        if (user.status !== 'ACTIVE') return null
        const ok = await bcrypt.compare(password, user.password)
        if (!ok) return null
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'eduquest-dev-secret-change-in-production-9f2k4m',
}

// Helper: get the current user record from the DB (server-side only)
export async function getCurrentUser(req?: any): Promise<{
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'TEACHER' | 'LEARNER'
  grade?: number | null
  phone?: string | null
} | null> {
  const { getServerSession } = await import('next-auth')
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const u = await db.user.findUnique({ where: { email: session.user.email } })
  if (!u) return null
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as any,
    grade: u.grade,
    phone: u.phone,
  }
}

export async function requireRole(roles: string[]) {
  const user = await getCurrentUser()
  if (!user || !roles.includes(user.role)) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}
