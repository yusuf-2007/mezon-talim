import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { commentsRepository } from "@/lib/db/repositories/comments";
import { messagesRepository } from "@/lib/db/repositories/messages";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { QuerySelect } from "@/components/admin/query-select";
import { DiscussionPanel } from "@/components/player/discussion-panel";
import { AuthorMessagesPanel } from "@/components/player/author-messages-panel";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card, CardHead, Empty, FilterChips } from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

type Section = "ask" | "discussion";

/**
 * Student questions, and the public discussion under each lesson.
 *
 * Questions now open on a list of threads rather than a course picker. The job
 * here is "answer whatever is waiting", and the old flow made someone guess
 * which course and which lesson the waiting thing was under before they could
 * see it. Discussion keeps the picker, because moderating means going to a
 * particular lesson on purpose.
 *
 * Both panels are the player's own components, so a reply sent from here fires
 * the same notification a reply sent from the lesson page would.
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    section?: string;
    courseId?: string;
    lessonId?: string;
    lesson?: string;
    box?: string;
  }>;
}) {
  const viewer = await requireRole("super_admin");
  const [t, tPlayer] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Player"),
  ]);
  const locale = (await getLocale()) as Locale;
  const sp = await searchParams;
  const section: Section = sp.section === "discussion" ? "discussion" : "ask";

  if (section === "discussion") {
    return (
      <DiscussionView
        sp={sp}
        viewerId={viewer.id}
        viewerRole={viewer.role}
        locale={locale}
        t={t}
        tPlayer={tPlayer}
      />
    );
  }

  const awaiting = sp.box !== "answered";
  // Both boxes, because a thread must not disappear the moment it is answered —
  // the reply you just sent is the thing you want to see. The sidebar lists the
  // active box; the panel resolves against everything.
  const [open, answered] = await Promise.all([
    messagesRepository.listThreadsForAdmin(true, 50),
    messagesRepository.listThreadsForAdmin(false, 50),
  ]);
  const threads = awaiting ? open : answered;
  // `lesson` is ours; `lessonId` is what the notification bell links with.
  const wanted = sp.lesson ?? sp.lessonId ?? "";
  const selected =
    [...open, ...answered].find((x) => x.lessonId === wanted) ?? threads[0];

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navMessages")}
        title={t("messagesTitle")}
        userId={viewer.id}
        role={viewer.role}
      />

      <SectionTabs section={section} t={t} tPlayer={tPlayer} />

      <div className="grid gap-[18px] xl:grid-cols-[21rem_1fr]">
        <Card className="xl:sticky xl:top-6 xl:self-start">
          <div className="border-b border-lp-line-soft px-5 py-4">
            <FilterChips
              active={awaiting ? null : "answered"}
              hrefFor={(v) => {
                const p = new URLSearchParams();
                if (v) p.set("box", v);
                if (selected) p.set("lesson", selected.lessonId);
                const q = p.toString();
                return `/admin/messages${q ? `?${q}` : ""}`;
              }}
              options={[
                { value: null, label: t("msgsOpen") },
                { value: "answered", label: t("msgsAnswered") },
              ]}
            />
          </div>

          {threads.length === 0 ? (
            <Empty>{t("msgsEmpty")}</Empty>
          ) : (
            <ul className="max-h-[32rem] overflow-y-auto">
              {threads.map((th) => {
                const on = th.lessonId === selected?.lessonId;
                return (
                  <li key={th.id}>
                    <Link
                      href={`/admin/messages?lesson=${th.lessonId}${awaiting ? "" : "&box=answered"}`}
                      aria-current={on ? "true" : undefined}
                      className={cn(
                        "block border-b border-lp-line-soft border-l-[3px] px-5 py-3.5 transition-colors last:border-b-0",
                        on
                          ? "border-l-lp-gold bg-lp-wash"
                          : "border-l-transparent hover:bg-lp-row-hover",
                      )}
                    >
                      <span className="mb-0.5 block truncate text-[.88rem] font-bold text-lp-ink">
                        {th.studentName ?? "—"}
                      </span>
                      <span className="block truncate text-[.84rem] text-lp-slate">
                        {th.body}
                      </span>
                      <span className="mt-0.5 block truncate text-[.78rem] text-lp-muted">
                        {pickLocale(th.lessonTitle, locale)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          {!selected ? (
            <Empty>{t("msgsPickThread")}</Empty>
          ) : (
            <>
              <CardHead
                title={selected.studentName ?? "—"}
                eyebrow={pickLocale(selected.lessonTitle, locale)}
                right={
                  <Link
                    href={`/learn/${selected.courseId}/${selected.lessonId}`}
                    className="text-[.84rem] font-bold text-lp-navy-mid hover:underline"
                  >
                    {t("msgsOpenLesson")}
                  </Link>
                }
              />
              <div className="p-6">
                <LessonThreads lessonId={selected.lessonId} viewerId={viewer.id} />
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

function SectionTabs({
  section,
  t,
  tPlayer,
}: {
  section: Section;
  t: Awaited<ReturnType<typeof getTranslations<"Admin">>>;
  tPlayer: Awaited<ReturnType<typeof getTranslations<"Player">>>;
}) {
  const tabs: { key: Section; label: string }[] = [
    { key: "ask", label: tPlayer("askAuthor") },
    { key: "discussion", label: tPlayer("discussion") },
  ];
  return (
    <div className="mb-[18px] flex w-fit gap-1 rounded-[10px] border border-lp-line bg-surface p-1">
      {tabs.map((s) => (
        <Link
          key={s.key}
          href={`/admin/messages?section=${s.key}`}
          aria-current={section === s.key ? "page" : undefined}
          className={cn(
            "rounded-[7px] px-4 py-2 text-[.86rem] font-bold transition-colors",
            section === s.key
              ? "bg-lp-navy text-white"
              : "text-lp-slate hover:text-lp-navy",
          )}
        >
          {s.label}
        </Link>
      ))}
      <span className="sr-only">{t("messagesTitle")}</span>
    </div>
  );
}

/** Public comments: still course → lesson, because moderation is targeted. */
async function DiscussionView({
  sp,
  viewerId,
  viewerRole,
  locale,
  t,
  tPlayer,
}: {
  sp: { courseId?: string; lessonId?: string };
  viewerId: string;
  viewerRole: string;
  locale: Locale;
  t: Awaited<ReturnType<typeof getTranslations<"Admin">>>;
  tPlayer: Awaited<ReturnType<typeof getTranslations<"Player">>>;
}) {
  const [courses, activity] = await Promise.all([
    coursesRepository.listAll(),
    commentsRepository.countsByLesson(),
  ]);
  const byLesson = new Map(activity.map((a) => [a.lessonId, a.n]));
  const byCourse = new Map<string, number>();
  for (const a of activity) {
    byCourse.set(a.courseId, (byCourse.get(a.courseId) ?? 0) + a.n);
  }
  const decorate = (label: string, n?: number) => (n ? `${label} (${n})` : label);

  // Validate against the real list — a malformed courseId must not reach SQL.
  const courseId = courses.some((c) => c.id === sp.courseId) ? sp.courseId! : "";
  const lessonRows = courseId ? await lessonsRepository.listByCourse(courseId) : [];
  const lessonOptions = lessonRows.map((r) => ({
    id: r.lesson.id,
    label: decorate(pickLocale(r.lesson.title, locale), byLesson.get(r.lesson.id)),
  }));
  const lessonId = lessonOptions.some((l) => l.id === sp.lessonId) ? sp.lessonId! : "";

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navMessages")}
        title={t("messagesTitle")}
        userId={viewerId}
        role={viewerRole}
      />

      <SectionTabs section="discussion" t={t} tPlayer={tPlayer} />

      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        <QuerySelect
          param="courseId"
          value={courseId}
          options={courses.map((c) => ({
            id: c.id,
            label: decorate(pickLocale(c.title, locale), byCourse.get(c.id)),
          }))}
          placeholder={t("enrollmentsSelectCourse")}
          clears={["lessonId"]}
        />
        {courseId && (
          <QuerySelect
            key={courseId}
            param="lessonId"
            value={lessonId}
            options={lessonOptions}
            placeholder={t("selectLesson")}
          />
        )}
      </div>

      <Card>
        {!courseId || !lessonId ? (
          <Empty>{!courseId ? t("selectCourse") : t("selectLesson")}</Empty>
        ) : (
          <div className="p-6">
            <LessonDiscussion lessonId={lessonId} viewerId={viewerId} />
          </div>
        )}
      </Card>
    </>
  );
}

async function LessonDiscussion({
  lessonId,
  viewerId,
}: {
  lessonId: string;
  viewerId: string;
}) {
  const comments = await commentsRepository.listForLesson(lessonId);
  return (
    <DiscussionPanel
      lessonId={lessonId}
      comments={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
      currentUserId={viewerId}
      canModerate
    />
  );
}

async function LessonThreads({
  lessonId,
  viewerId,
}: {
  lessonId: string;
  viewerId: string;
}) {
  const messages = await messagesRepository.listThreadsForLesson(lessonId);
  return (
    <AuthorMessagesPanel
      lessonId={lessonId}
      messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      currentUserId={viewerId}
      isInstructor
    />
  );
}
