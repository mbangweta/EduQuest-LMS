import { supabaseService } from './supabase'
import { adminCreateUser } from './auth-supabase'

// ============================================================================
// EduQuest LMS — Seed Supabase with Zambian sample data (v2 — idempotent)
// ============================================================================
// Run via: `bun run src/lib/seed-supabase.ts`
//
// Idempotent: if a record already exists (by email, class_code, etc.), it
// skips creation and reuses the existing row. Otherwise inserts fresh.
// ============================================================================

const DEMO_PASSWORD = 'eduquest123'
const J = (v: any) => (v === undefined ? null : JSON.stringify(v))

const SUBJECTS = [
  { code: 'MATH', name: 'Mathematics', description: 'Numbers, Algebra, Geometry, Statistics', color: '#2563eb' },
  { code: 'ENG', name: 'English', description: 'English Language — Grammar, Composition, Comprehension', color: '#dc2626' },
  { code: 'SCI', name: 'Science', description: 'Integrated Science / Science', color: '#16a34a' },
  { code: 'SS', name: 'Social Studies', description: 'History, Geography, Civics', color: '#ca8a04' },
  { code: 'ZL', name: 'Zambian Language', description: 'Zambian local language studies (Cinyanja, Bemba, Tonga, Lozi, etc.)', color: '#7c3aed' },
  { code: 'SP1', name: 'Special Paper 1', description: 'Reasoning + Verbal + Math reasoning', color: '#0e7490' },
  { code: 'SP2', name: 'Special Paper 2', description: 'General knowledge + spatial reasoning', color: '#155e75' },
  { code: 'TS', name: 'Technology Studies', description: 'Technology Studies', color: '#0891b2' },
  { code: 'HE', name: 'Home Economics', description: 'Home Economics', color: '#c2410c' },
  { code: 'EA', name: 'Expressive Arts', description: 'Expressive Arts', color: '#db2777' },
  // Legacy / additional subjects kept for backward compatibility
  { code: 'CTS', name: 'Creative and Technology Studies', description: 'Expressive Arts / Technology Studies / Home Economics (legacy)', color: '#0891b2' },
  { code: 'ISCI', name: 'Integrated Science', description: 'Science for Grades 5–7', color: '#16a34a' },
  { code: 'CIN', name: 'Cinyanja', description: 'Local language studies', color: '#9333ea' },
  { code: 'ZLANG', name: 'Zambian Language (legacy)', description: 'Zambian local language studies', color: '#7c3aed' },
  { code: 'SOC', name: 'Social Studies (legacy)', description: 'History, Geography, Civics', color: '#ca8a04' },
  { code: 'CIV', name: 'Civic Education', description: 'Citizenship and governance', color: '#7c3aed' },
  { code: 'BIO', name: 'Biology', description: 'Grades 10–12 Biology', color: '#16a34a' },
  { code: 'CHEM', name: 'Chemistry', description: 'Grades 10–12 Chemistry', color: '#0d9488' },
  { code: 'PHY', name: 'Physics', description: 'Grades 10–12 Physics', color: '#1d4ed8' },
]

interface SeedUser {
  email: string; name: string; role: 'SUPER_USER' | 'ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'LEARNER'
  phone?: string; grade?: number; avatarColor?: string; schoolCode?: string  // schoolCode = which school to assign to
}
const USERS: SeedUser[] = [
  // Super user — platform-wide (no school_id)
  { email: 'admin@eduquest.zm', name: 'Bwalya Phiri', role: 'SUPER_USER', phone: '+260971000001', avatarColor: '#dc2626' },
  // School admin for EduQuest Demo School
  { email: 'headmaster@eduquest.zm', name: 'Mr. Hamweene Sichone', role: 'SCHOOL_ADMIN', phone: '+260971000010', avatarColor: '#9333ea', schoolCode: 'EQS-DEMO' },
  // Teachers (assigned to EduQuest Demo School)
  { email: 'mrs.siya@eduquest.zm', name: 'Mrs. Siya Mwansa', role: 'TEACHER', phone: '+260971000002', avatarColor: '#2563eb', schoolCode: 'EQS-DEMO' },
  { email: 'mr.chisango@eduquest.zm', name: 'Mr. Chisango Banda', role: 'TEACHER', phone: '+260971000003', avatarColor: '#16a34a', schoolCode: 'EQS-DEMO' },
  // Learners (all at EduQuest Demo School)
  { email: 'thabo@eduquest.zm', name: 'Thabo Mumba', role: 'LEARNER', grade: 7, phone: '+260977000001', avatarColor: '#0891b2', schoolCode: 'EQS-DEMO' },
  { email: 'chipo@eduquest.zm', name: 'Chipo Nkhata', role: 'LEARNER', grade: 7, phone: '+260977000002', avatarColor: '#7c3aed', schoolCode: 'EQS-DEMO' },
  { email: 'lubosi@eduquest.zm', name: 'Lubosi Chama', role: 'LEARNER', grade: 6, phone: '+260977000003', avatarColor: '#ca8a04', schoolCode: 'EQS-DEMO' },
  { email: 'natasha@eduquest.zm', name: 'Natasha Tembo', role: 'LEARNER', grade: 5, phone: '+260977000004', avatarColor: '#dc2626', schoolCode: 'EQS-DEMO' },
  { email: 'kabwe@eduquest.zm', name: 'Kabwe Mulenga', role: 'LEARNER', grade: 8, phone: '+260977000005', avatarColor: '#0d9488', schoolCode: 'EQS-DEMO' },
  { email: 'mutale@eduquest.zm', name: 'Mutale Phiri', role: 'LEARNER', grade: 9, phone: '+260977000006', avatarColor: '#1d4ed8', schoolCode: 'EQS-DEMO' },
]

// Additional schools (the demo school is created by the SQL migration)
const SCHOOLS = [
  { name: 'Lusaka Primary School', code: 'LPS-001', address: 'Cairo Road, Lusaka, Zambia', phone: '+260 211 222 333', email: 'info@lusakaprim.sch.zm' },
  { name: 'Ndola Secondary School', code: 'NSS-001', address: 'Broadway, Ndola, Copperbelt, Zambia', phone: '+260 212 444 555', email: 'office@ndolasec.sch.zm' },
  { name: 'Kitwe Academy', code: 'KWA-001', address: 'Independence Avenue, Kitwe, Zambia', phone: '+260 212 666 777', email: 'admin@kitweacademy.sch.zm' },
]

