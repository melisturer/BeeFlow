import {
  addDays,
  endOfDay,
  format,
  getDate,
  getDay,
  startOfDay,
} from "date-fns";
import type { TaskRecurrence } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

function dueAtNoon(day: Date) {
  const d = startOfDay(day);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function occurrenceDateKey(day: Date) {
  return format(startOfDay(day), "yyyy-MM-dd");
}

export function parseSkippedOccurrenceDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function shouldSpawnOnDay(
  recurrence: TaskRecurrence,
  templateAnchor: Date,
  day: Date,
) {
  if (recurrence === "DAILY") return true;
  if (recurrence === "WEEKLY") {
    return getDay(day) === getDay(templateAnchor);
  }
  if (recurrence === "MONTHLY") {
    // Ayın aynı günü (31 yoksa ayın son günü)
    const target = getDate(templateAnchor);
    const dayOfMonth = getDate(day);
    const lastDay = getDate(new Date(day.getFullYear(), day.getMonth() + 1, 0));
    if (target > lastDay) return dayOfMonth === lastDay;
    return dayOfMonth === target;
  }
  return false;
}

async function deleteContentsForDays(
  days: Array<{ companyId: string; day: Date }>,
) {
  const seen = new Set<string>();
  for (const { companyId, day } of days) {
    const dayStart = startOfDay(day);
    const key = `${companyId}:${occurrenceDateKey(dayStart)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const dayEnd = addDays(dayStart, 1);
    await prisma.content.deleteMany({
      where: {
        companyId,
        OR: [
          { publishAt: { gte: dayStart, lt: dayEnd } },
          {
            publishAt: null,
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        ],
      },
    });
  }
}

/** Tekrarlayan şablonlardan (bugün + N gün) eksik kopyaları oluşturur. */
export async function ensureRecurringTaskOccurrences(opts?: {
  daysAhead?: number;
  from?: Date;
}) {
  const daysAhead = Math.min(Math.max(opts?.daysAhead ?? 7, 1), 31);
  const from = startOfDay(opts?.from ?? new Date());

  const templates = await prisma.task.findMany({
    where: {
      recurrence: { in: ["DAILY", "WEEKLY", "MONTHLY"] },
      recurrenceOfId: null,
    },
  });

  if (templates.length === 0) return { created: 0 };

  let created = 0;

  for (const template of templates) {
    const anchor = template.dueDate ?? template.startDate ?? template.createdAt;
    const skipped = new Set(
      parseSkippedOccurrenceDates(template.skippedOccurrenceDates),
    );

    for (let i = 0; i < daysAhead; i += 1) {
      const day = addDays(from, i);
      if (!shouldSpawnOnDay(template.recurrence, anchor, day)) continue;

      const dayStart = startOfDay(day);
      const dayEnd = addDays(dayStart, 1);
      const key = occurrenceDateKey(dayStart);
      if (skipped.has(key)) continue;

      // Aralık sorgusu: TZ / gece yarısı kaymalarında kaçırmasın
      const existing = await prisma.task.findFirst({
        where: {
          recurrenceOfId: template.id,
          OR: [
            { occurrenceDate: { gte: dayStart, lt: dayEnd } },
            {
              occurrenceDate: null,
              dueDate: { gte: dayStart, lt: dayEnd },
            },
          ],
        },
        select: { id: true },
      });
      if (existing) continue;

      const due = dueAtNoon(day);
      await prisma.task.create({
        data: {
          title: template.title,
          description: template.description,
          companyId: template.companyId,
          assigneeId: template.assigneeId,
          creatorId: template.creatorId,
          priority: template.priority,
          status: "WAITING",
          startDate: dayStart,
          dueDate: due,
          planPeriod: template.planPeriod,
          planPosts: 0,
          planStories: 0,
          planReels: 0,
          planVideos: 0,
          recurrence: "NONE",
          recurrenceOfId: template.id,
          occurrenceDate: due,
        },
      });
      created += 1;
    }
  }

  return { created };
}

/**
 * Silinen işlerin gününü şablona işle, otomatik içerikleri temizle.
 * Son kopyalar silinince şablon da kaldırılır (takvimde yeniden doğmasın).
 */
export async function suppressDeletedTasks(
  tasks: Array<{
    id: string;
    title: string;
    companyId: string | null;
    recurrence: TaskRecurrence;
    recurrenceOfId: string | null;
    occurrenceDate: Date | null;
    dueDate: Date | null;
    startDate: Date | null;
    createdAt: Date;
  }>,
) {
  const templateIdsToDelete = new Set<string>();
  const skipsByTemplate = new Map<string, Set<string>>();
  const contentDays: Array<{ companyId: string; day: Date }> = [];
  const deleteIds = new Set(tasks.map((t) => t.id));

  for (const task of tasks) {
    if (task.recurrence !== "NONE" && task.recurrenceOfId == null) {
      templateIdsToDelete.add(task.id);
      continue;
    }
    if (task.recurrenceOfId && task.occurrenceDate) {
      const key = occurrenceDateKey(task.occurrenceDate);
      const set = skipsByTemplate.get(task.recurrenceOfId) ?? new Set();
      set.add(key);
      skipsByTemplate.set(task.recurrenceOfId, set);
      if (task.companyId) {
        contentDays.push({
          companyId: task.companyId,
          day: task.occurrenceDate,
        });
      }
    } else if (task.companyId && task.dueDate) {
      contentDays.push({ companyId: task.companyId, day: task.dueDate });
    }
  }

  // Bu silme ile şablonun tüm kopyaları gidiyorsa şablonu da sil
  for (const templateId of [...skipsByTemplate.keys()]) {
    const remaining = await prisma.task.count({
      where: {
        recurrenceOfId: templateId,
        id: { notIn: [...deleteIds] },
      },
    });
    if (remaining === 0) {
      templateIdsToDelete.add(templateId);
      skipsByTemplate.delete(templateId);
    }
  }

  for (const [templateId, keys] of skipsByTemplate) {
    const template = await prisma.task.findUnique({
      where: { id: templateId },
      select: { skippedOccurrenceDates: true },
    });
    if (!template) continue;
    const merged = new Set([
      ...parseSkippedOccurrenceDates(template.skippedOccurrenceDates),
      ...keys,
    ]);
    await prisma.task.update({
      where: { id: templateId },
      data: {
        skippedOccurrenceDates: [...merged] as Prisma.InputJsonValue,
      },
    });
  }

  // Silinen şablonların önümüzdeki günlerindeki otomatik içerikleri temizle
  if (templateIdsToDelete.size > 0) {
    const templates = await prisma.task.findMany({
      where: { id: { in: [...templateIdsToDelete] } },
      select: {
        companyId: true,
        recurrence: true,
        dueDate: true,
        startDate: true,
        createdAt: true,
      },
    });
    const from = startOfDay(new Date());
    for (const template of templates) {
      if (!template.companyId) continue;
      const anchor =
        template.dueDate ?? template.startDate ?? template.createdAt;
      for (let i = 0; i < 14; i += 1) {
        const day = addDays(from, i);
        if (
          template.recurrence === "NONE" ||
          shouldSpawnOnDay(template.recurrence, anchor, day)
        ) {
          contentDays.push({ companyId: template.companyId, day });
        }
      }
    }
  }

  await deleteContentsForDays(contentDays);

  const ids = [...deleteIds];
  await prisma.task.deleteMany({
    where: {
      id: { in: ids },
      NOT: {
        AND: [{ recurrenceOfId: null }, { recurrence: { not: "NONE" } }],
      },
    },
  });

  if (templateIdsToDelete.size > 0) {
    await prisma.task.deleteMany({
      where: { id: { in: [...templateIdsToDelete] } },
    });
  }
}

/** Liste / takvimde şablonları gizle (sadece günlük kopyalar görünsün). */
export function excludeTaskTemplatesFilter() {
  return {
    NOT: {
      AND: [{ recurrenceOfId: null }, { recurrence: { not: "NONE" as const } }],
    },
  };
}

export function isTaskTemplate(task: {
  recurrence: TaskRecurrence;
  recurrenceOfId: string | null;
}) {
  return task.recurrence !== "NONE" && task.recurrenceOfId == null;
}

export function dayRange(day: Date = new Date()) {
  return { start: startOfDay(day), end: endOfDay(day) };
}
