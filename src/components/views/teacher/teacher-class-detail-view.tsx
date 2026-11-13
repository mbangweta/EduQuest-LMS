'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  ArrowLeft, Copy, Users, FileText, FileQuestion, Plus, Trash2, UserPlus,
  BarChart3, Loader2, MessageCircle,
} from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/views/shared/empty-state'
import { UserAvatar } from '@/components/views/shared/user-avatar'
import { ConfirmDialog } from '@/components/views/shared/confirm-dialog'
import { ClassChatView } from '@/components/views/shared/class-chat-view'
import { ClassEnrollmentButtons } from '@/components/views/shared/class-enrollment-buttons'
import { CreateAssessmentDialog } from '@/components/views/shared/create-assessment-dialog'
import { RecordScoresGrid } from '@/components/views/shared/record-scores-grid'

export function TeacherClassDetailView({ classId }: { classId?: string }) {
  const { navigate } = useRouter()
  const [cls, setCls] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [addLearnerOpen, setAddLearnerOpen] = useState(false)
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing')
  const [email, setEmail] = useState('')
  // New learner creation fields
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [createdLearnerInfo, setCreatedLearnerInfo] = useState<{ email: string; password: string; name: string } | null>(null)
  const [assignOpen, setAssignOpen] = useState<'lesson' | 'quiz' | null>(null)
  const [myLessons, setMyLessons] = useState<any[]>([])
  const [myQuizzes, setMyQuizzes] = useState<any[]>([])
  const [selectedLessons, setSelectedLessons] = useState<string[]>([])
  const [selectedQuizzes, setSelectedQuizzes] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [toRemove, setToRemove] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!classId) return
    setLoading(true)
    try {
      const { class: c } = await api.get<{ class: any }>(`/api/classes/${classId}`)
      setCls(c)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load class')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [classId])

  // Refresh class data after a bulk enrollment import
  useEffect(() => {
    const handler = () => load()
    window.addEventListener('class-members-updated', handler)
    return () => window.removeEventListener('class-members-updated', handler)
  }, [classId])

  async function openAssign(type: 'lesson' | 'quiz') {
    setAssignOpen(type)
    setSelectedLessons([])
    setSelectedQuizzes([])
    setStartDate('')
    setEndDate('')
    if (type === 'lesson') {
      const r = await api.get<{ lessons: any[] }>('/api/lessons?status=PUBLISHED')
      setMyLessons(r.lessons)
    } else {
      const r = await api.get<{ quizzes: any[] }>('/api/quizzes?status=PUBLISHED')
      setMyQuizzes(r.quizzes)
    }
  }

  async function addLearner() {
    if (!email) return
    setSaving(true)
    try {
      await api.post(`/api/classes/${classId}/members`, { email })
      toast.success('Learner added')
      setEmail('')
      setAddLearnerOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add learner')
    } finally { setSaving(false) }
  }

  async function createAndEnrollLearner() {
    if (!newFirstName.trim() || !newLastName.trim()) {
      toast.error('First name and last name are required')
      return
    }
    if (!cls?.grade) {
      toast.error('Class grade not found')
      return
    }
    setSaving(true)
    try {
      // 1. Create the learner via the users API (auto-generates email + password)
      const res = await api.post<any>('/api/users', {
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        role: 'LEARNER',
        grade: cls.grade,
        // schoolId is auto-set by the API based on the teacher's school
      })
      const learnerId = res.user?.id
      const genEmail = res.generatedEmail || res.user?.email || ''
      const genPassword = res.generatedPassword || 'eduquest123'
      setCreatedLearnerInfo({
        email: genEmail,
        password: genPassword,
        name: `${newFirstName.trim()} ${newLastName.trim()}`,
      })
      // 2. Enroll the learner in this class
      if (learnerId) {
        await api.post(`/api/classes/${classId}/members`, { userId: learnerId })
      }
      toast.success(`Learner created and enrolled — ${genEmail}`)
      setNewFirstName('')
      setNewLastName('')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create learner')
    } finally {
      setSaving(false)
    }
  }

  async function removeLearner() {
    if (!toRemove) return
    try {
      await api.del(`/api/classes/${classId}/members/${toRemove}`)
      toast.success('Learner removed')
      setToRemove(null)
      load()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
  }

  async function assignLessons() {
    setSaving(true)
    try {
      for (const lessonId of selectedLessons) {
        await api.post(`/api/lessons/${lessonId}/assign`, { classId })
      }
      toast.success(`${selectedLessons.length} lesson(s) assigned`)
      setAssignOpen(null)
      load()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
    finally { setSaving(false) }
  }
  async function assignQuizzes() {
    setSaving(true)
    try {
      for (const quizId of selectedQuizzes) {
        await api.post(`/api/quizzes/${quizId}/assign`, { classId, startDate: startDate || undefined, endDate: endDate || undefined })
      }
      toast.success(`${selectedQuizzes.length} quiz(zes) assigned`)
      setAssignOpen(null)
      load()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
    finally { setSaving(false) }
  }

  function copyCode() {
    if (cls?.classCode) {
      navigator.clipboard.writeText(cls.classCode)
      toast.success('Class code copied')
    }
  }

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>
  if (!cls) return <EmptyState title="Class not found" description="This class may have been removed." />

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('teacher.classes')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to classes
      </Button>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold">{cls.name}</h1>
                <Badge variant="secondary">Grade {cls.grade}</Badge>
                {cls.subject?.name && <Badge variant="outline">{cls.subject.name}</Badge>}
              </div>
              {cls.description && <p className="text-sm text-muted-foreground mb-3">{cls.description}</p>}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Class code:</span>
                <button onClick={copyCode} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-mono text-sm hover:bg-muted/70">
                  {cls.classCode} <Copy className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-3">
                <CreateAssessmentDialog
                  classId={classId || ''}
                  grade={cls.grade}
                  className={cls.name}
                />
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{cls._count?.members ?? 0}</div>
                <div className="text-xs text-muted-foreground">Learners</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{cls._count?.lessonAssignments ?? 0}</div>
                <div className="text-xs text-muted-foreground">Lessons</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{cls._count?.quizAssignments ?? 0}</div>
                <div className="text-xs text-muted-foreground">Quizzes</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="learners">
        <TabsList>
          <TabsTrigger value="learners"><Users className="mr-2 h-4 w-4" /> Learners</TabsTrigger>
          <TabsTrigger value="scores"><BarChart3 className="mr-2 h-4 w-4" /> Record Scores</TabsTrigger>
          <TabsTrigger value="lessons"><FileText className="mr-2 h-4 w-4" /> Lessons</TabsTrigger>
          <TabsTrigger value="quizzes"><FileQuestion className="mr-2 h-4 w-4" /> Quizzes</TabsTrigger>
          <TabsTrigger value="performance"><BarChart3 className="mr-2 h-4 w-4" /> Performance</TabsTrigger>
          <TabsTrigger value="chat"><MessageCircle className="mr-2 h-4 w-4" /> Discussion</TabsTrigger>
        </TabsList>

        {/* Learners tab */}
        <TabsContent value="learners">
          <Card>
            <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Enrolled Learners</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <ClassEnrollmentButtons
                  classId={classId || ''}
                  className={cls?.name || ''}
                  classGrade={cls?.grade || 5}
                />
                <Button size="sm" onClick={() => setAddLearnerOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" /> Add Learner
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(cls.members ?? []).length === 0 ? (
                <EmptyState title="No learners enrolled" description="Add learners by email or share the class code." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Learner</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Enrolled</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cls.members?.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserAvatar name={m.learner.name} color={m.learner.avatarColor} size="sm" />
                            <span className="font-medium text-sm">{m.learner.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{m.learner.email}</TableCell>
                        <TableCell className="text-sm">{m.learner.grade ? `Grade ${m.learner.grade}` : '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.enrolledAt ? format(new Date(m.enrolledAt), 'MMM d, yyyy') : '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setToRemove(m.learnerId)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Record Scores tab — editable grid with all 10 subjects */}
        <TabsContent value="scores">
          <RecordScoresGrid classId={classId || ''} grade={cls?.grade || 5} />
        </TabsContent>

        {/* Lessons tab */}
        <TabsContent value="lessons">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Assigned Lessons</CardTitle>
              <Button size="sm" onClick={() => openAssign('lesson')}>
                <Plus className="mr-2 h-4 w-4" /> Assign Lesson
              </Button>
            </CardHeader>
            <CardContent>
              {(cls.lessonAssignments ?? []).length === 0 ? (
                <EmptyState title="No lessons assigned" description="Assign a lesson to this class." />
              ) : (
                <div className="space-y-2">
                  {cls.lessonAssignments?.map((la: any) => (
                    <div key={la.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <div className="font-medium text-sm">{la.lesson.title}</div>
                        <div className="text-xs text-muted-foreground">{la.lesson.topic} · Grade {la.lesson.grade}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Due: {la.dueDate ? format(new Date(la.dueDate), 'MMM d, yyyy') : 'No deadline'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quizzes tab */}
        <TabsContent value="quizzes">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Assigned Quizzes</CardTitle>
              <Button size="sm" onClick={() => openAssign('quiz')}>
                <Plus className="mr-2 h-4 w-4" /> Assign Quiz
              </Button>
            </CardHeader>
            <CardContent>
              {(cls.quizAssignments ?? []).length === 0 ? (
                <EmptyState title="No quizzes assigned" description="Assign a quiz to this class." />
              ) : (
                <div className="space-y-2">
                  {cls.quizAssignments?.map((qa: any) => (
                    <div key={qa.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <div className="font-medium text-sm">{qa.quiz.title}</div>
                        <div className="text-xs text-muted-foreground">{qa.quiz.topic} · Passing {qa.quiz.passingScore}%</div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        <div>Opens: {qa.startDate ? format(new Date(qa.startDate), 'MMM d') : 'now'}</div>
                        <div>Closes: {qa.endDate ? format(new Date(qa.endDate), 'MMM d') : 'no end'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader><CardTitle className="text-base">Class Performance</CardTitle></CardHeader>
            <CardContent>
              <ClassPerformance classId={classId!} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Discussion tab */}
        <TabsContent value="chat">
          <ClassChatView classId={classId} />
        </TabsContent>
      </Tabs>

      {/* Add learner dialog */}
      <Dialog open={addLearnerOpen} onOpenChange={(v) => { setAddLearnerOpen(v); if (!v) { setCreatedLearnerInfo(null); setAddMode('existing') } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Learner to {cls?.name}</DialogTitle></DialogHeader>

          {createdLearnerInfo ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-accent/30 bg-accent/10 p-4 space-y-2">
                <p className="text-sm font-semibold text-accent">Learner created and enrolled!</p>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {createdLearnerInfo.name}</div>
                  <div><span className="text-muted-foreground">Email:</span> <code className="font-mono">{createdLearnerInfo.email}</code></div>
                  <div><span className="text-muted-foreground">Password:</span> <code className="font-mono">{createdLearnerInfo.password}</code></div>
                </div>
                <p className="text-xs text-muted-foreground">The learner can change their password after logging in.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setAddLearnerOpen(false); setCreatedLearnerInfo(null) }}>Done</Button>
                <Button onClick={() => { setCreatedLearnerInfo(null); setNewFirstName(''); setNewLastName('') }}>Add another</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Tab buttons */}
              <div className="flex gap-1 border-b">
                <button
                  onClick={() => setAddMode('existing')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    addMode === 'existing' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Add Existing
                </button>
                <button
                  onClick={() => setAddMode('new')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    addMode === 'new' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Create New
                </button>
              </div>

              {addMode === 'existing' ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Learner Email</Label>
                    <Input id="email" type="email" placeholder="learner@eduquest.zm" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                    Tip: To invite learners via class code, share the code <span className="font-mono">{cls?.classCode}</span>. They can join from their learner dashboard.
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddLearnerOpen(false)}>Cancel</Button>
                    <Button onClick={addLearner} disabled={saving || !email}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="newFirstName">First name *</Label>
                      <Input id="newFirstName" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="Thabo" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="newLastName">Last name *</Label>
                      <Input id="newLastName" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Mumba" />
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-0.5">
                    <p>Grade: <span className="font-medium text-foreground">{cls?.grade || '—'}</span> (auto-set from this class)</p>
                    <p>Email: <code className="font-mono text-foreground">
                      {newFirstName && newLastName
                        ? `${newFirstName.toLowerCase()}.${newLastName.toLowerCase().replace(/\s+/g, '')}@eduquest.zm`
                        : 'firstname.lastname@eduquest.zm'}
                    </code></p>
                    <p>Password: <code className="font-mono text-foreground">eduquest123</code></p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddLearnerOpen(false)}>Cancel</Button>
                    <Button
                      onClick={createAndEnrollLearner}
                      disabled={saving || !newFirstName.trim() || !newLastName.trim()}
                    >
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create & Enroll
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={!!assignOpen} onOpenChange={(o) => !o && setAssignOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign {assignOpen === 'lesson' ? 'Lessons' : 'Quizzes'} to {cls.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto scroll-thin">
            {assignOpen === 'lesson' && (
              myLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">You have no published lessons. Publish one first.</p>
              ) : myLessons.map((l) => (
                <label key={l.id} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/10">
                  <Checkbox
                    checked={selectedLessons.includes(l.id)}
                    onCheckedChange={(v) => setSelectedLessons(v ? [...selectedLessons, l.id] : selectedLessons.filter((x) => x !== l.id))}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{l.title}</div>
                    <div className="text-xs text-muted-foreground">{l.topic} · Grade {l.grade}</div>
                  </div>
                </label>
              ))
            )}
            {assignOpen === 'quiz' && (
              <>
                {myQuizzes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">You have no published quizzes.</p>
                ) : myQuizzes.map((q) => (
                  <label key={q.id} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/10">
                    <Checkbox
                      checked={selectedQuizzes.includes(q.id)}
                      onCheckedChange={(v) => setSelectedQuizzes(v ? [...selectedQuizzes, q.id] : selectedQuizzes.filter((x) => x !== q.id))}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{q.title}</div>
                      <div className="text-xs text-muted-foreground">{q.topic} · Grade {q.grade} · {q.timeLimit} min</div>
                    </div>
                  </label>
                ))}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <Label className="text-xs">Start Date (optional)</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">End Date (deadline)</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)}>Cancel</Button>
            <Button
              onClick={assignOpen === 'lesson' ? assignLessons : assignQuizzes}
              disabled={saving || (assignOpen === 'lesson' ? selectedLessons.length === 0 : selectedQuizzes.length === 0)}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toRemove}
        title="Remove learner?"
        description="They will lose access to this class's lessons and quizzes."
        confirmLabel="Remove"
        destructive
        onConfirm={removeLearner}
        onCancel={() => setToRemove(null)}
      />
    </div>
  )
}

function ClassPerformance({ classId }: { classId: string }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    api.get(`/api/quizzes/attempts/${classId}`).catch(() => {})
    // Use the analytics/quiz per quiz results aggregated across assignments
    api.get(`/api/classes/${classId}`)
      .then(({ class: c }: any) => setData(c))
      .catch(() => {})
  }, [classId])
  // Simpler: fetch assignments and results per quiz for this class.
  // For brevity, show placeholder.
  return (
    <div className="space-y-3 text-sm">
      {data?.quizAssignments?.length === 0 ? (
        <EmptyState title="No quiz data yet" description="Once learners attempt assigned quizzes, performance will appear here." />
      ) : (
        <PerQuizPerformance classId={classId} />
      )}
    </div>
  )
}

function PerQuizPerformance({ classId }: { classId: string }) {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    api.get(`/api/classes/${classId}`).then(async ({ class: c }: any) => {
      const quizAssignments = c.quizAssignments ?? []
      const rs: any[] = []
      for (const qa of quizAssignments) {
        try {
          const r = await api.get(`/api/quizzes/${qa.quizId}/results`)
          rs.push({ quiz: r.quiz, stats: r.stats, perLearner: r.perLearner })
        } catch {}
      }
      setRows(rs)
    })
  }, [classId])
  if (rows.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No quiz results yet.</p>
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.quiz.id} className="rounded-md border p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="font-medium text-sm">{r.quiz.title}</div>
            <Badge variant="secondary">Avg {r.stats.classAverage}%</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {r.stats.totalAttempts} attempts · Pass rate {r.stats.passRate}% · Highest {r.stats.highest}% · Lowest {r.stats.lowest}%
          </div>
          <div className="mt-2 grid gap-1">
            {r.perLearner.map((p: any) => (
              <div key={p.learner.id} className="flex items-center justify-between text-xs">
                <span>{p.learner.name}</span>
                <span>{p.highest}% ({p.latestGrade}) · {p.attempts} attempt(s)</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
