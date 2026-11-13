'use client'

import { Users, GraduationCap, BookOpen, Library, FileText, FileQuestion, School, Radio, Plus, UserPlus, FolderOpen, ClipboardCheck } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/views/shared/stat-card'
import { UserAvatar } from '@/components/views/shared/user-avatar'
import { useRealtimeQuery } from '@/hooks/use-realtime-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const ROLE_COLORS = ['#9333ea', '#ca8a04', '#2563eb', '#16a34a', '#dc2626']

export function SuperDashboardView() {
  const { navigate } = useRouter()

  // Realtime: refetches the admin analytics snapshot whenever any of these
  // tables change. Without realtime, this would only refresh on page load.
  const { data, isLoading, lastUpdatedAt } = useRealtimeQuery({
    queryKey: ['super-analytics'],
    queryFn: () => api.get('/api/analytics/admin'),
    table: 'profiles',
    event: '*',
  })

  // Additional triggers: any of these tables changing means the snapshot is stale
  useRealtimeQuery({ queryKey: ['super-analytics'], queryFn: () => api.get('/api/analytics/admin'), table: 'schools', event: '*' })
  useRealtimeQuery({ queryKey: ['super-analytics'], queryFn: () => api.get('/api/analytics/admin'), table: 'classes', event: '*' })
  useRealtimeQuery({ queryKey: ['super-analytics'], queryFn: () => api.get('/api/analytics/admin'), table: 'lessons', event: '*' })
  useRealtimeQuery({ queryKey: ['super-analytics'], queryFn: () => api.get('/api/analytics/admin'), table: 'quizzes', event: '*' })
  useRealtimeQuery({ queryKey: ['super-analytics'], queryFn: () => api.get('/api/analytics/admin'), table: 'quiz_attempts', event: '*' })
  useRealtimeQuery({ queryKey: ['super-analytics'], queryFn: () => api.get('/api/analytics/admin'), table: 'library_resources', event: '*' })
  useRealtimeQuery({ queryKey: ['super-analytics'], queryFn: () => api.get('/api/analytics/admin'), table: 'notifications', event: '*' })

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Super User Dashboard
            <span className="live-indicator">Live</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide overview across all EduQuest LMS schools.
            <span className="ml-2 text-[10px] text-muted-foreground/70">
              Updated {lastUpdatedAt ? formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true }) : 'moments ago'}
            </span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => navigate('super.schools')}>
            <Plus className="mr-2 h-4 w-4" /> Add School
          </Button>
          <Button variant="outline" onClick={() => navigate('super.users')}>
            <UserPlus className="mr-2 h-4 w-4" /> Manage Users
          </Button>
          <Button onClick={() => navigate('super.library')}>
            <Library className="mr-2 h-4 w-4" /> Open Library
          </Button>
        </div>
      </div>

      {isLoading ? (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </>
      ) : (
        <>
          {/* Row 1: Schools / Users / Teachers / Learners */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Schools" value={data?.counts?.schools ?? 0} icon={<School className="h-5 w-5" />} accent />
            <StatCard label="Total Users" value={data?.counts?.totalUsers ?? 0} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Total Teachers" value={data?.counts?.teachers ?? 0} icon={<GraduationCap className="h-5 w-5" />} />
            <StatCard label="Total Learners" value={data?.counts?.learners ?? 0} icon={<Users className="h-5 w-5" />} accent />
          </div>

          {/* Row 2: Classes / Lessons / Quizzes / Library */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Classes" value={data?.counts?.classes ?? 0} icon={<BookOpen className="h-5 w-5" />} />
            <StatCard label="Lessons Published" value={data?.counts?.lessonsPublished ?? 0} icon={<FileText className="h-5 w-5" />} accent />
            <StatCard label="Quizzes Published" value={data?.counts?.quizzesPublished ?? 0} icon={<FileQuestion className="h-5 w-5" />} />
            <StatCard label="Library Resources" value={data?.counts?.libraryResources ?? 0} icon={<Library className="h-5 w-5" />} accent />
          </div>

          {/* Schools Overview table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><School className="h-4 w-4 text-primary" /> Schools Overview</span>
                <Button variant="ghost" size="sm" onClick={() => navigate('super.schools')}>
                  View all
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(data?.schoolsOverview ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No schools yet.</p>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto scroll-thin">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>School</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Users</TableHead>
                        <TableHead className="text-right">Teachers</TableHead>
                        <TableHead className="text-right">Learners</TableHead>
                        <TableHead className="text-right">Classes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.schoolsOverview ?? []).map((s: any) => (
                        <TableRow
                          key={s.id}
                          className="cursor-pointer hover:bg-accent/10"
                          onClick={() => navigate('super.schools', { schoolId: s.id })}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{s.name}</div>
                                <Badge variant="outline" className="font-mono text-[10px] mt-0.5">{s.code}</Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.status === 'ACTIVE' ? 'default' : 'outline'}>
                              {s.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">{s.users}</TableCell>
                          <TableCell className="text-right text-sm">{s.teachers}</TableCell>
                          <TableCell className="text-right text-sm">{s.learners}</TableCell>
                          <TableCell className="text-right text-sm">{s.classes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="h-4 w-4 text-primary" /> Learners per Grade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.gradeBuckets ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.015 240)" />
                      <XAxis dataKey="grade" tickFormatter={(v) => `G${v}`} fontSize={12} />
                      <YAxis fontSize={12} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Learners" fill="oklch(0.50 0.18 250)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">User Role Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.roleDistribution ?? []}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={(e: any) => `${e.name}: ${e.value}`}
                      >
                        {(data?.roleDistribution ?? []).map((_: any, i: number) => (
                          <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Recent Activity</span>
                <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Radio className="h-3 w-3 text-accent animate-pulse" /> streaming
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-80 overflow-y-auto scroll-thin">
                {(data?.recentNotifications ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
                ) : (
                  <AnimatePresence initial={false}>
                    {(data?.recentNotifications ?? []).map((n: any) => (
                      <motion.div
                        key={n.id}
                        layout
                        initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(34, 197, 94, 0.15)' }}
                        animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                        transition={{ duration: 0.6 }}
                        className="flex items-start gap-3 py-2 border-b last:border-0"
                      >
                        <UserAvatar name={n.user?.name || 'User'} color={n.user?.avatar_color ?? n.user?.avatarColor} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{n.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                            {n.user?.name} · {n.createdAt ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) : ''}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
