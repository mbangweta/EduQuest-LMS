'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Calendar, Save, Loader2, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api-client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/views/shared/empty-state'
import { STANDARD_SUBJECTS } from '@/lib/assessment-utils'

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
]

const DEFAULT_PERIODS = [
  { period: 1, startTime: '07:00', endTime: '07:40' },
  { period: 2, startTime: '07:40', endTime: '08:20' },
  { period: 3, startTime: '08:20', endTime: '09:00' },
  { period: 4, startTime: '09:30', endTime: '10:10' },
  { period: 5, startTime: '10:10', endTime: '10:50' },
  { period: 6, startTime: '11:00', endTime: '11:40' },
  { period: 7, startTime: '11:40', endTime: '12:20' },
  { period: 8, startTime: '14:00', endTime: '14:40' },
]

interface Slot {
  id?: string
  dayOfWeek: number
  period: number
  startTime?: string
  endTime?: string
  subjectId?: string
  subjectName?: string
  subjectColor?: string
}

export function TimetableView() {
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [subjects, setSubjects] = useState<any[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<{ classes: any[] }>('/api/classes'),
      api.get<{ subjects: any[] }>('/api/subjects'),
    ]).then(([c, s]) => {
      setClasses(c.classes)
      setSubjects(s.subjects || [])
      if (c.classes[0]) setClassId(c.classes[0].id)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!classId) { setSlots([]); setDirty(false); return }
    setFetching(true)
    api.get<{ slots: any[] }>(`/api/timetable?classId=${classId}`)
      .then((r) => {
        const mapped = (r.slots || []).map((s: any) => ({
          id: s.id,
          dayOfWeek: s.day_of_week,
          period: s.period,
          startTime: s.start_time,
          endTime: s.end_time,
          subjectId: s.subject_id,
          subjectName: s.subject?.name,
          subjectColor: s.subject?.color,
        }))
        setSlots(mapped)
        setDirty(false)
      })
      .catch(() => { setSlots([]) })
      .finally(() => setFetching(false))
  }, [classId])

  function getSlot(day: number, period: number): Slot | undefined {
    return slots.find((s) => s.dayOfWeek === day && s.period === period)
  }

  function setSlot(day: number, period: number, subjectId: string) {
    const existing = getSlot(day, period)
    const periodDef = DEFAULT_PERIODS.find((p) => p.period === period)
    if (subjectId === 'NONE') {
      // Remove the slot
      if (existing) {
        setSlots((prev) => prev.filter((s) => !(s.dayOfWeek === day && s.period === period)))
        setDirty(true)
      }
    } else {
      if (existing) {
        setSlots((prev) => prev.map((s) =>
          s.dayOfWeek === day && s.period === period ? { ...s, subjectId } : s
        ))
      } else {
        setSlots((prev) => [...prev, {
          dayOfWeek: day,
          period,
          startTime: periodDef?.startTime,
          endTime: periodDef?.endTime,
          subjectId,
        }])
      }
      setDirty(true)
    }
  }

  async function save() {
    if (!classId) return
    setSaving(true)
    try {
      const payload = {
        classId,
        slots: slots.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          period: s.period,
          startTime: s.startTime,
          endTime: s.endTime,
          subjectId: s.subjectId,
        })),
      }
      await api.post('/api/timetable', payload)
      toast.success(`Timetable saved — ${slots.length} slots`)
      setDirty(false)
      // Refresh
      const r = await api.get<{ slots: any[] }>(`/api/timetable?classId=${classId}`)
      const mapped = (r.slots || []).map((s: any) => ({
        id: s.id, dayOfWeek: s.day_of_week, period: s.period,
        startTime: s.start_time, endTime: s.end_time,
        subjectId: s.subject_id, subjectName: s.subject?.name, subjectColor: s.subject?.color,
      }))
      setSlots(mapped)
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  function clearAll() {
    setSlots([])
    setDirty(true)
  }

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  const selectedClass = classes.find((c) => c.id === classId)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Timetable</h1>
          <p className="text-sm text-muted-foreground">
            Weekly class schedule — select a subject for each period.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearAll} disabled={!slots.length || saving}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear All
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save{dirty ? ' (unsaved)' : ''}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 flex items-center gap-2">
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Class: </span>
            <span className="font-medium">{selectedClass?.name ?? '—'}</span>
            {selectedClass?.grade && (
              <span className="text-muted-foreground ml-2">· Grade {selectedClass.grade}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {!classId ? (
        <EmptyState icon={<Calendar className="h-6 w-6" />} title="No class" description="Create a class first." />
      ) : fetching ? (
        <Skeleton className="h-96" />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b-2">
                  <th className="text-left p-2 w-28 text-sm font-semibold">Period</th>
                  {DAYS.map((d) => (
                    <th key={d.value} className="text-center p-2 text-sm font-semibold">{d.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEFAULT_PERIODS.map((p) => (
                  <tr key={p.period} className="border-b">
                    <td className="p-2 text-xs">
                      <div className="font-semibold">Period {p.period}</div>
                      <div className="text-muted-foreground">{p.startTime}–{p.endTime}</div>
                    </td>
                    {DAYS.map((d) => {
                      const slot = getSlot(d.value, p.period)
                      const subject = subjects.find((s) => s.id === slot?.subjectId)
                      return (
                        <td key={d.value} className="p-1">
                          <Select
                            value={slot?.subjectId || 'NONE'}
                            onValueChange={(v) => setSlot(d.value, p.period, v)}
                          >
                            <SelectTrigger
                              className="h-12 text-xs"
                              style={subject ? {
                                backgroundColor: `${subject.color}20`,
                                borderColor: subject.color,
                              } : undefined}
                            >
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">— Empty —</SelectItem>
                              {subjects.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {dirty && (
        <p className="text-xs text-amber-600">You have unsaved changes. Click Save to persist.</p>
      )}
    </div>
  )
}
