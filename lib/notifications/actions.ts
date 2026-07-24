"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { userNotificationsRepository } from "@/lib/db/repositories/user-notifications";

/** Bell actions — every mutation is scoped to the calling user in the repo. */

const uuidSchema = z.string().uuid();

export async function markNotificationReadAction(id: string): Promise<void> {
  const user = await requireUser();
  if (!uuidSchema.safeParse(id).success) return;
  await userNotificationsRepository.markRead(id, user.id);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await userNotificationsRepository.markAllRead(user.id);
}
