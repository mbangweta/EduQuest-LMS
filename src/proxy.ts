import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Refresh the Supabase auth session cookie on every page navigation.
// Skipped for API routes and static assets for performance.
// In Next.js 16+, the "proxy" file convention replaces the deprecated "middleware".
export async function proxy(request: NextRequest) {
  // Skip if Supabase env vars are not set (preview mode)
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next()
  }

  const response = NextResponse.next({ request: { headers: request.headers } })

  // Only refresh session on page navigations, not API calls
  // (API calls read the session via supabaseServer() which doesn't need proxy)
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/api/')) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map(({ name, value }) => ({ name, value }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
            request.cookies.set(name, value)
          })
        },
      },
    }
  )

  // Refresh the session — important for keeping the user logged in.
  // Use getUser() which is lightweight (just validates the JWT, no DB call)
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Only run proxy on page routes, skip everything else
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|woff|woff2)$).*)',
  ],
}
