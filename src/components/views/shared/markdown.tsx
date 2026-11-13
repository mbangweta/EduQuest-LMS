'use client'

import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  if (!content) return null
  return (
    <div className={cn('prose-edu text-sm', className)}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
