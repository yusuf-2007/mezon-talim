import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { emailVerificationsRepository } from "@/lib/db/repositories/email-verifications";
import { updateNotificationPrefsAction } from "@/lib/account/actions";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AccountCredentials } from "@/components/student/account-credentials";

export default async function StudentSettingsPage() {
  const sessionUser = await requireUser();
  const t = await getTranslations("Student");
  const [user, pending] = await Promise.all([
    usersRepository.findById(sessionUser.id),
    emailVerificationsRepository.findActiveForUser(sessionUser.id),
  ]);
  if (!user) notFound();

  return (
    <div className="space-y-10">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("settingsTitle")}
      </h1>

      {/* Sign-in credentials: phone, email, password */}
      <AccountCredentials
        email={user.email}
        emailVerified={Boolean(user.emailVerified)}
        pendingEmail={pending?.email ?? null}
        phone={user.phone}
        phoneVerified={Boolean(user.phoneVerified)}
        hasPassword={Boolean(user.passwordHash)}
        otpEnabled={env.OTP_LOGIN_ENABLED}
      />

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