// Helper: insert-or-fetch by a single column match. Returns the row id.
async function findOrInsert(table: string, match: Record<string, any>, insert: Record<string, any>, selectCols = '*'): Promise<any> {
  const sb = supabaseService()
  const keys = Object.keys(match)
  let q = sb.from(table).select(selectCols)
  for (const k of keys) q = q.eq(k, match[k])
  const { data: existing } = await q.maybeSingle()
  if (existing) return existing
  const { data, error } = await sb.from(table).insert(insert).select(selectCols).single()
  if (error) throw new Error(`Insert into ${table} failed: ${error.message}`)
  return data
}

export async function runSupabaseSeed() {
  console.log('🌱 Seeding EduQuest LMS on Supabase...')
  const sb = supabaseService()

  // 1. SUBJECTS — find-or-insert by code
  const subjectMap: Record<string, string> = {}
  for (const s of SUBJECTS) {
    const row = await findOrInsert('subjects', { code: s.code }, {
      code: s.code, name: s.name, description: s.description, color: s.color,
    }, 'id, code')
    subjectMap[s.code] = row.id
  }
  console.log(`✓ ${SUBJECTS.length} subjects`)

  // 1b. SCHOOLS — find-or-insert by code. The EQS-DEMO school was created by
  // the SQL migration, but we add it again here for safety + add 3 more schools.
  const schoolIds: Record<string, string> = {}
  const allSchools = [
    { name: 'EduQuest Demo School', code: 'EQS-DEMO', address: 'Plot 123, Independence Avenue, Lusaka, Zambia', phone: '+260 211 000 000', email: 'demo@eduquest.zm' },
    ...SCHOOLS,
  ]
  for (const s of allSchools) {
    const row = await findOrInsert('schools', { code: s.code }, {
      name: s.name, code: s.code, address: s.address, phone: s.phone, email: s.email, status: 'ACTIVE',
    }, 'id, code')
    schoolIds[s.code] = row.id
  }
  console.log(`✓ ${allSchools.length} schools`)

  // 2. USERS — create via Supabase Auth admin API (idempotent by email)
  const userIds: Record<string, string> = {}
  for (const u of USERS) {
    // Resolve school_id from schoolCode (null for SUPER_USER)
    const userSchoolId = u.schoolCode ? schoolIds[u.schoolCode] : null

    // Check if profile already exists
    const { data: existing } = await sb.from('profiles').select('id').eq('email', u.email).maybeSingle()
    if (existing) {
      userIds[u.email] = existing.id
      // Update role, school_id, avatar color, grade, phone if missing
      const update: any = {
        role: u.role,
        school_id: userSchoolId,  // super user → null
      }
      if (u.avatarColor) update.avatar_color = u.avatarColor
      if (u.grade !== undefined) update.grade = u.grade
      if (u.phone) update.phone = u.phone
      await sb.from('profiles').update(update).eq('id', existing.id)
      continue
    }
    const res = await adminCreateUser({
      email: u.email, password: DEMO_PASSWORD,
      name: u.name, role: u.role, grade: u.grade, phone: u.phone,
      schoolId: userSchoolId,
    })
    if ('error' in res) {
      console.warn(`  ⚠️  Failed to create ${u.email}: ${res.error}`)
      continue
    }
    userIds[u.email] = res.id
    if (u.avatarColor) await sb.from('profiles').update({ avatar_color: u.avatarColor }).eq('id', res.id)
  }
  console.log(`✓ ${USERS.length} users`)

  // 3. CLASSES — find-or-insert by class_code (school_id = demo school)
  const demoSchoolId = schoolIds['EQS-DEMO']
  const classDefs = [
    { classCode: 'G7PM-2025', name: 'Grade 7 Purple Mathematics', grade: 7, subjectCode: 'MATH', description: 'Grade 7 Mathematics — Purple stream. Covers ECZ syllabus.', teacherEmail: 'mrs.siya@eduquest.zm' },
    { classCode: 'G6SC-2025', name: 'Grade 6 Science', grade: 6, subjectCode: 'ISCI', description: 'Grade 6 Integrated Science following the Zambian curriculum.', teacherEmail: 'mr.chisango@eduquest.zm' },
    { classCode: 'G5SP1-2025', name: 'Grade 5 Special Paper 1', grade: 5, subjectCode: 'SP1', description: 'Grade 5 Special Paper 1 — reasoning, verbal, and math reasoning.', teacherEmail: 'mrs.siya@eduquest.zm' },
  ]
  const classIds: Record<string, string> = {}
  for (const cd of classDefs) {
    const teacherId = userIds[cd.teacherEmail]
    if (!teacherId) { console.warn(`  ⚠️  Teacher ${cd.teacherEmail} missing`); continue }
    const row = await findOrInsert('classes', { class_code: cd.classCode }, {
      name: cd.name, grade: cd.grade, subject_id: subjectMap[cd.subjectCode],
      description: cd.description, class_code: cd.classCode, teacher_id: teacherId,
      school_id: demoSchoolId,
    }, 'id, class_code')
    classIds[cd.classCode] = row.id
  }
  console.log(`✓ ${classDefs.length} classes`)

  // 4. CLASS MEMBERS
  const memberships = [
    { classCode: 'G7PM-2025', learnerEmails: ['thabo@eduquest.zm', 'chipo@eduquest.zm'] },
    { classCode: 'G6SC-2025', learnerEmails: ['lubosi@eduquest.zm', 'kabwe@eduquest.zm'] },
    { classCode: 'G5SP1-2025', learnerEmails: ['natasha@eduquest.zm', 'mutale@eduquest.zm'] },
  ]
  for (const m of memberships) {
    const classId = classIds[m.classCode]; if (!classId) continue
    for (const email of m.learnerEmails) {
      const learnerId = userIds[email]; if (!learnerId) continue
      await findOrInsert('class_members', { class_id: classId, learner_id: learnerId }, {
        class_id: classId, learner_id: learnerId,
      }, 'id')
    }
  }
  console.log(`✓ 6 class memberships`)

  // 5. LESSONS — find-or-insert by (title, teacher_id) match using SELECT first
  const mrsSiya = userIds['mrs.siya@eduquest.zm']
  const mrChisango = userIds['mr.chisango@eduquest.zm']

  const fractionsLesson = await findOrInsert(
    'lessons',
    { title: 'Adding and Subtracting Fractions', teacher_id: mrsSiya },
    {
      title: 'Adding and Subtracting Fractions', grade: 7,
      subject_id: subjectMap['MATH'], topic: 'Fractions',
      teacher_id: mrsSiya, status: 'PUBLISHED',
      objectives: `By the end of this lesson, learners will be able to:
- Add fractions with the same denominator
- Add fractions with different denominators by finding the lowest common multiple (LCM)
- Subtract fractions with the same and different denominators
- Apply fractions to real-life Zambian problems`,
      notes: `## Introduction\n\nIn Grade 6, you learned that a **fraction** shows a part of a whole...\n\n## Adding fractions with the same denominator\n\nWhen two fractions have the **same denominator**, you simply add the top numbers (numerators) and keep the denominator the same.\n\n**Example:** 1/5 + 2/5 = (1+2)/5 = **3/5**\n\n## Adding fractions with different denominators\n\nWhen the denominators are different, we must first find a **common denominator**.\n\n**Example:** 1/2 + 1/3\n- The denominators are 2 and 3.\n- LCM(2, 3) = **6**\n- Convert: 1/2 = 3/6, 1/3 = 2/6\n- Add: 3/6 + 2/6 = **5/6**\n\n## Real-life example\n\nA 50 kg bag of mealie meal is shared between two families. The first family receives 1/3 of the bag. The second family receives 1/2 of the bag. How much of the bag has been shared?\n\n- LCM(3, 2) = 6\n- 1/3 = 2/6, 1/2 = 3/6\n- 2/6 + 3/6 = **5/6**\n\nSo **5/6** of the bag has been shared. The remaining **1/6** of the bag is left over.`,
      activities: `## Activity 1 — Group work (15 minutes)\n\nIn groups of 4, learners complete the following on the chalkboard:\n- 1/4 + 2/4 = ?\n- 1/3 + 1/6 = ?\n- 3/5 − 1/5 = ?\n\n## Activity 2 — Pair work (10 minutes)\n\nPairs work on real-life problems:\n- Two friends share a 25 kg bag of rice. One takes 1/5, the other takes 2/5. How much is left?`,
      examples: `**Example 1:** 2/7 + 3/7 = 5/7 (same denominator)\n\n**Example 2:** 1/4 + 1/8\n- LCM(4, 8) = 8\n- 1/4 = 2/8\n- 2/8 + 1/8 = **3/8**\n\n**Example 3:** 5/9 − 2/9 = 3/9 = **1/3** (simplified)`,
      practice_questions: `1. 1/6 + 2/6 = ?\n2. 1/2 + 1/4 = ?\n3. 3/5 − 1/5 = ?\n4. 2/3 + 1/6 = ?\n5. 7/10 − 3/10 = ?\n\n**Answers:**\n1. 3/6 = 1/2\n2. 3/4\n3. 2/5\n4. 5/6\n5. 4/10 = 2/5`,
      homework: `1. A farmer divides his maize field into 5 equal parts. He plants maize on 2 parts and groundnuts on 1 part. What fraction of the field is planted? What fraction is empty?\n2. 1/3 + 1/4 = ? (show your working)\n3. 5/8 − 1/4 = ? (show your working)\n4. Mrs. Banda has 3/4 litre of cooking oil. She uses 1/3 litre to fry chips. How much oil is left?`,
      summary: `Today we learned how to add and subtract fractions. When the denominators are the same, just add or subtract the numerators. When the denominators are different, first find the lowest common multiple (LCM), convert each fraction, then add or subtract. Always simplify your final answer.`,
      video_links: J(['https://www.youtube.com/watch?v=example-fractions-lesson']),
    },
    'id'
  )

  const matterLesson = await findOrInsert(
    'lessons',
    { title: 'States of Matter', teacher_id: mrChisango },
    {
      title: 'States of Matter', grade: 6,
      subject_id: subjectMap['ISCI'], topic: 'Matter',
      teacher_id: mrChisango, status: 'PUBLISHED',
      objectives: `By the end of this lesson, learners will be able to:
- Define the three states of matter (solid, liquid, gas)
- Give examples of each state from everyday Zambian life
- Describe how matter changes from one state to another
- Explain melting, freezing, evaporation and condensation`,
      notes: `## What is matter?\n\n**Matter** is anything that has mass and takes up space.\n\nThere are **three states of matter**:\n1. **Solid**\n2. **Liquid**\n3. **Gas**\n\n## 1. Solids\n\nA **solid** has a fixed shape and a fixed volume.\n\n**Examples in Zambia:**\n- A piece of chalk\n- A stone from the Luangwa River\n- A mango\n- A copper ingot from the Copperbelt\n\n## 2. Liquids\n\nA **liquid** takes the shape of its container but has a fixed volume.\n\n**Examples in Zambia:**\n- Water from the Zambezi River\n- Cooking oil in a bottle\n- Milk from a local dairy\n\n## 3. Gases\n\nA **gas** has no fixed shape and no fixed volume.\n\n**Examples in Zambia:**\n- The air we breathe\n- Steam from a boiling pot of nshima\n- Smoke from a charcoal fire\n\n## How matter changes state\n\n- **Melting**: Solid → Liquid (ice melting into water)\n- **Freezing**: Liquid → Solid (water turning into ice)\n- **Evaporation**: Liquid → Gas (water boiling → steam)\n- **Condensation**: Gas → Liquid (water droplets on a cold drink)`,
      activities: `## Activity 1 — Class demonstration (15 minutes)\n\nTeacher places an ice cube in a metal dish on the table. Learners observe it melting over 10 minutes.\n\n## Activity 2 — Group sort (10 minutes)\n\nIn groups of 4, learners sort 12 picture cards into three piles: solid, liquid, gas.`,
      examples: `**Example 1 — Ice to water:** When you take an ice cube out of the freezer, it begins to **melt** into water.\n\n**Example 2 — Boiling water:** When you boil water for tea, you can see steam rising. The water is **evaporating**.\n\n**Example 3 — Cold drink droplets:** On a hot day in Lusaka, water droplets form on the outside of a cold Fanta bottle. This is **condensation**.`,
      practice_questions: `1. Name the three states of matter.\n2. Give one example of a solid, a liquid, and a gas from your home.\n3. What is melting?\n4. What happens when water boils?\n5. Why do water droplets form on the outside of a cold glass?`,
      homework: `1. Find 5 things in your home that are solids, 5 that are liquids, and 2 that are gases. Write them in a table.\n2. Explain in your own words why a puddle of water disappears after a sunny day.\n3. Draw the water cycle and label: evaporation, condensation, rain, river.`,
      summary: `Matter is everything around us. It exists in three states: solid, liquid, and gas. Matter can change from one state to another when heat is added or removed. The four main changes are melting, freezing, evaporation, and condensation.`,
    },
    'id'
  )

  const reasoningLesson = await findOrInsert(
    'lessons',
    { title: 'Verbal Reasoning Patterns', teacher_id: mrsSiya },
    {
      title: 'Verbal Reasoning Patterns', grade: 5,
      subject_id: subjectMap['SP1'], topic: 'Verbal Reasoning',
      teacher_id: mrsSiya, status: 'PUBLISHED',
      objectives: `By the end of this lesson, learners will be able to:
- Recognise number patterns and sequences
- Identify letter patterns and relationships
- Solve simple verbal analogies
- Apply logical thinking to solve reasoning problems`,
      notes: `## What is verbal reasoning?\n\n**Verbal reasoning** is using logic and patterns to solve problems. Special Paper 1 in the Zambian Grade 7 examination tests these skills.\n\n## 1. Number patterns\n\nLook at this sequence: **2, 4, 6, 8, ?**\n\nWhat number comes next? Each number goes up by 2. So the next number is **10**.\n\n## 2. Letter patterns\n\nLook at: **A, C, E, G, ?**\n\nThese are letters skipping one each time. The next letter is **I**.\n\n## 3. Analogies\n\n- **Bird is to fly as fish is to ?** — answer is **swim**.\n- **Lusaka is to Zambia as Nairobi is to ?** — answer is **Kenya**.\n\n## 4. Odd one out\n\n- **Mango, Banana, Apple, Carrot** — carrot is the odd one out (it's a vegetable; the others are fruits).`,
      activities: `## Activity 1 — Pattern race (10 minutes)\n\nTeacher writes 5 number patterns on the board. First learner to write the correct next number for each wins a star.\n\n## Activity 2 — Odd one out (10 minutes)\n\nTeacher shows groups of 4 pictures. Learners raise hands to identify the odd one out.`,
      examples: `**Example 1:** 5, 10, 15, 20, ? Answer: 25 (rule: +5 each step).\n\n**Example 2:** A, B, D, G, K, ? Answer: P.\n\n**Example 3:** Hammer is to nail as pen is to ? Answer: paper.\n\n**Example 4:** Dog, Cat, Cow, Eagle — Eagle is the odd one out.`,
      practice_questions: `1. What comes next in 7, 14, 21, 28, ?\n2. What comes next in A, D, G, J, ?\n3. Find the odd one out: Maize, Rice, Cassava, Beef.\n4. Lusaka is to Zambia as Harare is to ?\n5. Hand is to glove as foot is to ?`,
      homework: `1. Continue this sequence for 3 more numbers: 1, 4, 9, 16, ?, ?, ?\n2. Continue this letter sequence for 3 more letters: C, F, I, L, ?, ?, ?\n3. Write your own analogy problem and give it to a classmate to solve.\n4. Find the odd one out and explain why: Telephone, Radio, Television, Bicycle.\n5. Lake is to water as mountain is to ?`,
      summary: `Verbal reasoning helps us solve problems using patterns and logic. We learned about number patterns, letter patterns, analogies, and odd-one-out problems. Remember to look carefully for the rule that connects each item.`,
    },
    'id'
  )

  await findOrInsert(
    'lessons',
    { title: 'The Water Cycle', teacher_id: mrChisango },
    {
      title: 'The Water Cycle', grade: 6,
      subject_id: subjectMap['ISCI'], topic: 'Water Cycle',
      teacher_id: mrChisango, status: 'DRAFT',
      objectives: `By the end of this lesson, learners will be able to:\n- Describe the four main stages of the water cycle\n- Explain why water is never "lost"\n- Identify the water cycle in the Zambian environment`,
      notes: `## The water cycle\n\nThe water cycle is how water moves around the Earth.\n\n(This is a draft lesson — content to be completed by the teacher.)`,
    },
    'id'
  )
  console.log(`✓ 4 lessons`)

  // 6. LESSON ASSIGNMENTS
  await findOrInsert('lesson_assignments', { lesson_id: fractionsLesson.id, class_id: classIds['G7PM-2025'] }, {
    lesson_id: fractionsLesson.id, class_id: classIds['G7PM-2025'],
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }, 'id')
  await findOrInsert('lesson_assignments', { lesson_id: matterLesson.id, class_id: classIds['G6SC-2025'] }, {
    lesson_id: matterLesson.id, class_id: classIds['G6SC-2025'],
    due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  }, 'id')
  await findOrInsert('lesson_assignments', { lesson_id: reasoningLesson.id, class_id: classIds['G5SP1-2025'] }, {
    lesson_id: reasoningLesson.id, class_id: classIds['G5SP1-2025'],
    due_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
  }, 'id')

  // Lesson progress
  await findOrInsert('lesson_progress', { lesson_id: fractionsLesson.id, learner_id: userIds['thabo@eduquest.zm'] }, {
    lesson_id: fractionsLesson.id, learner_id: userIds['thabo@eduquest.zm'],
    completed: true, completed_at: new Date().toISOString(),
  }, 'id')
  await findOrInsert('lesson_progress', { lesson_id: matterLesson.id, learner_id: userIds['lubosi@eduquest.zm'] }, {
    lesson_id: matterLesson.id, learner_id: userIds['lubosi@eduquest.zm'],
    completed: true, completed_at: new Date().toISOString(),
  }, 'id')

  // 7. QUIZZES — find-or-insert by (title, teacher_id) match
  const fractionsQuiz = await findOrInsert(
    'quizzes',
    { title: 'Fractions Quiz', teacher_id: mrsSiya },
    {
      title: 'Fractions Quiz', grade: 7, subject_id: subjectMap['MATH'], topic: 'Fractions',
      description: 'A short quiz on adding and subtracting fractions.',
      difficulty: 'EASY', curriculum: 'ZAMBIAN',
      instructions: 'Answer all 5 questions. Show your working where needed.',
      time_limit: 15, passing_score: 50, max_attempts: 2,
      random_question_order: false, random_answer_order: false, allow_retakes: true,
      show_answers: 'AFTER_SUBMISSION', show_explanations: true,
      score_policy: 'HIGHEST', status: 'PUBLISHED', teacher_id: mrsSiya,
    },
    'id'
  )
  // Re-create questions (delete existing first to avoid duplicates on re-seed)
  await sb.from('quiz_questions').delete().eq('quiz_id', fractionsQuiz.id)
  const fractionsQuestions = [
    { quiz_id: fractionsQuiz.id, type: 'MULTIPLE_CHOICE' as any, question_text: 'What is 1/4 + 2/4?', options: ['A. 3/8', 'B. 3/4', 'C. 2/8', 'D. 3/16'], correct_answer: 'B', mark_allocation: 1, order: 0, explanation: 'When the denominators are the same, add the numerators: (1+2)/4 = 3/4.' },
    { quiz_id: fractionsQuiz.id, type: 'TRUE_FALSE' as any, question_text: 'True or false: To add 1/2 and 1/3, you can simply add the numerators to get 2/5.', correct_answer: false, mark_allocation: 1, order: 1, explanation: 'False. The denominators must be the same before adding.' },
    { quiz_id: fractionsQuiz.id, type: 'FILL_BLANK' as any, question_text: 'A 50 kg bag of mealie meal is shared: 1/3 to one family and 1/2 to another. The total shared is ___/6 of the bag.', accepted_answers: ['5', '5/6'], correct_answer: '5/6', mark_allocation: 1, order: 2, explanation: '1/3 = 2/6 and 1/2 = 3/6, so the total is 5/6.' },
    { quiz_id: fractionsQuiz.id, type: 'NUMERICAL' as any, question_text: 'A pizza is cut into 8 equal slices. If 3 slices are eaten, how many slices are left?', correct_answer: 5, numerical_tolerance: 0, mark_allocation: 1, order: 3, explanation: '8 − 3 = 5 slices are left.' },
    { quiz_id: fractionsQuiz.id, type: 'MATCHING' as any, question_text: 'Match each fraction with its simplified form.', matching_pairs: [{ left: '2/4', right: '1/2' }, { left: '3/9', right: '1/3' }, { left: '4/8', right: '1/2' }, { left: '6/10', right: '3/5' }], correct_answer: { '2/4': '1/2', '3/9': '1/3', '4/8': '1/2', '6/10': '3/5' }, mark_allocation: 2, order: 4, explanation: 'Divide both numerator and denominator by their greatest common factor.' },
  ]
  for (const q of fractionsQuestions) await sb.from('quiz_questions').insert(q)

  const matterQuiz = await findOrInsert(
    'quizzes',
    { title: 'States of Matter Quiz', teacher_id: mrChisango },
    {
      title: 'States of Matter Quiz', grade: 6, subject_id: subjectMap['ISCI'], topic: 'Matter',
      description: 'A quiz on solids, liquids, and gases.',
      difficulty: 'MEDIUM', curriculum: 'ZAMBIAN',
      instructions: 'Answer all 5 questions. Read each one carefully. Time limit: 20 minutes.',
      time_limit: 20, passing_score: 50, max_attempts: 1,
      random_question_order: true, random_answer_order: false, allow_retakes: false,
      show_answers: 'AFTER_SUBMISSION', show_explanations: true,
      score_policy: 'HIGHEST', status: 'PUBLISHED', teacher_id: mrChisango,
    },
    'id'
  )
  await sb.from('quiz_questions').delete().eq('quiz_id', matterQuiz.id)
  const matterQuestions = [
    { quiz_id: matterQuiz.id, type: 'MULTIPLE_CHOICE' as any, question_text: 'Which of the following is a solid?', options: ['A. Water', 'B. Air', 'C. A stone', 'D. Steam'], correct_answer: 'C', mark_allocation: 1, order: 0, explanation: 'A stone is a solid because it has a fixed shape and a fixed volume.' },
    { quiz_id: matterQuiz.id, type: 'TRUE_FALSE' as any, question_text: 'True or false: A liquid takes the shape of its container.', correct_answer: true, mark_allocation: 1, order: 1, explanation: 'True. A liquid has no fixed shape.' },
    { quiz_id: matterQuiz.id, type: 'MULTIPLE_CHOICE' as any, question_text: 'What is the name of the process when a gas turns into a liquid?', options: ['A. Melting', 'B. Freezing', 'C. Evaporation', 'D. Condensation'], correct_answer: 'D', mark_allocation: 1, order: 2, explanation: 'Condensation is when a gas cools down and becomes a liquid.' },
    { quiz_id: matterQuiz.id, type: 'SHORT_ANSWER' as any, question_text: 'In one or two sentences, explain what happens to the particles of water when it boils.', marking_guide: 'The answer should mention: (1) the particles gain heat/energy, (2) they move faster / spread out, (3) they escape from the liquid as a gas (steam/water vapour).', correct_answer: 'When water boils, the particles gain energy, move faster, and escape from the liquid as steam (a gas).', mark_allocation: 3, order: 3, explanation: 'Boiling adds heat energy to the water. The particles move much faster and escape from the surface of the liquid as a gas.' },
    { quiz_id: matterQuiz.id, type: 'NUMERICAL' as any, question_text: 'Water freezes at 0°C. If the temperature outside is -5°C, how many degrees below freezing is it?', correct_answer: 5, numerical_tolerance: 0.5, mark_allocation: 1, order: 4, explanation: '0 − (−5) = 5 degrees below freezing.' },
  ]
  for (const q of matterQuestions) await sb.from('quiz_questions').insert(q)

  const reasoningQuiz = await findOrInsert(
    'quizzes',
    { title: 'Verbal Reasoning Practice', teacher_id: mrsSiya },
    {
      title: 'Verbal Reasoning Practice', grade: 5, subject_id: subjectMap['SP1'], topic: 'Verbal Reasoning',
      description: 'Practice quiz for Special Paper 1 reasoning questions.',
      difficulty: 'EASY', curriculum: 'ZAMBIAN',
      instructions: 'Answer all questions. Look carefully for the pattern in each one.',
      time_limit: 10, passing_score: 60, max_attempts: 0,
      random_question_order: false, random_answer_order: true, allow_retakes: true,
      show_answers: 'AFTER_SUBMISSION', show_explanations: true,
      score_policy: 'LATEST', status: 'DRAFT', teacher_id: mrsSiya,
    },
    'id'
  )
  await sb.from('quiz_questions').delete().eq('quiz_id', reasoningQuiz.id)
  const reasoningQuestions = [
    { quiz_id: reasoningQuiz.id, type: 'NUMERICAL' as any, question_text: 'What number comes next in this sequence: 2, 4, 6, 8, ?', correct_answer: 10, numerical_tolerance: 0, mark_allocation: 1, order: 0, explanation: 'Each number goes up by 2, so the next is 8 + 2 = 10.' },
    { quiz_id: reasoningQuiz.id, type: 'MULTIPLE_CHOICE' as any, question_text: 'Find the odd one out: Maize, Rice, Cassava, Beef.', options: ['A. Maize', 'B. Rice', 'C. Cassava', 'D. Beef'], correct_answer: 'D', mark_allocation: 1, order: 1, explanation: 'Beef is meat from cattle; the others are crops grown in fields.' },
    { quiz_id: reasoningQuiz.id, type: 'FILL_BLANK' as any, question_text: 'Lusaka is to Zambia as Nairobi is to ___', accepted_answers: ['Kenya'], correct_answer: 'Kenya', mark_allocation: 1, order: 2, explanation: 'Lusaka is the capital of Zambia; Nairobi is the capital of Kenya.' },
    { quiz_id: reasoningQuiz.id, type: 'TRUE_FALSE' as any, question_text: 'True or false: In the sequence A, C, E, G, the next letter is I.', correct_answer: true, mark_allocation: 1, order: 3, explanation: 'True. Each letter skips one (A→C skips B; C→E skips D), so after G the next is I.' },
  ]
  for (const q of reasoningQuestions) await sb.from('quiz_questions').insert(q)
  console.log(`✓ 3 quizzes with questions`)

  // 8. QUIZ ASSIGNMENTS
  const fractionsAssignment = await findOrInsert('quiz_assignments', { quiz_id: fractionsQuiz.id, class_id: classIds['G7PM-2025'] }, {
    quiz_id: fractionsQuiz.id, class_id: classIds['G7PM-2025'],
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }, 'id')
  const matterAssignment = await findOrInsert('quiz_assignments', { quiz_id: matterQuiz.id, class_id: classIds['G6SC-2025'] }, {
    quiz_id: matterQuiz.id, class_id: classIds['G6SC-2025'],
    start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  }, 'id')
  console.log(`✓ 2 quiz assignments`)

  // 9. QUIZ ATTEMPTS with auto-marked answers
  await createAttempt(sb, fractionsQuiz.id, userIds['thabo@eduquest.zm'], fractionsAssignment.id, 1, [
    { qOrder: 0, answer: 'B' }, { qOrder: 1, answer: false },
    { qOrder: 2, answer: '5/6' }, { qOrder: 3, answer: 5 },
    { qOrder: 4, answer: { '2/4': '1/2', '3/9': '1/3', '4/8': '1/2', '6/10': '1/2' } },
  ])
  await createAttempt(sb, fractionsQuiz.id, userIds['chipo@eduquest.zm'], fractionsAssignment.id, 1, [
    { qOrder: 0, answer: 'B' }, { qOrder: 1, answer: true },
    { qOrder: 2, answer: '5/6' }, { qOrder: 3, answer: 5 },
    { qOrder: 4, answer: { '2/4': '1/2', '3/9': '1/3', '4/8': '1/2', '6/10': '3/5' } },
  ])
  await createAttempt(sb, matterQuiz.id, userIds['lubosi@eduquest.zm'], matterAssignment.id, 1, [
    { qOrder: 0, answer: 'C' }, { qOrder: 1, answer: true },
    { qOrder: 2, answer: 'D' }, { qOrder: 3, answer: 'When water boils the water turns to steam.' },
    { qOrder: 4, answer: 5 },
  ])
  console.log(`✓ 3 quiz attempts`)

  // 10. NOTIFICATIONS
  const notifTargets = [
    { email: 'thabo@eduquest.zm', type: 'NEW_QUIZ' as any, title: 'New quiz assigned', message: 'Fractions Quiz has been assigned to your class. Due in 7 days.', data: { quiz_title: 'Fractions Quiz' } },
    { email: 'chipo@eduquest.zm', type: 'NEW_QUIZ' as any, title: 'New quiz assigned', message: 'Fractions Quiz has been assigned to your class. Due in 7 days.', data: { quiz_title: 'Fractions Quiz' } },
    { email: 'mrs.siya@eduquest.zm', type: 'SUBMISSION' as any, title: 'New submission', message: 'Thabo Mumba submitted Fractions Quiz.', data: { quiz_title: 'Fractions Quiz', learner_name: 'Thabo Mumba' } },
    { email: 'mrs.siya@eduquest.zm', type: 'SUBMISSION' as any, title: 'New submission', message: 'Chipo Nkhata submitted Fractions Quiz.', data: { quiz_title: 'Fractions Quiz', learner_name: 'Chipo Nkhata' } },
    { email: 'mr.chisango@eduquest.zm', type: 'SUBMISSION' as any, title: 'New submission', message: 'Lubosi Chama submitted States of Matter Quiz.', data: { quiz_title: 'States of Matter Quiz', learner_name: 'Lubosi Chama' } },
    { email: 'admin@eduquest.zm', type: 'SYSTEM' as any, title: 'Platform activity', message: '2 teachers and 6 learners registered this week.', data: {} },
    { email: 'thabo@eduquest.zm', type: 'NEW_LESSON' as any, title: 'New lesson published', message: 'Adding and Subtracting Fractions is now available.', data: { lesson_title: 'Adding and Subtracting Fractions' } },
    { email: 'admin@eduquest.zm', type: 'SYSTEM' as any, title: 'Welcome to EduQuest LMS', message: 'EduQuest LMS is ready. All demo passwords are eduquest123.', data: {} },
  ]
  for (const n of notifTargets) {
    const userId = userIds[n.email]; if (!userId) continue
    await sb.from('notifications').insert({
      user_id: userId, type: n.type, title: n.title, message: n.message, data: n.data,
      school_id: schoolIds['EQS-DEMO'],
    })
  }
  console.log(`✓ ${notifTargets.length} notifications`)

  // 11. BACKFILL school_id on all rows (in case any of the findOrInsert calls
  // above didn't set school_id — happens if the row pre-existed the migration)
  await sb.from('lessons').update({ school_id: demoSchoolId }).is('school_id', null)
  await sb.from('quizzes').update({ school_id: demoSchoolId }).is('school_id', null)
  await sb.from('class_members').update({ /* no school_id on class_members */ }).eq('id', '00000000-0000-0000-0000-000000000000').then(() => {})

  // 12. LIBRARY RESOURCES — past exam papers + worksheets
  // Some are global (school_id = NULL), some are school-specific
  const mrsSiyaId = userIds['mrs.siya@eduquest.zm']
  const mrChisangoId = userIds['mr.chisango@eduquest.zm']
  const superUserId = userIds['admin@eduquest.zm']

  const libraryResources = [
    // Global past exam papers (visible to all schools)
    {
      school_id: null, title: 'ECZ Grade 7 Mathematics Past Paper 2023',
      description: 'Official ECZ Grade 7 Mathematics examination paper from 2023. Includes all sections: numeration, fractions, geometry, and word problems.',
      subject_id: subjectMap['MATH'], grade: 7, year: 2023, paper_type: 'EXAM',
      file_url: 'https://example.com/papers/ecz-g7-math-2023.pdf', file_type: 'pdf', file_size: 1024000,
      uploaded_by_id: superUserId, status: 'PUBLISHED',
    },
    {
      school_id: null, title: 'ECZ Grade 9 Integrated Science Past Paper 2022',
      description: 'Official ECZ Grade 9 Integrated Science paper from 2022. Covers biology, chemistry, and physics fundamentals.',
      subject_id: subjectMap['ISCI'], grade: 9, year: 2022, paper_type: 'EXAM',
      file_url: 'https://example.com/papers/ecz-g9-sci-2022.pdf', file_type: 'pdf', file_size: 856000,
      uploaded_by_id: superUserId, status: 'PUBLISHED',
    },
    {
      school_id: null, title: 'ECZ Grade 12 Biology Past Paper 2021',
      description: 'Official ECZ Grade 12 Biology examination paper from 2021. Covers cells, genetics, ecology, and human biology.',
      subject_id: subjectMap['BIO'], grade: 12, year: 2021, paper_type: 'EXAM',
      file_url: 'https://example.com/papers/ecz-g12-bio-2021.pdf', file_type: 'pdf', file_size: 1240000,
      uploaded_by_id: superUserId, status: 'PUBLISHED',
    },
    {
      school_id: null, title: 'ECZ Grade 7 English Language Past Paper 2023',
      description: 'Official ECZ Grade 7 English paper from 2023. Includes comprehension, composition, and grammar sections.',
      subject_id: subjectMap['ENG'], grade: 7, year: 2023, paper_type: 'EXAM',
      file_url: 'https://example.com/papers/ecz-g7-eng-2023.pdf', file_type: 'pdf', file_size: 712000,
      uploaded_by_id: superUserId, status: 'PUBLISHED',
    },
    // Demo school's own test papers (school_id = demo school)
    {
      school_id: demoSchoolId, title: 'Grade 7 Fractions Mid-Term Test 2025',
      description: 'Mid-term test covering fractions addition, subtraction, and simplification. Aligned with the Grade 7 Zambian curriculum.',
      subject_id: subjectMap['MATH'], grade: 7, year: 2025, paper_type: 'TEST',
      file_url: 'https://example.com/papers/eduquest-g7-fractions-test-2025.pdf', file_type: 'pdf', file_size: 248000,
      uploaded_by_id: mrsSiyaId, status: 'PUBLISHED',
    },
    {
      school_id: demoSchoolId, title: 'Grade 6 States of Matter Worksheet',
      description: 'Worksheet with diagrams and exercises on solids, liquids, and gases. Includes matching, fill-in-the-blank, and short answer questions.',
      subject_id: subjectMap['ISCI'], grade: 6, year: 2025, paper_type: 'WORKSHEET',
      file_url: 'https://example.com/papers/eduquest-g6-matter-worksheet.pdf', file_type: 'pdf', file_size: 184000,
      uploaded_by_id: mrChisangoId, status: 'PUBLISHED',
    },
    {
      school_id: demoSchoolId, title: 'Special Paper 1 Practice Set 2025',
      description: 'Practice set for Grade 5 Special Paper 1 — verbal reasoning, number patterns, and analogies. 50 questions with answer key.',
      subject_id: subjectMap['SP1'], grade: 5, year: 2025, paper_type: 'WORKSHEET',
      file_url: 'https://example.com/papers/eduquest-g5-sp1-practice-2025.pdf', file_type: 'pdf', file_size: 356000,
      uploaded_by_id: mrsSiyaId, status: 'PUBLISHED',
    },
    // Global notes / revision guide
    {
      school_id: null, title: 'Grade 7 ECZ Revision Notes — All Subjects',
      description: 'Comprehensive revision notes covering Mathematics, English, Science, and Social Studies for the Grade 7 ECZ examination.',
      subject_id: null, grade: 7, year: 2024, paper_type: 'NOTES',
      file_url: 'https://example.com/papers/ecz-g7-revision-notes.pdf', file_type: 'pdf', file_size: 2400000,
      uploaded_by_id: superUserId, status: 'PUBLISHED',
    },
  ]

  let libraryCount = 0
  for (const r of libraryResources) {
    // Check if already exists (by title + uploaded_by_id)
    const { data: existing } = await sb.from('library_resources')
      .select('id').eq('title', r.title).maybeSingle()
    if (existing) { libraryCount++; continue }
    const { error } = await sb.from('library_resources').insert(r)
    if (error) {
      console.warn(`  ⚠️  Library insert failed for "${r.title}": ${error.message}`)
    } else {
      libraryCount++
    }
  }
  console.log(`✓ ${libraryCount} library resources`)

  // 13. TEACHER-CLASS ASSIGNMENTS (explicit)
  for (const cd of classDefs) {
    const teacherId = userIds[cd.teacherEmail]
    const classId = classIds[cd.classCode]
    if (!teacherId || !classId) continue
    await sb.from('teacher_class_assignments').upsert({
      teacher_id: teacherId, class_id: classId, school_id: demoSchoolId,
    }, { onConflict: 'teacher_id,class_id' })
  }

  console.log('🌱 Seed complete.')
  return { ok: true, message: 'Seeded successfully' }
}

