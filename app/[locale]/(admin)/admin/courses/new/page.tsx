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

/** Admin create-course — reuses the Studio CourseForm; redirects within /admin. */
export default async function AdminNewCoursePage() {
  await requireRole("super_admin");
  const tS = await getTranslations("Studio");
  const tA = await getTranslations("Admin");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/courses" className="text-sm text-navy-600 hover:underline">
        ← {tA("coursesTitle")}
      </Link>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="font-heading text-2xl text-navy-800">
            {tS("createCourseTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CourseForm
            action={createCourseAction.bind(null, "/admin")}
            submitLabel={tS("create")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
