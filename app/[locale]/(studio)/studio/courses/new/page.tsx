import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { createCourseAction } from "@/lib/content/actions";
import { CourseForm } from "@/components/studio/course-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function NewCoursePage() {
  await requireRole("teacher", "super_admin");
  const t = await getTranslations("Studio");

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/studio"
        className="text-sm text-navy-600 hover:underline"
      >
        ← {t("backToStudio")}
      </Link>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="font-heading text-2xl text-navy-800">
            {t("createCourseTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CourseForm action={createCourseAction} submitLabel={t("create")} />
        </CardContent>
      </Card>
    </section>
  );
}
