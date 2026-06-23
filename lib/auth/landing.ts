import type { Role } from "./types";

/** Where each role lands after sign-in (locale is added by the caller's redirect). */
export function landingPathForRole(role: Role): string {
  switch (role) {
    case "teacher":
      return "/studio";
    case "super_admin":
    case "accountant":
      return "/admin";
    case "student":
    default:
      return "/dashboard";
  }
}
