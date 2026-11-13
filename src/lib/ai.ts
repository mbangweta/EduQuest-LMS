import ZAI from 'z-ai-web-dev-sdk'

// EduQuest LMS — AI helpers (server-side only)
// Uses z-ai-web-dev-sdk (GLM-4.6) for quiz & lesson generation, and AI-assisted short answer marking.

let zaiPromise: Promise<any> | null = null
async function getZAI() {
  if (!zaiPromise) zaiPromise = ZAI.create()
  return zaiPromise
}

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
export type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'FILL_BLANK'
  | 'SHORT_ANSWER'
  | 'NUMERICAL'
  | 'MATCHING'

export interface AIQuizQuestion {
  type: QuestionType
  questionText: string
  options?: string[]                       // for MULTIPLE_CHOICE
  correctAnswer: string | number | boolean | Record<string, string>
  acceptedAnswers?: string[]               // for FILL_BLANK
  matchingPairs?: { left: string; right: string }[] // for MATCHING
  markingGuide?: string                    // for SHORT_ANSWER
  numericalTolerance?: number             // for NUMERICAL
  markAllocation: number
  explanation?: string
}

export interface AIQuizResult {
  questions: AIQuizQuestion[]
}

export interface AILessonResult {
  title: string
  objectives: string
  notes: string
  activities: string
  examples: string
  practiceQuestions: string
  homework: string
  summary: string
}

export interface AIShortAnswerMark {
  isCorrect: boolean
  marksAwarded: number
  maxMarks: number
  feedback: string
  partial: boolean
}

// ---------------------------------------------------------------------------
// HELPERS — JSON extraction
// ---------------------------------------------------------------------------
function extractJson(text: string): any {
  if (!text) return null
  // Try direct parse first
  try { return JSON.parse(text) } catch {}
  // Try ```json fenced block
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) {
    try { return JSON.parse(fenced[1]) } catch {}
  }
  // Try first { ... last }
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)) } catch {}
  }
  const arrFirst = text.indexOf('[')
  const arrLast = text.lastIndexOf(']')
  if (arrFirst !== -1 && arrLast > arrFirst) {
    try { return JSON.parse(text.slice(arrFirst, arrLast + 1)) } catch {}
  }
  return null
}

// ---------------------------------------------------------------------------
// QUIZ GENERATION
// ---------------------------------------------------------------------------
export interface GenerateQuizParams {
  title: string
  grade: number
  subject: string
  topic: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD'
  numberOfQuestions: number
  questionTypes: QuestionType[]
  curriculum: 'ZAMBIAN' | 'ECZ' | 'CAMBRIDGE' | 'GENERAL'
  instructions?: string
  timeLimit?: number
  passingScore?: number
}

export async function generateQuiz(params: GenerateQuizParams): Promise<AIQuizResult> {
  const zai = await getZAI()

  const typesList = params.questionTypes.join(', ')
  const sys = `You are an expert Zambian curriculum assessment author for primary and secondary school learners (Grades 5–12), familiar with ECZ examination standards. You produce high-quality, age-appropriate, pedagogically-sound quiz questions in strict JSON format.`

  const user = `Generate a quiz with the following requirements. Output ONLY a JSON object with a single "questions" array. Do not include any commentary, prose, or markdown outside the JSON.

Requirements:
- Title: ${params.title}
- Grade: ${params.grade}
- Subject: ${params.subject}
- Topic: ${params.topic}
- Curriculum: ${params.curriculum}
- Difficulty: ${params.difficulty}
- Number of questions: ${params.numberOfQuestions}
- Question types to use (mix): ${typesList}
- Mark allocation: 1 mark per question unless it is a complex MATCHING or SHORT_ANSWER, in which case 2-3 marks.

Each question object must match this schema (omit fields that don't apply to its type):
{
  "type": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK" | "SHORT_ANSWER" | "NUMERICAL" | "MATCHING",
  "questionText": "string",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],  // MULTIPLE_CHOICE only — exactly 4 options, prefixed with "A. ", "B. ", etc.
  "correctAnswer": "B" | true | 42 | {"left1": "right2", "left2": "right1"},  // varies by type
  "acceptedAnswers": ["answer1", "answer2"],  // FILL_BLANK only — list of acceptable answers
  "matchingPairs": [{"left": "...", "right": "..."}],  // MATCHING only — 4 pairs
  "markingGuide": "string",  // SHORT_ANSWER only — describe what a correct answer must contain (3-5 key points); learners will NOT see this
  "numericalTolerance": 0.01,  // NUMERICAL only — tolerance for floating-point comparison
  "markAllocation": 1,
  "explanation": "string — a one or two sentence explanation that helps the learner understand the correct answer"
}

Rules:
- For MULTIPLE_CHOICE, correctAnswer must be exactly the letter ("A", "B", "C", or "D").
- For TRUE_FALSE, correctAnswer must be true or false (boolean).
- For FILL_BLANK, acceptedAnswers should list 2-4 acceptable variations (case-insensitive).
- For SHORT_ANSWER, write a clear markingGuide that names the key points the answer must include.
- For NUMERICAL, correctAnswer is a number and numericalTolerance is the allowed error.
- For MATCHING, correctAnswer is a map of left-item → right-item, and matchingPairs lists them.
- All questions must be Zambian-context appropriate (use Zambian names, examples from Zambian life where possible: kwacha, maize, Lusaka, Zambezi River, Copperbelt, etc.).
- Each question must have an explanation.

Output format:
{ "questions": [ { ... }, { ... } ] }`

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      thinking: { type: 'disabled' },
    })
    const raw = completion?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(raw)
    if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return { questions: parsed.questions as AIQuizQuestion[] }
    }
    // Fallback: generate a small deterministic quiz so the UI still works
    return fallbackQuiz(params)
  } catch (e) {
    console.error('AI quiz generation failed:', e)
    return fallbackQuiz(params)
  }
}

