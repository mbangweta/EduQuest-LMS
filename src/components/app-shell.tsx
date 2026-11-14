'use client'

import { useEffect, useState } from 'react'
import { Menu, LogOut, User as UserIcon, Settings as SettingsIcon, ChevronDown, School, Building2, Globe2, KeyRound, CalendarDays } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { useCurrentUser } from '@/hooks/use-current-user'
import { Sidebar } from '@/components/sidebar'
import { NotificationsBell } from '@/components/notifications-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserAvatar } from '@/components/views/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ViewRenderer } from '@/components/view-renderer'
import { ChangePasswordDialog } from '@/components/views/shared/change-password-dialog'
import { api } from '@/lib/api-client'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { useRealtimePresence, onPresenceUpdate } from '@/hooks/use-realtime'
import { useAcademicYear } from '@/hooks/use-academic-year'

interface PresenceUser {
  userId: string
  name: string
  role: string
  onlineAt: number
}

function settingsViewFor(role: string): string {
  if (role === 'SUPER_USER') return 'super.settings'
  if (role === 'SCHOOL_ADMIN') return 'school-admin.settings'
  return 'admin.settings'
}

export function AppShell() {
  const { user } = useCurrentUser()
  const { navigate } = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [liveOnlineCount, setLiveOnlineCount] = useState(1)
  const [switchSchoolOpen, setSwitchSchoolOpen] = useState(false)
  const [schools, setSchools] = useState<any[]>([])
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)
  const { currentYear, years, setYear, currentYearId } = useAcademicYear(user?.schoolId)

  // Track this user's presence (broadcast to all other connected clients)
  const { onlineCount } = useRealtimePresence({
    channelName: 'eduquest-presence',
    user: user ? { userId: user.id, name: user.name, role: user.role } : null,
    enabled: !!user,
  })

  // Listen for live presence updates (sets the count from peer broadcasts)
  useEffect(() => {
    if (!user) return
    const unsubscribe = onPresenceUpdate((users: PresenceUser[]) => {
      setLiveOnlineCount(users.length)
    })
    return unsubscribe
  }, [user])

  async function openSwitchSchool() {
    setSwitchSchoolOpen(true)
    setLoadingSchools(true)
    try {
      const { schools: list } = await api.get<{ schools: any[] }>('/api/schools')
      setSchools(list)
    } catch {
      setSchools([])
    } finally {
      setLoadingSchools(false)
    }
  }

  if (!user) return null

  const displayCount = Math.max(onlineCount, liveOnlineCount, 1)
  const isSuper = user.role === 'SUPER_USER'
  const schoolBadgeText = isSuper
    ? 'Platform-wide'
    : user.schoolName || 'No school'
  const SchoolIcon = isSuper ? Globe2 : Building2

  async function handleSignOut() {
    try {
      await supabaseBrowser().auth.signOut()
    } catch {}
    try { await fetch('/api/auth/signout', { method: 'POST' }) } catch {}
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-card/95 backdrop-blur px-4 lg:px-6">
        {/* Mobile sidebar toggle */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <Sidebar role={user.role} />
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-muted-foreground hidden sm:inline">
            EduQuest LMS
          </span>
          {/* School scope badge */}
          <Badge
            variant="outline"
            className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 max-w-[260px] text-foreground/80"
            title={schoolBadgeText}
          >
            <SchoolIcon className="h-3 w-3 shrink-0 text-primary" />
            <span className="truncate">{schoolBadgeText}</span>
          </Badge>
          {/* Academic Year switcher — only for users with a schoolId */}
          {user.schoolId && years.length > 0 && (
            <Select value={currentYearId || undefined} onValueChange={setYear}>
              <SelectTrigger className="hidden md:flex h-7 w-auto gap-1 text-xs px-2 py-0.5 max-w-[140px]" title="Academic Year">
                <CalendarDays className="h-3 w-3 text-muted-foreground" />
                <SelectValue placeholder="AY" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    AY: {y.name}{y.is_current ? ' (current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="hidden md:inline-flex live-indicator" title={`${displayCount} ${displayCount === 1 ? 'person' : 'people'} online right now`}>
            {displayCount} online
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <NotificationsBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2 hover:bg-accent/40">
                <UserAvatar name={user.name} size="sm" />
                <span className="hidden sm:inline text-sm font-medium">{user.name}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-semibold">{user.name}</span>
                  <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
                  <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{user.role}</span>
                  {user.schoolName && (
                    <span className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
                      <School className="h-3 w-3" /> {user.schoolName}
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isSuper && (
                <DropdownMenuItem onClick={openSwitchSchool} className="cursor-pointer">
                  <Building2 className="mr-2 h-4 w-4" /> Switch school
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setChangePwOpen(true)} className="cursor-pointer">
                <KeyRound className="mr-2 h-4 w-4" /> Change password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(settingsViewFor(user.role))} className="sm:hidden cursor-pointer">
                <SettingsIcon className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 border-r">
          <Sidebar role={user.role} />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <ViewRenderer />
        </main>
      </div>

      {/* Switch school dialog (SUPER_USER) */}
      <Dialog open={switchSchoolOpen} onOpenChange={setSwitchSchoolOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Switch school
            </DialogTitle>
            <DialogDescription>
              Pick a school to scope the dashboard. The Schools page lets you drill into per-school details.
            </DialogDescription>
          </DialogHeader>
          {loadingSchools ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : schools.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No schools available.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto scroll-thin space-y-1">
              {schools.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSwitchSchoolOpen(false)
                    navigate('super.schools', { schoolId: s.id })
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <School className="h-3 w-3" /> {s.code}
                    </div>
                  </div>
                  <Badge variant={s.status === 'ACTIVE' ? 'default' : 'outline'} className="shrink-0">
                    {s.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change password dialog */}
      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
    </div>
  )
}
