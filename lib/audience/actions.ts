"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { auditRepository } from "@/lib/db/repositories/audit";
import {
  POLL_VARIANTS,
  settingsRepository,
  type PollVariant,
} from "@/lib/db/repositories/settings";

/**
 * Set the entry-poll's visual treatment (super_admin only). Audited. The poll
 * reads this via a public cached endpoint, so a change propagates to visitors
 * within ~a minute rather than needing a redeploy.
 */
export async function setPollVariantAction(variant: string): Promise<void> {
  const actor = await requireRole("super_admin");
  if (!(POLL_VARIANTS as readonly string[]).includes(variant)) {
    throw new Error("Invalid poll variant");
  }
  const before = await settingsRepository.getPollVariant();
  await settingsRepository.setPollVariant(variant as PollVariant, actor.id);
  await auditRepository.record({
    actorUserId: actor.id,
    action: "settings.poll_variant_change",
    entityType: "app_setting",
    entityId: "audience.poll_variant",
    meta: { from: before, to: variant },
  });
  revalidatePath("/admin/audience");
}
