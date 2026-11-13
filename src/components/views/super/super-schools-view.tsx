'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, School, Loader2, Users, GraduationCap, BookOpen, Mail, Phone, MapPin, Power } from 'lucide-react'
import { format } from 'date-fns'

import { api } from '@/lib/api-client'
import { useRouter } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/views/shared/empty-state'
import { ConfirmDialog } from '@/components/views/shared/confirm-dialog'
import { useRealtimeQuery } from '@/hooks/use-realtime-query'

const schoolSchema = z.object({
  name: z.string().min(1, 'Name required'),
  code: z.string().min(1, 'Code required').max(12, 'Max 12 chars'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Valid email required').or(z.literal('')).optional(),
})
type SchoolValues = z.infer<typeof schoolSchema>

export function SuperSchoolsView() {
  const { params } = useRouter()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)

  const form = useForm<SchoolValues>({
    resolver: zodResolver(schoolSchema),
    defaultValues: { name: '', code: '', address: '', phone: '', email: '' },
  })

  const { data, isLoading, refetch } = useRealtimeQuery<{ schools: any[] }>({
    queryKey: ['schools'],
    queryFn: () => api.get('/api/schools'),
    table: 'schools',
    event: '*',
  })
  // Also re-fetch when profiles change (counts update)
  useRealtimeQuery({
    queryKey: ['schools'],
    queryFn: () => api.get('/api/schools'),
    table: 'profiles',
    event: '*',
  })
  useRealtimeQuery({
    queryKey: ['schools'],
    queryFn: () => api.get('/api/schools'),
    table: 'classes',
    event: '*',
  })

  const schools = data?.schools ?? []
  const schoolIdFromParams = params.schoolId

  const filtered = useMemo(() => {
    let list = schools
    if (statusFilter !== 'ALL') list = list.filter((s) => s.status === statusFilter)
    if (query) {
      const q = query.toLowerCase()
      list = list.filter((s) => s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q))
    }
    return list
  }, [schools, statusFilter, query])

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', code: '', address: '', phone: '', email: '' })
    setDialogOpen(true)
  }
  function openEdit(s: any) {
    setEditing(s)
    form.reset({
      name: s.name,
      code: s.code,
      address: s.address ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
    })
    setDialogOpen(true)
  }

  // Open the edit dialog when arriving with ?schoolId=xxx (e.g. from the dashboard)
  useEffect(() => {
    if (schoolIdFromParams) {
      const s = schools.find((x) => x.id === schoolIdFromParams)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s) openEdit(s)
    }
  }, [schoolIdFromParams, schools.length])

  async function onSubmit(values: SchoolValues) {
    try {
      const payload = {
        name: values.name,
        code: values.code.toUpperCase(),
        address: values.address || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
      }
      if (editing) {
        await api.patch(`/api/schools/${editing.id}`, payload)
        toast.success('School updated')
      } else {
        await api.post('/api/schools', payload)
        toast.success('School created')
      }
      setDialogOpen(false)
      refetch()
    } catch (e: any) {
      toast.error(e?.message || 'Save failed')
    }
  }

  async function toggleStatus(s: any) {
    try {
      await api.patch(`/api/schools/${s.id}`, { status: s.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })
      toast.success(s.status === 'ACTIVE' ? 'School disabled' : 'School enabled')
      refetch()
    } catch (e: any) {
      toast.error(e?.message || 'Failed')
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await api.del(`/api/schools/${toDelete}`)
      toast.success('School deleted')
      setToDelete(null)
      refetch()
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed')
      setToDelete(null)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <School className="h-6 w-6 text-primary" /> Schools
          </h1>
          <p className="text-sm text-muted-foreground">Manage all schools on the EduQuest LMS platform.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add School
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="DISABLED">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<School className="h-6 w-6" />}
          title="No schools found"
          description="Try a different filter, or create a new school."
          action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add School</Button>}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.name}</div>
                    <Badge variant="outline" className="font-mono text-[10px] mt-0.5">{s.code}</Badge>
                  </div>
                  <Badge variant={s.status === 'ACTIVE' ? 'default' : 'outline'} className="shrink-0">
                    {s.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                {s.address && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{s.address}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {s.email && (
                    <div className="flex items-center gap-1 text-muted-foreground truncate">
                      <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{s.email}</span>
                    </div>
                  )}
                  {s.phone && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" /> <span>{s.phone}</span>
                    </div>
                  )}
                </div>
                {s.counts && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t pt-2">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {s.counts.users} users</span>
                    <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {s.counts.teachers} teachers</span>
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {s.counts.classes} classes</span>
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground/70">
                  Created {s.created_at ? format(new Date(s.created_at), 'MMM d, yyyy') : '—'}
                </div>
                <div className="flex items-center justify-end gap-1 border-t pt-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleStatus(s)} title={s.status === 'ACTIVE' ? 'Disable' : 'Enable'}>
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setToDelete(s.id)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit School' : 'Add School'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Editing ${editing.name}. The code must be unique.`
                : 'Create a new school. The code must be unique (e.g. EDQ, LPS, NDS).'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">School Name</Label>
              <Input id="name" placeholder="e.g. EduQuest Demo School" {...form.register('name')} />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" placeholder="e.g. EDQ" {...form.register('code')} />
              {form.formState.errors.code && <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address (optional)</Label>
              <Input id="address" placeholder="Street, city" {...form.register('address')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" {...form.register('phone')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email (optional)</Label>
                <Input id="email" type="email" {...form.register('email')} />
                {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save changes' : 'Create school'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete school?"
        description="Deleting a school fails if it still has users assigned. Reassign or delete those users first. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
