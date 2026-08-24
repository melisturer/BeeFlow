import { prisma } from "@/lib/db";

export async function logActivity(params: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown> | string | null;
}) {
  await prisma.activityLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      meta:
        typeof params.meta === "string" || params.meta == null
          ? (params.meta ?? null)
          : JSON.stringify(params.meta),
    },
  });
}
