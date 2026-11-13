'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Printer, GraduationCap } from 'lucide-react'
import { api } from '@/lib/api-client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ReportCardDocument } from '@/components/views/shared/report-card-document'
import { EmptyState } from '@/components/views/shared/empty-state'

export function TeacherReportCardsView() {
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [learners, setLearners] = useState<any[]>([])
  const [learnerId, setLearnerId] = useState('')
  const [term, setTerm] = useState('ALL')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    api.get<{ classes: any[] }>('/api/classes')
      .then((r) => {
        setClasses(r.classes)
        if (r.classes[0]) setClassId(r.classes[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!classId) { setLearners([]); setLearnerId('NONE'); return }
    api.get<{ members: any[] }>(`/api/classes/${classId}/members`)
      .then((r) => {
        const list = (r.members || [])
          .filter((m: any) => m.role === 'LEARNER' || m.learner)
          .map((m: any) => m.learner ?? m)
          .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
        setLearners(list)
        if (list[0]) setLearnerId(list[0].id)
        else setLearnerId('NONE')
      })
      .catch(() => { setLearners([]); setLearnerId('NONE') })
  }, [classId])

  useEffect(() => {
    if (!learnerId || learnerId === 'NONE') { setReport(null); return }
    setFetching(true)
    const params = new URLSearchParams()
    if (term !== 'ALL') params.set('term', term)
    api.get(`/api/report-cards/${learnerId}${params.size ? `?${params.toString()}` : ''}`)
      .then(setReport)
      .catch((e: any) => { toast.error(e?.message || 'Failed to load report'); setReport(null) })
      .finally(() => setFetching(false))
  }, [learnerId, term])

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Report Cards</h1>
          <p className="text-sm text-muted-foreground">
            Generate official report cards for your learners.
          </p>
        </div>
        {report && (
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
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={learnerId} onValueChange={setLearnerId}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Select learner" /></SelectTrigger>
            <SelectContent>
              {learners.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All terms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All terms</SelectItem>
              <SelectItem value="1">Term 1</SelectItem>
              <SelectItem value="2">Term 2</SelectItem>
              <SelectItem value="3">Term 3</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!learnerId || learnerId === 'NONE' ? (
        <EmptyState
          icon={<GraduationCap className="h-6 w-6" />}
          title="Select a learner"
          description="Choose a class and learner above to generate their report card."
        />
      ) : fetching ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="print:p-0">
          <ReportCardDocument report={report} />
        </div>
      )}
    </div>
  )
}
