// EduQuest LMS — Assessment type labels and helpers.
// Shared between teacher / school-admin / learner views so labels stay consistent.

export const ASSESSMENT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'MIDTERM', label: 'Mid-Term' },
  { value: 'END_OF_TERM', label: 'End-of-Term' },
]

// Test types shown in the Mark Schedule dropdown. These map to the `type`
// column on the `assessments` table (which is TEXT, so any value works).
// END_OF_TERM is the default and is what report cards use as the "END TERM"
// column. TEST_1..TEST_6 are for the six in-term tests.
export const MARK_SCHEDULE_TEST_TYPES: Array<{ value: string; label: string }> = [
  { value: 'END_OF_TERM', label: 'End of Term' },
  { value: 'TEST_1', label: 'Test 1' },
  { value: 'TEST_2', label: 'Test 2' },
  { value: 'TEST_3', label: 'Test 3' },
  { value: 'TEST_4', label: 'Test 4' },
  { value: 'TEST_5', label: 'Test 5' },
  { value: 'TEST_6', label: 'Test 6' },
]

const TYPE_LABELS: Record<string, string> = {
  // Current (preferred) types
  FORTNIGHTLY: 'Fortnightly',
  MONTHLY: 'Monthly',
  MIDTERM: 'Mid-Term',
  END_OF_TERM: 'End-of-Term',
  // Legacy types — kept so existing data still renders nicely if present
  CLASS_TEST: 'Class Test',
  ASSIGNMENT: 'Assignment',
  PROJECT: 'Project',
  HOMEWORK: 'Homework',
  MID_TERM_EXAM: 'Mid-Term Exam',
  END_OF_TERM_EXAM: 'End-of-Term Exam',
  QUIZ: 'Quiz',
}

