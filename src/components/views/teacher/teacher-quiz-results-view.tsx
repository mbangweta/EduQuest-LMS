'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ArrowLeft, Download, Loader2, ChevronDown, ChevronRight, CheckCircle2, XCircle, Save } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { QUESTION_TYPE_LABELS, formatAnswer, type QuestionType } from '@/lib/quiz-utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/views/shared/empty-state'
import { UserAvatar } from '@/components/views/shared/user-avatar'

export function TeacherQuizResultsView({ quizId }: { quizId?: string }) {
  const { navigate } = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any | null>(null)
  const [overrideMarks, setOverrideMarks] = useState<Record<string, string>>({})

  async function load() {
    if (!quizId) return
    setLoading(true)
    try {
      const r = await api.get(`/api/quizzes/${quizId}/results`)
      setData(r)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load results')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [quizId])

  function exportCsv() {
    window.open(`/api/analytics/quiz/${quizId}/export`, '_blank')
  }

  async function saveOverride(attemptId: string, answerId: string) {
    try {
      const marks = Number(overrideMarks[answerId])
      if (Number.isNaN(marks)) { toast.error('Enter a number'); return }
      await api.patch(`/api/quiz-attempts/${attemptId}/answers/${answerId}`, { marksAwarded: marks })
      toast.success('Marks updated')
      load()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
  }

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>
  if (!data) return <EmptyState title="No results" description="Quiz not found." />

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('teacher.quizzes')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{data.quiz.title}</h1>
        <p className="text-sm text-muted-foreground">Grade {data.quiz.grade} · {data.quiz.topic} · {data.stats.totalAttempts} attempts</p>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Class Average</div><div className="text-2xl font-bold text-primary">{data.stats.classAverage}%</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Highest</div><div className="text-2xl font-bold text-accent-foreground">{data.stats.highest}%</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Lowest</div><div className="text-2xl font-bold">{data.stats.lowest}%</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pass Rate</div><div className="text-2xl font-bold text-primary">{data.stats.passRate}%</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Unique Learners</div><div className="text-2xl font-bold">{data.stats.uniqueLearners}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Score Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stats.distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.015 240)" />
                <XAxis dataKey="range" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Learners" fill="oklch(0.50 0.18 250)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Per-Learner Results</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.perLearner.length === 0 ? (
            <EmptyState title="No attempts yet" description="Once learners submit, you'll see results here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Learner</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Latest %</TableHead>
                    <TableHead>Best %</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Last submitted</TableHead>
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.perLearner.map((p: any) => (
                    <TableRow key={p.learner.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar name={p.learner.name} color={p.learner.avatarColor} size="sm" />
                          <span className="font-medium text-sm">{p.learner.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{p.attempts}</TableCell>
                      <TableCell>{p.latestScore}%</TableCell>
                      <TableCell className="font-semibold">{p.highest}%</TableCell>
                      <TableCell>
                        <Badge variant={p.latestPassed ? 'default' : 'destructive'}>{p.latestGrade}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.latestSubmittedAt ? format(new Date(p.latestSubmittedAt), 'MMM d, yyyy HH:mm') : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => {
                          setDetail(data.attempts.find((a: any) => a.id === p.latestAttemptId))
                          setOverrideMarks({})
                        }}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail?.learner?.name}'s attempt — {detail?.percentage}% ({detail?.grade})
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              {detail.answers.map((a: any, i: number) => (
                <div key={a.answerId} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-sm font-medium">Q{i + 1} · <span className="text-xs text-muted-foreground">{QUESTION_TYPE_LABELS[a.type as QuestionType]}</span></div>
                    <div className="flex items-center gap-2">
                      {a.isCorrect === true ? (
                        <Badge variant="default" className="bg-accent text-accent-foreground"><CheckCircle2 className="mr-1 h-3 w-3" /> Correct</Badge>
                      ) : a.isCorrect === false ? (
                        <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Incorrect</Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">{a.marksAwarded}/{a.maxMarks} marks</span>
                    </div>
                  </div>
                  <div className="text-sm mb-1">{a.questionText}</div>
                  <div className="text-xs text-muted-foreground mb-1">Learner's answer: <span className="text-foreground font-medium">{formatAnswer(a.learnerAnswer)}</span></div>
                  {a.correctAnswer !== undefined && (
                    <div className="text-xs text-muted-foreground mb-1">Correct answer: <span className="text-accent-foreground font-medium">{formatAnswer(a.correctAnswer)}</span></div>
                  )}
                  {a.aiMarkingResult?.feedback && (
                    <div className="text-xs bg-muted/50 rounded p-2 mt-2">
                      <span className="font-medium">AI feedback:</span> {a.aiMarkingResult.feedback}
                    </div>
                  )}
                  {a.type === 'SHORT_ANSWER' && (
                    <div className="mt-2 pt-2 border-t flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Teacher override marks:</span>
                      <Input
                        type="number"
                        step="0.5"
                        className="h-7 w-20"
                        defaultValue={a.marksAwarded}
                        onChange={(e) => setOverrideMarks({ ...overrideMarks, [a.answerId]: e.target.value })}
                      />
                      <Button size="sm" variant="outline" onClick={() => saveOverride(detail.id, a.answerId)}>
                        <Save className="mr-1 h-3 w-3" /> Save override
                      </Button>
                      {a.teacherOverride && <Badge variant="secondary" className="text-xs">Overridden</Badge>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
