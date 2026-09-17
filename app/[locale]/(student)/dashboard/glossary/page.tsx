import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { glossaryRepository } from "@/lib/db/repositories/glossary";
import { pickLocale } from "@/lib/i18n/localized";
import { PageHeader } from "@/components/student/page-header";
import { GlossaryBrowser } from "@/components/student/glossary-browser";
import type { Locale } from "@/lib/i18n/routing";

/**
 * The glossary as a library rather than a lesson aside (B9).
 *
 * Terms are the language bridge: the course is taught in Uzbek while the
 * standards and the AAOIFI exam are in English, so a student needs somewhere to
 * look one up without hunting for the lesson that introduced it. Filtering is
 * client-side because the whole set is a few dozen rows — a round trip per
 * keystroke would be slower than the typing.
 */
export default async function GlossaryPage() {
  const user = await requireUser();
  const t = await getTranslations("Student");
  const locale = (await getLocale()) as Locale;

  const rows = await glossaryRepository.listForUser(user.id);
  const terms = rows.map((r) => ({
    id: r.id,
    term: r.term,
    definition: pickLocale(r.definition, locale),
    scope: r.courseTitle ? pickLocale(r.courseTitle, locale) : null,
  }));

  return (
    <>
      <PageHeader
        eyebrow={t("navGlossary")}
        title={t("subGlossary")}
        userId={user.id}
        role={user.role}
      />
      <GlossaryBrowser terms={terms} />
      <p className="mt-4 px-1 text-[.8rem] text-lp-muted">{t("glossaryNote")}</p>
    </>
  );
}
