'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Printer } from 'lucide-react'
import { useCurrentUser } from '@/hooks/use-current-user'
import { api } from '@/lib/api-client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ReportCardDocument } from '@/components/views/shared/report-card-document'

export function LearnerReportCardView() {
  const { user } = useCurrentUser()
  const [term, setTerm] = useState('ALL')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    setFetching(true)
    const params = new URLSearchParams()
    if (term !== 'ALL') params.set('term', term)
    api.get(`/api/report-cards/${user.id}${params.size ? `?${params.toString()}` : ''}`)
      .then(setReport)
      .catch((e: any) => { toast.error(e?.message || 'Failed to load'); setReport(null) })
      .finally(() => { setFetching(false); setLoading(false) })
  }, [user?.id, term])

  if (loading || !user) {
    return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Report Card</h1>
          <p className="text-sm text-muted-foreground">
            Your official school report card{term !== 'ALL' ? ` · Term ${term}` : ' · All terms'}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All terms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All terms</SelectItem>
              <SelectItem value="1">Term 1</SelectItem>
              <SelectItem value="2">Term 2</SelectItem>
              <SelectItem value="3">Term 3</SelectItem>
            </SelectContent>
          </Select>
          {report && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          )}
        </div>
      </div>

      {fetching ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="print:p-0">
          <ReportCardDocument report={report} />
        </div>
      )}
    </div>
  )
}
