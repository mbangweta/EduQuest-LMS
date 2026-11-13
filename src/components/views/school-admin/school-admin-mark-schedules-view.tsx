'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ClipboardList, Printer, Award } from 'lucide-react'
import { api } from '@/lib/api-client'
import { gradeColorClass } from '@/lib/assessment-utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/views/shared/empty-state'
import { MarkSheetButtons } from '@/components/views/shared/mark-sheet-buttons'

export function SchoolAdminMarkSchedulesView() {
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [term, setTerm] = useState('ALL')
  const [data, setData] = useState<any>(null)
  const [roster, setRoster] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    api.get<{ classes: any[] }>('/api/classes')
      .then((r) => {
        setClasses(r.classes)
        if (r.classes[0]) setClassId(r.classes[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = () => setReloadKey((k) => k + 1)
    window.addEventListener('mark-sheet-uploaded', handler)
    return () => window.removeEventListener('mark-sheet-uploaded', handler)
  }, [])

  useEffect(() => {
    if (!classId) { setRoster([]); return }
    api.get<{ members: any[] }>(`/api/classes/${classId}/members`)
      .then((r) => setRoster(r.members || []))
      .catch(() => setRoster([]))
  }, [classId])

  useEffect(() => {
    if (!classId) { setData(null); return }
    setFetching(true)
    const params = new URLSearchParams({ classId })
    if (term !== 'ALL') params.set('term', term)
    api.get(`/api/mark-schedule?${params.toString()}`)
      .then(setData)
      .catch((e: any) => { toast.error(e?.message || 'Failed to load'); setData(null) })
      .finally(() => setFetching(false))
  }, [classId, term, reloadKey])

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  const subjects: any[] = data?.subjects ?? []
  const rows: any[] = data?.rows ?? []

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Mark Schedules</h1>
          <p className="text-sm text-muted-foreground">
            School-wide mark schedules. Browse any class in your school.
          </p>
        </div>
        {data && (
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} · Grade {c.grade} · {c.subject?.name ?? '—'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All terms</SelectItem>
              <SelectItem value="1">Term 1</SelectItem>
              <SelectItem value="2">Term 2</SelectItem>
              <SelectItem value="3">Term 3</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {classId && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm">
                <span className="font-medium">Zambian Mark Sheet</span>
                <span className="text-muted-foreground ml-2">— download a template with all subjects, fill in scores, and upload it back.</span>
              </div>
            </div>
            <MarkSheetButtons
              classId={classId}
              className={classes.find((c) => c.id === classId)?.name ?? 'class'}
              learners={roster.map((m: any) => ({ id: m.id, name: m.name }))}
              term={term}
            />
          </CardContent>
        </Card>
      )}

      {!classId ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Select a class" description="Choose a class above to view its mark schedule." />
      ) : fetching ? (
        <Skeleton className="h-96" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No learners" description="This class has no enrolled learners." />
      ) : subjects.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No subjects" description="No standard subjects found. Please contact an administrator." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 w-10 text-center">#</TableHead>
                    <TableHead className="sticky left-10 bg-background z-10 min-w-[180px]">Learner</TableHead>
                    {subjects.map((s) => (
                      <TableHead key={s.code} className="text-center min-w-[80px]">
                        <div className="font-medium leading-tight">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">/{s.maxScore}</div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center bg-muted/30">Total</TableHead>
                    <TableHead className="text-center bg-muted/30">Average</TableHead>
                    <TableHead className="text-center bg-muted/30">Grade</TableHead>
                    <TableHead className="text-center bg-muted/30">Rank</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r: any, idx: number) => {
                    const avgScore = r.averageScore
                    const grade = r.grade || '—'
                    const total = r.total
                    return (
                      <TableRow key={r.learner.id}>
                        <TableCell className="sticky left-0 bg-background z-10 text-center text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="sticky left-10 bg-background z-10 font-medium">{r.learner.name}</TableCell>
                        {subjects.map((s) => {
                          const v = r.scoresBySubject?.[s.code] ?? null
                          return (
                            <TableCell key={s.code} className="text-center">
                              {v === null || v === undefined ? <span className="text-muted-foreground">—</span> : (
                                <span className={v / s.maxScore >= 0.5 ? 'text-foreground' : 'text-destructive'}>{v}</span>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-center bg-muted/30 font-semibold">{total === null || total === undefined ? '—' : total}</TableCell>
                        <TableCell className="text-center bg-muted/30 font-semibold">{avgScore === null ? '—' : avgScore}</TableCell>
                        <TableCell className="text-center bg-muted/30">
                          <Badge variant="outline" className={gradeColorClass(grade)}>{grade}</Badge>
                        </TableCell>
                        <TableCell className="text-center bg-muted/30">
                          {r.rank ? (
                            <span className="inline-flex items-center gap-1 font-semibold">
                              {r.rank === 1 && <Award className="h-3.5 w-3.5 text-amber-500" />}
                              {r.rank}<span className="text-muted-foreground font-normal text-xs">/{rows.filter((x: any) => x.rank).length}</span>
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
