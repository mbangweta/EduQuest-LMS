'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Trophy, Medal, Award, Star, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api-client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

const RANK_STYLES = [
  { icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200', label: '1st' },
  { icon: Medal, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200', label: '2nd' },
  { icon: Award, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: '3rd' },
]

export function GamificationView() {
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    api.get<{ classes: any[] }>('/api/classes')
      .then((r) => {
        setClasses(r.classes)
        if (r.classes[0]) setClassId(r.classes[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!classId) { setData(null); return }
    setFetching(true)
    api.get(`/api/gamification?classId=${classId}`)
      .then(setData)
      .catch((e: any) => { toast.error(e?.message || 'Failed to load'); setData(null) })
      .finally(() => setFetching(false))
  }, [classId])

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  const selectedClass = classes.find((c) => c.id === classId)
  const leaderboard = data?.leaderboard ?? []
  const badgeDefs = data?.badges ?? []
  const maxPoints = leaderboard.length > 0 ? Math.max(...leaderboard.map((l: any) => l.points)) : 1

  function getBadgeDef(code: string) {
    return badgeDefs.find((b: any) => b.code === code)
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-500" /> Leaderboard & Badges
        </h1>
        <p className="text-sm text-muted-foreground">
          Class leaderboard with points and achievement badges.
        </p>
      </div>

      <Card>
        <CardContent className="p-3 flex items-center gap-2">
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Class: </span>
            <span className="font-medium">{selectedClass?.name ?? '—'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Available badges */}
      {badgeDefs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Available Badges</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {badgeDefs.map((b: any) => (
                <div key={b.code} className="flex items-center gap-2 rounded-md border p-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: `${b.color}20` }}
                  >
                    {b.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{b.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{b.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      {!classId ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Select a class.</CardContent></Card>
      ) : fetching ? (
        <Skeleton className="h-96" />
      ) : leaderboard.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No learners in this class.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Class Leaderboard</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {leaderboard.map((l: any, idx: number) => {
                const rankStyle = l.rank <= 3 ? RANK_STYLES[l.rank - 1] : null
                const RankIcon = rankStyle?.icon
                return (
                  <div
                    key={l.learnerId}
                    className={`flex items-center gap-3 p-3 ${rankStyle ? rankStyle.bg : ''} ${idx === 0 ? 'border-l-4 border-l-amber-400' : ''}`}
                  >
                    {/* Rank */}
                    <div className="w-12 text-center">
                      {RankIcon ? (
                        <div className={`flex flex-col items-center ${rankStyle.color}`}>
                          <RankIcon className="h-5 w-5" />
                          <span className="text-xs font-semibold">{rankStyle.label}</span>
                        </div>
                      ) : (
                        <div className="text-lg font-bold text-muted-foreground">#{l.rank}</div>
                      )}
                    </div>

                    {/* Name + avatar */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{l.name}</div>
                      {/* Badges */}
                      {l.badges.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {l.badges.map((code: string) => {
                            const def = getBadgeDef(code)
                            if (!def) return null
                            return (
                              <span
                                key={code}
                                title={def.description}
                                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs"
                                style={{ backgroundColor: `${def.color}20`, color: def.color }}
                              >
                                {def.icon} {def.label}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground">
                      {l.total !== null && <span>Total: {l.total}</span>}
                      {l.attendanceRate !== null && <span>Attendance: {l.attendanceRate}%</span>}
                    </div>

                    {/* Points bar */}
                    <div className="w-24 sm:w-32">
                      <div className="text-right text-sm font-bold mb-1">{l.points} pts</div>
                      <Progress value={(l.points / maxPoints) * 100} className="h-2" />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
