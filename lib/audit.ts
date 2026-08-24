import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Records an admin action for the audit trail (distributor approve/reject, dealer/ward/shipping
 * changes). Best-effort by design: an audit-log write must never fail the action it's recording,
 * so callers should not await this inside the same transaction as the mutation it describes.
 */
export async function recordAudit(entry: {
  actorId: number;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  reason?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId != null ? String(entry.entityId) : null,
        oldValue: entry.oldValue ?? undefined,
        newValue: entry.newValue ?? undefined,
        reason: entry.reason ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry:", error);
  }
}
