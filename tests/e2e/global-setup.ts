import { hash } from "@node-rs/argon2";
import { IDS, PASSWORD, USERS, testSql, wipeCommunity } from "./db";

/**
 * Seeds the disposable test database (idempotent): three users, one published
 * course owned by the admin, one module, two lessons (second one sequentially
 * locked), and active enrollments for both students. Community tables start
 * empty. Refuses to run against anything but localhost (see db.ts).
 */
export default async function globalSetup() {
  const sql = testSql();
  const pw = await hash(PASSWORD);

  const ids: Record<string, string> = {};
  for (const [key, u] of Object.entries(USERS)) {
    const role = key === "admin" ? "super_admin" : "student";
    const [row] = await sql`
      insert into users (email, full_name, password_hash, role, email_verified)
      values (${u.email}, ${u.name}, ${pw}, ${role}, now())
      on conflict (email) do update set
        full_name = excluded.full_name,
        password_hash = excluded.password_hash,
        role = excluded.role
      returning id`;
    ids[key] = row.id;
  }

  await sql`
    insert into courses (id, slug, title, status, created_by)
    values (
      ${IDS.course}, 'e2e-course',
      ${sql.json({ uz: "E2E Sinov Kursi", ru: "E2E Курс", en: "E2E Course" })},
      'published', ${ids.admin}
    )
    on conflict (id) do update set created_by = excluded.created_by`;

  await sql`
    insert into modules (id, course_id, order_index, title)
    values (${IDS.module}, ${IDS.course}, 0,
      ${sql.json({ uz: "Modul 1", ru: "Модуль 1", en: "Module 1" })})
    on conflict (id) do nothing`;

  for (const [lessonId, order, title] of [
    [IDS.lesson1, 0, "Birinchi dars"],
    [IDS.lesson2, 1, "Ikkinchi dars"],
  ] as const) {
    await sql`
      insert into lessons (id, module_id, order_index, title)
      values (${lessonId}, ${IDS.module}, ${order},
        ${sql.json({ uz: title, ru: title, en: title })})
      on conflict (id) do nothing`;
  }

  for (const student of [ids.studentA, ids.studentB]) {
    await sql`
      insert into enrollments (user_id, course_id, status)
      values (${student}, ${IDS.course}, 'active')
      on conflict (user_id, course_id) do nothing`;
  }

  await wipeCommunity(sql);
  await sql.end();
}