function fallbackQuiz(params: GenerateQuizParams): AIQuizResult {
  // Deterministic fallback when AI is unavailable — generates a tiny starter quiz.
  const questions: AIQuizQuestion[] = []
  for (let i = 0; i < Math.min(params.numberOfQuestions, 3); i++) {
    questions.push({
      type: 'MULTIPLE_CHOICE',
      questionText: `Sample question ${i + 1} on ${params.topic} (Grade ${params.grade} ${params.subject}). Edit this question or click "Regenerate with AI" again.`,
      options: ['A. Option one', 'B. Option two', 'C. Option three', 'D. Option four'],
      correctAnswer: 'B',
      markAllocation: 1,
      explanation: 'This is a placeholder question generated by the fallback when the AI service is unavailable.',
    })
  }
  return { questions }
}

// ---------------------------------------------------------------------------
// LESSON GENERATION
// ---------------------------------------------------------------------------
export interface GenerateLessonParams {
  grade: number
  subject: string
  topic: string
  curriculum: 'ZAMBIAN' | 'ECZ' | 'CAMBRIDGE' | 'GENERAL'
  duration?: number // minutes
  learningObjectives?: string
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD'
}

export async function generateLesson(params: GenerateLessonParams): Promise<AILessonResult> {
  const zai = await getZAI()
  const sys = `You are an experienced Zambian curriculum teacher and instructional designer for Grades 5–12 (ECZ standards). You produce clear, structured, age-appropriate lesson content in strict JSON format.`
  const user = `Generate a complete lesson plan as JSON. Output ONLY a JSON object, no commentary outside JSON.

Requirements:
- Grade: ${params.grade}
- Subject: ${params.subject}
- Topic: ${params.topic}
- Curriculum: ${params.curriculum}
- Duration: ${params.duration ?? 40} minutes
- Learning objectives: ${params.learningObjectives ?? 'generate 3-5 age-appropriate objectives'}
- Difficulty: ${params.difficulty ?? 'MEDIUM'}

Output schema (all fields are plain text/markdown strings, suitable for student-facing display):
{
  "title": "string — lesson title",
  "objectives": "markdown — 3-5 learning objectives as a bullet list starting with 'By the end of this lesson, learners will be able to:'",
  "notes": "markdown — detailed lesson notes, 400-700 words, broken into clear sections with subheadings (##), examples using Zambian context (kwacha, maize, Lusaka, Zambezi, Copperbelt, local names) where natural",
  "activities": "markdown — 2-3 teaching activities, each with a title and step-by-step instructions",
  "examples": "markdown — 2-3 worked examples with step-by-step solutions",
  "practiceQuestions": "markdown — 4-5 practice questions with answers at the end",
  "homework": "markdown — 3-5 homework questions",
  "summary": "markdown — a 100-150 word recap of the key points"
}

All content must be:
- Age-appropriate for Grade ${params.grade}
- Aligned with ${params.curriculum} standards
- Use Zambian examples and contexts where natural
- Well-structured markdown with headings`

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      thinking: { type: 'disabled' },
    })
    const raw = completion?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(raw)
    if (parsed && parsed.title && parsed.notes) {
      return {
        title: parsed.title,
        objectives: parsed.objectives ?? '',
        notes: parsed.notes ?? '',
        activities: parsed.activities ?? '',
        examples: parsed.examples ?? '',
        practiceQuestions: parsed.practiceQuestions ?? '',
        homework: parsed.homework ?? '',
        summary: parsed.summary ?? '',
      }
    }
    return fallbackLesson(params)
  } catch (e) {
    console.error('AI lesson generation failed:', e)
    return fallbackLesson(params)
  }
}

