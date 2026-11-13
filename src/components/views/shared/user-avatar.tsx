'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  color?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const PALETTE = ['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#9333ea', '#0891b2', '#0d9488', '#1d4ed8', '#7c3aed']

function pickColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserAvatar({ name, color, size = 'md', className }: UserAvatarProps) {
  const bg = color || pickColor(name)
  const dims = size === 'sm' ? 'h-7 w-7 text-xs' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-sm'
  return (
    <Avatar className={cn(dims, className)}>
      <AvatarFallback style={{ backgroundColor: bg, color: 'white' }} className="font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
