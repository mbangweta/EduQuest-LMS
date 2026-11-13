'use client'

import { BookOpen, Users, FileText, FileQuestion, Plus, Radio } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/views/shared/stat-card'
import { UserAvatar } from '@/components/views/shared/user-avatar'
import { EmptyState } from '@/components/views/shared/empty-state'
import { useRealtimeQuery } from '@/hooks/use-realtime-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export function TeacherDashboard() {
  const { navigate } = useRouter()
  // Single realtime subscription (was 5 — reduced for performance)
  const { data, isLoading, lastUpdatedAt } = useRealtimeQuery({
    queryKey: ['teacher-analytics'],
    queryFn: () => api.get('/api/analytics/teacher'),
    table: 'quiz_attempts',
    event: '*',
  })

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Teacher Dashboard
            <span className="live-indicator">Live</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your classes, lessons and quizzes.
            <span className="ml-2 text-[10px] text-muted-foreground/70">
              Updated {lastUpdatedAt ? formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true }) : 'moments ago'}
            </span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => navigate('teacher.classes')}>
            <Plus className="mr-2 h-4 w-4" /> Create Class
          </Button>
          <Button variant="outline" onClick={() => navigate('teacher.lesson-editor')}>
            <Plus className="mr-2 h-4 w-4" /> Create Lesson
          </Button>
          <Button onClick={() => navigate('teacher.quiz-editor')}>
            <Plus className="mr-2 h-4 w-4" /> Create Quiz
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="My Classes" value={data?.counts?.classes ?? 0} icon={<BookOpen className="h-5 w-5" />} />
            <StatCard label="Total Learners" value={data?.counts?.totalLearners ?? 0} icon={<Users className="h-5 w-5" />} accent />
            <StatCard label="Published Lessons" value={data?.counts?.lessons ?? 0} icon={<FileText className="h-5 w-5" />} />
            <StatCard label="Published Quizzes" value={data?.counts?.quizzes ?? 0} icon={<FileQuestion className="h-5 w-5" />} accent />
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Class Average Performance</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(data?.classPerformance ?? []).map((c: any) => ({ name: c.className.replace('Grade ', 'G').replace(' Purple', '').slice(0, 14), avg: c.avgScore }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.015 240)" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} domain={[0, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="avg" name="Avg %" stroke="oklch(0.50 0.18 250)" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Recent Submissions</span>
                  <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <Radio className="h-3 w-3 text-accent animate-pulse" /> live
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(data?.recentAttempts ?? []).length === 0 ? (
                  <EmptyState icon={<Users className="h-6 w-6" />} title="No submissions yet" description="Learner attempts will appear here in real-time as they submit." />
                ) : (
                  <div className="overflow-x-auto max-h-80 overflow-y-auto scroll-thin">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Learner</TableHead>
                          <TableHead>Quiz</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>When</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence initial={false}>
                          {data?.recentAttempts?.map((a: any) => (
                            <motion.div
                              key={a.id}
                              as="tr"
                              layout
                              initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(34, 197, 94, 0.18)' }}
                              animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                              transition={{ duration: 0.6 }}
                              className="hover:bg-accent/10"
                            >
                              <TableRow>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <UserAvatar name={a.learner.name} color={a.learner.avatarColor} size="sm" />
                                    <span className="text-sm">{a.learner.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm max-w-32 truncate">{a.quiz.title}</TableCell>
                                <TableCell><Badge variant={a.passed ? 'default' : 'destructive'}>{a.percentage}%</Badge></TableCell>
                                <TableCell className="text-sm font-semibold">{a.grade}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{a.submittedAt ? formatDistanceToNow(new Date(a.submittedAt), { addSuffix: true }) : ''}</TableCell>
                              </TableRow>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Pass Rate per Quiz</CardTitle></CardHeader>
            <CardContent>
              {(data?.passRatePerQuiz ?? []).filter((q: any) => q.attempts > 0).length === 0 ? (
                <EmptyState title="No quiz attempts yet" description="Once learners attempt your quizzes, pass rates will appear here." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quiz</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Avg Score</TableHead>
                        <TableHead>Pass Rate</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.passRatePerQuiz?.filter((q: any) => q.attempts > 0).map((q: any) => (
                        <TableRow key={q.quizId}>
                          <TableCell className="font-medium">{q.title}</TableCell>
                          <TableCell>{q.attempts}</TableCell>
                          <TableCell>{q.avgScore}%</TableCell>
                          <TableCell><Badge variant="secondary">{q.passRate}%</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => navigate('teacher.quiz-results', { quizId: q.quizId })}>View</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