function fallbackLesson(params: GenerateLessonParams): AILessonResult {
  return {
    title: `${params.topic} — Grade ${params.grade} ${params.subject}`,
    objectives: 'By the end of this lesson, learners will be able to:\n- Describe the key concepts of ' + params.topic + '\n- Apply these concepts to simple problems\n- Give examples from everyday Zambian life',
    notes: `## Introduction\n\nThis lesson covers ${params.topic} for Grade ${params.grade} ${params.subject}.\n\n## Key Concepts\n\nEdit this content or click "Regenerate with AI" again.\n\n## Examples\n\n(TBD)`,
    activities: '1. Group discussion on ' + params.topic + '\n2. Pair work with examples\n3. Class sharing and feedback',
    examples: '**Example 1**: To be added by teacher.',
    practiceQuestions: '1. Question 1\n2. Question 2\n3. Question 3',
    homework: '1. Homework Q1\n2. Homework Q2',
    summary: `This lesson introduced ${params.topic}. Learners should be able to recall and apply the key concepts covered.`,
  }
}

// ---------------------------------------------------------------------------
// AI-ASSISTED SHORT ANSWER MARKING
// ---------------------------------------------------------------------------
export async function markShortAnswer(
  questionText: string,
  markingGuide: string,
  learnerAnswer: string,
  maxMarks: number,
): Promise<AIShortAnswerMark> {
  // Empty answer → zero
  if (!learnerAnswer || !learnerAnswer.trim()) {
    return { isCorrect: false, marksAwarded: 0, maxMarks, feedback: 'No answer provided.', partial: false }
  }

  const zai = await getZAI()
  const sys = `You are a careful, fair Zambian school teacher marking a learner's short-answer response. You compare the learner's answer to a marking guide and decide the mark. Output ONLY strict JSON.`
  const user = `Mark the learner's answer.

Question: ${questionText}

Marking guide (key points the answer should include):
${markingGuide}

Learner's answer:
"${learnerAnswer}"

Maximum marks: ${maxMarks}

Output JSON:
{
  "isCorrect": boolean,           // true if the learner has captured all or nearly all key points
  "marksAwarded": number,          // integer 0..maxMarks (partial marks allowed)
  "maxMarks": ${maxMarks},
  "feedback": "string",            // one short sentence, encouraging, in simple English
  "partial": boolean              // true if any partial credit was given
}

Be generous to learners in lower grades but fair. If the answer is clearly correct in spirit but worded differently, award full marks. If the learner has the right idea but missed one key point, give partial marks. If the answer is wrong or blank, give zero.`

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      thinking: { type: 'disabled' },
    })
    const raw = completion?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(raw)
    if (parsed && typeof parsed.marksAwarded === 'number') {
      return {
        isCorrect: !!parsed.isCorrect,
        marksAwarded: Math.max(0, Math.min(maxMarks, Math.round(parsed.marksAwarded))),
        maxMarks,
        feedback: String(parsed.feedback ?? ''),
        partial: !!parsed.partial,
      }
    }
    // Heuristic fallback: keyword match
    return heuristicShortAnswer(questionText, markingGuide, learnerAnswer, maxMarks)
  } catch (e) {
    console.error('AI short-answer marking failed:', e)
    return heuristicShortAnswer(questionText, markingGuide, learnerAnswer, maxMarks)
  }
}

function heuristicShortAnswer(
  questionText: string,
  markingGuide: string,
  learnerAnswer: string,
  maxMarks: number,
): AIShortAnswerMark {
  // Simple keyword overlap heuristic
  const answer = learnerAnswer.toLowerCase()
  const keywords = markingGuide
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 3)
  if (keywords.length === 0) {
    return {
      isCorrect: answer.trim().length > 0,
      marksAwarded: answer.trim().length > 0 ? maxMarks : 0,
      maxMarks,
      feedback: 'Marked on length only — please review manually.',
      partial: false,
    }
  }
  const matched = keywords.filter((k) => answer.includes(k)).length
  const ratio = matched / keywords.length
  const marksAwarded = Math.round(ratio * maxMarks)
  return {
    isCorrect: ratio >= 0.8,
    marksAwarded,
    maxMarks,
    feedback:
      ratio >= 0.8
        ? 'Good answer — covers the main points.'
        : ratio >= 0.4
          ? 'Partially correct — some key points are missing.'
          : 'This answer does not cover the key points. Review the lesson and try again.',
    partial: marksAwarded > 0 && marksAwarded < maxMarks,
  }
}

// ---------------------------------------------------------------------------
// PARSE PASTED QUESTIONS — AI reads pasted exam/revision questions and
// structures them into the standard question format.
// ---------------------------------------------------------------------------
export interface PastedQuestionsParams {
  pastedText: string
  grade: number
  subject: string
  defaultQuestionType?: QuestionType
  generateMissingOptions?: boolean  // if true, AI generates MCQ options when missing
}

