'use client'
import { ReactNode, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// EduQuest LMS — App-wide providers.
// NextAuth SessionProvider removed — auth is now handled by Supabase Auth.
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,       // data is fresh for 60s (was 30s)
        gcTime: 5 * 60 * 1000,   // keep cache for 5 min
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnMount: false,    // don't refetch when component remounts
      },
    },
  }))
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  )
}
