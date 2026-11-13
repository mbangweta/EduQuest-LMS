'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Check } from 'lucide-react'
import { api } from '@/lib/api-client'

/**
 * InlineScoreInput — a single editable score cell for the mark schedule grid.
 *
 * - Renders as a number input that the teacher can click and type into.
 * - Saves on blur (or Enter). Esc cancels the edit.
 * - Validates: must be a number 0 ≤ score ≤ maxScore.
 * - On successful save, calls onSaved(newScore) so the parent can update its
 *   local copy of the matrix and recompute totals.
 * - Uses PUT /api/assessments/[assessmentId]/scores with a single-element
 *   scores array, so it works with the existing bulk-upsert endpoint.
 */
export function InlineScoreInput({
  learnerId,
  learnerName,
  assessmentId,
  maxScore,
  initialScore,
  subjectCode,
  onSaved,
}: {
  learnerId: string
  learnerName: string
  assessmentId: string
  maxScore: number
  initialScore: number | null
  subjectCode: string
  onSaved?: (newScore: number | null) => void
}) {
  const [value, setValue] = useState<string>(initialScore === null ? '' : String(initialScore))
  const [original, setOriginal] = useState<string>(initialScore === null ? '' : String(initialScore))
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // If the parent re-fetches and the score changes from outside, sync.
  useEffect(() => {
    const newVal = initialScore === null ? '' : String(initialScore)
    if (newVal !== original && document.activeElement !== inputRef.current) {
      setValue(newVal)
      setOriginal(newVal)
    }
  }, [initialScore])  // eslint-disable-line react-hooks/exhaustive-deps

  function validate(v: string): { ok: boolean; num: number | null } {
    if (v.trim() === '') return { ok: true, num: null }
    const n = Number(v)
    if (Number.isNaN(n)) return { ok: false, num: null }
    if (n < 0 || n > maxScore) return { ok: false, num: null }
    return { ok: true, num: n }
  }

  async function save() {
    const v = value.trim()
    if (v === original) return  // no change
    const { ok, num } = validate(v)
    setInvalid(!ok)
    if (!ok) {
      toast.error(`Score must be between 0 and ${maxScore}`)
      return
    }
    setSaving(true)
    try {
      await api.put(`/api/assessments/${assessmentId}/scores`, {
        scores: [{ learnerId, score: num }],
      })
      setOriginal(v)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1200)
      onSaved?.(num)
    } catch (e: any) {
      toast.error(`Failed to save ${subjectCode} score for ${learnerName}: ${e?.message || 'unknown error'}`)
      // Revert
      setValue(original)
    } finally {
      setSaving(false)
    }
  }

  function onBlur() {
    save()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      ;(e.target as HTMLInputElement).blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setValue(original)
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <input
        ref={inputRef}
        type="number"
        min={0}
        max={maxScore}
        step="0.5"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          // Clear invalid state once the user starts editing again
          if (invalid) setInvalid(false)
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder="—"
        disabled={saving}
        className={`h-7 w-14 text-center text-sm rounded border px-1 outline-none transition-colors
          ${invalid
            ? 'border-destructive bg-destructive/10'
            : value !== original
              ? 'border-amber-400 bg-amber-50'
              : 'border-transparent hover:border-border focus:border-primary bg-transparent'
          }`}
        title={invalid ? `Must be 0–${maxScore}` : `${learnerName} · ${subjectCode}`}
      />
      {saving && (
        <Loader2 className="absolute -right-5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
      )}
      {justSaved && !saving && (
        <Check className="absolute -right-5 top-1/2 -translate-y-1/2 h-3 w-3 text-emerald-600" />
      )}
    </div>
  )
}
