'use client'

import { format, formatDistanceToNow, differenceInCalendarDays } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, FileText, FileQuestion, ClipboardCheck, TrendingUp, Clock, Radio,
} from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRealtimeQuery } from '@/hooks/use-realtime-query'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { StatCard } from '@/components/views/shared/stat-card'
import { EmptyState } from '@/components/views/shared/empty-state'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export function LearnerDashboard() {
  const { navigate } = useRouter()
  const { user } = useCurrentUser()

  // Single realtime subscription (was 5 — reduced for performance)
  const { data, isLoading, lastUpdatedAt } = useRealtimeQuery({
    queryKey: ['learner-analytics'],
    queryFn: () => api.get('/api/analytics/learner'),
    table: 'quiz_attempts',
    event: '*',
  })

  if (isLoading) return <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>

  const counts = data?.counts ?? {}
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Welcome back!
          <span className="live-indicator">Live</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Your learning at a glance.
          <span className="ml-2 text-[10px] text-muted-foreground/70">
            Updated {lastUpdatedAt ? formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true }) : 'moments ago'}
          </span>
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Enrolled Classes" value={counts.classes ?? 0} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard label="Available Lessons" value={counts.availableLessons ?? 0} icon={<FileText className="h-5 w-5" />} accent />
        <StatCard label="Pending Quizzes" value={counts.pendingQuizzes ?? 0} icon={<FileQuestion className="h-5 w-5" />} />
        <StatCard label="Completed Quizzes" value={counts.completedQuizzes ?? 0} icon={<ClipboardCheck className="h-5 w-5" />} accent />
        <StatCard label="Average Score" value={`${counts.avgScore ?? 0}%`} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Learning Progress</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Lessons completed</span>
            <span className="font-medium">{counts.completedLessons ?? 0} / {counts.availableLessons ?? 0} ({data?.lessonsProgressPct ?? 0}%)</span>
          </div>
          <Progress value={data?.lessonsProgressPct ?? 0} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Upcoming Deadlines</span>
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Radio className="h-3 w-3 text-accent animate-pulse" /> live
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.upcoming ?? []).length === 0 ? (
              <EmptyState title="No upcoming deadlines" description="You're all caught up!" />
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {data.upcoming.map((u: any) => {
                    const days = differenceInCalendarDays(new Date(u.assignment.endDate), new Date())
                    return (
                      <motion.button
                        key={u.quiz.id}
                        layout
                        initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(34, 197, 94, 0.18)' }}
                        animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.5 }}
                        onClick={() => navigate('learner.quiz-take', { quizId: u.quiz.id })}
                        className="w-full flex items-center justify-between gap-2 rounded-md border p-3 hover:bg-accent/10 text-left"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{u.quiz.title}</div>
                          <div className="text-xs text-muted-foreground">{u.quiz.topic}</div>
                        </div>
                        <Badge variant={days <= 2 ? 'destructive' : 'secondary'} className="shrink-0">
                          <Clock className="mr-1 h-3 w-3" /> {days === 0 ? 'Today' : `${days}d left`}
                        </Badge>
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Results</CardTitle></CardHeader>
          <CardContent>
            {(data?.recentAttempts ?? []).length === 0 ? (
              <EmptyState title="No attempts yet" description="Take your first quiz to see results here." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quiz</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence initial={false}>
                      {data.recentAttempts.map((a: any) => (
                        <motion.tr
                          key={a.id}
                          layout
                          initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(34, 197, 94, 0.18)' }}
                          animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                          transition={{ duration: 0.5 }}
                        >
                          <TableCell className="text-sm max-w-40 truncate">{a.quizTitle}</TableCell>
                          <TableCell><Badge variant={a.passed ? 'default' : 'destructive'}>{a.percentage}%</Badge></TableCell>
                          <TableCell className="font-semibold">{a.grade}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.submittedAt ? formatDistanceToNow(new Date(a.submittedAt), { addSuffix: true }) : ''}</TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => navigate('learner.lessons')}><FileText className="mr-2 h-4 w-4" /> Continue Learning</Button>
        <Button variant="outline" onClick={() => navigate('learner.quizzes')}><FileQuestion className="mr-2 h-4 w-4" /> View Quizzes</Button>
        <Button variant="outline" onClick={() => navigate('learner.classes')}><BookOpen className="mr-2 h-4 w-4" /> My Classes</Button>
      </div>
    </div>
  )
}
