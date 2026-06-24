import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { userAvatarsRepository } from "@/lib/db/repositories/user-avatars";
import { Link } from "@/lib/i18n/navigation";
import { ProfileEditForm } from "@/components/student/profile-edit-form";
import { AvatarUploadForm } from "@/components/student/avatar-upload-form";

export default async function StudentProfileEditPage() {
  const sessionUser = await requireUser();
  const t = await getTranslations("Student");
  const [user, hasAvatar] = await Promise.all([
    usersRepository.findById(sessionUser.id),
    userAvatarsRepository.exists(sessionUser.id),
  ]);
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/profile" className="text-sm text-navy-600 hover:underline">
        ← {t("profileTitle")}
      </Link>
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("editProfileTitle")}
      </h1>
      <AvatarUploadForm
        userId={user.id}
        name={user.fullName}
        email={user.email}
        hasAvatar={hasAvatar}
      />
      <ProfileEditForm
        fullName={user.fullName}
        email={user.email}
        bio={user.bio}
      />
    </div>
  );
}
