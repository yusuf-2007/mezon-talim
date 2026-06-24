import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { Link } from "@/lib/i18n/navigation";
import { ProfileEditForm } from "@/components/student/profile-edit-form";

export default async function StudentProfileEditPage() {
  const sessionUser = await requireUser();
  const t = await getTranslations("Student");
  const user = await usersRepository.findById(sessionUser.id);
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/profile" className="text-sm text-navy-600 hover:underline">
        ← {t("profileTitle")}
      </Link>
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("editProfileTitle")}
      </h1>
      <ProfileEditForm
        fullName={user.fullName}
        email={user.email}
        bio={user.bio}
      />
    </div>
  );
}
