'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useRealtimeQuery } from '@/hooks/use-realtime-query'

interface Teacher { id: string; name: string; email: string; avatar_color: string }
interface Subject { id: string; name: string; code: string; color: string }
interface ClassRow { id: string; name: string; grade: number; class_code: string }
interface ClassAssignment { id: string; class_id: string; class: ClassRow }
interface SubjectAssignment {
  id: string; teacher_id: string; subject_id: string;
  subject: Subject;
}

export function SchoolAdminTeacherWorkloadView() {
  // Fetch teachers, classes, subjects
  const { data: teachersData } = useRealtimeQuery<{ users: Teacher[] }>({
    queryKey: ['teachers-for-workload'],
    queryFn: () => api.get('/api/users?role=TEACHER'),
    table: 'profiles',
  })
  const { data: subjectsData } = useRealtimeQuery<{ subjects: Subject[] }>({
    queryKey: ['subjects-for-workload'],
    queryFn: () => api.get('/api/subjects'),
    table: 'subjects',
  })
  const { data: classAssignmentsData } = useRealtimeQuery<{ assignments: ClassAssignment[] }>({
    queryKey: ['class-assignments-workload'],
    queryFn: () => api.get('/api/teacher-class-assignments'),
    table: 'teacher_class_assignments',
  })
  const { data: subjectAssignmentsData } = useRealtimeQuery<{ assignments: SubjectAssignment[] }>({
    queryKey: ['subject-assignments-workload'],
    queryFn: () => api.get('/api/teacher-subject-assignments'),
    table: 'teacher_subject_assignments',
  })

  const teachers = teachersData?.users || []
  const subjects = subjectsData?.subjects || []
  const classAssignments = classAssignmentsData?.assignments || []
  const subjectAssignments = subjectAssignmentsData?.assignments || []

  // For each teacher, get their assigned class IDs + subject IDs
  function teacherClasses(teacherId: string): ClassRow[] {
    return classAssignments.filter((a) => a.teacher_id === teacherId).map((a) => a.class).filter(Boolean)
  }
  function teacherSubjects(teacherId: string): Subject[] {
    return subjectAssignments.filter((a) => a.teacher_id === teacherId).map((a) => a.subject).filter(Boolean)
  }

  // Edit dialog
  const [editTarget, setEditTarget] = useState<Teacher | null>(null)
  const [editClasses, setEditClasses] = useState<Set<string>>(new Set())
  const [editSubjects, setEditSubjects] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [allClasses, setAllClasses] = useState<ClassRow[]>([])

  // Fetch all classes in the school for the dialog
  useEffect(() => {
    api.get<{ classes: ClassRow[] }>('/api/classes').then((r) => setAllClasses(r.classes || [])).catch(() => {})
  }, [])

  function openEdit(t: Teacher) {
    setEditTarget(t)
    setEditClasses(new Set(classAssignments.filter((a) => a.teacher_id === t.id).map((a) => a.class_id)))
    setEditSubjects(new Set(subjectAssignments.filter((a) => a.teacher_id === t.id).map((a) => a.subject_id)))
  }

  async function saveAssignments() {
    if (!editTarget) return
    setSaving(true)
    try {
      // Diff classes
      const oldClasses = new Set(classAssignments.filter((a) => a.teacher_id === editTarget.id).map((a) => a.class_id))
      const newClasses = editClasses
      const classesToAdd = [...newClasses].filter((id) => !oldClasses.has(id))
      const classesToRemove = [...oldClasses].filter((id) => !newClasses.has(id))
      for (const cid of classesToAdd) {
        await fetch('/api/teacher-class-assignments', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacherId: editTarget.id, classId: cid }),
        })
      }
      for (const cid of classesToRemove) {
        await fetch(`/api/teacher-class-assignments?teacherId=${editTarget.id}&classId=${cid}`, { method: 'DELETE' })
      }
      // Diff subjects
      const oldSubjects = new Set(subjectAssignments.filter((a) => a.teacher_id === editTarget.id).map((a) => a.subject_id))
      const newSubjects = editSubjects
      const subjectsToAdd = [...newSubjects].filter((id) => !oldSubjects.has(id))
      const subjectsToRemove = [...oldSubjects].filter((id) => !newSubjects.has(id))
      for (const sid of subjectsToAdd) {
        await fetch('/api/teacher-subject-assignments', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacherId: editTarget.id, subjectId: sid }),
        })
      }
      for (const sid of subjectsToRemove) {
        await fetch(`/api/teacher-subject-assignments?teacherId=${editTarget.id}&subjectId=${sid}`, { method: 'DELETE' })
      }
      const total = classesToAdd.length + classesToRemove.length + subjectsToAdd.length + subjectsToRemove.length
      toast.success(`Updated ${total} assignment(s)`)
      setEditTarget(null)
    } catch (e: any) {
      toast.error(e?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Briefcase className="h-6 w-6" /> Teacher Workload
          <span className="live-indicator">Live</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          View and assign classes and subjects for teachers in your school.
        </p>
      </div>

      {!teachersData ? (
        <Skeleton className="h-64" />
      ) : teachers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No teachers in your school yet.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead>Subjects</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence initial={false}>
                    {teachers.map((t) => {
                      const classes = teacherClasses(t.id)
                      const subj = teacherSubjects(t.id)
                      return (
                        <motion.tr
                          key={t.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold shrink-0"
                                style={{ backgroundColor: t.avatar_color || '#2563eb' }}
                              >
                                {t.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{t.name}</div>
                                <div className="text-xs text-muted-foreground">{t.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {classes.length === 0 ? (
                                <span className="text-xs text-muted-foreground">No classes</span>
                              ) : classes.map((c) => (
                                <Badge key={c.id} variant="secondary" className="text-xs">
                                  {c.name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {subj.length === 0 ? (
                                <span className="text-xs text-muted-foreground">No subjects</span>
                              ) : subj.map((s) => (
                                <Badge
                                  key={s.id}
                                  variant="outline"
                                  className="text-xs"
                                  style={{ borderColor: s.color || '#2563eb', color: s.color || '#2563eb' }}
                                >
                                  {s.name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                              <Pencil className="mr-1 h-3 w-3" /> Edit
                            </Button>
                          </TableCell>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign classes & subjects — {editTarget?.name}</DialogTitle>
            <DialogDescription>
              Check the classes and subjects this teacher should manage. Changes are saved when you click Save.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Classes ({allClasses.length} available)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto scroll-thin border rounded-md p-3">
                {allClasses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No classes in your school.</p>
                ) : allClasses.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={editClasses.has(c.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(editClasses)
                        if (v) next.add(c.id); else next.delete(c.id)
                        setEditClasses(next)
                      }}
                    />
                    <span className="text-sm">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Subjects ({subjects.length} available)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto scroll-thin border rounded-md p-3">
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={editSubjects.has(s.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(editSubjects)
                        if (v) next.add(s.id); else next.delete(s.id)
                        setEditSubjects(next)
                      }}
                    />
                    <span className="text-sm" style={{ color: s.color || undefined }}>{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveAssignments} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
