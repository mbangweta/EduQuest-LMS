'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Users, FileText, FileQuestion, Loader2, BookOpen, Copy } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/views/shared/empty-state'
import { CreateSubjectDialog } from '@/components/views/shared/create-subject-dialog'

const schema = z.object({
  name: z.string().min(1, 'Class name required'),
  grade: z.string().min(1, 'Grade required'),
  subjectId: z.string().optional(),  // Optional for Grades 4-7 (they learn all subjects)
  description: z.string().optional(),
})
type ClassValues = z.infer<typeof schema>

export function TeacherClassesView() {
  const { navigate } = useRouter()
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const form = useForm<ClassValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', grade: '', subjectId: '', description: '' },
  })

  useEffect(() => {
    Promise.all([
      api.get<{ classes: any[] }>('/api/classes'),
      api.get<{ subjects: any[] }>('/api/subjects'),
    ])
      .then(([c, s]) => { setClasses(c.classes); setSubjects(s.subjects) })
      .finally(() => setLoading(false))
  }, [])

  async function onSubmit(values: ClassValues) {
    try {
      const gradeNum = Number(values.grade)
      const payload: any = {
        name: values.name,
        grade: gradeNum,
        description: values.description,
      }
      // Only send subjectId if the grade is 8+ OR a subject was explicitly chosen
      if (values.subjectId) {
        payload.subjectId = values.subjectId
      } else if (gradeNum > 7) {
        toast.error('Subject is required for Grade 8 and above')
        return
      }
      const { class: created } = await api.post<{ class: any }>('/api/classes', payload)
      toast.success(`Class "${created.name}" created · code ${created.classCode}`)
      setOpen(false)
      form.reset()
      const { classes: list } = await api.get<{ classes: any[] }>('/api/classes')
      setClasses(list)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create class')
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    toast.success('Class code copied')
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Classes</h1>
          <p className="text-sm text-muted-foreground">Create and manage your classes.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Class
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No classes yet"
          description="Create your first class to start enrolling learners."
          action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create Class</Button>}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('teacher.class-detail', { classId: c.id })}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.subject?.name}</div>
                  </div>
                  <Badge variant="secondary">Grade {c.grade}</Badge>
                </div>
                {c.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.description}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c._count?.members ?? 0}</span>
                  <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {c._count?.lessonAssignments ?? 0}</span>
                  <span className="flex items-center gap-1"><FileQuestion className="h-3 w-3" /> {c._count?.quizAssignments ?? 0}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); copyCode(c.classCode) }}
                    className="flex items-center gap-1 text-xs font-mono hover:text-primary transition-colors"
                  >
                    {c.classCode} <Copy className="h-3 w-3" />
                  </button>
                  <span className="text-xs text-muted-foreground">View →</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Class</DialogTitle>
            <DialogDescription>A class code will be generated automatically.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Class Name</Label>
              <Input id="name" placeholder="Grade 7 Purple Mathematics" {...form.register('name')} />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="grade">Grade</Label>
                <Select value={form.watch('grade')} onValueChange={(v) => form.setValue('grade', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.grade && <p className="text-xs text-destructive">{form.formState.errors.grade.message}</p>}
              </div>
              {Number(form.watch('grade') || 0) > 7 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="subject">Subject</Label>
                    <CreateSubjectDialog onCreated={(s) => setSubjects((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)))} />
                  </div>
                  <Select value={form.watch('subjectId')} onValueChange={(v) => form.setValue('subjectId', v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.subjectId && <p className="text-xs text-destructive">{form.formState.errors.subjectId.message}</p>}
                </div>
              )}
            </div>
            {Number(form.watch('grade') || 0) <= 7 && Number(form.watch('grade') || 0) > 0 && (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
                Grades 4-7 learn all subjects — no subject selection needed. Just enter the class name and grade.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description (optional)</Label>
              <Textarea id="desc" rows={2} {...form.register('description')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Class
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
