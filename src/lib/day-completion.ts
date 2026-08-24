import { addDays, startOfDay } from "date-fns";
import { ContentStatus, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { excludeTaskTemplatesFilter } from "@/lib/recurring-tasks";

/** Firma + gün için tüm içerikler PUBLISHED mi? */
export async function isCompanyDayContentsDone(
  companyId: string,
  day: Date,
): Promise<{ total: number; done: number; allDone: boolean }> {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  const contents = await prisma.content.findMany({
    where: {
      companyId,
      publishAt: { gte: dayStart, lt: dayEnd },
    },
    select: { status: true },
  });

  const total = contents.length;
  const done = contents.filter((c) => c.status === "PUBLISHED").length;
  return { total, done, allDone: total > 0 && done === total };
}

function dayTaskWhere(companyId: string, dayStart: Date, dayEnd: Date) {
  return {
    companyId,
    ...excludeTaskTemplatesFilter(),
    OR: [
      { occurrenceDate: dayStart },
      {
        occurrenceDate: null,
        dueDate: { gte: dayStart, lt: dayEnd },
      },
    ],
  };
}

/**
 * Günlük kontrol tamamlanınca o günkü firma görevlerini DONE yapar;
 * geri alınırsa DONE olanları WAITING’e çeker.
 */
export async function syncCompanyDayTaskCompletion(
  companyId: string,
  day: Date,
) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const { total, allDone } = await isCompanyDayContentsDone(companyId, day);

  if (total === 0) {
    return { synced: false, allDone: false };
  }

  const where = dayTaskWhere(companyId, dayStart, dayEnd);

  if (allDone) {
    await prisma.task.updateMany({
      where: {
        ...where,
        status: { not: TaskStatus.DONE },
      },
      data: { status: TaskStatus.DONE },
    });
  } else {
    await prisma.task.updateMany({
      where: {
        ...where,
        status: TaskStatus.DONE,
      },
      data: { status: TaskStatus.WAITING },
    });
  }

  return { synced: true, allDone };
}

/**
 * Dashboard / görev “Tamamla” → takvim firma-gün kartı da güncellensin.
 * Görevi DONE yapınca o günün içeriklerini PUBLISHED; geri alınca SCHEDULED.
 */
export async function syncTaskDoneToCompanyDayContents(task: {
  companyId: string | null;
  dueDate: Date | null;
  occurrenceDate: Date | null;
  createdAt: Date;
  status: TaskStatus;
}) {
  if (!task.companyId) return { synced: false };

  const dayStart = startOfDay(
    task.occurrenceDate ?? task.dueDate ?? task.createdAt,
  );
  const dayEnd = addDays(dayStart, 1);
  const done = task.status === TaskStatus.DONE;

  const contents = await prisma.content.findMany({
    where: {
      companyId: task.companyId,
      publishAt: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true, publishAt: true },
  });

  if (contents.length === 0) {
    return { synced: false };
  }

  await prisma.content.updateMany({
    where: { id: { in: contents.map((c) => c.id) } },
    data: {
      status: done ? ContentStatus.PUBLISHED : ContentStatus.SCHEDULED,
    },
  });

  // Aynı günün diğer görevlerini de hizala
  await syncCompanyDayTaskCompletion(task.companyId, dayStart);

  return { synced: true, day: dayStart, contentCount: contents.length };
}
