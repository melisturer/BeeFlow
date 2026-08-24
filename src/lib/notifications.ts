import {
  ContentStatus,
  NotificationType,
  TaskStatus,
} from "@/generated/prisma/client";
import { prisma, resetPrismaClient } from "@/lib/db";
import { endOfDay, startOfDay, subDays, addDays, isSameDay } from "date-fns";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}) {
  const client = (globalThis as unknown as { prisma?: typeof prisma }).prisma ?? prisma;
  await client.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      entityType: params.entityType,
      entityId: params.entityId,
    },
  });
}

function isPoolTimeout(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("pool timeout") || message.includes("45028");
}

function getClient() {
  return (globalThis as unknown as { prisma?: typeof prisma }).prisma ?? prisma;
}

/** Dashboard açılışında teslim tarihi hatırlatmalarını üret */
export async function syncDueDateNotifications(userId: string) {
  try {
    await syncDueDateNotificationsInner(userId);
  } catch (error) {
    if (isPoolTimeout(error)) {
      try {
        await resetPrismaClient();
        await syncDueDateNotificationsInner(userId);
        return;
      } catch (retryError) {
        console.error("Bildirim senkronu (retry) atlandı:", retryError);
        return;
      }
    }
    console.error("Bildirim senkronu atlandı:", error);
  }
}

async function syncDueDateNotificationsInner(userId: string) {
  const client = getClient();
  const now = new Date();
  const todayStart = startOfDay(now);
  const in3 = endOfDay(addDays(now, 3));

  const tasks = await client.task.findMany({
    where: {
      assigneeId: userId,
      status: { not: TaskStatus.DONE },
      dueDate: { not: null, lte: in3 },
    },
  });

  for (const task of tasks) {
    if (!task.dueDate) continue;

    let type: NotificationType | null = null;
    if (task.dueDate < todayStart) type = NotificationType.TASK_OVERDUE;
    else if (isSameDay(task.dueDate, now)) type = NotificationType.DUE_TODAY;
    else if (isSameDay(task.dueDate, addDays(now, 1)))
      type = NotificationType.DUE_IN_1_DAY;
    else if (isSameDay(task.dueDate, addDays(now, 3)))
      type = NotificationType.DUE_IN_3_DAYS;

    if (!type) continue;

    const since = subDays(now, 1);
    const existing = await client.notification.findFirst({
      where: {
        userId,
        type,
        entityType: "Task",
        entityId: task.id,
        createdAt: { gte: since },
      },
    });
    if (existing) continue;

    const titles: Record<string, string> = {
      TASK_OVERDUE: "Görev gecikti",
      DUE_TODAY: "Bugün teslim",
      DUE_IN_1_DAY: "Teslim tarihine 1 gün kaldı",
      DUE_IN_3_DAYS: "Teslim tarihine 3 gün kaldı",
    };

    await client.notification.create({
      data: {
        userId,
        type,
        title: titles[type] ?? "Görev hatırlatması",
        body: `"${task.title}" görevi için teslim hatırlatması.`,
        entityType: "Task",
        entityId: task.id,
      },
    });
  }

  const todaysContent = await client.content.findMany({
    where: {
      authorId: userId,
      status: { in: [ContentStatus.SCHEDULED, ContentStatus.APPROVED] },
      publishAt: { gte: startOfDay(now), lte: endOfDay(now) },
    },
  });

  for (const content of todaysContent) {
    const existing = await client.notification.findFirst({
      where: {
        userId,
        type: NotificationType.CONTENT_SCHEDULED_TODAY,
        entityType: "Content",
        entityId: content.id,
        createdAt: { gte: startOfDay(now) },
      },
    });
    if (existing) continue;

    await client.notification.create({
      data: {
        userId,
        type: NotificationType.CONTENT_SCHEDULED_TODAY,
        title: "Bugün planlanan paylaşım",
        body: `"${content.title}" içeriği bugün planlandı.`,
        entityType: "Content",
        entityId: content.id,
      },
    });
  }
}
