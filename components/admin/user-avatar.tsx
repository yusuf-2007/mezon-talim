import { cn } from "@/lib/utils";

/** Two-letter initials from a name (or email) for the avatar fallback. */
export function initials(name: string | null, email: string | null): string {
  const s = (name || email || "?").trim();
  const parts = s.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1])
    return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

/** Initials avatar circle used across the admin user/roster tables. */
export function UserAvatar({
  name,
  email,
  className,
}: {
  name: string | null;
  email: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-800",
        className,
      )}
    >
      {initials(name, email)}
    </span>
  );
}
