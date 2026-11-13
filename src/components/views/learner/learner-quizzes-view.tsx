'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { differenceInCalendarDays, format } from 'date-fns'
import { FileQuestion, Clock, ClipboardCheck, Eye, Loader2, Play } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/views/shared/empty-state'

export function LearnerQuizzesView() {
  const { navigate } = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/analytics/learner')
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>

  const pending = data?.pending ?? []
  const completed = data?.completed ?? []

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Quizzes</h1>
        <p className="text-sm text-muted-foreground">Quizzes assigned to you across your classes.</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pending.length === 0 ? (
            <EmptyState icon={<FileQuestion className="h-6 w-6" />} title="No pending quizzes" description="You're all caught up!" />
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((p: any) => {
                const deadline = p.assignment?.endDate
                const days = deadline ? differenceInCalendarDays(new Date(deadline), new Date()) : null
                return (
                  <Card key={p.quiz.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{p.quiz.title}</div>
                          <div className="text-xs text-muted-foreground">{p.quiz.topic} · Grade {p.quiz.grade}</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        {p.quiz.timeLimit} min · Pass {p.quiz.passingScore}%
                        {deadline && (
                          <Badge variant={days! <= 2 ? 'destructive' : 'secondary'} className="ml-2">
                            <Clock className="mr-1 h-3 w-3" /> {days! <= 0 ? 'Today' : `${days}d left`}
                          </Badge>
                        )}
                      </div>
                      <Button className="w-full" onClick={() => navigate('learner.quiz-take', { quizId: p.quiz.id })}>
                        <Play className="mr-2 h-4 w-4" /> Start Quiz
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completed.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title="No completed quizzes" description="Take a quiz to see your results here." />
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {completed.map((c: any) => (
                <Card key={c.quiz.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{c.quiz.title}</div>
                        <div className="text-xs text-muted-foreground">{c.quiz.topic} · {c.attempts} attempt(s)</div>
                      </div>
                      <Badge variant={c.attempt.passed ? 'default' : 'destructive'} className="shrink-0">{c.attempt.percentage}%</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      Grade {c.attempt.grade} · Submitted {c.attempt.submittedAt ? format(new Date(c.attempt.submittedAt), 'MMM d, yyyy') : ''}
                    </div>
                    <Button className="w-full" variant="outline" onClick={() => navigate('learner.quiz-results', { attemptId: c.attempt.id })}>
                      <Eye className="mr-2 h-4 w-4" /> View Results
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
