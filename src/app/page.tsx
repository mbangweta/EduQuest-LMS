'use client'

import { Loader2 } from 'lucide-react'
import { LandingPage } from '@/components/views/landing-page'
import { AppShell } from '@/components/app-shell'
import { RouterProvider } from '@/lib/router'
import { useCurrentUser } from '@/hooks/use-current-user'

export default function Home() {
  const { user, status } = useCurrentUser()

  return (
    <RouterProvider>
      {status === 'loading' ? (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm">Loading EduQuest…</span>
          </div>
        </div>
      ) : !user ? (
        <LandingPage />
      ) : (
        <AppShell />
      )}
    </RouterProvider>
  )
}
