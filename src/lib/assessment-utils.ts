// EduQuest LMS — Assessment type labels and helpers.
// Shared between teacher / school-admin / learner views so labels stay consistent.

export const ASSESSMENT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'MIDTERM', label: 'Mid-Term' },
  { value: 'END_OF_TERM', label: 'End-of-Term' },
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
// A (140-150) Excellent | B (130-139) Very Good | C (120-129) Good
// D (100-119) Satisfactory | E (75-99) Fair | F (0-74) Needs Improvement
// ============================================================================

export const MAX_REPORT_SCORE = 150

export const GRADING_SCALE: Array<{ grade: string; min: number; max: number; range: string; remark: string }> = [
  { grade: 'A', min: 140, max: 150, range: '140-150', remark: 'Excellent' },
  { grade: 'B', min: 130, max: 139, range: '130-139', remark: 'Very Good' },
  { grade: 'C', min: 120, max: 129, range: '120-129', remark: 'Good' },
  { grade: 'D', min: 100, max: 119, range: '100-119', remark: 'Satisfactory' },
  { grade: 'E', min: 75,  max: 99,  range: '75-99',   remark: 'Fair' },
  { grade: 'F', min: 0,   max: 74,  range: '0-74',    remark: 'Needs Improvement' },
]

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
