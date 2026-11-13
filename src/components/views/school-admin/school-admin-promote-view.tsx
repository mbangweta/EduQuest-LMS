'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpCircle, GraduationCap, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/use-current-user'

interface PromoteResponse {
  dryRun: boolean
  schoolId: string
  promotedCount: number
  graduatedCount: number
  skippedCount: number
  promoted: { id: string; name: string; grade: number; newGrade: number }[]
  graduated: { id: string; name: string; grade: number }[]
  skipped: { id: string; name: string; reason: string }[]
}

export function SchoolAdminPromoteView() {
  const { user } = useCurrentUser()
  const [fromGrade, setFromGrade] = useState<string>('all')
  const [maxGrade, setMaxGrade] = useState('12')
  const [dryRun, setDryRun] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<PromoteResponse | null>(null)

  async function run(dry: boolean) {
    setSubmitting(true)
    setResult(null)
    try {
      const body: any = {
        maxGrade: Number(maxGrade),
        dryRun: dry,
      }
      if (fromGrade !== 'all') body.fromGrade = Number(fromGrade)
      if (user?.role === 'SUPER_USER') body.schoolId = user.schoolId
      const res = await fetch('/api/learners/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed')
        return
      }
      setResult(data)
      if (!dry) {
        toast.success(`Promoted ${data.promotedCount} learners`)
        setDryRun(true)  // reset to preview mode after applying
      } else {
        toast.info(`Preview: ${data.promotedCount} to promote, ${data.graduatedCount} to graduate, ${data.skippedCount} skipped`)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowUpCircle className="h-6 w-6" /> Promote Learners
        </h1>
        <p className="text-sm text-muted-foreground">
          Bulk-promote learners in {user?.schoolName || 'your school'} from Grade N to Grade N+1.
          Learners at or above the max grade graduate.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>From grade</Label>
              <Select value={fromGrade} onValueChange={setFromGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All grades</SelectItem>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Leave on "All grades" to promote everyone below the max grade.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Max grade (graduation)</Label>
              <Select value={maxGrade} onValueChange={setMaxGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Learners at or above this grade will graduate instead of being promoted.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 h-fit mt-5">
              <div>
                <Label htmlFor="dry-run" className="cursor-pointer">Dry run (preview only)</Label>
                <p className="text-xs text-muted-foreground">
                  {dryRun ? 'On — no changes will be saved' : 'Off — changes will be applied for real'}
                </p>
              </div>
              <Switch id="dry-run" checked={dryRun} onCheckedChange={setDryRun} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => run(true)} disabled={submitting}>
              {submitting && dryRun && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Preview
            </Button>
            <Button
              onClick={() => run(false)}
              disabled={submitting || (!result && dryRun)}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {submitting && !dryRun && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Promote Now
            </Button>
            {(!result || dryRun) && (
              <p className="text-xs text-muted-foreground self-center">Run a preview first to review changes</p>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <Card><CardContent className="p-4">
              <div className="text-2xl font-bold text-accent">{result.promotedCount}</div>
              <div className="text-xs text-muted-foreground">Will be promoted</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">{result.graduatedCount}</div>
              <div className="text-xs text-muted-foreground">Will graduate</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-2xl font-bold text-muted-foreground">{result.skippedCount}</div>
              <div className="text-xs text-muted-foreground">Skipped</div>
            </CardContent></Card>
          </div>

          {result.promoted.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4 text-accent" /> Will be promoted ({result.promoted.length})
              </CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto scroll-thin">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Current grade</TableHead>
                      <TableHead>New grade</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      <AnimatePresence initial={false}>
                        {result.promoted.map((p, i) => (
                          <motion.tr
                            key={p.id}
                            initial={{ opacity: 0, x: -10, backgroundColor: 'rgba(34, 197, 94, 0.15)' }}
                            animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                            transition={{ delay: i * 0.02 }}
                          >
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell><Badge variant="outline">Grade {p.grade}</Badge></TableCell>
                            <TableCell><Badge className="bg-accent text-accent-foreground">Grade {p.newGrade}</Badge></TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {result.graduated.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" /> Will graduate ({result.graduated.length})
              </CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto scroll-thin">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Current grade</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {result.graduated.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell className="font-medium">{g.name}</TableCell>
                          <TableCell><Badge variant="outline">Grade {g.grade}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {result.skipped.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" /> Skipped ({result.skipped.length})
              </CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto scroll-thin">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {result.skipped.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
