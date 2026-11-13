'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Printer, GraduationCap, Download, Loader2 } from 'lucide-react'
import { api } from '@/lib/api-client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ReportCardDocument } from '@/components/views/shared/report-card-document'
import { EmptyState } from '@/components/views/shared/empty-state'

export function SchoolAdminReportCardsView() {
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [learners, setLearners] = useState<any[]>([])
  const [learnerId, setLearnerId] = useState('NONE')
  const [term, setTerm] = useState('ALL')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [classReports, setClassReports] = useState<any[] | null>(null)
  const [buildingClass, setBuildingClass] = useState(false)
  const printingClassRef = useRef(false)

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

  useEffect(() => {
    if (classReports && classReports.length > 0 && !printingClassRef.current) {
      printingClassRef.current = true
      const t = setTimeout(() => {
        window.print()
        setTimeout(() => { printingClassRef.current = false }, 1000)
      }, 350)
      return () => clearTimeout(t)
    }
  }, [classReports])

  async function buildClassPdfs() {
    if (!learners.length || !classId) {
      toast.error('Select a class with learners first')
      return
    }
    setBuildingClass(true)
    setClassReports(null)
    try {
      const params = new URLSearchParams()
      if (term !== 'ALL') params.set('term', term)
      const qs = params.size ? `?${params.toString()}` : ''
      const reports: any[] = []
      for (const l of learners) {
        try {
          const r = await api.get<any>(`/api/report-cards/${l.id}${qs}`)
          if (r && r.subjects && r.subjects.length > 0) reports.push(r)
        } catch (e) {
          // skip
        }
      }
      if (reports.length === 0) {
        toast.error('No report cards could be built — no published scores found for any learner in this class.')
        return
      }
      setClassReports(reports)
      toast.success(`Prepared ${reports.length} report card${reports.length === 1 ? '' : 's'} — use "Save as PDF" in the print dialog.`)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to build class PDFs')
    } finally {
      setBuildingClass(false)
    }
  }

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  return (
    <div className="p-4 lg:p-6 space-y-4 print:hidden-when-class-pdf">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Report Cards</h1>
          <p className="text-sm text-muted-foreground">
            Generate official report cards for any learner in your school. Marks auto-sync from the Mark Schedule.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {report && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print / PDF (this learner)
            </Button>
          )}
          {learners.length > 0 && (
            <Button variant="outline" onClick={buildClassPdfs} disabled={buildingClass || fetching}>
              {buildingClass ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building…</>
              ) : (
                <><Download className="mr-2 h-4 w-4" /> Class PDFs ({learners.length})</>
              )}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · Grade {c.grade}</SelectItem>)}
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
        <div className="print:p-0 print:block">
          <ReportCardDocument report={report} />
        </div>
      )}

      {classReports && classReports.length > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '794px',
          }}
          className="class-pdf-print-container"
        >
          {classReports.map((r, i) => (
            <ReportCardDocument key={i} report={r} />
          ))}
        </div>
      )}

      <style jsx global>{`
        @media print {
          .print\\:hidden-when-class-pdf { display: none !important; }
          .class-pdf-print-container {
            position: static !important;
            left: 0 !important;
            top: 0 !important;
            width: auto !important;
          }
        }
      `}</style>
    </div>
  )
}
