import {
  ArrowRight,
  Bookmark,
  Download,
  FileText,
  Play,
  ShieldCheck,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getDashboardData, type ModuleProgress } from "@/lib/learning/dashboard";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/student/page-header";
import { CertificateArtifact } from "@/components/student/certificate-artifact";
import { Lattice, CornerMarks } from "@/components/student/lattice";
import { APP_TIME_ZONE, cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/routing";

/** mm:ss from seconds — the player's own clock format. */
function clock(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function DashboardHomePage() {
  const user = await requireUser();
  const t = await getTranslations("Student");
  const locale = (await getLocale()) as Locale;
  const d = await getDashboardData(user.id);

  const firstName = (user.fullName || "").split(/\s+/)[0] || "";

  return (
    <>
      <PageHeader
        eyebrow={t("navHome")}
        title={firstName ? t("greetingName", { name: firstName }) : t("greetingPlain")}
        userId={user.id}
        role={user.role}
      />

      {!d.course ? (
        <EmptyState t={t} />
      ) : (
        <div className="space-y-5">
          {d.resume && (
            <ResumePanel
              courseTitle={pickLocale(d.course.title, locale)}
              lessonTitle={pickLocale(d.resume.title, locale)}
              moduleLabel={t("resumeModule", { n: d.resume.moduleIndex })}
              moduleTitle={pickLocale(d.resume.moduleTitle, locale)}
              href={`/learn/${d.course.id}/${d.resume.lessonId}`}
              position={d.resume.positionSeconds}
              duration={d.resume.durationSeconds}
              t={t}
            />
          )}

          <CourseMap
            courseTitle={pickLocale(d.course.title, locale)}
            courseSlug={d.course.slug}
            modules={d.modules}
            completed={d.curriculum?.completedCount ?? 0}
            total={d.curriculum?.lessonCount ?? 0}
            locale={locale}
            t={t}
          />

          <section className="grid overflow-hidden rounded-2xl border border-lp-line bg-surface shadow-[0_2px_10px_rgba(2,58,105,.05)] lg:grid-cols-[1.1fr_1fr_1fr]">
            <NextAssessment data={d.nextAssessment} locale={locale} t={t} />
            <WeekStrip week={d.week} locale={locale} t={t} />
            <LatestQuestion data={d.latestQuestion} locale={locale} t={t} />
          </section>

          <section className="grid items-start gap-5 lg:grid-cols-[1.15fr_.85fr]">
            {d.certificate ? (
              <div className="grid items-center gap-6 rounded-2xl border border-lp-line bg-lp-wash p-6 sm:grid-cols-[auto_1fr]">
                <div className="w-full max-w-[236px]">
                  <CertificateArtifact
                    studentName={user.fullName || "—"}
                    courseTitle={d.certificate.courseTitle}
                    issuedAt={d.certificate.issuedAt}
                    verificationCode={d.certificate.verificationCode}
                  />
                </div>
                <div>
                  <Eyebrow>{t("myCertificate")}</Eyebrow>
                  <h4 className="mb-2 font-lp-heading text-[1.2rem] font-semibold leading-snug text-lp-navy">
                    {pickLocale(d.certificate.courseTitle, locale)}
                  </h4>
                  <p className="mb-4 flex flex-wrap items-center gap-3 text-[.82rem] text-lp-slate">
                    <span className="rounded border border-lp-line bg-surface px-2 py-0.5 font-mono text-lp-ink">
                      {d.certificate.verificationCode}
                    </span>
                    <span>
                      {new Date(d.certificate.issuedAt).toLocaleDateString(
                        locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ",
                      )}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      render={
                        <a
                          href={`/api/certificates/${d.certificate.verificationCode}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                      variant="outline"
                      size="sm"
                    >
                      <Download className="size-3.5" />
                      {t("downloadPdf")}
                    </Button>
                    <Link
                      href={`/verify/${d.certificate.verificationCode}`}
                      className="inline-flex items-center gap-1 px-1 text-[.84rem] font-bold text-lp-navy-mid hover:underline"
                    >
                      {t("verifyPage")} <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <NoCertificateYet t={t} />
            )}

            <div className="overflow-hidden rounded-2xl border border-lp-line bg-surface shadow-[0_2px_10px_rgba(2,58,105,.05)]">
              {d.termOfDay && (
                <div className="border-b border-lp-line-soft p-6">
                  <Eyebrow>{t("termOfDay")}</Eyebrow>
                  <p className="mb-1.5 font-lp-heading text-[1.25rem] font-semibold text-lp-navy">
                    {d.termOfDay.term}
                  </p>
                  <p className="text-[.9rem] leading-relaxed text-lp-slate">
                    {pickLocale(d.termOfDay.definition, locale)}
                  </p>
                </div>
              )}
              <QuietRow
                href="/dashboard/glossary"
                icon={<FileText className="size-[18px] text-lp-navy" strokeWidth={1.75} />}
                label={t("myNotes")}
                value={t("countSuffix", { count: d.noteCounts.total })}
              />
              <QuietRow
                href="/dashboard/glossary"
                icon={<Bookmark className="size-[18px] text-lp-navy" strokeWidth={1.75} />}
                label={t("bookmarksLabel")}
                value={t("countSuffix", { count: d.noteCounts.pinned })}
                last
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"Student">>>;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[.72rem] font-bold uppercase tracking-[.14em] text-lp-gold-deep">
      {children}
    </p>
  );
}

/**
 * The panel that answers "what now?" before anything else on the page.
 *
 * Navy, full-bleed and first, because resuming is the single action a returning
 * student takes most often — the old dashboard opened with three stat tiles,
 * which answer a question nobody arrives with.
 */
function ResumePanel({
  courseTitle,
  lessonTitle,
  moduleLabel,
  moduleTitle,
  href,
  position,
  duration,
  t,
}: {
  courseTitle: string;
  lessonTitle: string;
  moduleLabel: string;
  moduleTitle: string;
  href: string;
  position: number;
  duration: number | null;
  t: T;
}) {
  const pct = duration && duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <section className="relative overflow-hidden rounded-[18px] bg-lp-navy shadow-[0_16px_40px_rgba(1,20,40,.22)]">
      <Lattice size={46} opacity={0.06} />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-36 size-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle at 40% 40%,rgba(11,76,130,.7),transparent 62%)",
        }}
      />
      <div className="relative grid items-center gap-8 p-7 sm:p-9 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <p className="mb-4 flex items-center gap-2.5">
            <span aria-hidden className="h-0.5 w-6 bg-lp-gold" />
            <span className="text-[.72rem] font-bold uppercase tracking-[.14em] text-lp-gold-light">
              {t("resumeEyebrow")} &middot; {courseTitle}
            </span>
          </p>
          <h2 className="font-lp-heading text-[clamp(1.4rem,2.6vw,2.15rem)] font-semibold leading-[1.12] tracking-[-.015em] text-white">
            {lessonTitle}
          </h2>
          <p className="mt-4 flex flex-wrap items-center gap-4 text-[.88rem] text-lp-on-navy">
            <span>
              {moduleLabel} &middot; {moduleTitle}
            </span>
            {duration && duration > 0 && (
              <>
                <span aria-hidden className="h-3.5 w-px bg-white/20" />
                <span className="tabular-nums">
                  {t("resumeFrom", { done: clock(position), total: clock(duration) })}
                </span>
              </>
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              render={<Link href={href} />}
              size="lg"
              className="bg-lp-gold text-lp-navy-deep shadow-[0_6px_20px_rgba(248,184,1,.32)] hover:bg-lp-gold"
            >
              <Play className="size-3.5 fill-current" />
              {t("resumeContinue")}
            </Button>
            <Button
              render={<Link href={`${href}?tab=notes`} />}
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/[.07] text-white hover:bg-white/15 hover:text-white"
            >
              {t("resumeNotes")}
            </Button>
          </div>
        </div>

        <Link href={href} className="relative block">
          <div className="relative aspect-video overflow-hidden rounded-[14px] bg-lp-navy-dark shadow-[0_18px_44px_rgba(1,20,40,.45)]">
            <Lattice size={36} opacity={0.1} />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full border-[1.5px] border-white/50 bg-white/15 backdrop-blur-sm">
                <Play className="size-5 fill-white text-white" />
              </span>
            </span>
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <span className="block h-full bg-white" style={{ width: `${pct}%` }} />
            </span>
            {duration && duration > 0 && (
              <span className="absolute bottom-3 right-3 rounded-md bg-lp-navy-deep/70 px-2 py-0.5 text-[.72rem] font-bold tabular-nums text-white">
                {clock(duration)}
              </span>
            )}
          </div>
          <CornerMarks />
        </Link>
      </div>
    </section>
  );
}

const MODULE_STATE: Record<ModuleProgress["state"], { key: "modDone" | "modTestDue" | "modCurrent"; className: string } | null> = {
  done: { key: "modDone", className: "text-lp-success" },
  test_due: { key: "modTestDue", className: "text-lp-gold-ink" },
  current: { key: "modCurrent", className: "text-lp-gold-deep" },
  upcoming: null,
};

/**
 * The whole course as one picture: four columns of modules, each lesson a tick.
 *
 * A progress bar says how far along you are; this says where you are and what
 * is left, which is the question a student in the middle of a course actually
 * has. Lesson ticks carry a title attribute so hovering names them.
 */
function CourseMap({
  courseTitle,
  courseSlug,
  modules,
  completed,
  total,
  locale,
  t,
}: {
  courseTitle: string;
  courseSlug: string;
  modules: ModuleProgress[];
  completed: number;
  total: number;
  locale: Locale;
  t: T;
}) {
  return (
    <section className="rounded-2xl border border-lp-line bg-surface shadow-[0_2px_10px_rgba(2,58,105,.05)]">
      <div className="flex flex-wrap items-end justify-between gap-5 px-7 pt-6">
        <div>
          <Eyebrow>{t("courseMapEyebrow")}</Eyebrow>
          <h3 className="font-lp-heading text-[1.3rem] font-semibold text-lp-navy">{courseTitle}</h3>
        </div>
        <p className="flex items-baseline gap-2">
          <span className="font-lp-heading text-[2rem] font-semibold leading-none tabular-nums text-lp-navy">
            {completed}
            <span className="font-medium text-lp-muted-light"> / {total}</span>
          </span>
          <span className="text-[.84rem] text-lp-muted">{t("lessonsDoneLabel")}</span>
        </p>
      </div>

      <div className="grid gap-x-0 gap-y-5 px-7 pb-1.5 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        {modules.map((m, i) => {
          const status = MODULE_STATE[m.state];
          return (
            <div
              key={m.id}
              className={cn(
                "pb-5 pr-4.5 lg:border-r lg:border-lp-line-soft",
                i === modules.length - 1 && "lg:border-r-0",
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[.7rem] font-bold uppercase tracking-[.1em] text-lp-muted">
                  {t("resumeModule", { n: m.label })}
                </span>
                {status && (
                  <span className={cn("text-[.72rem] font-bold", status.className)}>
                    {t(status.key)}
                  </span>
                )}
              </div>
              <p className="mb-3 text-[.95rem] font-bold text-lp-ink">
                {pickLocale(m.title, locale)}
              </p>
              <div className="flex gap-1.5">
                {m.lessons.map((l) => (
                  <span
                    key={l.id}
                    title={pickLocale(l.title, locale)}
                    className={cn(
                      "h-2.5 flex-1 rounded-[3px] border-[1.5px]",
                      l.state === "done" && "border-lp-navy bg-lp-navy",
                      l.state === "current" && "border-lp-gold bg-lp-gold",
                      l.state === "locked" && "border-lp-line-strong bg-transparent",
                    )}
                  />
                ))}
              </div>
              <p className="mt-2.5 text-[.78rem] text-lp-muted">
                {t("modMeta", { done: m.completed, total: m.total })}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-lp-line-soft px-7 py-4">
        <ul className="flex flex-wrap gap-4 text-[.78rem] text-lp-muted">
          <Legend className="border-lp-navy bg-lp-navy">{t("legendDone")}</Legend>
          <Legend className="border-lp-gold bg-lp-gold">{t("legendCurrent")}</Legend>
          <Legend className="border-lp-line-strong bg-transparent">{t("legendLocked")}</Legend>
        </ul>
        <Link
          href={`/courses/${courseSlug}`}
          className="inline-flex items-center gap-1 text-[.84rem] font-bold text-lp-navy-mid hover:underline"
        >
          {t("fullProgramme")} <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("h-2 w-3 rounded-[2px] border-[1.5px]", className)} />
      {children}
    </li>
  );
}

function NextAssessment({
  data,
  locale,
  t,
}: {
  data: Awaited<ReturnType<typeof getDashboardData>>["nextAssessment"];
  locale: Locale;
  t: T;
}) {
  if (!data) {
    return (
      <div className="p-6">
        <Eyebrow>{t("nextAssessmentEyebrow")}</Eyebrow>
        <p className="mb-2 font-lp-heading text-[1.15rem] font-semibold leading-snug text-lp-navy">
          {t("noAssessment")}
        </p>
        <p className="text-[.82rem] leading-relaxed text-lp-slate">{t("noAssessmentSub")}</p>
      </div>
    );
  }
  return (
    <div className="p-6">
      <Eyebrow>{t("nextAssessmentEyebrow")}</Eyebrow>
      <h4 className="mb-2 font-lp-heading text-[1.15rem] font-semibold leading-snug text-lp-navy">
        {pickLocale(data.title, locale)}
      </h4>
      <p className="mb-4 flex flex-wrap items-center gap-2 text-[.82rem] tabular-nums text-lp-slate">
        <span>{t("metaQuestions", { count: data.questionCount })}</span>
        <span aria-hidden className="text-lp-line-strong">|</span>
        <span>{t("metaPass", { pct: data.passThresholdPct })}</span>
        {data.maxAttempts != null && (
          <>
            <span aria-hidden className="text-lp-line-strong">|</span>
            <span>{t("metaAttempts", { count: data.maxAttempts })}</span>
          </>
        )}
      </p>
      <Button render={<Link href={`/exam/${data.id}`} />} variant="outline" size="sm">
        {t("startAssessment")}
      </Button>
    </div>
  );
}

/**
 * Lessons completed per day, not minutes watched.
 *
 * The design asked for watch-time, which the product has never recorded —
 * `savePosition` exists and nothing calls it. A count of completions is the
 * strongest signal that is actually true; the shape of the chart is the same.
 */
function WeekStrip({
  week,
  locale,
  t,
}: {
  week: Awaited<ReturnType<typeof getDashboardData>>["week"];
  locale: Locale;
  t: T;
}) {
  const total = week.reduce((sum, d) => sum + d.count, 0);
  const activeDays = week.filter((d) => d.count > 0).length;
  const max = Math.max(1, ...week.map((d) => d.count));
  const dayLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ";

  return (
    <div className="border-t border-lp-line-soft p-6 lg:border-l lg:border-t-0">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-[.72rem] font-bold uppercase tracking-[.14em] text-lp-gold-deep">
          {t("weekEyebrow")}
        </span>
        <span className="font-lp-heading text-[1.2rem] font-semibold tabular-nums text-lp-navy">
          {t("weekLessons", { count: total })}
        </span>
      </div>
      <div className="mb-2.5 flex h-[54px] items-end gap-1.5">
        {week.map((d) => (
          <span
            key={d.date.toISOString()}
            className={cn(
              "flex-1 rounded-[3px]",
              d.count === 0 ? "bg-lp-line-soft" : d.isToday ? "bg-lp-gold" : "bg-lp-navy",
            )}
            style={{ height: d.count === 0 ? "4px" : `${Math.max(14, (d.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="flex gap-1.5">
        {week.map((d) => (
          <span
            key={d.date.toISOString()}
            className={cn(
              "flex-1 text-center text-[.68rem]",
              d.isToday ? "font-extrabold text-lp-navy" : "font-semibold text-lp-muted",
            )}
          >
            {d.date
              .toLocaleDateString(dayLocale, {
                weekday: "short",
                timeZone: APP_TIME_ZONE,
              })
              .slice(0, 2)}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[.8rem] text-lp-muted">
        {total === 0 ? t("weekNone") : t("weekActiveDays", { days: activeDays })}
      </p>
    </div>
  );
}

function LatestQuestion({
  data,
  locale,
  t,
}: {
  data: Awaited<ReturnType<typeof getDashboardData>>["latestQuestion"];
  locale: Locale;
  t: T;
}) {
  return (
    <Link
      href="/dashboard/messages"
      className="block border-t border-lp-line-soft p-6 transition-colors hover:bg-lp-wash lg:border-l lg:border-t-0"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[.72rem] font-bold uppercase tracking-[.14em] text-lp-gold-deep">
          {t("askEyebrow")}
        </span>
        {data && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[.7rem] font-bold",
              data.answered
                ? "bg-lp-tint text-lp-navy"
                : "bg-lp-gold-tint text-lp-gold-ink",
            )}
          >
            {data.answered ? t("answeredLabel") : t("awaitingReply")}
          </span>
        )}
      </div>
      {data ? (
        <>
          <p className="mb-2.5 line-clamp-3 font-lp-heading text-[1rem] font-medium italic leading-relaxed text-lp-ink">
            &laquo;{data.body}&raquo;
          </p>
          <p className="text-[.8rem] text-lp-muted">{pickLocale(data.lessonTitle, locale)}</p>
        </>
      ) : (
        <>
          <p className="mb-1.5 font-lp-heading text-[1rem] font-semibold text-lp-navy">
            {t("noQuestionYet")}
          </p>
          <p className="text-[.82rem] leading-relaxed text-lp-slate">{t("noQuestionSub")}</p>
        </>
      )}
      <p className="mt-3.5 inline-flex items-center gap-1 text-[.84rem] font-bold text-lp-navy-mid">
        {t("allMessages")} <ArrowRight className="size-3.5" />
      </p>
    </Link>
  );
}

function QuietRow({
  href,
  icon,
  label,
  value,
  last = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-lp-wash",
        !last && "border-b border-lp-line-soft",
      )}
    >
      <span className="flex items-center gap-3">
        {icon}
        <span className="text-[.92rem] font-semibold text-lp-ink">{label}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-[.84rem] tabular-nums text-lp-muted">
        {value} <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}

function NoCertificateYet({ t }: { t: T }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-dashed border-lp-line-strong p-6">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl border-[1.5px] border-dashed border-lp-line-strong">
        <ShieldCheck className="size-[18px] text-lp-muted" strokeWidth={1.75} />
      </span>
      <div>
        <p className="mb-1 text-[.98rem] font-bold text-lp-ink">{t("noCertsTitle")}</p>
        <p className="text-[.86rem] leading-relaxed text-lp-slate">{t("noCertsBody")}</p>
      </div>
    </div>
  );
}

function EmptyState({ t }: { t: T }) {
  return (
    <div className="rounded-2xl border border-dashed border-lp-line-strong bg-surface p-12 text-center">
      <p className="font-lp-heading text-[1.3rem] font-semibold text-lp-navy">
        {t("emptyNoCourse")}
      </p>
      <p className="mx-auto mt-2 max-w-[46ch] text-[.92rem] leading-relaxed text-lp-slate">
        {t("emptyNoCourseSub")}
      </p>
      <Button render={<Link href="/dashboard/catalog" />} className="mt-5">
        {t("browseCatalog")}
      </Button>
    </div>
  );
}
