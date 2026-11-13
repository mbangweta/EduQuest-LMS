'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Star, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useRealtimeQuery } from '@/hooks/use-realtime-query'
import { useCurrentUser } from '@/hooks/use-current-user'
import { format } from 'date-fns'

interface AcademicYear {
  id: string
  school_id: string
  name: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  status: string
  created_at: string
}

interface School { id: string; name: string; code: string }

export function AcademicYearsView({ schools = [] }: { schools?: School[] }) {
  const { user } = useCurrentUser()
  const isSuperUser = user?.role === 'SUPER_USER'
  const schoolName = isSuperUser ? 'All schools' : (user?.schoolName || 'your school')

  // Super user without a schoolId filter gets all; school-scoped users get their own.
  const { data, isLoading } = useRealtimeQuery<{ academicYears: AcademicYear[] }>({
    queryKey: ['academic-years', user?.schoolId],
    queryFn: () => api.get('/api/academic-years'),
    table: 'academic_years',
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AcademicYear | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AcademicYear | null>(null)
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: true, schoolId: '', status: 'ACTIVE' })
  const [submitting, setSubmitting] = useState(false)

  const years = data?.academicYears || []

  function openAdd() {
    setEditing(null)
    setForm({ name: '', startDate: '', endDate: '', isCurrent: true, schoolId: schools[0]?.id || '', status: 'ACTIVE' })
    setDialogOpen(true)
  }
  function openEdit(y: AcademicYear) {
    setEditing(y)
    setForm({
      name: y.name,
      startDate: y.start_date ? y.start_date.slice(0, 10) : '',
      endDate: y.end_date ? y.end_date.slice(0, 10) : '',
      isCurrent: y.is_current,
      schoolId: y.school_id,
      status: y.status,
    })
    setDialogOpen(true)
  }

  async function submit() {
    if (!form.name) { toast.error('Name is required'); return }
    if (isSuperUser && !editing && !form.schoolId) { toast.error('Select a school'); return }
    setSubmitting(true)
    try {
      const body: any = {
        name: form.name,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        isCurrent: form.isCurrent,
        status: form.status,
      }
      if (isSuperUser) body.schoolId = form.schoolId
      const res = editing
        ? await fetch(`/api/academic-years/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: body.name, start_date: body.startDate, end_date: body.endDate, is_current: body.isCurrent, status: body.status }) })
        : await fetch('/api/academic-years', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      toast.success(editing ? 'Year updated' : 'Year created')
      setDialogOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function setAsCurrent(y: AcademicYear) {
    try {
      const res = await fetch(`/api/academic-years/${y.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_current: true }),
      })
      if (!res.ok) { toast.error('Failed'); return }
      toast.success(`${y.name} is now the current academic year`)
    } catch (e: any) {
      toast.error(e?.message || 'Failed')
    }
  }

  async function deleteYear() {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/academic-years/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error || 'Failed'); return
      }
      toast.success('Year deleted')
      setDeleteTarget(null)
    } catch (e: any) {
      toast.error(e?.message || 'Failed')
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Academic Years
            <span className="live-indicator">Live</span>
          </h1>
          <p className="text-sm text-muted-foreground">Scope: {schoolName}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add Year
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : years.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>No academic years yet. Click "Add Year" to create one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {years.map((y) => {
              const school = schools.find((s) => s.id === y.school_id)
              return (
                <motion.div
                  key={y.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className={y.is_current ? 'border-accent border-2' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-lg">{y.name}</div>
                          {school && <div className="text-xs text-muted-foreground">{school.name}</div>}
                        </div>
                        {y.is_current && <Badge className="bg-accent text-accent-foreground">Current</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                        {y.start_date && <div>Start: {format(new Date(y.start_date), 'MMM d, yyyy')}</div>}
                        {y.end_date && <div>End: {format(new Date(y.end_date), 'MMM d, yyyy')}</div>}
                        <Badge variant={y.status === 'ACTIVE' ? 'secondary' : 'outline'} className="mt-1">
                          {y.status}
                        </Badge>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {!y.is_current && (
                          <Button size="sm" variant="ghost" onClick={() => setAsCurrent(y)}>
                            <Star className="mr-1 h-3 w-3" /> Set current
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(y)}>
                          <Pencil className="mr-1 h-3 w-3" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(y)}>
                          <Trash2 className="mr-1 h-3 w-3" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Academic Year' : 'Add Academic Year'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update the year details.' : 'Create a new academic year for the school.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {isSuperUser && !editing && (
              <div className="space-y-1.5">
                <Label>School</Label>
                <Select value={form.schoolId} onValueChange={(v) => setForm({ ...form, schoolId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ay-name">Name</Label>
              <Input id="ay-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2026 or 2026/2027" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ay-start">Start date</Label>
                <Input id="ay-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ay-end">End date</Label>
                <Input id="ay-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="ay-current" className="cursor-pointer">Set as current year</Label>
                <p className="text-xs text-muted-foreground">Only one year per school can be current.</p>
              </div>
              <Switch id="ay-current" checked={form.isCurrent} onCheckedChange={(v) => setForm({ ...form, isCurrent: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <span className="mr-2">...</span>}
              {editing ? 'Save changes' : 'Create year'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete academic year "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the year. Classes linked to it will lose their year association. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteYear} className="bg-destructive text-destructive-foreground hover:bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
