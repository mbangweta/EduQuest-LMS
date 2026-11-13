import bcrypt from 'bcryptjs'
import { db } from './db'
import { hashPassword } from './auth'

// EduQuest LMS — Seed data with realistic Zambian sample content
// Run via /api/seed (admin-only) or npm script

const PASSWORD = 'eduquest123'

// ---------------------------------------------------------------------------
// JSON helpers (Prisma SQLite uses String for JSON)
// ---------------------------------------------------------------------------
const J = (v: any) => JSON.stringify(v)

// ---------------------------------------------------------------------------
// SEED DATA DEFINITIONS
// ---------------------------------------------------------------------------
const SUBJECTS = [
  { code: 'MATH', name: 'Mathematics', description: 'Numbers, Algebra, Geometry, Statistics', color: '#2563eb' },
  { code: 'ISCI', name: 'Integrated Science', description: 'Science for Grades 5–7', color: '#16a34a' },
  { code: 'SCI', name: 'Science', description: 'Science for Grades 8–9', color: '#16a34a' },
  { code: 'ENG', name: 'English Language', description: 'Grammar, Composition, Comprehension', color: '#dc2626' },
  { code: 'SOC', name: 'Social Studies', description: 'History, Geography, Civics', color: '#ca8a04' },
  { code: 'CIN', name: 'Cinyanja', description: 'Local language studies', color: '#9333ea' },
  { code: 'SP1', name: 'Special Paper 1', description: 'Reasoning + Verbal + Math reasoning', color: '#0891b2' },
  { code: 'SP2', name: 'Special Paper 2', description: 'General knowledge + spatial reasoning', color: '#0e7490' },
  { code: 'CIV', name: 'Civic Education', description: 'Citizenship and governance', color: '#7c3aed' },
  { code: 'BIO', name: 'Biology', description: 'Grades 10–12 Biology', color: '#16a34a' },
  { code: 'CHEM', name: 'Chemistry', description: 'Grades 10–12 Chemistry', color: '#0d9488' },
  { code: 'PHY', name: 'Physics', description: 'Grades 10–12 Physics', color: '#1d4ed8' },
]

const USERS: Array<{
  email: string
  name: string
  role: 'ADMIN' | 'TEACHER' | 'LEARNER'
  phone?: string
  grade?: number
  color?: string
}> = [
  { email: 'admin@eduquest.zm', name: 'Bwalya Phiri', role: 'ADMIN', phone: '+260971000001', color: '#dc2626' },
  { email: 'mrs.siya@eduquest.zm', name: 'Mrs. Siya Mwansa', role: 'TEACHER', phone: '+260971000002', color: '#2563eb' },
  { email: 'mr.chisango@eduquest.zm', name: 'Mr. Chisango Banda', role: 'TEACHER', phone: '+260971000003', color: '#16a34a' },
  { email: 'thabo@eduquest.zm', name: 'Thabo Mumba', role: 'LEARNER', grade: 7, phone: '+260977000001', color: '#0891b2' },
  { email: 'chipo@eduquest.zm', name: 'Chipo Nkhata', role: 'LEARNER', grade: 7, phone: '+260977000002', color: '#7c3aed' },
  { email: 'lubosi@eduquest.zm', name: 'Lubosi Chama', role: 'LEARNER', grade: 6, phone: '+260977000003', color: '#ca8a04' },
  { email: 'natasha@eduquest.zm', name: 'Natasha Tembo', role: 'LEARNER', grade: 5, phone: '+260977000004', color: '#dc2626' },
  { email: 'kabwe@eduquest.zm', name: 'Kabwe Mulenga', role: 'LEARNER', grade: 8, phone: '+260977000005', color: '#0d9488' },
  { email: 'mutale@eduquest.zm', name: 'Mutale Phiri', role: 'LEARNER', grade: 9, phone: '+260977000006', color: '#1d4ed8' },
]

