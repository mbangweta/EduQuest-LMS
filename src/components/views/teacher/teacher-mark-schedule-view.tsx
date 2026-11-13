'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ClipboardList, Loader2, Printer, Award, Sparkles } from 'lucide-react'
import { api } from '@/lib/api-client'
import { MARK_SCHEDULE_TEST_TYPES } from '@/lib/assessment-utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/views/shared/empty-state'
import { MarkSheetButtons } from '@/components/views/shared/mark-sheet-buttons'
import { InlineScoreInput } from '@/components/views/shared/inline-score-input'

interface ClassItem { id: string; name: string; grade: number; subject?: { id: string; name: string } }

export function TeacherMarkScheduleView() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classId, setClassId] = useState('')
  const [term, setTerm] = useState('1')
  const [testType, setTestType] = useState('END_OF_TERM')
  const [data, setData] = useState<any>(null)
  const [roster, setRoster] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [initializing, setInitializing] = useState(false)

  useEffect(() => {
    api.get<{ classes: ClassItem[] }>('/api/classes')
      .then((r) => {
        setClasses(r.classes)
        if (r.classes[0]) setClassId(r.classes[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  // Listen for the "mark-sheet-uploaded" event to refresh data
  useEffect(() => {
    const handler = () => setReloadKey((k) => k + 1)
    window.addEventListener('mark-sheet-uploaded', handler)
    return () => window.removeEventListener('mark-sheet-uploaded', handler)
  }, [])

  // Fetch the class roster whenever classId changes
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
    params.set('testType', testType)
    api.get(`/api/mark-schedule?${params.toString()}`)
      .then(setData)
      .catch((e: any) => { toast.error(e?.message || 'Failed to load'); setData(null) })
      .finally(() => setFetching(false))
  }, [classId, term, testType, reloadKey])

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  const subjects: any[] = data?.subjects ?? []
  const rows: any[] = data?.rows ?? []
  const selectedClass = classes.find((c) => c.id === classId)
  // If any standard subject lacks an END_OF_TERM assessment, offer to
  // initialize them so the cells become editable.
  const needsInitialization = subjects.length > 0 && subjects.some((s: any) => !s.assessmentId)
  const activeTermForInit = term !== 'ALL' ? term : '1'

  async function initializeMarkSchedule() {
    if (!classId) return
    setInitializing(true)
    try {
      const r = await api.post<any>('/api/mark-schedule/initialize', {
        classId,
        term: Number(activeTermForInit),
        testType,
      })
      toast.success(`Mark schedule ready — ${r.createdCount} new assessment${r.createdCount === 1 ? '' : 's'} created, ${r.existingCount} already existed.`)
      setReloadKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to initialize mark schedule')
    } finally {
      setInitializing(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Mark Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Class scores matrix — totals, averages, and rank for each learner.
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
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.subject?.name ?? '—'}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Term 1</SelectItem>
              <SelectItem value="2">Term 2</SelectItem>
              <SelectItem value="3">Term 3</SelectItem>
            </SelectContent>
          </Select>
          <Select value={testType} onValueChange={setTestType}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MARK_SCHEDULE_TEST_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {classId && selectedClass && (
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
              className={selectedClass.name}
              learners={roster.map((m: any) => ({ id: m.id, name: m.name }))}
              term={term}
            />
          </CardContent>
        </Card>
      )}

      {!classId ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="Select a class"
          description="Choose a class above to view its mark schedule."
        />
      ) : fetching ? (
        <Skeleton className="h-96" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No learners"
          description="This class has no enrolled learners."
        />
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No subjects"
          description="The 10 standard Zambian subjects could not be loaded. Please run the migration SQL or upload a mark sheet to auto-create them."
        />
      ) : needsInitialization ? (
        <Card>
          <CardContent className="p-6 space-y-3 text-center">
            <div className="mx-auto w-fit">
              <ClipboardList className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Start entering scores online</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                No {testType === 'END_OF_TERM' ? 'End-of-Term' : testType.replace('_', ' ')} assessments exist for {selectedClass?.name} yet (Term {activeTermForInit}).
                Click below to create the 10 standard subject assessments — you can then
                type scores directly into the grid below, or upload a mark sheet template.
              </p>
            </div>
            <Button onClick={initializeMarkSchedule} disabled={initializing}>
              {initializing
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
                : <><Sparkles className="mr-2 h-4 w-4" /> Initialize Mark Schedule</>}
            </Button>
            <p className="text-xs text-muted-foreground">
              Or use the &ldquo;Mark Sheet Template&rdquo; button above to download the Excel
              template — uploading it also creates these assessments automatically.
            </p>
          </CardContent>
        </Card>
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
                      </TableHead>
                    ))}
                    <TableHead className="text-center bg-muted/30">Total</TableHead>
                    <TableHead className="text-center bg-muted/30">Position</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r: any, idx: number) => {
                    const total = r.total
                    const position = r.position
                    return (
                      <TableRow key={r.learner.id}>
                        <TableCell className="sticky left-0 bg-background z-10 text-center text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="sticky left-10 bg-background z-10 font-medium">
                          {r.learner.name}
                        </TableCell>
                        {subjects.map((s) => {
                          const v = r.scoresBySubject?.[s.code] ?? null
                          // If the subject has an END_OF_TERM assessment, the
                          // cell is editable. Otherwise, show an em-dash.
                          if (!s.assessmentId) {
                            return (
                              <TableCell key={s.code} className="text-center">
                                <span className="text-muted-foreground">—</span>
                              </TableCell>
                            )
                          }
                          return (
                            <TableCell key={s.code} className="text-center">
                              <InlineScoreInput
                                learnerId={r.learner.id}
                                learnerName={r.learner.name}
                                assessmentId={s.assessmentId}
                                maxScore={s.maxScore}
                                initialScore={v}
                                subjectCode={s.code}
                                onSaved={(newScore) => {
                                  // Update the local row state so totals recompute
                                  setData((prev: any) => {
                                    if (!prev) return prev
                                    const newRows = (prev.rows || []).map((row: any) => {
                                      if (row.learner.id !== r.learner.id) return row
                                      const nextScores = { ...(row.scoresBySubject || {}), [s.code]: newScore }
                                      return { ...row, scoresBySubject: nextScores }
                                    })
                                    return { ...prev, rows: newRows }
                                  })
                                  // Trigger a full re-fetch after a short delay
                                  // so the server recomputes the term total /
                                  // position + class averages correctly.
                                  setTimeout(() => setReloadKey((k) => k + 1), 250)
                                }}
                              />
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-center bg-muted/30 font-semibold">
                          {total === null || total === undefined ? '—' : total}
                        </TableCell>
                        <TableCell className="text-center bg-muted/30 font-semibold">
                          {position === null || position === undefined ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              {position === 1 && <Award className="h-3.5 w-3.5 text-amber-500" />}
                              {position}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {/* === Average row (bottom) === */}
                  <TableRow className="border-t-2 border-gray-400 bg-muted/40 font-semibold">
                    <TableCell className="sticky left-0 bg-muted/40 z-10 text-center text-muted-foreground"></TableCell>
                    <TableCell className="sticky left-10 bg-muted/40 z-10 italic">
                      Average
                    </TableCell>
                    {subjects.map((s) => {
                      const avg = data?.classAverages?.bySubject?.[s.code]
                      return (
                        <TableCell key={s.code} className="text-center">
                          {avg === null || avg === undefined ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span>{avg}</span>
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center bg-muted/50">
                      {data?.classAverages?.total === null || data?.classAverages?.total === undefined
                        ? <span className="text-muted-foreground">—</span>
                        : data.classAverages.total}
                    </TableCell>
                    <TableCell className="text-center bg-muted/50 text-muted-foreground italic text-xs">
                      avg of {data?.classAverages?.learnersWithScores ?? 0} learner{(data?.classAverages?.learnersWithScores ?? 0) === 1 ? '' : 's'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedClass && (
        <p className="text-xs text-muted-foreground">
          {selectedClass.name} · {selectedClass.subject?.name ?? 'All subjects'} · {subjects.length} subjects · {rows.length} learner{rows.length === 1 ? '' : 's'}
        </p>
      )}
    </div>
  )
}
