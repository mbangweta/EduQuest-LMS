'use client'

import { supabaseBrowser } from '@/lib/supabase-browser'

// ============================================================================
// Client-side Supabase auth helpers (used by LoginView and the AppShell)
// ============================================================================

export async function signInWithEmail(email: string, password: string) {
  const sb = supabaseBrowser()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signUpWithEmail(opts: {
  email: string
  password: string
  name: string
  role: 'ADMIN' | 'TEACHER' | 'LEARNER'
  grade?: number
}) {
  const sb = supabaseBrowser()
  const { data, error } = await sb.auth.signUp({
    email: opts.email,
    password: opts.password,
    options: {
      data: {
        name: opts.name,
        role: opts.role,
        grade: opts.grade,
      },
    },
  })
  return { data, error }
}

export async function signOut() {
  const sb = supabaseBrowser()
  await sb.auth.signOut()
}

export async function getSession() {
  const sb = supabaseBrowser()
  const { data: { session } } = await sb.auth.getSession()
  return session
}

export async function getCurrentUserClient() {
  const sb = supabaseBrowser()
  const { data: { user } } = await sb.auth.getUser()
  return user
}
