'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ArrowLeft, FileText, FileQuestion, Users, Clock, ClipboardCheck, CheckCircle2, GraduationCap, UserCircle } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/views/shared/empty-state'
import { UserAvatar } from '@/components/views/shared/user-avatar'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'

export function LearnerClassDetailView({ classId }: { classId?: string }) {
  const { navigate } = useRouter()
  const [cls, setCls] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<Record<string, boolean>>({})
  const [extraTeachers, setExtraTeachers] = useState<any[]>([])

  useEffect(() => {
    if (!classId) return
    api.get<{ class: any }>(`/api/classes/${classId}`)
      .then(({ class: c }) => {
        setCls(c)
        // For each lesson, fetch progress
        const lessonIds = (c.lessonAssignments ?? []).map((la: any) => la.lessonId)
        return Promise.all(lessonIds.map((id: string) =>
          api.get<{ lesson: any }>(`/api/lessons/${id}`).then((r) => {
            if (r.lesson?.myProgress) setProgress((p) => ({ ...p, [id]: !!r.lesson.myProgress.completed }))
          }).catch(() => {})
        ))
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Fetch teacher_class_assignments for this class (extra teachers)
    if (classId) {
      api.get<{ assignments: any[] }>(`/api/teacher-class-assignments?classId=${classId}`)
        .then((r) => {
          setExtraTeachers((r.assignments || []).map((a: any) => a.teacher).filter(Boolean))
        })
        .catch(() => {})
    }
  }, [classId])

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>
  if (!cls) return <EmptyState title="Class not found" />

  const lessons = (cls.lessonAssignments ?? []).map((la: any) => la.lesson)
  const quizzes = (cls.quizAssignments ?? []).map((qa: any) => qa.quiz)
  const members = cls.members || []
  // Combine the main class teacher + any extra assigned teachers
  const allTeachers = [
    ...(cls.teacher ? [cls.teacher] : []),
    ...extraTeachers.filter((t) => t.id !== cls.teacherId), // avoid duplicates
  ]

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('learner.classes')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to classes
      </Button>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold">{cls.name}</h1>
                <Badge variant="secondary">Grade {cls.grade}</Badge>
                <Badge variant="outline">{cls.subject?.name}</Badge>
              </div>
              {cls.description && <p className="text-sm text-muted-foreground">{cls.description}</p>}
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center"><div className="text-2xl font-bold text-primary">{lessons.length}</div><div className="text-xs text-muted-foreground">Lessons</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-primary">{quizzes.length}</div><div className="text-xs text-muted-foreground">Quizzes</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-primary">{members.length}</div><div className="text-xs text-muted-foreground">Members</div></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="lessons">
        <TabsList>
          <TabsTrigger value="lessons"><FileText className="mr-2 h-4 w-4" /> Lessons</TabsTrigger>
          <TabsTrigger value="quizzes"><FileQuestion className="mr-2 h-4 w-4" /> Quizzes</TabsTrigger>
          <TabsTrigger value="members"><Users className="mr-2 h-4 w-4" /> Members</TabsTrigger>
        </TabsList>

        {/* Lessons tab */}
        <TabsContent value="lessons">
          {lessons.length === 0 ? (
            <EmptyState title="No lessons assigned" description="Your teacher hasn't assigned lessons yet." />
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {lessons.map((l: any) => (
                <Card key={l.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('learner.lesson-view', { lessonId: l.id })}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-semibold truncate">{l.title}</div>
                      {progress[l.id] && <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{l.topic}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Quizzes tab */}
        <TabsContent value="quizzes">
          {quizzes.length === 0 ? (
            <EmptyState title="No quizzes assigned" description="Quizzes will appear here when assigned." />
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {quizzes.map((q: any) => (
                <Card key={q.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('learner.quiz-take', { quizId: q.id })}>
                  <CardContent className="p-4">
                    <div className="font-semibold mb-1 truncate">{q.title}</div>
                    <div className="text-xs text-muted-foreground mb-2">{q.topic} · {q.timeLimit} min · Pass {q.passingScore}%</div>
                    <Button size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); navigate('learner.quiz-take', { quizId: q.id }) }}>
                      <ClipboardCheck className="mr-2 h-4 w-4" /> Take Quiz
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Members tab — shows teachers and class members */}
        <TabsContent value="members">
          <div className="space-y-6">
            {/* Teachers section */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" /> Teachers
              </h3>
              {allTeachers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teachers assigned.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {allTeachers.map((t: any) => (
                    <Card key={t.id}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <UserAvatar name={t.name} color={t.avatar_color} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{t.name}</div>
                          <Badge variant="secondary" className="text-xs">Teacher</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Class members (learners) section */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-primary" /> Class Members
              </h3>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No other members in this class.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {members.map((m: any) => (
                    <Card key={m.id || m.learner?.id}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <UserAvatar name={m.learner?.name || 'Unknown'} color={m.learner?.avatar_color} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{m.learner?.name}</div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs">Learner</Badge>
                            {m.learner?.grade && <span className="text-xs text-muted-foreground">Grade {m.learner.grade}</span>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