// ---------------------------------------------------------------------------
async function createAttempt(
  sb: any, quizId: string, learnerId: string, assignmentId: string,
  attemptNumber: number,
  answers: Array<{ qOrder: number; answer: any }>,
) {
  // Don't create duplicate attempts on re-seed
  const { data: existingAttempt } = await sb.from('quiz_attempts')
    .select('id').eq('quiz_id', quizId).eq('learner_id', learnerId).eq('attempt_number', attemptNumber).maybeSingle()
  if (existingAttempt) return

  const { data: questions } = await sb.from('quiz_questions')
    .select('*').eq('quiz_id', quizId).order('order', { ascending: true })
  if (!questions || questions.length === 0) return

  const { data: attempt } = await sb.from('quiz_attempts').insert({
    quiz_id: quizId, learner_id: learnerId, assignment_id: assignmentId,
    attempt_number: attemptNumber, status: 'SUBMITTED',
    started_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    submitted_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    time_spent: 600 + Math.floor(Math.random() * 600),
  }).select().single()
  if (!attempt) return

  let totalScore = 0, maxScore = 0
  for (const ans of answers) {
    const q = questions[ans.qOrder]; if (!q) continue
    const maxMarks = q.mark_allocation || 1; maxScore += maxMarks
    let isCorrect = false, marksAwarded = 0, aiResult: any = null
    if (q.type === 'SHORT_ANSWER') {
      const r = heuristicMark(q.marking_guide || '', String(ans.answer ?? ''), maxMarks)
      isCorrect = r.isCorrect; marksAwarded = r.marksAwarded
      aiResult = { feedback: r.feedback, partial: r.partial, source: 'heuristic' }
    } else {
      const r = markObjectiveInline(q, ans.answer)
      isCorrect = r.isCorrect; marksAwarded = r.marksAwarded
    }
    totalScore += marksAwarded
    await sb.from('quiz_answers').insert({
      attempt_id: attempt.id, question_id: q.id,
      learner_answer: ans.answer,
      is_correct: isCorrect, marks_awarded: marksAwarded,
      ai_marking_result: aiResult, graded_at: new Date().toISOString(),
    })
  }

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0
  const grade = computeGradeLetter(percentage)
  await sb.from('quiz_attempts').update({
    score: totalScore, max_score: maxScore, percentage,
    grade, passed: percentage >= 50,
  }).eq('id', attempt.id)
}

