import { getTranslations } from "next-intl/server";
import {
  deleteCourseAction,
  setCourseStatusAction,
} from "@/lib/content/actions";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { ConfirmSubmit } from "./confirm-submit";

type Status = "draft" | "published" | "archived";

/** Publish / unpublish / archive / delete controls for a course. */
export async function CourseStatusControls({
  courseId,
  status,
}: {
  courseId: string;
  status: Status;
}) {
  const t = await getTranslations("Studio");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={status} />

      {status !== "published" && (
        <form action={setCourseStatusAction.bind(null, courseId, "published")}>
          <Button type="submit" size="sm">
            {t("publish")}
          </Button>
        </form>
      )}
      {status === "published" && (
        <form action={setCourseStatusAction.bind(null, courseId, "draft")}>
          <Button type="submit" size="sm" variant="outline">
            {t("unpublish")}
          </Button>
        </form>
      )}
      {status !== "archived" && (
        <form action={setCourseStatusAction.bind(null, courseId, "archived")}>
          <Button type="submit" size="sm" variant="outline">
            {t("archive")}
          </Button>
        </form>
      )}

      <form action={deleteCourseAction.bind(null, courseId)} className="ml-auto">
        <ConfirmSubmit label={t("delete")} variant="ghost" />
      </form>
    </div>
  );
}
