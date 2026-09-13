import { env } from "@/lib/env";
import { AuthEntry } from "@/components/auth/auth-entry";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The one door in. Signing in and signing up are the same flow for a phone
 * number, so /signup redirects here rather than offering a second, divergent
 * form; see components/auth/auth-entry.
 *
 * The heading lives inside AuthEntry: it has to name the current step, and the
 * step is client state.
 */
export default async function LoginPage() {
  return (
    <Card>
      <CardContent className="pt-6">
        <AuthEntry otpEnabled={env.OTP_LOGIN_ENABLED} />
      </CardContent>
    </Card>
  );
}
