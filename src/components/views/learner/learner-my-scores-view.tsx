'use client'

import { useEffect, useState } from 'react'
import { Award, FileText, TrendingUp } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { formatAssessmentType, gradeForScore, gradeColorClass } from '@/lib/assessment-utils'
import { format } from 'date-fns'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/views/shared/empty-state'

const SUBJECT_COLOR_FALLBACK = '#0f766e'
const MAX_SCORE = 150

export function LearnerMyScoresView() {
  const { navigate } = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [term, setTerm] = useState('ALL')

  useEffect(() => {
    const params = new URLSearchParams()
    if (term !== 'ALL') params.set('term', term)
    api.get(`/api/learner/my-scores${params.size ? `?${params.toString()}` : ''}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [term])

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  const subjects: any[] = data?.subjectSummaries ?? []
  const recordedTotal = subjects.reduce((a, s) => a + s.recordedCount, 0)
  const overallAvg = (() => {
    const validAvgs = subjects.map((s) => s.averageScore).filter((v) => v !== null) as number[]
    return validAvgs.length > 0 ? Math.round(validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length) : null
  })()

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Test Scores</h1>
          <p className="text-sm text-muted-foreground">
            Your scores across all subjects{term !== 'ALL' ? ` · Term ${term}` : ' · All terms'}.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All terms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All terms</SelectItem>
              <SelectItem value="1">Term 1</SelectItem>
              <SelectItem value="2">Term 2</SelectItem>
              <SelectItem value="3">Term 3</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">
            <TrendingUp className="mr-1 h-3 w-3" /> Overall: {overallAvg === null ? '—' : `${overallAvg} / ${MAX_SCORE}`}
          </Badge>
        </div>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No scores yet"
          description="Your teachers haven't published any scores for you yet."
        />
      ) : (
        <div className="space-y-4">
          {subjects.map((s) => {
            const accent = s.subject.color || SUBJECT_COLOR_FALLBACK
            const avgScore = s.averageScore
            const letter = s.grade || gradeForScore(avgScore)
            return (
              <Card key={s.subject.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="inline-block w-1.5 h-5 rounded-sm" style={{ backgroundColor: accent }} />
                      {s.subject.name}
                      {s.subject.code && <Badge variant="outline" className="text-[10px]">{s.subject.code}</Badge>}
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{s.recordedCount} / {s.assessments.length} recorded</span>
                      {avgScore !== null && (
                        <Badge variant="outline" className={gradeColorClass(letter)}>{letter} · {avgScore}</Badge>
                      )}
                    </div>
                  </div>
                  {avgScore !== null && (
                    <div className="mt-2 max-w-xs">
                      <Progress value={(avgScore / MAX_SCORE) * 100} className="h-1.5" />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Assessment</TableHead>
                          <TableHead className="text-center">Type</TableHead>
                          <TableHead className="text-center">Term</TableHead>
                          <TableHead className="text-center">Date</TableHead>
                          <TableHead className="text-center">Score (/150)</TableHead>
                          <TableHead className="text-center">Grade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {s.assessments.map((a: any) => {
                          const v = a.score
                          const normScore = v === null ? null : Math.round((v / a.maxScore) * MAX_SCORE)
                          const cellGrade = v === null ? '—' : gradeForScore(normScore)
                          return (
                            <TableRow key={a.id}>
                              <TableCell className="font-medium">{a.title}</TableCell>
                              <TableCell className="text-center text-xs text-muted-foreground">
                                {formatAssessmentType(a.type)}
                              </TableCell>
                              <TableCell className="text-center">Term {a.term}</TableCell>
                              <TableCell className="text-center text-xs">
                                {a.date ? format(new Date(a.date), 'dd MMM') : '—'}
                              </TableCell>
                              <TableCell className="text-center font-semibold">
                                {v === null ? <span className="text-muted-foreground">—</span> : (
                                  <span>{v}<span className="text-muted-foreground font-normal">/{a.maxScore}</span></span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {normScore === null ? <span className="text-muted-foreground">—</span> : (
                                  <Badge variant="outline" className={gradeColorClass(cellGrade)}>
                                    {normScore}
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Award className="h-6 w-6 text-primary" />
                <div>
                  <div className="text-sm font-medium">Want your full report card with class position?</div>
                  <div className="text-xs text-muted-foreground">See subject rankings, overall position in your grade, and letter grades.</div>
                </div>
              </div>
              <button
                onClick={() => navigate('learner.report-card')}
                className="text-sm font-medium text-primary hover:underline"
              >
                View my report card →
              </button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
