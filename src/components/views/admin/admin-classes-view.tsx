'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Users, FileText, FileQuestion, ChevronRight, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/views/shared/empty-state'
import { UserAvatar } from '@/components/views/shared/user-avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export function AdminClassesView() {
  const { params, navigate } = useRouter()
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any | null>(null)

  useEffect(() => {
    api.get<{ classes: any[] }>('/api/classes')
      .then((r) => setClasses(r.classes))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!params.classId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null)
      return
    }
    let cancelled = false
    api.get<{ class: any }>(`/api/classes/${params.classId}`)
      .then((r) => { if (!cancelled) setDetail(r.class) })
      .catch(() => { if (!cancelled) setDetail(null) })
    return () => { cancelled = true }
  }, [params.classId])

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">All Classes</h1>
        <p className="text-sm text-muted-foreground">Browse every class across the platform (read-only).</p>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : classes.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No classes yet" description="Classes will appear here once teachers create them." />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('admin.class-detail', { classId: c.id })}>
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
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c._count?.members ?? 0} learners</span>
                  <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {c._count?.lessonAssignments ?? 0} lessons</span>
                  <span className="flex items-center gap-1"><FileQuestion className="h-3 w-3" /> {c._count?.quizAssignments ?? 0} quizzes</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">{c.teacher?.name}</span>
                  <span className="font-mono text-xs">{c.classCode}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && navigate('admin.classes')}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Grade:</span> {detail.grade}</div>
                <div><span className="text-muted-foreground">Subject:</span> {detail.subject?.name}</div>
                <div><span className="text-muted-foreground">Code:</span> <span className="font-mono">{detail.classCode}</span></div>
                <div><span className="text-muted-foreground">Teacher:</span> {detail.teacher?.name}</div>
              </div>
              {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}
              <div>
                <h4 className="font-semibold text-sm mb-2">Enrolled Learners ({detail.members?.length ?? 0})</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Learner</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Enrolled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.members?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-4">No learners enrolled</TableCell>
                      </TableRow>
                    ) : detail.members?.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserAvatar name={m.learner.name} color={m.learner.avatarColor} size="sm" />
                            <span className="text-sm font-medium">{m.learner.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{m.learner.email}</TableCell>
                        <TableCell className="text-sm">{m.learner.grade ? `Grade ${m.learner.grade}` : '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.enrolledAt ? format(new Date(m.enrolledAt), 'MMM d, yyyy') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
