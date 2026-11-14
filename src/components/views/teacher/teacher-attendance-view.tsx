'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Calendar, Save, Loader2, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react'
import { api } from '@/lib/api-client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/views/shared/empty-state'

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'UNMARKED'

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: any; color: string; badge: string }> = {
  PRESENT: { label: 'Present', icon: CheckCircle2, color: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ABSENT:  { label: 'Absent',  icon: XCircle,      color: 'text-red-600',     badge: 'bg-red-100 text-red-700 border-red-200' },
  LATE:    { label: 'Late',    icon: Clock,        color: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  EXCUSED: { label: 'Excused', icon: FileText,     color: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  UNMARKED:{ label: '—',       icon: null,         color: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground border-border' },
}

interface AttendanceRecord {
  learnerId: string
  learnerName: string
  avatarColor?: string
  status: AttendanceStatus
  notes: string
  recordId: string | null
}

export function TeacherAttendanceView() {
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    api.get<{ classes: any[] }>('/api/classes')
      .then((r) => {
        setClasses(r.classes)
        if (r.classes[0]) setClassId(r.classes[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  const fetchAttendance = useCallback(() => {
    if (!classId) { setRecords([]); return }
    setFetching(true)
    api.get<{ records: AttendanceRecord[]; summary: any }>(`/api/attendance?classId=${classId}&date=${date}`)
      .then((r) => { setRecords(r.records || []); setDirty(false) })
      .catch((e: any) => { toast.error(e?.message || 'Failed to load'); setRecords([]) })
      .finally(() => setFetching(false))
  }, [classId, date])

  useEffect(() => { fetchAttendance() }, [fetchAttendance])

  function updateRecord(learnerId: string, patch: Partial<AttendanceRecord>) {
    setRecords((prev) => prev.map((r) => r.learnerId === learnerId ? { ...r, ...patch } : r))
    setDirty(true)
  }

  function markAllPresent() {
    setRecords((prev) => prev.map((r) => ({ ...r, status: 'PRESENT' as AttendanceStatus })))
    setDirty(true)
  }

  async function save() {
    if (!classId || !date) return
    setSaving(true)
    try {
      const payload = {
        classId,
        date,
        records: records.map((r) => ({
          learnerId: r.learnerId,
          status: r.status === 'UNMARKED' ? 'PRESENT' : r.status,
          notes: r.notes || undefined,
        })),
      }
      const r = await api.post<any>('/api/attendance', payload)
      toast.success(`Attendance saved — ${r.inserted} new, ${r.updated} updated`)
      setDirty(false)
      fetchAttendance() // refresh to get the summary
    } catch (e: any) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  const selectedClass = classes.find((c) => c.id === classId)
  const todayLabel = new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Summary counts from current records state
  const summary = {
    present: records.filter((r) => r.status === 'PRESENT').length,
    absent: records.filter((r) => r.status === 'ABSENT').length,
    late: records.filter((r) => r.status === 'LATE').length,
    excused: records.filter((r) => r.status === 'EXCUSED').length,
    unmarked: records.filter((r) => r.status === 'UNMARKED').length,
    total: records.length,
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Mark daily attendance for your class. {todayLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllPresent} disabled={!records.length || saving}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark all present
          </Button>
          <Button size="sm" onClick={save} disabled={!records.length || saving || !dirty}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save{dirty ? ' (unsaved)' : ''}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Class: </span>
            <span className="font-medium">{selectedClass?.name ?? '—'}</span>
            {selectedClass?.grade && (
              <span className="text-muted-foreground ml-2">· Grade {selectedClass.grade}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary badges */}
      {records.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className={STATUS_CONFIG.PRESENT.badge}>
            <CheckCircle2 className="mr-1 h-3 w-3" /> {summary.present} Present
          </Badge>
          <Badge variant="outline" className={STATUS_CONFIG.ABSENT.badge}>
            <XCircle className="mr-1 h-3 w-3" /> {summary.absent} Absent
          </Badge>
          <Badge variant="outline" className={STATUS_CONFIG.LATE.badge}>
            <Clock className="mr-1 h-3 w-3" /> {summary.late} Late
          </Badge>
          <Badge variant="outline" className={STATUS_CONFIG.EXCUSED.badge}>
            <FileText className="mr-1 h-3 w-3" /> {summary.excused} Excused
          </Badge>
          {summary.unmarked > 0 && (
            <Badge variant="outline" className={STATUS_CONFIG.UNMARKED.badge}>
              {summary.unmarked} Unmarked
            </Badge>
          )}
          <Badge variant="outline">
            Total: {summary.total}
          </Badge>
        </div>
      )}

      {!classId ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="No class"
          description="You don't have any classes yet."
        />
      ) : fetching ? (
        <Skeleton className="h-96" />
      ) : records.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="No learners"
          description="This class has no enrolled learners."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="min-w-[180px]">Learner</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead className="min-w-[200px]">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r, idx) => (
                  <TableRow key={r.learnerId}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{r.learnerName}</TableCell>
                    <TableCell>
                      <Select
                        value={r.status}
                        onValueChange={(v) => updateRecord(r.learnerId, { status: v as AttendanceStatus })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRESENT">✅ Present</SelectItem>
                          <SelectItem value="ABSENT">❌ Absent</SelectItem>
                          <SelectItem value="LATE">⏰ Late</SelectItem>
                          <SelectItem value="EXCUSED">📝 Excused</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Optional notes (e.g. doctor's appointment)…"
                        value={r.notes}
                        onChange={(e) => updateRecord(r.learnerId, { notes: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
