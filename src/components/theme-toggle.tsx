'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * ThemeToggle — switches between light and dark mode.
 * Persists the choice in localStorage and applies/removes the `.dark`
 * class on <html> (Tailwind v4 dark mode via @custom-variant).
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // On mount, read the saved preference or fall back to system preference
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    const prefersDark = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
    const dark = saved ? saved === 'dark' : prefersDark
    setIsDark(dark)
    applyTheme(dark)
  }, [])

  function applyTheme(dark: boolean) {
    const root = document.documentElement
    if (dark) root.classList.add('dark')
    else root.classList.remove('dark')
  }

  function toggle() {
    const next = !isDark
    setIsDark(next)
    applyTheme(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="h-9 w-9 hover:bg-accent/40"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