export function formatAssessmentType(type: string | undefined | null): string {
  if (!type) return '—'
  if (TYPE_LABELS[type]) return TYPE_LABELS[type]
  // Fallback: prettify SNAKE_CASE → Title Case
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ============================================================================
// GRADING SCALE — raw scores out of 150 (no percentages)
// ============================================================================
// A (140-150) Excellent         | B (130-139) Very Good
// C (120-129) Good              | D (100-119) Fair
// E (75-99)   Average           | F (0-74)   Needs Improvement
// ============================================================================
// Remarks updated 2026-11-13 per school spec.
// Note: D and E remarks differ from the older scale — D is now "Fair" (was
// "Satisfactory") and E is now "Average" (was "Fair").
// ============================================================================

export const MAX_REPORT_SCORE = 150

export const GRADING_SCALE: Array<{ grade: string; min: number; max: number; range: string; remark: string }> = [
  { grade: 'A', min: 140, max: 150, range: '140-150', remark: 'Excellent' },
  { grade: 'B', min: 130, max: 139, range: '130-139', remark: 'Very Good' },
  { grade: 'C', min: 120, max: 129, range: '120-129', remark: 'Good' },
  { grade: 'D', min: 100, max: 119, range: '100-119', remark: 'Fair' },
  { grade: 'E', min: 75,  max: 99,  range: '75-99',   remark: 'Average' },
  { grade: 'F', min: 0,   max: 74,  range: '0-74',    remark: 'Needs Improvement' },
]

// Remark for a letter grade — used by report cards.
export function remarkForGrade(grade: string): string {
  const found = GRADING_SCALE.find((g) => g.grade === grade)
  return found?.remark || '—'
}

// ============================================================================
// GRADE-BASED TERM TOTAL CALCULATION (Zambia primary school spec)
// ----------------------------------------------------------------------------
// The Term Total is computed differently depending on the learner's grade:
//
//   Grades 6 & 7:
//     Term Total = SP1 + SP2 + best 4 scores from the remaining 8 subjects
//     (compulsory: SP1, SP2 — even if low)
//     (best 4 picked from: MATH, ENG, SCI, SS, ZL, TS, HE, EA)
//
//   Grades 5 and below:
//     Term Total = MATH + ENG + SCI + SS + best 2 from the remaining 6 subjects
//     (compulsory: MATH, ENG, SCI, SS — even if low)
//     (best 2 picked from: ZL, SP1, SP2, TS, HE, EA)
//
// All scores are expected to be on the /150 normalized scale before being
// passed in. Subjects with `null` score are excluded from "best N" selection
// but compulsory subjects are ALWAYS included (with 0 if null).
// ============================================================================

export interface SubjectScoreForTotal {
  code: string         // must match a STANDARD_SUBJECTS code (MATH, ENG, …)
  score: number | null // normalized to /150; null = no score recorded
}

export interface TermTotalResult {
  termTotal: number               // sum of compulsory + best N (out of 150 × selected subjects)
  selectedSubjects: Array<{ code: string; score: number; compulsory: boolean }>
  droppedSubjects: Array<{ code: string; score: number | null }>
  rule: 'GRADE_6_7' | 'GRADE_5_BELOW'
}

export function computeTermTotal(
  grade: number,
  subjectScores: SubjectScoreForTotal[],
): TermTotalResult {
  const rule: 'GRADE_6_7' | 'GRADE_5_BELOW' = grade >= 6 ? 'GRADE_6_7' : 'GRADE_5_BELOW'

  // Build a lookup: code → score (default to null if missing)
  const scoreByCode = new Map<string, number | null>()
  for (const s of subjectScores) {
    scoreByCode.set(s.code.toUpperCase(), s.score)
  }
  // Ensure all 10 standard subjects are represented
  for (const std of STANDARD_SUBJECTS) {
    if (!scoreByCode.has(std.code)) scoreByCode.set(std.code, null)
  }

  const selected: Array<{ code: string; score: number; compulsory: boolean }> = []
  const dropped: Array<{ code: string; score: number | null }> = []

  if (rule === 'GRADE_6_7') {
    // Compulsory: SP1, SP2
    const compulsoryCodes = ['SP1', 'SP2']
    // Best 4 from the rest
    const optionalCodes = ['MATH', 'ENG', 'SCI', 'SS', 'ZL', 'TS', 'HE', 'EA']
    const bestN = 4

    for (const code of compulsoryCodes) {
      const sc = scoreByCode.get(code) ?? null
      selected.push({ code, score: sc ?? 0, compulsory: true })
    }
    // Pick best N from optional (only those with a non-null score)
    const optionalScored = optionalCodes
      .map((code) => ({ code, score: scoreByCode.get(code) ?? null }))
      .filter((s) => s.score !== null) as Array<{ code: string; score: number }>
    optionalScored.sort((a, b) => b.score - a.score)
    const picked = new Set(optionalScored.slice(0, bestN).map((s) => s.code))
    for (const s of optionalScored) {
      if (picked.has(s.code)) {
        selected.push({ code: s.code, score: s.score, compulsory: false })
      } else {
        dropped.push({ code: s.code, score: s.score })
      }
    }
    // Optional subjects with no score recorded → dropped (null)
    for (const code of optionalCodes) {
      const sc = scoreByCode.get(code) ?? null
      if (sc === null && !picked.has(code)) {
        dropped.push({ code, score: null })
      }
    }
  } else {
    // GRADE_5_BELOW: Compulsory = MATH, ENG, SCI, SS; Best 2 from rest
    const compulsoryCodes = ['MATH', 'ENG', 'SCI', 'SS']
    const optionalCodes = ['ZL', 'SP1', 'SP2', 'TS', 'HE', 'EA']
    const bestN = 2

    for (const code of compulsoryCodes) {
      const sc = scoreByCode.get(code) ?? null
      selected.push({ code, score: sc ?? 0, compulsory: true })
    }
    const optionalScored = optionalCodes
      .map((code) => ({ code, score: scoreByCode.get(code) ?? null }))
      .filter((s) => s.score !== null) as Array<{ code: string; score: number }>
    optionalScored.sort((a, b) => b.score - a.score)
    const picked = new Set(optionalScored.slice(0, bestN).map((s) => s.code))
    for (const s of optionalScored) {
      if (picked.has(s.code)) {
        selected.push({ code: s.code, score: s.score, compulsory: false })
      } else {
        dropped.push({ code: s.code, score: s.score })
      }
    }
    for (const code of optionalCodes) {
      const sc = scoreByCode.get(code) ?? null
      if (sc === null && !picked.has(code)) {
        dropped.push({ code, score: null })
      }
    }
  }

  const termTotal = selected.reduce((sum, s) => sum + s.score, 0)
  return { termTotal, selectedSubjects: selected, droppedSubjects: dropped, rule }
}

export function gradeForScore(score: number | null): string {
  if (score === null) return '—'
  if (score >= 140) return 'A'
  if (score >= 130) return 'B'
  if (score >= 120) return 'C'
  if (score >= 100) return 'D'
  if (score >= 75) return 'E'
  return 'F'
}

// Normalize a raw score to the 150-point scale.
// E.g. if a test is out of 100 and the learner got 80, that's 80 * 150 / 100 = 120.
export function normalizeTo150(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0
  return Math.round((score / maxScore) * MAX_REPORT_SCORE)
}

// Tailwind color classes for each grade badge
export function gradeColorClass(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'B': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'C': return 'bg-teal-100 text-teal-800 border-teal-200'
    case 'D': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'E': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'F': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-muted text-muted-foreground border-border'
  }
}

