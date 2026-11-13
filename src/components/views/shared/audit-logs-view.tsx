'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ScrollText, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { format, formatDistanceToNow } from 'date-fns'
import { api } from '@/lib/api-client'
import { useRealtimeQuery } from '@/hooks/use-realtime-query'
import { useCurrentUser } from '@/hooks/use-current-user'
import { UserAvatar } from '@/components/views/shared/user-avatar'

interface AuditLog {
  id: string
  actor_id: string
  actor_email: string
  actor_role: string
  school_id: string
  action: string
  entity_type: string
  entity_id: string
  description: string
  metadata: any
  created_at: string
  actor?: { id: string; name: string; avatar_color: string }
  school?: { id: string; name: string; code: string }
}

const ACTION_COLORS: Record<string, string> = {
  USER_CREATE: 'bg-accent text-accent-foreground',
  USER_UPDATE: 'bg-primary text-primary-foreground',
  USER_DELETE: 'bg-destructive text-destructive-foreground',
  SCHOOL_CREATE: 'bg-accent text-accent-foreground',
  SCHOOL_UPDATE: 'bg-primary text-primary-foreground',
  SCHOOL_DELETE: 'bg-destructive text-destructive-foreground',
  PROMOTE_LEARNERS: 'bg-chart-3 text-white',
  BULK_IMPORT_USERS: 'bg-chart-5 text-white',
}

export function AuditLogsView() {
  const { user } = useCurrentUser()
  const [q, setQ] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [debouncedQ, setDebouncedQ] = useState('')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400)
    return () => clearTimeout(t)
  }, [q])

  const queryKey = ['audit-logs', actionFilter, debouncedQ]
  const { data, isLoading } = useRealtimeQuery<{ logs: AuditLog[] }>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams()
      if (actionFilter !== 'all') params.set('action', actionFilter)
      if (debouncedQ) params.set('q', debouncedQ)
      params.set('limit', '100')
      return api.get(`/api/audit-logs?${params.toString()}`)
    },
    table: 'audit_logs',
  })

  const logs = data?.logs || []

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6" /> Audit Logs
          <span className="live-indicator">Live</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {user?.role === 'SUPER_USER' ? 'All administrative actions across the platform.' : 'Administrative actions in your school.'}
        </p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by description or actor email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="USER_CREATE">User created</SelectItem>
              <SelectItem value="USER_UPDATE">User updated</SelectItem>
              <SelectItem value="USER_DELETE">User deleted</SelectItem>
              <SelectItem value="SCHOOL_CREATE">School created</SelectItem>
              <SelectItem value="SCHOOL_UPDATE">School updated</SelectItem>
              <SelectItem value="SCHOOL_DELETE">School deleted</SelectItem>
              <SelectItem value="PROMOTE_LEARNERS">Learners promoted</SelectItem>
              <SelectItem value="BULK_IMPORT_USERS">Bulk import</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : logs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ScrollText className="h-10 w-10 mx-auto mb-2 opacity-40" />
          No audit logs match your filters.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto scroll-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    {user?.role === 'SUPER_USER' && <TableHead>School</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence initial={false}>
                    {logs.map((log) => (
                      <motion.tr
                        key={log.id}
                        layout
                        initial={{ opacity: 0, x: -10, backgroundColor: 'rgba(37, 99, 235, 0.08)' }}
                        animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                        transition={{ duration: 0.5 }}
                      >
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <div>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</div>
                          <div className="text-[10px] opacity-70">{format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {log.actor ? (
                              <UserAvatar name={log.actor.name} color={log.actor.avatar_color} size="sm" />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-muted" />
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{log.actor?.name || log.actor_email}</div>
                              <div className="text-xs text-muted-foreground">{log.actor_role}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={ACTION_COLORS[log.action] || 'bg-muted text-muted-foreground'}>
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.description}</TableCell>
                        {user?.role === 'SUPER_USER' && (
                          <TableCell className="text-xs text-muted-foreground">
                            {log.school?.name || (log.school_id ? '—' : 'Platform')}
                          </TableCell>
                        )}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
