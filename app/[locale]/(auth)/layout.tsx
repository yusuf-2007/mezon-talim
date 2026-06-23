import { getCurrentUser } from "@/lib/auth";
import { landingPathForRole } from "@/lib/auth/landing";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { Link } from "@/lib/i18n/navigation";
import { BrandWordmark } from "@/components/brand-wordmark";

/** Centered shell for unauthenticated flows. Signed-in users are sent home. */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user) return redirectLocalized(landingPathForRole(user.role));

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 flex justify-center">
        <Link href="/">
          <BrandWordmark />
        </Link>
      </div>
      {children}
    </div>
  );
}
