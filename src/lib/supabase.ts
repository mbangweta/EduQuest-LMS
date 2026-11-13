import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// EduQuest LMS — Server-side Supabase clients
// ============================================================================
// IMPORTANT: This file imports `next/headers` (server-only). DO NOT import
// this file from client components. For browser-side access, use:
//   `import { supabaseBrowser } from '@/lib/supabase-browser'`
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
    'Add them to .env (see SETUP.md). Supabase-dependent features will fail until set.'
  )
}

// Singleton service client (bypasses RLS — server-side use only!)
let _serviceClient: SupabaseClient | null = null
export function supabaseService(): SupabaseClient {
  if (_serviceClient) return _serviceClient
  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env (see SETUP.md).'
    )
  }
  _serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _serviceClient
}

// Server client bound to the user's session cookie (respects RLS)
export async function supabaseServer(): Promise<SupabaseClient> {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.'
    )
  }
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }))
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component where cookies can't be set.
          // Middleware will refresh the session instead.
        }
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON && SUPABASE_SERVICE)
