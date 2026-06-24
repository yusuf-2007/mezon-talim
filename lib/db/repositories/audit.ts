import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { auditLog, users } from "../schema";

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

  /** Recent audit entries with the acting admin's name (for the viewer page). */
  async recentWithActor(limit = 100) {
    return db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        meta: auditLog.meta,
        createdAt: auditLog.createdAt,
        actorName: users.fullName,
        actorEmail: users.email,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
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
