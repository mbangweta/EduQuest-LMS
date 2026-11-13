'use client'

import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  description?: string
  accent?: boolean
  className?: string
}

export function StatCard({ label, value, icon, description, accent, className }: StatCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4 flex items-start gap-3">
        {icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              accent ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary',
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <p className="text-2xl font-bold mt-0.5 leading-tight">{value}</p>
          {description && <p className="text-xs text-muted-foreground mt-1 truncate">{description}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
