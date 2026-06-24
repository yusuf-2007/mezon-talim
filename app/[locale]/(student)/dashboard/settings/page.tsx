import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { updateNotificationPrefsAction } from "@/lib/account/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChangePasswordForm } from "@/components/student/change-password-form";

export default async function StudentSettingsPage() {
  const sessionUser = await requireUser();
  const t = await getTranslations("Student");
  const user = await usersRepository.findById(sessionUser.id);
  if (!user) notFound();

  return (
    <div className="space-y-10">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("settingsTitle")}
      </h1>

      {/* Security */}
      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-navy-800">
          {t("security")}
        </h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-navy-800">
          {t("notifications")}
        </h2>
        <form action={updateNotificationPrefsAction} className="mt-4 max-w-md space-y-4">
          <label className="flex items-center gap-3">
            <Switch name="notifyEmail" value="true" defaultChecked={user.notifyEmail} />
            <span className="text-sm">{t("notifyEmail")}</span>
          </label>
          <label className="flex items-center gap-3">
            <Switch name="notifySms" value="true" defaultChecked={user.notifySms} />
            <span className="text-sm">{t("notifySms")}</span>
          </label>
          <Button type="submit">{t("saveSettings")}</Button>
        </form>
      </section>
    </div>
  );
}
