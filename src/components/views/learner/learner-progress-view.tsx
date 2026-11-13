'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { TrendingUp, CheckCircle2, FileText, FileQuestion, Award } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/views/shared/empty-state'
import { StatCard } from '@/components/views/shared/stat-card'

export function LearnerProgressView() {
  const { navigate } = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/analytics/learner')
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  if (!data) return <EmptyState title="No data" />

  const counts = data.counts ?? {}

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Progress</h1>
        <p className="text-sm text-muted-foreground">Your learning journey at a glance.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Average Score" value={`${counts.avgScore ?? 0}%`} icon={<TrendingUp className="h-5 w-5" />} accent />
        <StatCard label="Completed Quizzes" value={counts.completedQuizzes ?? 0} icon={<Award className="h-5 w-5" />} />
        <StatCard label="Completed Lessons" value={counts.completedLessons ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} accent />
        <StatCard label="Enrolled Classes" value={counts.classes ?? 0} icon={<FileQuestion className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lesson Completion</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Lessons completed</span>
            <span className="font-medium">{counts.completedLessons ?? 0} / {counts.availableLessons ?? 0}</span>
          </div>
          <Progress value={data.lessonsProgressPct ?? 0} className="h-2" />
          <p className="text-xs text-muted-foreground">{data.lessonsProgressPct ?? 0}% complete</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Quiz Results</CardTitle></CardHeader>
        <CardContent>
          {(data?.recentAttempts ?? []).length === 0 ? (
            <EmptyState title="No quiz attempts yet" description="Take your first quiz to see results." />
          ) : (
            <div className="space-y-2">
              {data.recentAttempts.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{a.quizTitle}</div>
                    <div className="text-xs text-muted-foreground">{a.submittedAt ? format(new Date(a.submittedAt), 'MMM d, yyyy') : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.passed ? 'default' : 'destructive'}>{a.percentage}%</Badge>
                    <span className="font-semibold">{a.grade}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Available Lessons</CardTitle></CardHeader>
        <CardContent>
          {(data?.availableLessons ?? []).length === 0 ? (
            <EmptyState icon={<FileText className="h-6 w-6" />} title="No lessons assigned yet" />
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {data.availableLessons.map((l: any) => (
                <button
                  key={l.id}
                  onClick={() => navigate('learner.lesson-view', { lessonId: l.id })}
                  className="flex items-center justify-between rounded-md border p-3 text-left hover:bg-accent/10"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{l.title}</div>
                    <div className="text-xs text-muted-foreground">{l.topic}</div>
                  </div>
                  {l.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-accent-foreground shrink-0" />
                  ) : (
                    <Badge variant="outline">To do</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
