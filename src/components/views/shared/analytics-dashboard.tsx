'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  TrendingUp, AlertTriangle, Award, Users, BarChart3, Calendar,
  TrendingDown, Star, Target,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { gradeColorClass } from '@/lib/assessment-utils'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export function AnalyticsDashboard({ role }: { role: 'TEACHER' | 'SCHOOL_ADMIN' }) {
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    api.get<{ classes: any[] }>('/api/classes')
      .then((r) => {
        setClasses(r.classes)
        // For school admin, default to school-wide (empty classId)
        if (role === 'TEACHER' && r.classes[0]) setClassId(r.classes[0].id)
      })
      .finally(() => setLoading(false))
  }, [role])

  useEffect(() => {
    setFetching(true)
    const params = new URLSearchParams()
    if (classId) params.set('classId', classId)
    api.get(`/api/analytics/advanced?${params.toString()}`)
      .then(setData)
      .catch((e: any) => { toast.error(e?.message || 'Failed to load analytics'); setData(null) })
      .finally(() => setFetching(false))
  }, [classId])

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  const maxSubjectAvg = 150

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Analytics Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            At-risk learners, subject performance, grade distribution, and more.
          </p>
        </div>
        {role === 'SCHOOL_ADMIN' && classes.length > 0 && (
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Whole school" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Whole School</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · Grade {c.grade}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {fetching ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : !data ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No analytics data available.</CardContent></Card>
      ) : (
        <>
          {/* === KPI cards === */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<Users className="h-5 w-5" />}
              label="Total Learners"
              value={data.totalLearners}
              accent="text-blue-600"
            />
            <KpiCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Class Average"
              value={data.classAverage !== null ? `${data.classAverage}/900` : '—'}
              accent="text-emerald-600"
            />
            <KpiCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="At-Risk Learners"
              value={data.atRiskLearners?.length ?? 0}
              accent="text-red-600"
            />
            <KpiCard
              icon={<Calendar className="h-5 w-5" />}
              label="Attendance Rate"
              value={data.attendanceSummary?.rate !== null && data.attendanceSummary?.rate !== undefined ? `${data.attendanceSummary.rate}%` : '—'}
              accent="text-amber-600"
            />
          </div>

          {/* === Grade distribution === */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" /> Grade Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.gradingScale?.map((g: any) => {
                  const count = data.gradeDistribution?.[g.grade] ?? 0
                  const total = Object.values(data.gradeDistribution || {}).reduce((a: number, b: any) => a + (b as number), 0)
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={g.grade} className="flex items-center gap-3">
                      <div className="w-8">
                        <Badge variant="outline" className={gradeColorClass(g.grade)}>{g.grade}</Badge>
                      </div>
                      <div className="flex-1">
                        <Progress value={pct} className="h-5" />
                      </div>
                      <div className="w-20 text-right text-sm">
                        <span className="font-semibold">{count}</span>
                        <span className="text-muted-foreground ml-1">({pct}%)</span>
                      </div>
                      <div className="w-24 text-xs text-muted-foreground hidden sm:block">{g.remark}</div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* === Subject performance === */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Subject Performance</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.subjectPerformance?.map((s: any) => (
                    <div key={s.code}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">
                          {s.avgScore !== null ? `${s.avgScore}/150` : '—'}
                          <span className="ml-2 text-xs">({s.learnerCount} learners)</span>
                        </span>
                      </div>
                      <Progress
                        value={s.avgScore !== null ? (s.avgScore / maxSubjectAvg) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* === Top & bottom performers === */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4" /> Top & Bottom Performers</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-emerald-600 uppercase mb-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Top 5
                  </h4>
                  <div className="space-y-1">
                    {data.topPerformers?.length > 0 ? data.topPerformers.map((p: any, i: number) => (
                      <div key={p.learnerId} className="flex items-center justify-between text-sm py-1">
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground w-4">{i + 1}.</span>
                          {p.name}
                        </span>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{p.total}</Badge>
                      </div>
                    )) : <p className="text-xs text-muted-foreground">No scores recorded.</p>}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-red-600 uppercase mb-2 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" /> Bottom 5 (need support)
                  </h4>
                  <div className="space-y-1">
                    {data.bottomPerformers?.length > 0 ? data.bottomPerformers.map((p: any, i: number) => (
                      <div key={p.learnerId} className="flex items-center justify-between text-sm py-1">
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground w-4">{i + 1}.</span>
                          {p.name}
                        </span>
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{p.total}</Badge>
                      </div>
                    )) : <p className="text-xs text-muted-foreground">No scores recorded.</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* === At-risk learners === */}
          {data.atRiskLearners?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" /> At-Risk Learners ({data.atRiskLearners.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
                  {data.atRiskLearners.map((l: any) => (
                    <div key={l.learnerId} className="rounded-md border border-red-200 bg-red-50/40 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{l.name}</span>
                        <div className="flex gap-1 flex-wrap">
                          {l.reasons.map((r: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs bg-red-100 text-red-700 border-red-200">{r}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Total: {l.total ?? '—'} · Attendance: {l.attendanceRate !== null ? `${l.attendanceRate}%` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* === Attendance summary === */}
          {data.attendanceSummary && data.attendanceSummary.rate !== null && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Attendance Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-emerald-600">{data.attendanceSummary.present}</div>
                    <div className="text-xs text-muted-foreground">Present</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{data.attendanceSummary.absent}</div>
                    <div className="text-xs text-muted-foreground">Absent</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">{data.attendanceSummary.late}</div>
                    <div className="text-xs text-muted-foreground">Late</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{data.attendanceSummary.excused}</div>
                    <div className="text-xs text-muted-foreground">Excused</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Overall Attendance Rate</span>
                    <span className="font-semibold">{data.attendanceSummary.rate}%</span>
                  </div>
                  <Progress value={data.attendanceSummary.rate} className="h-3" />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: any; accent: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`${accent}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}
