import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { auditLog } from "../schema";

/**
 * Audit trail for sensitive admin/teacher actions (role changes, publishes,
 * cert revokes). Append-only; read for the admin activity view.
 */
export const auditRepository = {
  async record(input: {
    actorUserId: string | null;
    action: string;
    entityType?: string;
    entityId?: string;
    meta?: unknown;
  }) {
    await db.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      meta: (input.meta ?? null) as object | null,
    });
  },

  async recent(limit = 20) {
    return db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
  },

  async forEntity(entityType: string, entityId: string) {
    return db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, entityId))
      .orderBy(desc(auditLog.createdAt));
  },
};
