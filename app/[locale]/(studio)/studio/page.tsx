import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { listStudioCourses } from "@/lib/content/access";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { StatusBadge } from "@/components/studio/status-badge";
import { formatTiyin } from "@/lib/payments";

export default async function StudioPage() {
  const user = await requireRole("teacher", "super_admin");
  const t = await getTranslations("Studio");
  const courses = await listStudioCourses(user.id, user.role);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-navy-800">
            {t("title")}
          </h1>
          <p className="mt-1 text-slate-500">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/studio/courses/new" />}>
            {t("newCourse")}
          </Button>
          <LogoutButton />
        </div>
      </div>

      {courses.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-line bg-surface p-10 text-center text-slate-500">
          {t("noCourses")}
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/studio/courses/${c.id}`}
                className="block h-full rounded-xl border border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-heading text-lg font-semibold text-navy-800">
                    {c.title.uz}
                  </h2>
                  <StatusBadge status={c.status} />
                </div>
                {c.summary?.uz && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                    {c.summary.uz}
                  </p>
                )}
                <p className="mt-4 text-sm font-medium tabular-nums text-navy-600">
                  {c.priceTiyin > 0 ? formatTiyin(c.priceTiyin) : t("free")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
