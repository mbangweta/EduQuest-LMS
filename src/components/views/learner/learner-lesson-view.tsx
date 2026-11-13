'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, FileText, Link as LinkIcon, Loader2, ArrowUpRight } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Markdown } from '@/components/views/shared/markdown'
import { EmptyState } from '@/components/views/shared/empty-state'

export function LearnerLessonView({ lessonId }: { lessonId?: string }) {
  const { navigate } = useRouter()
  const [lesson, setLesson] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  async function load() {
    if (!lessonId) return
    try {
      const { lesson } = await api.get<{ lesson: any }>(`/api/lessons/${lessonId}`)
      setLesson(lesson)
    } catch (e: any) { toast.error(e?.message || 'Failed to load lesson') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [lessonId])

  async function markComplete() {
    setMarking(true)
    try {
      await api.post(`/api/lessons/${lessonId}/mark-complete`, {})
      toast.success('Lesson marked complete')
      load()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
    finally { setMarking(false) }
  }

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>
  if (!lesson) return <EmptyState title="Lesson not found" />

  const attachments = lesson.attachments ? safeParseArr(lesson.attachments) : []
  const videos = lesson.videoLinks ? safeParseArr(lesson.videoLinks) : []

  return (
    <div className="p-4 lg:p-6 max-w-4xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('learner.lessons')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to lessons
      </Button>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="secondary">Grade {lesson.grade}</Badge>
            <Badge variant="outline">{lesson.subject?.name}</Badge>
            <Badge variant="outline">{lesson.topic}</Badge>
            {lesson.myProgress?.completed && (
              <Badge variant="default" className="bg-accent text-accent-foreground"><CheckCircle2 className="mr-1 h-3 w-3" /> Completed</Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">{lesson.title}</h1>
        </CardContent>
      </Card>

      {lesson.objectives && (
        <Card><CardContent className="p-5"><h3 className="font-semibold mb-2">Learning Objectives</h3><Markdown content={lesson.objectives} /></CardContent></Card>
      )}
      {lesson.notes && (
        <Card><CardContent className="p-5"><h3 className="font-semibold mb-2">Notes</h3><Markdown content={lesson.notes} /></CardContent></Card>
      )}
      {lesson.activities && (
        <Card><CardContent className="p-5"><h3 className="font-semibold mb-2">Activities</h3><Markdown content={lesson.activities} /></CardContent></Card>
      )}
      {lesson.examples && (
        <Card><CardContent className="p-5"><h3 className="font-semibold mb-2">Examples</h3><Markdown content={lesson.examples} /></CardContent></Card>
      )}
      {lesson.practiceQuestions && (
        <Card><CardContent className="p-5"><h3 className="font-semibold mb-2">Practice Questions</h3><Markdown content={lesson.practiceQuestions} /></CardContent></Card>
      )}
      {lesson.homework && (
        <Card><CardContent className="p-5"><h3 className="font-semibold mb-2">Homework</h3><Markdown content={lesson.homework} /></CardContent></Card>
      )}
      {lesson.summary && (
        <Card><CardContent className="p-5"><h3 className="font-semibold mb-2">Summary</h3><Markdown content={lesson.summary} /></CardContent></Card>
      )}

      {(attachments.length > 0 || videos.length > 0) && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-3">Resources</h3>
            {attachments.length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="text-xs text-muted-foreground font-medium">Attachments</div>
                {attachments.map((a: any, i: number) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent/10">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </a>
                ))}
              </div>
            )}
            {videos.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground font-medium">Videos</div>
                {videos.map((v: string, i: number) => {
                  const ytId = youtubeId(v)
                  return (
                    <div key={i} className="rounded-md border p-2">
                      <a href={v} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:text-primary mb-2">
                        <LinkIcon className="h-4 w-4" /> <span className="truncate">{v}</span>
                      </a>
                      {ytId && (
                        <div className="aspect-video w-full">
                          <iframe
                            className="w-full h-full rounded"
                            src={`https://www.youtube.com/embed/${ytId}`}
                            title={`Video ${i + 1}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-4 z-10">
        <Button
          className="w-full shadow-lg"
          size="lg"
          onClick={markComplete}
          disabled={marking || lesson.myProgress?.completed}
        >
          {marking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {lesson.myProgress?.completed ? 'Completed' : 'Mark as Completed'}
        </Button>
      </div>
    </div>
  )
}

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)
  return m ? m[1] : null
}

function safeParseArr<T>(v: any): T[] {
  try { return JSON.parse(v) as T[] } catch { return [] }
}
