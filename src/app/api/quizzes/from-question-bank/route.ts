import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// POST /api/quizzes/from-question-bank — create a quiz with random questions
// selected from the question bank based on filters.
//
// Body: {
//   title, subjectId, grade, topic?, difficulty?, questionTypes?,
//   numberOfQuestions, selectionMode: 'random' | 'all',
//   quizSettings: { timeLimit, passingScore, ... },
//   classIds?: string[]
// }
// Returns: { quiz: { id, ... }, questions: [...] }
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const {
      title, subjectId, grade, topic, difficulty, questionTypes,
      numberOfQuestions, selectionMode, quizSettings, classIds,
    } = body
    if (!title || !subjectId || !grade) {
      return NextResponse.json({ error: 'title, subjectId, grade required' }, { status: 400 })
    }
    const numQuestions = Number(numberOfQuestions) || 10
    if (numQuestions < 1 || numQuestions > 100) {
      return NextResponse.json({ error: 'numberOfQuestions must be 1–100' }, { status: 400 })
    }

    const sb = supabaseService()
    // Build the question bank query
    let q = sb.from('question_bank').select('*')
    if (user.role === 'SUPER_USER') {
      // super user: all or filter by schoolId
    } else {
      // school-scoped
      q = q.eq('school_id', user.schoolId!)
    }
    if (subjectId) q = q.eq('subject_id', subjectId)
    if (grade) q = q.eq('grade', Number(grade))
    if (topic) q = q.ilike('topic', `%${topic}%`)
    if (difficulty && difficulty !== 'MIXED') q = q.eq('difficulty', difficulty)
    if (questionTypes && Array.isArray(questionTypes) && questionTypes.length > 0) {
      q = q.in('type', questionTypes)
    }

    const { data: bankQuestions, error } = await q.order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!bankQuestions || bankQuestions.length === 0) {
      return NextResponse.json({
        error: 'No questions found in the question bank matching these filters. Try adjusting filters or add questions to the bank first.',
      }, { status: 404 })
    }

    // Select questions (random or all)
    let selected = bankQuestions
    if (selectionMode === 'random' && bankQuestions.length > numQuestions) {
      // Fisher-Yates shuffle + take first N
      const shuffled = [...bankQuestions]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      selected = shuffled.slice(0, numQuestions)
    }

    // Create the quiz
    const settings = quizSettings || {}
    const { data: quiz, error: quizErr } = await sb.from('quizzes').insert({
      title: String(title),
      grade: Number(grade),
      subject_id: subjectId,
      topic: topic || '',
      description: `Created from question bank (${selected.length} questions, ${selectionMode || 'random'} selection)`,
      difficulty: (difficulty || 'MEDIUM'),
      curriculum: 'ZAMBIAN',
      instructions: settings.instructions || '',
      time_limit: settings.timeLimit ?? 30,
      passing_score: settings.passingScore ?? 50,
      max_attempts: settings.maxAttempts ?? 1,
      random_question_order: settings.randomQuestionOrder ?? false,
      random_answer_order: settings.randomAnswerOrder ?? false,
      allow_retakes: settings.allowRetakes ?? true,
      show_answers: settings.showAnswers || 'AFTER_SUBMISSION',
      show_explanations: settings.showExplanations ?? true,
      score_policy: settings.scorePolicy || 'HIGHEST',
      status: 'DRAFT',
      teacher_id: user.id,
      school_id: user.schoolId,
    }).select().single()
    if (quizErr) return NextResponse.json({ error: quizErr.message }, { status: 500 })

    // Insert quiz questions from the selected bank questions
    const quizQuestions = selected.map((bq: any, idx: number) => ({
      quiz_id: quiz.id,
      type: bq.type,
      question_text: bq.question_text,
      options: bq.options,
      correct_answer: bq.correct_answer,
      accepted_answers: bq.accepted_answers,
      matching_pairs: bq.matching_pairs,
      marking_guide: bq.marking_guide,
      numerical_tolerance: bq.numerical_tolerance,
      mark_allocation: bq.mark_allocation || 1,
      explanation: bq.explanation,
      order: idx,
      question_bank_id: bq.id,
    }))
    const { error: qErr } = await sb.from('quiz_questions').insert(quizQuestions)
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

    // Assign to classes if provided
    if (classIds && Array.isArray(classIds)) {
      for (const cid of classIds) {
        await sb.from('quiz_assignments').upsert({
          quiz_id: quiz.id, class_id: cid,
        }, { onConflict: 'quiz_id,class_id' })
      }
    }

    return NextResponse.json({
      quiz: { id: quiz.id, title: quiz.title, status: 'DRAFT' },
      questions: quizQuestions,
      selectedFromBank: selected.length,
      totalInBank: bankQuestions.length,
    }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