function computeGradeLetter(p: number): string {
  if (p >= 80) return 'A'
  if (p >= 70) return 'B'
  if (p >= 60) return 'C'
  if (p >= 50) return 'D'
  return 'F'
}

function markObjectiveInline(q: any, learnerAnswer: any) {
  const maxMarks = q.mark_allocation || 1
  switch (q.type) {
    case 'MULTIPLE_CHOICE': {
      const correct = String(q.correct_answer ?? '').trim().toUpperCase()
      const given = String(learnerAnswer ?? '').trim().toUpperCase()
      const ok = correct !== '' && given === correct
      return { isCorrect: ok, marksAwarded: ok ? maxMarks : 0 }
    }
    case 'TRUE_FALSE': {
      const toBool = (v: any) => {
        if (v === true || v === 'true' || v === 1 || v === '1') return true
        if (v === false || v === 'false' || v === 0 || v === '0') return false
        return null
      }
      const c = toBool(q.correct_answer), g = toBool(learnerAnswer)
      if (g === null) return { isCorrect: false, marksAwarded: 0 }
      const ok = c === g
      return { isCorrect: ok, marksAwarded: ok ? maxMarks : 0 }
    }
    case 'NUMERICAL': {
      if (learnerAnswer === '' || learnerAnswer === null || learnerAnswer === undefined) return { isCorrect: false, marksAwarded: 0 }
      const c = Number(q.correct_answer), g = Number(learnerAnswer)
      if (Number.isNaN(c) || Number.isNaN(g)) return { isCorrect: false, marksAwarded: 0 }
      const tol = q.numerical_tolerance ?? 0.01
      const ok = Math.abs(c - g) <= Math.abs(tol)
      return { isCorrect: ok, marksAwarded: ok ? maxMarks : 0 }
    }
    case 'FILL_BLANK': {
      const norm = (s: string) => String(s).trim().toLowerCase().replace(/[.,!?;:'"\-_/\\()]/g, '').replace(/\s+/g, ' ')
      const accepted = (q.accepted_answers ?? (Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer]))
        .map((a: any) => norm(String(a))).filter(Boolean)
      const given = norm(String(learnerAnswer ?? ''))
      if (!given) return { isCorrect: false, marksAwarded: 0 }
      const ok = accepted.includes(given)
      return { isCorrect: ok, marksAwarded: ok ? maxMarks : 0 }
    }
    case 'MATCHING': {
      const correct = q.correct_answer ?? {}, given = learnerAnswer ?? {}
      const keys = Object.keys(correct)
      if (keys.length === 0) return { isCorrect: false, marksAwarded: 0 }
      let correctCount = 0
      const norm = (s: string) => String(s).trim().toLowerCase().replace(/[.,!?;:'"\-_/\\()]/g, '').replace(/\s+/g, ' ')
      for (const k of keys) {
        if (norm(String(correct[k])) === norm(String(given[k] ?? ''))) correctCount++
      }
      const marks = (correctCount / keys.length) * maxMarks
      return { isCorrect: correctCount === keys.length, marksAwarded: Math.round(marks * 100) / 100 }
    }
    case 'SHORT_ANSWER': {
      const r = heuristicMark(q.marking_guide ?? '', String(learnerAnswer ?? ''), maxMarks)
      return { isCorrect: r.isCorrect, marksAwarded: r.marksAwarded }
    }
    default: return { isCorrect: false, marksAwarded: 0 }
  }
}

function heuristicMark(markingGuide: string, learnerAnswer: string, maxMarks: number) {
  const answer = learnerAnswer.toLowerCase()
  if (!answer.trim()) return { isCorrect: false, marksAwarded: 0, feedback: 'No answer provided.', partial: false }
  const keywords = markingGuide.toLowerCase().split(/[^a-z0-9]+/i).filter((w) => w.length > 3)
  if (keywords.length === 0) return { isCorrect: answer.trim().length > 0, marksAwarded: answer.trim().length > 0 ? maxMarks : 0, feedback: 'Marked on length only.', partial: false }
  const matched = keywords.filter((k) => answer.includes(k)).length
  const ratio = matched / keywords.length
  const marksAwarded = Math.round(ratio * maxMarks)
  return {
    isCorrect: ratio >= 0.8, marksAwarded,
    feedback: ratio >= 0.8 ? 'Good answer — covers the main points.' : ratio >= 0.4 ? 'Partially correct.' : 'Key points missing.',
    partial: marksAwarded > 0 && marksAwarded < maxMarks,
  }
}

if (require.main === module) {
  runSupabaseSeed()
    .then((r) => { console.log(r); process.exit(0) })
    .catch((e) => { console.error(e); process.exit(1) })
}
