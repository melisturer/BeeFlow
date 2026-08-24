import { startOfDay } from "date-fns";
import type { CalendarItem } from "@/app/(dashboard)/calendar/calendar-client";
import type { ContentType } from "@/generated/prisma/enums";
import { calendarDateKey, calendarDayIso } from "@/lib/calendar-day";
import { prisma } from "@/lib/db";
import {
  ensureRecurringTaskOccurrences,
  excludeTaskTemplatesFilter,
} from "@/lib/recurring-tasks";
import { ensureContentSlotsFromTasks } from "@/lib/ensure-content-slots";

/** Atanan (veya atanmamışsa oluşturan) / admin */
export function canActOnTask(
  task: { assigneeId: string | null; creatorId: string },
  userId?: string,
  admin?: boolean,
) {
  if (admin) return true;
  if (!userId) return false;
  return (
    task.assigneeId === userId ||
    (!task.assigneeId && task.creatorId === userId)
  );
}

/** Firma-gün: yalnızca tüm içerik/görevler kullanıcıya aitse (admin hariç) */
export function canActOnCompanyDay(
  parts: {
    contentAuthorIds: string[];
    tasks: { assigneeId: string | null; creatorId: string }[];
  },
  userId?: string,
  admin?: boolean,
) {
  if (admin) return true;
  if (!userId) return false;
  if (parts.contentAuthorIds.length === 0) return false;
  const contentsMine = parts.contentAuthorIds.every((id) => id === userId);
  const tasksMine = parts.tasks.every((t) => canActOnTask(t, userId, false));
  return contentsMine && tasksMine;
}

export async function getCalendarItems(scope: {
  userId?: string;
  /** Admin her işe dokunabilir */
  admin?: boolean;
} = {}): Promise<CalendarItem[]> {
  // Sonraki ~1 ay için yenilenen iş + içerik kopyalarını üret
  await ensureRecurringTaskOccurrences({ daysAhead: 31 });
  await ensureContentSlotsFromTasks({ daysAhead: 31 });

  const taskWhere = {
    dueDate: { not: null },
    ...excludeTaskTemplatesFilter(),
  };

  const [contents, tasks] = await Promise.all([
    prisma.content.findMany({
      include: {
        company: { select: { id: true, name: true } },
        author: true,
      },
      orderBy: [{ publishAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.task.findMany({
      where: taskWhere,
      include: { company: true, assignee: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  type Group = {
    companyId: string;
    companyName: string;
    dateKey: string;
    date: Date;
    contentIds: string[];
    contentAuthorIds: string[];
    doneCount: number;
    typeCounts: Partial<Record<ContentType, number>>;
    taskIds: string[];
    tasks: { assigneeId: string | null; creatorId: string }[];
  };

  const groups = new Map<string, Group>();

  for (const c of contents) {
    const day = startOfDay(c.publishAt ?? c.createdAt);
    const dateKey = calendarDateKey(day);
    const key = `${c.companyId}:${dateKey}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        companyId: c.companyId,
        companyName: c.company.name,
        dateKey,
        date: day,
        contentIds: [],
        contentAuthorIds: [],
        doneCount: 0,
        typeCounts: {},
        taskIds: [],
        tasks: [],
      };
      groups.set(key, g);
    }
    g.contentIds.push(c.id);
    g.contentAuthorIds.push(c.authorId);
    if (c.status === "PUBLISHED") g.doneCount += 1;
    g.typeCounts[c.type] = (g.typeCounts[c.type] ?? 0) + 1;
  }

  const taskItems: CalendarItem[] = [];

  for (const t of tasks) {
    if (!t.dueDate) continue;
    const day = startOfDay(t.occurrenceDate ?? t.dueDate);
    const dateKey = calendarDateKey(day);
    // Firma+gün içerik kartı varsa görev oraya bağlanır — ayrı kartla çift gösterme
    if (t.companyId) {
      const g = groups.get(`${t.companyId}:${dateKey}`);
      if (g) {
        g.taskIds.push(t.id);
        g.tasks.push({
          assigneeId: t.assigneeId,
          creatorId: t.creatorId,
        });
        continue;
      }
    }
    taskItems.push({
      kind: "task",
      id: t.id,
      title: t.title,
      date: calendarDayIso(day),
      companyId: t.companyId,
      companyName: t.company?.name ?? "Firma yok",
      personName: t.assignee?.name ?? "Atanmamış",
      priority: t.priority,
      status: t.status,
      recurring: !!t.recurrenceOfId,
      canToggle: canActOnTask(t, scope.userId, scope.admin),
    });
  }

  const companyDayItems: CalendarItem[] = [...groups.values()].map((g) => ({
    kind: "company-day" as const,
    id: `${g.companyId}:${g.dateKey}`,
    companyId: g.companyId,
    companyName: g.companyName,
    date: calendarDayIso(g.date),
    contentIds: g.contentIds,
    doneCount: g.doneCount,
    totalCount: g.contentIds.length,
    typeCounts: g.typeCounts,
    allDone:
      g.contentIds.length > 0 && g.doneCount === g.contentIds.length,
    taskIds: g.taskIds,
    canToggle: canActOnCompanyDay(
      { contentAuthorIds: g.contentAuthorIds, tasks: g.tasks },
      scope.userId,
      scope.admin,
    ),
  }));

  return [...companyDayItems, ...taskItems];
}

/** @deprecated use getCalendarItems */
export async function getCalendarContents(scope?: {
  userId?: string;
  admin?: boolean;
}) {
  return getCalendarItems(scope);
}