export async function parsePastedQuestions(params: PastedQuestionsParams): Promise<AIQuizResult> {
  const zai = await getZAI()
  const sys = `You are an expert Zambian curriculum assessment author. You parse pasted exam questions into structured JSON format. You carefully identify each question, its options, correct answer, and marking scheme from the pasted text. If the pasted text doesn't contain an answer, you set "correctAnswer" to null and add "uncertain: true" to flag it for teacher review. You never invent answers when the source material doesn't provide them.`

  const user = `Parse the following pasted questions into structured JSON. Output ONLY a JSON object with a "questions" array.

Pasted text:
"""
${params.pastedText.slice(0, 8000)}
"""

Context:
- Grade: ${params.grade}
- Subject: ${params.subject}
${params.generateMissingOptions ? '- Generate plausible multiple-choice options (A, B, C, D) for questions that appear to be MCQs but are missing options.' : '- Do NOT generate missing options. Only structure what is provided.'}

Each question object:
{
  "type": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK" | "SHORT_ANSWER" | "NUMERICAL" | "MATCHING",
  "questionText": "the full question text",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],  // only for MCQ
  "correctAnswer": "B" | true | "answer text" | 42 | null,  // null if not provided in the source
  "acceptedAnswers": ["alt1", "alt2"],  // for FILL_BLANK
  "markingGuide": "string",  // for SHORT_ANSWER; null if not provided
  "markAllocation": 1,
  "explanation": "string or null",
  "uncertain": true|false  // true if correct answer was not found in the source material
}

Rules:
- Preserve the original question text as-is (do not paraphrase).
- If an answer is clearly stated in the source, use it.
- If an answer is NOT stated, set correctAnswer to null and uncertain to true.
- Identify the question type from the format (e.g., "A. B. C. D." = MCQ, "True or False" = TRUE_FALSE).
- Number questions in order they appear in the text.
- Output format: { "questions": [ { ... }, { ... } ] }`

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      thinking: { type: 'disabled' },
    })
    const raw = completion?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(raw)
    if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return { questions: parsed.questions as AIQuizQuestion[] }
    }
    return { questions: [] }
  } catch (e) {
    console.error('AI parse pasted questions failed:', e)
    return { questions: [] }
  }
}

// ---------------------------------------------------------------------------
// REGENERATE INDIVIDUAL QUESTION — AI replaces one question in a quiz
// without affecting the others.
// ---------------------------------------------------------------------------
export interface RegenerateQuestionParams {
  prompt?: string           // optional: teacher's instruction for what to change
  grade: number
  subject: string
  topic: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD'
  questionType: QuestionType
  curriculum: 'ZAMBIAN' | 'ECZ' | 'CAMBRIDGE' | 'GENERAL'
  existingQuestionText?: string  // the question being replaced (for context)
  avoidQuestions?: string[]      // other question texts in the quiz (to avoid duplicates)
}

export async function regenerateQuestion(params: RegenerateQuestionParams): Promise<AIQuizQuestion | null> {
  const zai = await getZAI()
  const sys = `You are an expert Zambian curriculum assessment author. You generate ONE replacement question in strict JSON format.`

  const user = `Generate ONE ${params.questionType.replace('_', ' ')} question.

Context:
- Grade: ${params.grade}
- Subject: ${params.subject}
- Topic: ${params.topic}
- Difficulty: ${params.difficulty}
- Curriculum: ${params.curriculum}
${params.prompt ? `- Teacher's instruction: "${params.prompt}"` : ''}
${params.existingQuestionText ? `- Original question being replaced: "${params.existingQuestionText}"` : ''}
${params.avoidQuestions && params.avoidQuestions.length > 0 ? `- Do NOT duplicate or closely resemble these existing questions: ${params.avoidQuestions.slice(0, 10).map((q) => `"${q.slice(0, 80)}"`).join('; ')}` : ''}

Output ONE question as JSON:
{
  "type": "${params.questionType}",
  "questionText": "...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],  // for MCQ only
  "correctAnswer": "...",
  "acceptedAnswers": [...],  // for FILL_BLANK
  "markingGuide": "...",  // for SHORT_ANSWER
  "markAllocation": 1,
  "explanation": "..."
}

Use Zambian context (kwacha, maize, Lusaka, Zambezi, etc.) where natural. Output ONLY the JSON object.`

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      thinking: { type: 'disabled' },
    })
    const raw = completion?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(raw)
    if (parsed && parsed.questionText) {
      return parsed as AIQuizQuestion
    }
    return null
  } catch (e) {
    console.error('AI regenerate question failed:', e)
    return null
  }
}