// ---------------------------------------------------------------------------
// MAIN SEED
// ---------------------------------------------------------------------------
export async function runSeed() {
  console.log('🌱 Seeding EduQuest LMS...')
  const existing = await db.user.count()
  if (existing > 0) {
    console.log(`Already seeded (${existing} users). Skipping.`)
    return { skipped: true, message: 'Already seeded' }
  }

  // 1. SUBJECTS
  for (const s of SUBJECTS) {
    await db.subject.create({ data: { code: s.code, name: s.name, description: s.description, color: s.color } })
  }
  console.log(`✓ ${SUBJECTS.length} subjects`)

  // 2. USERS
  const passwordHash = await hashPassword(PASSWORD)
  const userMap: Record<string, string> = {}
  for (const u of USERS) {
    const created = await db.user.create({
      data: {
        email: u.email,
        password: passwordHash,
        name: u.name,
        role: u.role,
        phone: u.phone,
        grade: u.grade,
        status: 'ACTIVE',
        avatarColor: u.color,
      },
    })
    userMap[u.email] = created.id
  }
  console.log(`✓ ${USERS.length} users`)

  // 3. CLASSES
  const mathSub = await db.subject.findUnique({ where: { code: 'MATH' } })
  const sciSub = await db.subject.findUnique({ where: { code: 'ISCI' } })
  const sp1Sub = await db.subject.findUnique({ where: { code: 'SP1' } })

  const classG7PM = await db.class.create({
    data: {
      name: 'Grade 7 Purple Mathematics',
      grade: 7,
      subjectId: mathSub!.id,
      description: 'Grade 7 Mathematics — Purple stream. Covers ECZ syllabus.',
      classCode: 'G7PM-2025',
      teacherId: userMap['mrs.siya@eduquest.zm'],
    },
  })
  const classG6SC = await db.class.create({
    data: {
      name: 'Grade 6 Science',
      grade: 6,
      subjectId: sciSub!.id,
      description: 'Grade 6 Integrated Science following the Zambian curriculum.',
      classCode: 'G6SC-2025',
      teacherId: userMap['mr.chisango@eduquest.zm'],
    },
  })
  const classG5SP1 = await db.class.create({
    data: {
      name: 'Grade 5 Special Paper 1',
      grade: 5,
      subjectId: sp1Sub!.id,
      description: 'Grade 5 Special Paper 1 — reasoning, verbal, and math reasoning.',
      classCode: 'G5SP1-2025',
      teacherId: userMap['mrs.siya@eduquest.zm'],
    },
  })
  console.log(`✓ 3 classes`)

  // 4. CLASS MEMBERSHIPS
  await db.classMember.createMany({
    data: [
      { classId: classG7PM.id, learnerId: userMap['thabo@eduquest.zm'] },
      { classId: classG7PM.id, learnerId: userMap['chipo@eduquest.zm'] },
      { classId: classG6SC.id, learnerId: userMap['lubosi@eduquest.zm'] },
      { classId: classG6SC.id, learnerId: userMap['kabwe@eduquest.zm'] },
      { classId: classG5SP1.id, learnerId: userMap['natasha@eduquest.zm'] },
      { classId: classG5SP1.id, learnerId: userMap['mutale@eduquest.zm'] },
    ],
  })
  console.log(`✓ 6 class memberships`)

  // 5. LESSONS
  const lessonFractions = await db.lesson.create({
    data: {
      title: 'Adding and Subtracting Fractions',
      grade: 7,
      subjectId: mathSub!.id,
      topic: 'Fractions',
      teacherId: userMap['mrs.siya@eduquest.zm'],
      status: 'PUBLISHED',
      objectives: `By the end of this lesson, learners will be able to:
- Add fractions with the same denominator
- Add fractions with different denominators by finding the lowest common multiple (LCM)
- Subtract fractions with the same and different denominators
- Apply fractions to real-life Zambian problems (sharing a bag of mealie meal, dividing a field for planting)`,
      notes: `## Introduction

In Grade 6, you learned that a **fraction** shows a part of a whole. For example, when you cut an orange into 4 equal pieces and take 1, you have **1/4** of the orange.

In Grade 7, we learn how to **add** and **subtract** fractions.

## Adding fractions with the same denominator

When two fractions have the **same denominator** (the bottom number), you simply add the top numbers (numerators) and keep the denominator the same.

**Example:** 1/5 + 2/5 = (1+2)/5 = **3/5**

The denominator stays at 5 because both fractions are cut into 5 equal pieces.

## Adding fractions with different denominators

When the denominators are different, we must first find a **common denominator**. The easiest way is to find the **Lowest Common Multiple (LCM)** of the two denominators.

**Example:** 1/2 + 1/3

- The denominators are 2 and 3.
- LCM(2, 3) = **6** (the smallest number both 2 and 3 divide into).
- Convert: 1/2 = 3/6 (multiply top and bottom by 3)
- Convert: 1/3 = 2/6 (multiply top and bottom by 2)
- Add: 3/6 + 2/6 = **5/6**

## Subtracting fractions

Subtracting works the same way. When the denominators match, subtract the numerators.

**Example:** 5/8 − 2/8 = (5−2)/8 = **3/8**

When the denominators are different, find the LCM first, just like addition.

## Real-life example

A 50 kg bag of mealie meal is shared between two families. The first family receives 1/3 of the bag. The second family receives 1/2 of the bag. How much of the bag has been shared?

- LCM(3, 2) = 6
- 1/3 = 2/6, 1/2 = 3/6
- 2/6 + 3/6 = **5/6**

So **5/6** of the bag has been shared. The remaining **1/6** of the bag is left over.

## Key rules to remember

1. Same denominator → add or subtract the numerators, keep the denominator.
2. Different denominators → find the LCM, convert each fraction, then add or subtract.
3. Always simplify your final answer if possible (e.g., 2/4 = 1/2).`,
      activities: `## Activity 1 — Group work (15 minutes)

In groups of 4, learners complete the following on the chalkboard:
- 1/4 + 2/4 = ?
- 1/3 + 1/6 = ?
- 3/5 − 1/5 = ?

## Activity 2 — Pair work (10 minutes)

Pairs work on real-life problems:
- Two friends share a 25 kg bag of rice. One takes 1/5, the other takes 2/5. How much is left?

## Activity 3 — Class game (10 minutes)

Teacher writes fractions on the board; learners race to add them. The first correct answer wins a star.`,
      examples: `**Example 1:** 2/7 + 3/7 = 5/7 (same denominator)

**Example 2:** 1/4 + 1/8
- LCM(4, 8) = 8
- 1/4 = 2/8
- 2/8 + 1/8 = **3/8**

**Example 3:** 5/9 − 2/9 = 3/9 = **1/3** (simplified)`,
      practiceQuestions: `1. 1/6 + 2/6 = ?
2. 1/2 + 1/4 = ?
3. 3/5 − 1/5 = ?
4. 2/3 + 1/6 = ?
5. 7/10 − 3/10 = ?

**Answers:**
1. 3/6 = 1/2
2. 3/4
3. 2/5
4. 5/6
5. 4/10 = 2/5`,
      homework: `1. A farmer divides his maize field into 5 equal parts. He plants maize on 2 parts and groundnuts on 1 part. What fraction of the field is planted? What fraction is empty?
2. 1/3 + 1/4 = ? (show your working)
3. 5/8 − 1/4 = ? (show your working)
4. Mrs. Banda has 3/4 litre of cooking oil. She uses 1/3 litre to fry chips. How much oil is left?`,
      summary: `Today we learned how to add and subtract fractions. When the denominators are the same, just add or subtract the numerators. When the denominators are different, first find the lowest common multiple (LCM), convert each fraction, then add or subtract. Always simplify your final answer. Practice with the homework questions for next lesson.`,
      videoLinks: J(['https://www.youtube.com/watch?v=example-fractions-lesson']),
    },
  })

  const lessonMatter = await db.lesson.create({
    data: {
      title: 'States of Matter',
      grade: 6,
      subjectId: sciSub!.id,
      topic: 'Matter',
      teacherId: userMap['mr.chisango@eduquest.zm'],
      status: 'PUBLISHED',
      objectives: `By the end of this lesson, learners will be able to:
- Define the three states of matter (solid, liquid, gas)
- Give examples of each state from everyday Zambian life
- Describe how matter changes from one state to another
- Explain melting, freezing, evaporation and condensation`,
      notes: `## What is matter?

**Matter** is anything that has mass and takes up space. Everything around you — your chair, your book, the water you drink, the air you breathe — is made of matter.

There are **three states of matter**:
1. **Solid**
2. **Liquid**
3. **Gas**

## 1. Solids

A **solid** has a fixed shape and a fixed volume. The particles in a solid are packed tightly together and can only vibrate.

**Examples in Zambia:**
- A piece of chalk
- A stone from the Luangwa River
- A mango
- A copper ingot from the Copperbelt

## 2. Liquids

A **liquid** takes the shape of its container but has a fixed volume. The particles are close together but can move past each other.

**Examples in Zambia:**
- Water from the Zambezi River
- Cooking oil in a bottle
- Milk from a local dairy
- Chibuku beer (traditional drink)

## 3. Gases

A **gas** has no fixed shape and no fixed volume. It fills any container it is put in. The particles move freely and quickly.

**Examples in Zambia:**
- The air we breathe (contains oxygen, nitrogen, and other gases)
- Steam from a boiling pot of nshima
- Smoke from a charcoal fire (braai)
- Carbon dioxide from a Fanta bottle

## How matter changes state

Matter can change from one state to another when heat is added or removed:

- **Melting**: Solid → Liquid (e.g., ice melting into water)
- **Freezing**: Liquid → Solid (e.g., water turning into ice in a freezer)
- **Evaporation**: Liquid → Gas (e.g., water boiling and turning into steam)
- **Condensation**: Gas → Liquid (e.g., water droplets on the outside of a cold drink)

## The water cycle

The water we drink today may have been drunk by a dinosaur! The same water keeps moving around the Earth in the **water cycle**:
1. The sun heats water in lakes and rivers (Zambezi, Kariba).
2. Water **evaporates** into the air as water vapour.
3. The vapour **condenses** into clouds.
4. Clouds become heavy and water falls as **rain**.
5. Rain flows back into rivers and lakes.

## Key vocabulary

- **Solid** — fixed shape and volume
- **Liquid** — takes shape of container, fixed volume
- **Gas** — fills any container, no fixed shape or volume
- **Melting** — solid to liquid
- **Freezing** — liquid to solid
- **Evaporation** — liquid to gas
- **Condensation** — gas to liquid`,
      activities: `## Activity 1 — Class demonstration (15 minutes)

Teacher places an ice cube in a metal dish on the table. Learners observe it melting over 10 minutes. Discuss what is happening.

## Activity 2 — Group sort (10 minutes)

In groups of 4, learners sort 12 picture cards into three piles: solid, liquid, gas. Each group reports their answers to the class.

## Activity 3 — Outdoor observation (10 minutes)

Class goes outside to find 3 examples of each state of matter around the school.`,
      examples: `**Example 1 — Ice to water:** When you take an ice cube out of the freezer, it begins to **melt** into water. Heat from the room is added to the solid ice.

**Example 2 — Boiling water:** When you boil water for tea, you can see steam rising. The water is **evaporating** into water vapour (a gas).

**Example 3 — Cold drink droplets:** On a hot day in Lusaka, water droplets form on the outside of a cold Fanta bottle. This is **condensation** — water vapour in the air is cooling and turning back into liquid water.`,
      practiceQuestions: `1. Name the three states of matter.
2. Give one example of a solid, a liquid, and a gas from your home.
3. What is melting?
4. What happens when water boils?
5. Why do water droplets form on the outside of a cold glass?

**Answers:**
1. Solid, liquid, gas
2. Solid: stone; Liquid: water; Gas: air (many correct answers)
3. Solid changing to liquid due to heat
4. It evaporates into steam (gas)
5. Water vapour in the air condenses on the cold surface.`,
      homework: `1. Find 5 things in your home that are solids, 5 that are liquids, and 2 that are gases. Write them in a table.
2. Explain in your own words why a puddle of water disappears after a sunny day.
3. Draw the water cycle and label: evaporation, condensation, rain, river.`,
      summary: `Matter is everything around us. It exists in three states: solid, liquid, and gas. Matter can change from one state to another when heat is added or removed. The four main changes are melting (solid→liquid), freezing (liquid→solid), evaporation (liquid→gas) and condensation (gas→liquid). The water cycle is a real-life example of these changes happening every day.`,
    },
  })

  const lessonReasoning = await db.lesson.create({
    data: {
      title: 'Verbal Reasoning Patterns',
      grade: 5,
      subjectId: sp1Sub!.id,
      topic: 'Verbal Reasoning',
      teacherId: userMap['mrs.siya@eduquest.zm'],
      status: 'PUBLISHED',
      objectives: `By the end of this lesson, learners will be able to:
- Recognise number patterns and sequences
- Identify letter patterns and relationships
- Solve simple verbal analogies
- Apply logical thinking to solve reasoning problems`,
      notes: `## What is verbal reasoning?

**Verbal reasoning** is using logic and patterns to solve problems. It helps you think clearly and answer questions quickly. Special Paper 1 in the Zambian Grade 7 examination tests these skills.

## 1. Number patterns

Look at this sequence of numbers: **2, 4, 6, 8, ?**

What number comes next? You can see each number goes up by 2. So the next number is **10**.

**Rules for number patterns:**
- **Adding**: 3, 6, 9, 12, ? — each step adds 3. Answer: 15.
- **Subtracting**: 20, 17, 14, 11, ? — each step subtracts 3. Answer: 8.
- **Multiplying**: 2, 4, 8, 16, ? — each step doubles. Answer: 32.
- **Squaring**: 1, 4, 9, 16, ? — these are square numbers (1², 2², 3², 4²). Answer: 25.

## 2. Letter patterns

Look at: **A, C, E, G, ?**

These are letters skipping one each time (A → C, skip B). The next letter is **I**.

**Another example:** **B, D, F, H, ?** — answer is **J**.

## 3. Analogies

An analogy shows how two things are related. For example:
- **Bird is to fly as fish is to ?** — answer is **swim**.
- **Doctor is to hospital as teacher is to ?** — answer is **school**.
- **Lusaka is to Zambia as Nairobi is to ?** — answer is **Kenya**.

Think about the **relationship** between the first pair, then apply it to the second.

## 4. Odd one out

Find the one that does not belong:
- **Mango, Banana, Apple, Carrot** — carrot is the odd one out (it's a vegetable; the others are fruits).
- **Lusaka, Ndola, Kitwe, Kariba** — Kariba is the odd one out (it's in Zimbabwe; the others are in Zambia).

## Tips for solving reasoning problems

1. Read the question carefully — twice!
2. Look for a pattern or rule.
3. Try the rule on each item in the question.
4. Check your answer against the rule.`,
      activities: `## Activity 1 — Pattern race (10 minutes)

Teacher writes 5 number patterns on the board. First learner to write the correct next number for each wins a star.

## Activity 2 — Letter sequence pairs (10 minutes)

Learners work in pairs to complete 10 letter patterns on a worksheet.

## Activity 3 — Odd one out (10 minutes)

Teacher shows groups of 4 pictures. Learners raise hands to identify the odd one out and explain why.`,
      examples: `**Example 1 — Number pattern:** 5, 10, 15, 20, ? Answer: 25 (rule: +5 each step).

**Example 2 — Letter pattern:** A, B, D, G, K, ? Answer: P (the gap grows by 1 each time: +1, +2, +3, +4, +5).

**Example 3 — Analogy:** Hammer is to nail as pen is to ? Answer: paper.

**Example 4 — Odd one out:** Dog, Cat, Cow, Eagle — Eagle is the odd one out (the others are mammals).`,
      practiceQuestions: `1. What comes next in 7, 14, 21, 28, ??
2. What comes next in A, D, G, J, ?
3. Find the odd one out: Maize, Rice, Cassava, Beef.
4. Lusaka is to Zambia as Harare is to ?
5. Hand is to glove as foot is to ?

**Answers:**
1. 35 (rule: +7)
2. M (rule: +3 letters)
3. Beef (the others are crops; beef is meat)
4. Zimbabwe
5. Shoe`,
      homework: `1. Continue this sequence for 3 more numbers: 1, 4, 9, 16, ?, ?, ?
2. Continue this letter sequence for 3 more letters: C, F, I, L, ?, ?, ?
3. Write your own analogy problem and give it to a classmate to solve.
4. Find the odd one out and explain why: Telephone, Radio, Television, Bicycle.
5. Lake is to water as mountain is to ?`,
      summary: `Verbal reasoning helps us solve problems using patterns and logic. We learned about number patterns, letter patterns, analogies, and odd-one-out problems. Remember to look carefully for the rule that connects each item, then apply that rule to find the answer. Practice these skills every day to do well in Special Paper 1.`,
    },
  })

  const lessonWaterCycle = await db.lesson.create({
    data: {
      title: 'The Water Cycle',
      grade: 6,
      subjectId: sciSub!.id,
      topic: 'Water Cycle',
      teacherId: userMap['mr.chisango@eduquest.zm'],
      status: 'DRAFT',
      objectives: `By the end of this lesson, learners will be able to:
- Describe the four main stages of the water cycle
- Explain why water is never "lost"
- Identify the water cycle in the Zambian environment`,
      notes: `## The water cycle

The water cycle is how water moves around the Earth. It has four main stages...

(This is a draft lesson — content to be completed by the teacher.)`,
      activities: '',
      examples: '',
      practiceQuestions: '',
      homework: '',
      summary: '',
    },
  })
  console.log(`✓ 4 lessons`)

  // 6. LESSON ASSIGNMENTS
  await db.lessonAssignment.create({
    data: { lessonId: lessonFractions.id, classId: classG7PM.id, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  })
  await db.lessonAssignment.create({
    data: { lessonId: lessonMatter.id, classId: classG6SC.id, dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
  })
  await db.lessonAssignment.create({
    data: { lessonId: lessonReasoning.id, classId: classG5SP1.id, dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) },
  })

  // Mark lessons completed for some learners
  await db.lessonProgress.create({ data: { lessonId: lessonFractions.id, learnerId: userMap['thabo@eduquest.zm'], completed: true, completedAt: new Date() } })
  await db.lessonProgress.create({ data: { lessonId: lessonMatter.id, learnerId: userMap['lubosi@eduquest.zm'], completed: true, completedAt: new Date() } })

  // 7. QUIZZES
  const quizFractions = await db.quiz.create({
    data: {
      title: 'Fractions Quiz',
      grade: 7,
      subjectId: mathSub!.id,
      topic: 'Fractions',
      description: 'A short quiz on adding and subtracting fractions.',
      difficulty: 'EASY',
      curriculum: 'ZAMBIAN',
      instructions: 'Answer all 5 questions. Show your working where needed. The quiz has no time limit but should take about 15 minutes.',
      timeLimit: 15,
      passingScore: 50,
      maxAttempts: 2,
      randomQuestionOrder: false,
      randomAnswerOrder: false,
      allowRetakes: true,
      showAnswers: 'AFTER_SUBMISSION',
      showExplanations: true,
      scorePolicy: 'HIGHEST',
      status: 'PUBLISHED',
      teacherId: userMap['mrs.siya@eduquest.zm'],
    },
  })

  const quizQuestionsFractions = [
    {
      type: 'MULTIPLE_CHOICE',
      questionText: 'What is 1/4 + 2/4?',
      optionsJson: J(['A. 3/8', 'B. 3/4', 'C. 2/8', 'D. 3/16']),
      correctAnswerJson: J('B'),
      markAllocation: 1,
      explanation: 'When the denominators are the same, add the numerators and keep the denominator: (1+2)/4 = 3/4.',
      order: 0,
    },
    {
      type: 'TRUE_FALSE',
      questionText: 'True or false: To add 1/2 and 1/3, you can simply add the numerators to get 2/5.',
      correctAnswerJson: J(false),
      markAllocation: 1,
      explanation: 'False. The denominators must be the same before adding. You must first find the lowest common multiple (LCM) of 2 and 3, which is 6.',
      order: 1,
    },
    {
      type: 'FILL_BLANK',
      questionText: 'A 50 kg bag of mealie meal is shared: 1/3 to one family and 1/2 to another. The total shared is ___/6 of the bag.',
      acceptedAnswersJson: J(['5', '5/6']),
      correctAnswerJson: J('5/6'),
      markAllocation: 1,
      explanation: '1/3 = 2/6 and 1/2 = 3/6, so the total is 2/6 + 3/6 = 5/6.',
      order: 2,
    },
    {
      type: 'NUMERICAL',
      questionText: 'A pizza is cut into 8 equal slices. If 3 slices are eaten, how many slices are left?',
      correctAnswerJson: J(5),
      numericalTolerance: 0,
      markAllocation: 1,
      explanation: '8 − 3 = 5 slices are left.',
      order: 3,
    },
    {
      type: 'MATCHING',
      questionText: 'Match each fraction with its simplified form.',
      matchingPairsJson: J([
        { left: '2/4', right: '1/2' },
        { left: '3/9', right: '1/3' },
        { left: '4/8', right: '1/2' },
        { left: '6/10', right: '3/5' },
      ]),
      correctAnswerJson: J({
        '2/4': '1/2',
        '3/9': '1/3',
        '4/8': '1/2',
        '6/10': '3/5',
      }),
      markAllocation: 2,
      explanation: 'Divide both the numerator and denominator by their greatest common factor to simplify.',
      order: 4,
    },
  ]
  for (const q of quizQuestionsFractions) {
    await db.quizQuestion.create({ data: { quizId: quizFractions.id, ...q } })
  }

  const quizMatter = await db.quiz.create({
    data: {
      title: 'States of Matter Quiz',
      grade: 6,
      subjectId: sciSub!.id,
      topic: 'Matter',
      description: 'A quiz on solids, liquids, and gases.',
      difficulty: 'MEDIUM',
      curriculum: 'ZAMBIAN',
      instructions: 'Answer all 5 questions. Read each one carefully. Time limit: 20 minutes.',
      timeLimit: 20,
      passingScore: 50,
      maxAttempts: 1,
      randomQuestionOrder: true,
      randomAnswerOrder: false,
      allowRetakes: false,
      showAnswers: 'AFTER_SUBMISSION',
      showExplanations: true,
      scorePolicy: 'HIGHEST',
      status: 'PUBLISHED',
      teacherId: userMap['mr.chisango@eduquest.zm'],
    },
  })

  const quizQuestionsMatter = [
    {
      type: 'MULTIPLE_CHOICE',
      questionText: 'Which of the following is a solid?',
      optionsJson: J(['A. Water', 'B. Air', 'C. A stone', 'D. Steam']),
      correctAnswerJson: J('C'),
      markAllocation: 1,
      explanation: 'A stone is a solid because it has a fixed shape and a fixed volume.',
      order: 0,
    },
    {
      type: 'TRUE_FALSE',
      questionText: 'True or false: A liquid takes the shape of its container.',
      correctAnswerJson: J(true),
      markAllocation: 1,
      explanation: 'True. A liquid has no fixed shape — it flows to fill the bottom of any container it is in.',
      order: 1,
    },
    {
      type: 'MULTIPLE_CHOICE',
      questionText: 'What is the name of the process when a gas turns into a liquid?',
      optionsJson: J(['A. Melting', 'B. Freezing', 'C. Evaporation', 'D. Condensation']),
      correctAnswerJson: J('D'),
      markAllocation: 1,
      explanation: 'Condensation is when a gas (water vapour) cools down and becomes a liquid (water droplets).',
      order: 2,
    },
    {
      type: 'SHORT_ANSWER',
      questionText: 'In one or two sentences, explain what happens to the particles of water when it boils.',
      markingGuide: 'The answer should mention: (1) the particles gain heat/energy, (2) they move faster / spread out, (3) they escape from the liquid as a gas (steam/water vapour).',
      correctAnswerJson: J('When water boils, the particles gain energy, move faster, and escape from the liquid as steam (a gas).'),
      markAllocation: 3,
      explanation: 'Boiling adds heat energy to the water. The particles move much faster and escape from the surface of the liquid as a gas.',
      order: 3,
    },
    {
      type: 'NUMERICAL',
      questionText: 'Water freezes at 0°C. If the temperature outside is -5°C, how many degrees below freezing is it?',
      correctAnswerJson: J(5),
      numericalTolerance: 0.5,
      markAllocation: 1,
      explanation: '0 − (−5) = 5 degrees below freezing.',
      order: 4,
    },
  ]
  for (const q of quizQuestionsMatter) {
    await db.quizQuestion.create({ data: { quizId: quizMatter.id, ...q } })
  }

  const quizReasoning = await db.quiz.create({
    data: {
      title: 'Verbal Reasoning Practice',
      grade: 5,
      subjectId: sp1Sub!.id,
      topic: 'Verbal Reasoning',
      description: 'Practice quiz for Special Paper 1 reasoning questions.',
      difficulty: 'EASY',
      curriculum: 'ZAMBIAN',
      instructions: 'Answer all questions. Look carefully for the pattern in each one.',
      timeLimit: 10,
      passingScore: 60,
      maxAttempts: 0, // unlimited
      randomQuestionOrder: false,
      randomAnswerOrder: true,
      allowRetakes: true,
      showAnswers: 'AFTER_SUBMISSION',
      showExplanations: true,
      scorePolicy: 'LATEST',
      status: 'DRAFT',
      teacherId: userMap['mrs.siya@eduquest.zm'],
    },
  })

  const quizQuestionsReasoning = [
    {
      type: 'NUMERICAL',
      questionText: 'What number comes next in this sequence: 2, 4, 6, 8, ?',
      correctAnswerJson: J(10),
      numericalTolerance: 0,
      markAllocation: 1,
      explanation: 'Each number goes up by 2, so the next is 8 + 2 = 10.',
      order: 0,
    },
    {
      type: 'MULTIPLE_CHOICE',
      questionText: 'Find the odd one out: Maize, Rice, Cassava, Beef.',
      optionsJson: J(['A. Maize', 'B. Rice', 'C. Cassava', 'D. Beef']),
      correctAnswerJson: J('D'),
      markAllocation: 1,
      explanation: 'Beef is meat from cattle; the others are crops grown in fields.',
      order: 1,
    },
    {
      type: 'FILL_BLANK',
      questionText: 'Lusaka is to Zambia as Nairobi is to ___',
      acceptedAnswersJson: J(['Kenya']),
      correctAnswerJson: J('Kenya'),
      markAllocation: 1,
      explanation: 'Lusaka is the capital of Zambia; Nairobi is the capital of Kenya.',
      order: 2,
    },
    {
      type: 'TRUE_FALSE',
      questionText: 'True or false: In the sequence A, C, E, G, the next letter is I.',
      correctAnswerJson: J(true),
      markAllocation: 1,
      explanation: 'True. Each letter skips one (A→C skips B; C→E skips D), so after G the next is I.',
      order: 3,
    },
  ]
  for (const q of quizQuestionsReasoning) {
    await db.quizQuestion.create({ data: { quizId: quizReasoning.id, ...q } })
  }
  console.log(`✓ 3 quizzes with questions`)

  // 8. QUIZ ASSIGNMENTS
  const qaFractions = await db.quizAssignment.create({
    data: { quizId: quizFractions.id, classId: classG7PM.id, startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  })
  const qaMatter = await db.quizAssignment.create({
    data: { quizId: quizMatter.id, classId: classG6SC.id, startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
  })
  console.log(`✓ 2 quiz assignments`)

  // 9. QUIZ ATTEMPTS + ANSWERS (so dashboards and analytics have real data)
  // Thabo Mumba — Fractions Quiz — 85% (4 of 5 mark points correct; matching = 1/2 partial = 0 marks for simplicity if all correct → 5/5 = 100%, but we'll set a wrong answer)
  await createAttempt(
    quizFractions.id,
    userMap['thabo@eduquest.zm'],
    qaFractions.id,
    1,
    [
      { questionIdx: 0, learnerAnswer: 'B' }, // correct
      { questionIdx: 1, learnerAnswer: false }, // correct
      { questionIdx: 2, learnerAnswer: '5/6' }, // correct
      { questionIdx: 3, learnerAnswer: 5 }, // correct
      { questionIdx: 4, learnerAnswer: { '2/4': '1/2', '3/9': '1/3', '4/8': '1/2', '6/10': '1/2' } }, // last one wrong → 3/4 matched
    ],
  )

  // Chipo Nkhata — Fractions Quiz — 70%
  await createAttempt(
    quizFractions.id,
    userMap['chipo@eduquest.zm'],
    qaFractions.id,
    1,
    [
      { questionIdx: 0, learnerAnswer: 'B' }, // correct
      { questionIdx: 1, learnerAnswer: true }, // WRONG (false was correct)
      { questionIdx: 2, learnerAnswer: '3/6' }, // correct (accepted)
      { questionIdx: 3, learnerAnswer: 5 }, // correct
      { questionIdx: 4, learnerAnswer: { '2/4': '1/2', '3/9': '1/3', '4/8': '1/2', '6/10': '3/5' } }, // all correct
    ],
  )

  // Lubosi Chama — States of Matter Quiz — 60%
  await createAttempt(
    quizMatter.id,
    userMap['lubosi@eduquest.zm'],
    qaMatter.id,
    1,
    [
      { questionIdx: 0, learnerAnswer: 'C' }, // correct
      { questionIdx: 1, learnerAnswer: true }, // correct
      { questionIdx: 2, learnerAnswer: 'D' }, // correct
      { questionIdx: 3, learnerAnswer: 'When water boils the water turns to steam.' }, // short answer — partial credit ~1/3
      { questionIdx: 4, learnerAnswer: 5 }, // correct
    ],
    true, // skip AI marking for short answer (will be heuristic)
  )
  console.log(`✓ 3 quiz attempts`)

  // 10. NOTIFICATIONS
  const notifTargets = [
    { userId: userMap['thabo@eduquest.zm'], type: 'NEW_QUIZ', title: 'New quiz assigned', message: 'Fractions Quiz has been assigned to your class. Due in 7 days.', data: { quizId: quizFractions.id, classId: classG7PM.id } },
    { userId: userMap['chipo@eduquest.zm'], type: 'NEW_QUIZ', title: 'New quiz assigned', message: 'Fractions Quiz has been assigned to your class. Due in 7 days.', data: { quizId: quizFractions.id, classId: classG7PM.id } },
    { userId: userMap['mrs.siya@eduquest.zm'], type: 'SUBMISSION', title: 'New submission', message: 'Thabo Mumba submitted Fractions Quiz (Score: 85%).', data: { quizId: quizFractions.id, learnerId: userMap['thabo@eduquest.zm'] } },
    { userId: userMap['mrs.siya@eduquest.zm'], type: 'SUBMISSION', title: 'New submission', message: 'Chipo Nkhata submitted Fractions Quiz (Score: 70%).', data: { quizId: quizFractions.id, learnerId: userMap['chipo@eduquest.zm'] } },
    { userId: userMap['mr.chisango@eduquest.zm'], type: 'SUBMISSION', title: 'New submission', message: 'Lubosi Chama submitted States of Matter Quiz (Score: 60%).', data: { quizId: quizMatter.id, learnerId: userMap['lubosi@eduquest.zm'] } },
    { userId: userMap['admin@eduquest.zm'], type: 'SYSTEM', title: 'Platform activity', message: '2 teachers and 6 learners registered this week.', data: {} },
    { userId: userMap['thabo@eduquest.zm'], type: 'NEW_LESSON', title: 'New lesson published', message: 'Adding and Subtracting Fractions is now available.', data: { lessonId: lessonFractions.id } },
    { userId: userMap['admin@eduquest.zm'], type: 'SYSTEM', title: 'Welcome to EduQuest LMS', message: 'EduQuest LMS is ready. Log in as admin, teacher, or learner to explore. All demo passwords are eduquest123.', data: {} },
  ]
  for (const n of notifTargets) {
    await db.notification.create({
      data: {
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        dataJson: J(n.data),
      },
    })
  }
  console.log(`✓ ${notifTargets.length} notifications`)
  console.log('🌱 Seed complete.')

  return { skipped: false, message: 'Seeded successfully' }
}

// ---------------------------------------------------------------------------
// Helper: create a quiz attempt with answers, running the marking logic
// ---------------------------------------------------------------------------
async function createAttempt(
  quizId: string,
  learnerId: string,
  assignmentId: string,
  attemptNumber: number,
  answers: Array<{ questionIdx: number; learnerAnswer: any }>,
  skipAiMarking = false,
) {
  const questions = await db.quizQuestion.findMany({ where: { quizId }, orderBy: { order: 'asc' } })
  let totalScore = 0
  let maxScore = 0

  const attempt = await db.quizAttempt.create({
    data: {
      quizId,
      learnerId,
      assignmentId,
      attemptNumber,
      status: 'SUBMITTED',
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
      timeSpent: 600 + Math.floor(Math.random() * 600),
    },
  })

  for (const ans of answers) {
    const q = questions[ans.questionIdx]
    if (!q) continue
    const maxMarks = q.markAllocation || 1
    maxScore += maxMarks

    let isCorrect = false
    let marksAwarded = 0
    let aiResult: any = null

    const questionData: any = {
      type: q.type,
      options: q.optionsJson ? JSON.parse(q.optionsJson) : undefined,
      correctAnswer: q.correctAnswerJson ? JSON.parse(q.correctAnswerJson) : undefined,
      acceptedAnswers: q.acceptedAnswersJson ? JSON.parse(q.acceptedAnswersJson) : undefined,
      matchingPairs: q.matchingPairsJson ? JSON.parse(q.matchingPairsJson) : undefined,
      markingGuide: q.markingGuide,
      numericalTolerance: q.numericalTolerance,
      markAllocation: maxMarks,
    }

    if (q.type === 'SHORT_ANSWER') {
      if (skipAiMarking) {
        // Use heuristic for seed
        const heuristic = heuristicMark(q.markingGuide || '', String(ans.learnerAnswer ?? ''), maxMarks)
        isCorrect = heuristic.isCorrect
        marksAwarded = heuristic.marksAwarded
        aiResult = { feedback: heuristic.feedback, partial: heuristic.partial, source: 'heuristic' }
      } else {
        // Will be filled below by AI call (kept async)
        // For seed, we use heuristic to keep things fast
        const heuristic = heuristicMark(q.markingGuide || '', String(ans.learnerAnswer ?? ''), maxMarks)
        isCorrect = heuristic.isCorrect
        marksAwarded = heuristic.marksAwarded
        aiResult = { feedback: heuristic.feedback, partial: heuristic.partial, source: 'heuristic' }
      }
    } else {
      // Deterministic objective marking
      const r = markObjectiveInline(questionData, ans.learnerAnswer)
      isCorrect = r.isCorrect
      marksAwarded = r.marksAwarded
    }

    totalScore += marksAwarded

    await db.quizAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: q.id,
        learnerAnswerJson: J(ans.learnerAnswer),
        isCorrect,
        marksAwarded,
        aiMarkingResult: aiResult ? J(aiResult) : null,
        gradedAt: new Date(),
      },
    })
  }

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0
  const grade = computeGradeLetter(percentage)

  await db.quizAttempt.update({
    where: { id: attempt.id },
    data: {
      score: totalScore,
      maxScore,
      percentage,
      grade,
      passed: percentage >= 50,
    },
  })
}

