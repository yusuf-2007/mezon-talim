/**
 * Seed a demo course for client previews: one published course →
 * 2 modules → video lessons (first is a free preview) → glossary →
 * a timed final exam with graded questions.
 *
 *   npm run db:seed:demo
 *
 * Idempotent: deletes any existing course with the demo slug (cascades to
 * modules/lessons/assessments) and recreates it fresh. Self-contained so it
 * never imports `server-only` modules. Bunny video IDs are left null — the
 * player shows a placeholder; everything else (catalog, curriculum, exam) is
 * fully clickable.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  assessments,
  courses,
  glossaryTerms,
  lessons,
  modules,
  questionOptions,
  questions,
  users,
} from "../lib/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set (see .env).");
  process.exit(1);
}

const SLUG = "aaoifi-shariah-standartlari-asoslari";

async function main() {
  const sql = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(sql, {
    schema: {
      courses,
      modules,
      lessons,
      glossaryTerms,
      assessments,
      questions,
      questionOptions,
      users,
    },
  });

  // Author = the seeded super admin (fallback: any user, else null).
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@mezontalim.uz"))
    .limit(1);
  const createdBy = admin?.id ?? null;

  // Idempotent: wipe any prior demo course (cascades to children).
  await db.delete(courses).where(eq(courses.slug, SLUG));

  // --- Course ---
  const [course] = await db
    .insert(courses)
    .values({
      slug: SLUG,
      title: {
        uz: "AAOIFI Shariah standartlari asoslari",
        ru: "Основы шариатских стандартов AAOIFI",
      },
      summary: {
        uz: "Islom moliyasi va AAOIFI shariah standartlariga kirish kursi.",
        ru: "Вводный курс по исламским финансам и шариатским стандартам AAOIFI.",
      },
      description: {
        uz: "Ushbu kurs AAOIFI shariah standartlarini tizimli o'rganishga bag'ishlangan. Siz islom moliyasining asosiy tushunchalari, riba, g'arar va murobaha kabi tamoyillar bilan tanishasiz. Har bir modul video darslar va testlar bilan ta'minlangan.",
        ru: "Этот курс посвящён системному изучению шариатских стандартов AAOIFI. Вы познакомитесь с основными понятиями исламских финансов: риба, гарар и мурабаха. Каждый модуль сопровождается видеоуроками и тестами.",
      },
      status: "published",
      priceTiyin: 49000000, // 490 000 so'm
      accessDurationDays: 365,
      certificateEnabled: true,
      passThresholdPct: 70,
      createdBy,
    })
    .returning();

  // --- Module 1 ---
  const [m1] = await db
    .insert(modules)
    .values({
      courseId: course.id,
      orderIndex: 0,
      title: { uz: "Kirish va asosiy tushunchalar", ru: "Введение и основные понятия" },
    })
    .returning();

  await db.insert(lessons).values([
    {
      moduleId: m1.id,
      orderIndex: 0,
      title: { uz: "Islom moliyasiga kirish", ru: "Введение в исламские финансы" },
      body: {
        uz: "Islom moliyasi shariah tamoyillariga asoslangan moliyaviy tizimdir. Ushbu darsda asosiy farqlarni ko'rib chiqamiz.",
        ru: "Исламские финансы — это финансовая система, основанная на принципах шариата. В этом уроке мы рассмотрим ключевые отличия.",
      },
      isPreview: true,
      durationSeconds: 480,
    },
    {
      moduleId: m1.id,
      orderIndex: 1,
      title: { uz: "AAOIFI tashkiloti haqida", ru: "Об организации AAOIFI" },
      body: {
        uz: "AAOIFI — islom moliya institutlari uchun buxgalteriya va auditorlik standartlarini ishlab chiquvchi xalqaro tashkilot.",
        ru: "AAOIFI — международная организация, разрабатывающая стандарты учёта и аудита для исламских финансовых институтов.",
      },
      durationSeconds: 600,
    },
    {
      moduleId: m1.id,
      orderIndex: 2,
      title: { uz: "Shariah standartlari tuzilishi", ru: "Структура шариатских стандартов" },
      body: {
        uz: "Standartlar tuzilishi va ularning amaliyotda qo'llanilishi.",
        ru: "Структура стандартов и их применение на практике.",
      },
      durationSeconds: 540,
    },
  ]);

  // --- Module 2 ---
  const [m2] = await db
    .insert(modules)
    .values({
      courseId: course.id,
      orderIndex: 1,
      title: { uz: "Riba, g'arar va murobaha", ru: "Риба, гарар и мурабаха" },
    })
    .returning();

  await db.insert(lessons).values([
    {
      moduleId: m2.id,
      orderIndex: 0,
      title: { uz: "Riba va uning turlari", ru: "Риба и её виды" },
      body: {
        uz: "Riba — islom moliyasida qat'iyan man etilgan. Riba al-fadl va riba an-nasiya turlarini ko'rib chiqamiz.",
        ru: "Риба строго запрещена в исламских финансах. Рассмотрим виды риба аль-фадль и риба ан-насия.",
      },
      durationSeconds: 660,
    },
    {
      moduleId: m2.id,
      orderIndex: 1,
      title: { uz: "Murobaha asoslari", ru: "Основы мурабаха" },
      body: {
        uz: "Murobaha — xarid narxiga ma'lum foyda qo'shilgan holda sotish shartnomasi.",
        ru: "Мурабаха — договор продажи с добавлением определённой наценки к цене покупки.",
      },
      durationSeconds: 720,
    },
  ]);

  // --- Glossary ---
  await db.insert(glossaryTerms).values([
    {
      courseId: course.id,
      term: "Riba",
      definition: {
        uz: "Qarz yoki almashinuvda olinadigan sudxo'rlik foizi; shariatda man etilgan.",
        ru: "Ростовщический процент по займу или обмену; запрещён в шариате.",
      },
    },
    {
      courseId: course.id,
      term: "G'arar",
      definition: {
        uz: "Shartnomadagi noaniqlik yoki haddan tashqari xavf-xatar.",
        ru: "Неопределённость или чрезмерный риск в договоре.",
      },
    },
    {
      courseId: course.id,
      term: "Murobaha",
      definition: {
        uz: "Xarid narxi va foyda ochiq ko'rsatilgan savdo shartnomasi.",
        ru: "Договор продажи с открытым указанием цены покупки и наценки.",
      },
    },
  ]);

  // --- Final exam ---
  const [exam] = await db
    .insert(assessments)
    .values({
      type: "final_exam",
      courseId: course.id,
      title: { uz: "Yakuniy imtihon", ru: "Итоговый экзамен" },
      timeLimitSeconds: 600,
      passThresholdPct: 70,
      maxAttempts: null, // friendly for demo
      attemptCooldownHours: null,
      isScored: true,
      randomize: true,
    })
    .returning();

  const q1 = await insertQuestion(db, exam.id, 0, "single", {
    prompt: { uz: "Riba nima?", ru: "Что такое риба?" },
    explanation: {
      uz: "Riba — sudxo'rlik foizi, shariatda man etilgan.",
      ru: "Риба — ростовщический процент, запрещённый в шариате.",
    },
    options: [
      { label: { uz: "Sudxo'rlik foizi", ru: "Ростовщический процент" }, correct: true },
      { label: { uz: "Savdo foydasi", ru: "Торговая прибыль" }, correct: false },
      { label: { uz: "Sadaqa", ru: "Милостыня" }, correct: false },
    ],
  });

  const q2 = await insertQuestion(db, exam.id, 1, "true_false", {
    prompt: {
      uz: "AAOIFI islom moliya institutlari uchun standartlar ishlab chiqadi.",
      ru: "AAOIFI разрабатывает стандарты для исламских финансовых институтов.",
    },
    explanation: {
      uz: "To'g'ri — bu AAOIFI ning asosiy vazifasi.",
      ru: "Верно — это основная задача AAOIFI.",
    },
    options: [
      { label: { uz: "To'g'ri", ru: "Верно" }, correct: true },
      { label: { uz: "Noto'g'ri", ru: "Неверно" }, correct: false },
    ],
  });

  const q3 = await insertQuestion(db, exam.id, 2, "multiple", {
    prompt: {
      uz: "Quyidagilardan qaysilari shariatda man etilgan? (bir nechta javob)",
      ru: "Что из перечисленного запрещено в шариате? (несколько ответов)",
    },
    explanation: {
      uz: "Riba va g'arar man etilgan; murobaha esa ruxsat etilgan.",
      ru: "Риба и гарар запрещены; мурабаха разрешена.",
    },
    options: [
      { label: { uz: "Riba", ru: "Риба" }, correct: true },
      { label: { uz: "G'arar", ru: "Гарар" }, correct: true },
      { label: { uz: "Murobaha", ru: "Мурабаха" }, correct: false },
    ],
  });

  const q4 = await insertQuestion(db, exam.id, 3, "single", {
    prompt: { uz: "Murobaha shartnomasi nimaga asoslanadi?", ru: "На чём основан договор мурабаха?" },
    explanation: {
      uz: "Murobaha — xarid narxiga ochiq foyda qo'shilgan savdo.",
      ru: "Мурабаха — продажа с открытой наценкой к цене покупки.",
    },
    options: [
      { label: { uz: "Ochiq foyda qo'shilgan savdo", ru: "Продажа с открытой наценкой" }, correct: true },
      { label: { uz: "Qarz foizi", ru: "Процент по займу" }, correct: false },
      { label: { uz: "Noaniq kelishuv", ru: "Неопределённое соглашение" }, correct: false },
    ],
  });

  void q1, q2, q3, q4;

  console.info(`✓ Demo course seeded: ${course.slug}`);
  console.info(`  Modules: 2, Lessons: 5, Glossary: 3, Final exam: 4 questions`);
  await sql.end();
}

type DB = ReturnType<typeof drizzle>;

async function insertQuestion(
  db: DB,
  assessmentId: string,
  orderIndex: number,
  type: "single" | "multiple" | "true_false",
  data: {
    prompt: { uz: string; ru?: string };
    explanation?: { uz: string; ru?: string };
    options: { label: { uz: string; ru?: string }; correct: boolean }[];
  },
) {
  const [q] = await db
    .insert(questions)
    .values({
      assessmentId,
      orderIndex,
      type,
      prompt: data.prompt,
      explanation: data.explanation,
    })
    .returning();

  await db.insert(questionOptions).values(
    data.options.map((o, i) => ({
      questionId: q.id,
      orderIndex: i,
      label: o.label,
      isCorrect: o.correct,
    })),
  );
  return q;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