// ============================================================================
// STANDARD SUBJECTS — the 10 official Zambian primary school subjects (Grades 4-7).
// Every mark sheet, mark schedule, and report card MUST render exactly these 10
// subjects, regardless of whether scores exist for each. This constant is the
// single source of truth — never query the DB `subjects` table for the column
// list; only use it to resolve a code → subject_id for assessment linking.
// ============================================================================
export interface StandardSubject {
  code: string         // short code, also stored in subjects.code
  name: string         // human-readable name (Title Case)
  label: string        // UPPER-CASE label used in Excel templates
  color: string        // hex color for badges / chips
}

export const STANDARD_SUBJECTS: StandardSubject[] = [
  { code: 'MATH', name: 'Mathematics',      label: 'MATHEMATICS',       color: '#2563eb' },
  { code: 'ENG',  name: 'English',          label: 'ENGLISH',           color: '#dc2626' },
  { code: 'SCI',  name: 'Science',          label: 'SCIENCE',           color: '#16a34a' },
  { code: 'SS',   name: 'Social Studies',   label: 'SOCIAL STUDIES',    color: '#ca8a04' },
  { code: 'ZL',   name: 'Zambian Language', label: 'ZAMBIAN LANGUAGE',  color: '#7c3aed' },
  { code: 'SP1',  name: 'Special Paper 1',  label: 'SPECIAL PAPER 1',   color: '#0e7490' },
  { code: 'SP2',  name: 'Special Paper 2',  label: 'SPECIAL PAPER 2',   color: '#155e75' },
  { code: 'TS',   name: 'Technology Studies', label: 'TECHNOLOGY STUDIES', color: '#0891b2' },
  { code: 'HE',   name: 'Home Economics',   label: 'HOME ECONOMICS',    color: '#c2410c' },
  { code: 'EA',   name: 'Expressive Arts',  label: 'EXPRESSIVE ARTS',   color: '#db2777' },
]

// Aliases accepted when parsing an uploaded mark sheet header row.
// Maps various spellings → our subject code.
const SUBJECT_ALIASES: Record<string, string> = {}
function regAlias(code: string, ...names: string[]) {
  for (const n of names) SUBJECT_ALIASES[n.toUpperCase().trim()] = code
}
regAlias('MATH', 'MATH', 'MATHEMATICS', 'MATHS')
regAlias('ENG',  'ENG',  'ENGLISH',     'ENGL')
regAlias('SCI',  'SCI',  'SCIENCE',     'SCI.')
regAlias('SS',   'SS',   'SOCIAL STUDIES', 'SOCIAL', 'SOCIALSTUDIES', 'S.S')
regAlias('ZL',   'ZL',   'ZAMBIAN LANGUAGE', 'ZAMBIANLANG', 'ZAMBIAN', 'CINYANJA', 'CIYANJA', 'BEMBA', 'TONGA', 'LOZI', 'NDEBELE')
regAlias('SP1',  'SP1',  'SPECIAL PAPER 1', 'SPECIALPAPER1', 'SP 1', 'S.P.1')
regAlias('SP2',  'SP2',  'SPECIAL PAPER 2', 'SPECIALPAPER2', 'SP 2', 'S.P.2')
regAlias('TS',   'TS',   'TECHNOLOGY STUDIES', 'TECH', 'TECHNOLOGY', 'CTS', 'COMPUTER STUDIES', 'T.S')
regAlias('HE',   'HE',   'HOME ECONOMICS', 'HOME EC', 'HOME-EC', 'H.E')
regAlias('EA',   'EA',   'EXPRESSIVE ARTS', 'ARTS', 'EXPRESSIVE', 'E.A')

// Resolve an arbitrary header string to a STANDARD_SUBJECTS code, or null.
export function resolveSubjectCode(header: string): string | null {
  const key = (header || '').toString().toUpperCase().trim()
  if (!key) return null
  if (SUBJECT_ALIASES[key]) return SUBJECT_ALIASES[key]
  const byCode = STANDARD_SUBJECTS.find((s) => s.code.toUpperCase() === key)
  if (byCode) return byCode.code
  const byLabel = STANDARD_SUBJECTS.find((s) => s.label.toUpperCase() === key)
  if (byLabel) return byLabel.code
  const stripped = key.replace(/[^A-Z0-9]/g, '')
  if (SUBJECT_ALIASES[stripped]) return SUBJECT_ALIASES[stripped]
  const byCodeStrip = STANDARD_SUBJECTS.find((s) => s.code.toUpperCase() === stripped)
  if (byCodeStrip) return byCodeStrip.code
  return null
}
