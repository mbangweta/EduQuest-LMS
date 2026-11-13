import { createBrowserClient } from '@supabase/ssr'

// ============================================================================
// EduQuest LMS — Browser-side Supabase client (safe to import from client components)
// ============================================================================
// Uses `@supabase/ssr`'s createBrowserClient so auth tokens are stored in
// cookies (not localStorage) — the server-side `supabaseServer()` reads the
// same cookies, so getCurrentUser() works seamlessly across SSR and CSR.
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (typeof window !== 'undefined' && (!SUPABASE_URL || !SUPABASE_ANON)) {
  console.warn(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
    'Add them to .env (see SETUP.md). Supabase auth will not work until set.'
  )
}

let _browserClient: any = null
export function supabaseBrowser(): any {
  if (_browserClient) return _browserClient
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    // No env vars — return a stub so client components don't crash.
    // Use createBrowserClient with placeholders so the client constructs
    // but auth calls will fail gracefully.
    _browserClient = createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-anon-key',
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    )
    return _browserClient
  }
  _browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Use cookie-based storage so the server can read the session.
      storageKey: `sb-${SUPABASE_URL.replace('https://', '').split('.')[0]}-auth-token`,
    },
  })
  return _browserClient
}

export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON)
export const supabaseUrl = SUPABASE_URL
