import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { emailVerificationsRepository } from "@/lib/db/repositories/email-verifications";
import { userAvatarsRepository } from "@/lib/db/repositories/user-avatars";
import { updateNotificationPrefsAction } from "@/lib/account/actions";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/student/page-header";
import { AccountCredentials } from "@/components/student/account-credentials";
import { AvatarUploadForm } from "@/components/student/avatar-upload-form";
import { ProfileEditForm } from "@/components/student/profile-edit-form";
import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * One settings page with a section index, rather than settings split across
 * /profile and /settings as before.
 *
 * Everything here is "my account", and a student looking for their phone number
 * should not have to guess which of two pages it lives on. The anchors let the
 * index jump without turning each section into its own route.
 */
export default async function StudentSettingsPage() {
  const sessionUser = await requireUser();
  const t = await getTranslations("Student");

  const [user, pending, hasAvatar] = await Promise.all([
    usersRepository.findById(sessionUser.id),
    emailVerificationsRepository.findActiveForUser(sessionUser.id),
    userAvatarsRepository.exists(sessionUser.id),
  ]);
  if (!user) notFound();

  const sections = [
    { id: "profile", label: t("settingsProfile") },
    { id: "notifications", label: t("settingsNotifications") },
    { id: "security", label: t("settingsSecurity") },
    { id: "language", label: t("settingsLanguage") },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("navSettings")}
        title={t("subSettings")}
        userId={sessionUser.id}
        role={sessionUser.role}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="sticky top-7 hidden flex-col gap-0.5 lg:flex">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-[9px] px-3.5 py-2.5 text-[.88rem] font-semibold text-lp-slate transition-colors hover:bg-lp-wash hover:text-lp-navy"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-[18px]">
          <Card id="profile" eyebrow={t("settingsProfile")} title={t("profileHeading")}>
            <div className="border-b border-lp-line-soft p-6">
              <AvatarUploadForm
                userId={user.id}
                name={user.fullName}
                email={user.email}
                hasAvatar={hasAvatar}
                bare
              />
            </div>
            <div className="p-6">
              <ProfileEditForm fullName={user.fullName} bio={user.bio} bare />
            </div>
          </Card>

          <Card
            id="notifications"
            eyebrow={t("settingsNotifications")}
            title={t("notificationsHeading")}
          >
            <form action={updateNotificationPrefsAction}>
              <ToggleRow
                name="notifyEmail"
                checked={user.notifyEmail}
                title={t("notifyEmail")}
                sub={t("notifyEmailSub")}
              />
              <ToggleRow
                name="notifySms"
                checked={user.notifySms}
                title={t("notifySms")}
                sub={t("notifySmsSub")}
              />
              <div className="flex justify-end border-t border-lp-line-soft bg-lp-wash-alt px-6 py-4">
                <Button type="submit">{t("saveSettings")}</Button>
              </div>
            </form>
          </Card>

          <div id="security" className="scroll-mt-7">
            <AccountCredentials
              eyebrow={t("settingsSecurity")}
              email={user.email}
              emailVerified={Boolean(user.emailVerified)}
              pendingEmail={pending?.email ?? null}
              phone={user.phone}
              phoneVerified={Boolean(user.phoneVerified)}
              hasPassword={Boolean(user.passwordHash)}
              otpEnabled={env.OTP_LOGIN_ENABLED}
            />
          </div>

          <Card id="language" eyebrow={t("settingsLanguage")} title={t("languageHeading")}>
            <div className="p-6">
              <LanguageSwitcher />
              <p className="mt-3 text-[.78rem] leading-relaxed text-lp-muted">
                {t("languageNote")}
              </p>
            </div>
          </Card>

          {/* Account deletion is a request, not a button: certificates already
              issued must stay verifiable, so a real erase needs a human. */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-lp-danger-line px-6 py-5">
            <div>
              <p className="text-[.92rem] font-bold text-lp-ink">{t("dangerTitle")}</p>
              <p className="mt-0.5 text-[.82rem] text-lp-muted">{t("dangerBody")}</p>
            </div>
            <a
              href={`mailto:admin@mezontalim.uz?subject=${encodeURIComponent(t("dangerTitle"))}`}
              className="text-[.84rem] font-bold text-lp-danger hover:underline"
            >
              {t("dangerAction")}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-7 overflow-hidden rounded-2xl border border-lp-line bg-surface shadow-[0_2px_10px_rgba(2,58,105,.05)]"
    >
      <div className="border-b border-lp-line-soft px-6 py-5">
        <p className="mb-1 text-[.72rem] font-bold uppercase tracking-[.14em] text-lp-gold-deep">
          {eyebrow}
        </p>
        <h3 className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  name,
  checked,
  title,
  sub,
}: {
  name: string;
  checked: boolean;
  title: string;
  sub: string;
}) {
  return (
    <label className="flex items-center justify-between gap-5 border-b border-lp-line-soft px-6 py-4">
      <span>
        <span className="block text-[.94rem] font-semibold text-lp-ink">{title}</span>
        <span className="mt-0.5 block text-[.82rem] leading-relaxed text-lp-muted">{sub}</span>
      </span>
      <Switch name={name} value="true" defaultChecked={checked} />
    </label>
  );
}