function computeGradeLetter(p: number): string {
  if (p >= 80) return 'A'
  if (p >= 70) return 'B'
  if (p >= 60) return 'C'
  if (p >= 50) return 'D'
  return 'F'
}

// Inline objective marker (mirrors src/lib/marking.ts without imports to avoid circular deps in seed)
function markObjectiveInline(q: any, learnerAnswer: any) {
  const maxMarks = q.markAllocation || 1
  switch (q.type) {
    case 'MULTIPLE_CHOICE': {
      const correct = String(q.correctAnswer ?? '').trim().toUpperCase()
      const given = String(learnerAnswer ?? '').trim().toUpperCase()
      const ok = correct !== '' && given === correct
      return { isCorrect: ok, marksAwarded: ok ? maxMarks : 0 }
    }
    case 'TRUE_FALSE': {
      const toBool = (v: any) => {
        if (v === true || v === 'true' || v === 1 || v === '1' || v === 'True') return true
        if (v === false || v === 'false' || v === 0 || v === '0' || v === 'False') return false
        return null
      }
      const c = toBool(q.correctAnswer)
      const g = toBool(learnerAnswer)
      if (g === null) return { isCorrect: false, marksAwarded: 0 }
      const ok = c === g
      return { isCorrect: ok, marksAwarded: ok ? maxMarks : 0 }
    }
    case 'NUMERICAL': {
      if (learnerAnswer === '' || learnerAnswer === null || learnerAnswer === undefined) return { isCorrect: false, marksAwarded: 0 }
      const c = Number(q.correctAnswer)
      const g = Number(learnerAnswer)
      if (Number.isNaN(c) || Number.isNaN(g)) return { isCorrect: false, marksAwarded: 0 }
      const tol = q.numericalTolerance ?? 0.01
      const ok = Math.abs(c - g) <= Math.abs(tol)
      return { isCorrect: ok, marksAwarded: ok ? maxMarks : 0 }
    }
    case 'FILL_BLANK': {
      const norm = (s: string) => String(s).trim().toLowerCase().replace(/[.,!?;:'"\-_/\\()]/g, '').replace(/\s+/g, ' ')
      const accepted = (q.acceptedAnswers ?? (Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer]))
        .map((a: any) => norm(String(a))).filter(Boolean)
      const given = norm(String(learnerAnswer ?? ''))
      if (!given) return { isCorrect: false, marksAwarded: 0 }
      const ok = accepted.includes(given)
      return { isCorrect: ok, marksAwarded: ok ? maxMarks : 0 }
    }
    case 'MATCHING': {
      const correct = q.correctAnswer ?? {}
      const given = learnerAnswer ?? {}
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
      // Use heuristic in seed (no live AI calls)
      const r = heuristicMark(q.markingGuide ?? '', String(learnerAnswer ?? ''), maxMarks)
      return { isCorrect: r.isCorrect, marksAwarded: r.marksAwarded }
    }
    default:
      return { isCorrect: false, marksAwarded: 0 }
  }
}

function heuristicMark(markingGuide: string, learnerAnswer: string, maxMarks: number) {
  const answer = learnerAnswer.toLowerCase()
  if (!answer.trim()) return { isCorrect: false, marksAwarded: 0, feedback: 'No answer provided.', partial: false }
  const keywords = markingGuide
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 3)
  if (keywords.length === 0) return { isCorrect: answer.trim().length > 0, marksAwarded: answer.trim().length > 0 ? maxMarks : 0, feedback: 'Marked on length only.', partial: false }
  const matched = keywords.filter((k) => answer.includes(k)).length
  const ratio = matched / keywords.length
  const marksAwarded = Math.round(ratio * maxMarks)
  return {
    isCorrect: ratio >= 0.8,
    marksAwarded,
    feedback: ratio >= 0.8 ? 'Good answer — covers the main points.' : ratio >= 0.4 ? 'Partially correct.' : 'Key points missing.',
    partial: marksAwarded > 0 && marksAwarded < maxMarks,
  }
}

// Run as a script: `bun run src/lib/seed.ts`
if (require.main === module) {
  runSeed()
    .then((r) => { console.log(r); process.exit(0) })
    .catch((e) => { console.error(e); process.exit(1) })
}
