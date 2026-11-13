'use client'

import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotifications } from '@/hooks/use-notifications'
import { useCurrentUser } from '@/hooks/use-current-user'
import { cn } from '@/lib/utils'

export function NotificationsBell() {
  const { user } = useCurrentUser()
  const { all, unread, hasNewSinceLastView, clearNewIndicator, markRead, markAllRead } = useNotifications(user?.id)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className={cn('h-5 w-5 transition-transform', hasNewSinceLastView && 'animate-swing')} />
          <AnimatePresence>
            {unread.length > 0 && (
              <motion.span
                key={unread.length}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground"
              >
                {unread.length > 9 ? '9+' : unread.length}
              </motion.span>
            )}
          </AnimatePresence>
          {hasNewSinceLastView && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-chart-4 animate-ping" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" onOpenChange={(open) => { if (open) setTimeout(clearNewIndicator, 500) }}>
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold flex items-center gap-2">
            Notifications
            <span className="text-xs text-muted-foreground font-normal">· live</span>
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          </span>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {all.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {all.slice(0, 30).map((n) => (
                  <motion.button
                    key={n.id}
                    layout
                    initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(34, 197, 94, 0.15)' }}
                    animate={{ opacity: 1, x: 0, backgroundColor: n.read ? 'rgba(0,0,0,0)' : 'rgba(34, 197, 94, 0.08)' }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.4 }}
                    onClick={() => markRead(n.id)}
                    className={cn(
                      'flex flex-col items-start gap-1 px-3 py-2 text-left text-sm hover:bg-accent/30 transition-colors border-b',
                      !n.read && 'bg-accent/10',
                    )}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="font-medium leading-tight">{n.title}</span>
                      {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">{n.message}</span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {n.createdAt ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) : ''}
                    </span>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
