"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  NotificationType,
  PlanPeriod,
  Prisma,
  Role,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
} from "@/generated/prisma/client";
import { logActivity } from "@/lib/activity";
import { parsePlanInt } from "@/lib/content-plan";
import { syncTaskDoneToCompanyDayContents } from "@/lib/day-completion";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import {
  ensureContentSlotsFromTasks,
  pruneCompletedPastWork,
  pruneOrphanAutoContents,
} from "@/lib/ensure-content-slots";
import { parsePlanTimesFromForm } from "@/lib/plan-times";
import {
  ensureRecurringTaskOccurrences,
  suppressDeletedTasks,
} from "@/lib/recurring-tasks";
import { requireSession } from "@/lib/session";

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  status: z.enum(["WAITING", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  planPeriod: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  planPosts: z.number().int().min(0).max(999),
  planStories: z.number().int().min(0).max(999),
  planReels: z.number().int().min(0).max(999),
  planVideos: z.number().int().min(0).max(999),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]),
});

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Geçersiz tarih");
  return d;
}

function parseTask(formData: FormData) {
  return taskSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    companyId: formData.get("companyId") || null,
    assigneeId: formData.get("assigneeId") || null,
    priority: formData.get("priority") || "NORMAL",
    status: formData.get("status") || undefined,
    startDate: formData.get("startDate") || null,
    dueDate: formData.get("dueDate") || null,
    planPeriod: formData.get("planPeriod") || "WEEKLY",
    planPosts: parsePlanInt(formData, "planPosts"),
    planStories: parsePlanInt(formData, "planStories"),
    planReels: parsePlanInt(formData, "planReels"),
    planVideos: parsePlanInt(formData, "planVideos"),
    recurrence: formData.get("recurrence") || "NONE",
  });
}

function revalidateTasks(id?: string, companyId?: string | null) {
  revalidatePath("/work");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/contents");
  revalidatePath("/contents/new");
  revalidatePath("/companies");
  revalidatePath("/");
  if (id) revalidatePath(`/tasks/${id}`);
  if (companyId) revalidatePath(`/companies/${companyId}`);
}

export async function createTask(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== Role.ADMIN) {
    throw new Error("İş tanımlama yalnızca admin tarafından yapılabilir");
  }
  const data = parseTask(formData);
  const planTimes = parsePlanTimesFromForm(formData, {
    planPosts: data.planPosts,
    planStories: data.planStories,
    planReels: data.planReels,
    planVideos: data.planVideos,
  });
  const assigneeId = data.assigneeId || null;

  const recurrence = data.recurrence as TaskRecurrence;
  // Formda tarih yok: tek seferlik bugüne, tekrarlayan şablon anchor = createdAt
  let dueDate = parseOptionalDate(data.dueDate);
  let startDate = parseOptionalDate(data.startDate);
  if (recurrence === TaskRecurrence.NONE && !dueDate) {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    dueDate = noon;
    startDate = startDate ?? new Date(noon);
    startDate.setHours(0, 0, 0, 0);
  }

  // Yineleme seçildiyse hedef dönemini aynı periyoda hizala
  const planPeriod =
    recurrence === TaskRecurrence.DAILY
      ? PlanPeriod.DAILY
      : recurrence === TaskRecurrence.WEEKLY
        ? PlanPeriod.WEEKLY
        : recurrence === TaskRecurrence.MONTHLY
          ? PlanPeriod.MONTHLY
          : (data.planPeriod as PlanPeriod);

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description,
      companyId: data.companyId || null,
      assigneeId,
      creatorId: session.user.id,
      priority: data.priority as TaskPriority,
      status: TaskStatus.WAITING,
      startDate,
      dueDate,
      planPeriod,
      planPosts: data.planPosts,
      planStories: data.planStories,
      planReels: data.planReels,
      planVideos: data.planVideos,
      planTimes:
        Object.keys(planTimes).length > 0
          ? (planTimes as Prisma.InputJsonValue)
          : Prisma.DbNull,
      recurrence,
    },
  });

  if (task.assigneeId && task.recurrence === TaskRecurrence.NONE) {
    await createNotification({
      userId: task.assigneeId,
      type: NotificationType.TASK_ASSIGNED,
      title: "Yeni görev atandı",
      body: `"${task.title}" görevi size atandı.`,
      entityType: "Task",
      entityId: task.id,
    });
  }

  if (task.recurrence !== TaskRecurrence.NONE) {
    await ensureRecurringTaskOccurrences({ daysAhead: 31 });
  }
  await ensureContentSlotsFromTasks({ daysAhead: 31 });

  await logActivity({
    actorId: session.user.id,
    action:
      task.recurrence !== TaskRecurrence.NONE
        ? "Tekrarlayan görev şablonu oluşturuldu"
        : "Görev oluşturuldu",
    entityType: "Task",
    entityId: task.id,
    meta: { title: task.title, recurrence: task.recurrence },
  });

  revalidateTasks(task.id, task.companyId);
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const session = await requireSession();

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new Error("Görev bulunamadı");

  const canMark =
    session.user.role === Role.ADMIN ||
    task.assigneeId === session.user.id ||
    (!task.assigneeId && task.creatorId === session.user.id);
  if (!canMark) {
    throw new Error("Bu işin durumunu yalnızca atanan kişi değiştirebilir");
  }

  const parsedStatus = z
    .enum(["WAITING", "IN_PROGRESS", "IN_REVIEW", "DONE"])
    .parse(status);

  const updated = await prisma.task.update({
    where: { id },
    data: { status: parsedStatus as TaskStatus },
  });

  if (
    parsedStatus === "DONE" ||
    task.status === TaskStatus.DONE
  ) {
    await syncTaskDoneToCompanyDayContents(updated);
  }

  await logActivity({
    actorId: session.user.id,
    action: "Görev durumu güncellendi",
    entityType: "Task",
    entityId: id,
    meta: { status: parsedStatus },
  });

  revalidateTasks(id, task.companyId);
}

/** Takvim / hızlı kontrol: tamamlandı tik at / geri al — atanan veya admin */
export async function toggleTaskDone(id: string) {
  const session = await requireSession();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new Error("Görev bulunamadı");

  const canMark =
    session.user.role === Role.ADMIN ||
    task.assigneeId === session.user.id ||
    (!task.assigneeId && task.creatorId === session.user.id);
  if (!canMark) {
    throw new Error("Bu işi yalnızca atanan kişi işaretleyebilir");
  }

  const done = task.status === TaskStatus.DONE;
  const nextStatus = done ? TaskStatus.IN_PROGRESS : TaskStatus.DONE;

  const updated = await prisma.task.update({
    where: { id },
    data: { status: nextStatus },
  });

  // Takvim firma-gün kartı içerik durumuna bakıyor — senkronla
  await syncTaskDoneToCompanyDayContents(updated);

  await logActivity({
    actorId: session.user.id,
    action: done
      ? "Görev tamamlandı işareti kaldırıldı"
      : "Görev tamamlandı olarak işaretlendi",
    entityType: "Task",
    entityId: id,
  });

  revalidateTasks(id, task.companyId);
}

export async function updateTask(id: string, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== Role.ADMIN) {
    throw new Error("İş düzenleme yalnızca admin tarafından yapılabilir");
  }
  const data = parseTask(formData);
  const planTimes = parsePlanTimesFromForm(formData, {
    planPosts: data.planPosts,
    planStories: data.planStories,
    planReels: data.planReels,
    planVideos: data.planVideos,
  });

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw new Error("Görev bulunamadı");

  const task = await prisma.task.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      companyId: data.companyId || null,
      assigneeId: data.assigneeId || null,
      priority: data.priority as TaskPriority,
      ...(data.status ? { status: data.status as TaskStatus } : {}),
      startDate: parseOptionalDate(data.startDate),
      dueDate: parseOptionalDate(data.dueDate),
      planPeriod: data.planPeriod as PlanPeriod,
      planPosts: data.planPosts,
      planStories: data.planStories,
      planReels: data.planReels,
      planVideos: data.planVideos,
      planTimes:
        Object.keys(planTimes).length > 0
          ? (planTimes as Prisma.InputJsonValue)
          : Prisma.DbNull,
      // Kopyaların tekrarını değiştirme; şablonlarda güncelle
      ...(existing.recurrenceOfId
        ? {}
        : { recurrence: data.recurrence as TaskRecurrence }),
    },
  });

  if (
    !existing.recurrenceOfId &&
    data.recurrence !== "NONE"
  ) {
    await ensureRecurringTaskOccurrences({ daysAhead: 31 });
  }
  await ensureContentSlotsFromTasks({ daysAhead: 31 });

  if (task.assigneeId) {
    const assigneeChanged =
      !!data.assigneeId && data.assigneeId !== existing.assigneeId;

    await createNotification({
      userId: task.assigneeId,
      type: assigneeChanged
        ? NotificationType.TASK_ASSIGNED
        : NotificationType.TASK_UPDATED,
      title: assigneeChanged ? "Yeni görev atandı" : "Görev güncellendi",
      body: assigneeChanged
        ? `"${task.title}" görevi size atandı.`
        : `"${task.title}" görevi güncellendi.`,
      entityType: "Task",
      entityId: task.id,
    });
  }

  await logActivity({
    actorId: session.user.id,
    action: "Görev güncellendi",
    entityType: "Task",
    entityId: id,
  });

  revalidateTasks(id, task.companyId);
  if (existing.companyId && existing.companyId !== task.companyId) {
    revalidatePath(`/companies/${existing.companyId}`);
  }
}

/** Takvim sürükleme kapalı — tarih değişimi desteklenmiyor */
export async function moveTaskDueDate(_id: string, _dueDate: string) {
  await requireSession();
  throw new Error("Takvimde sürükleyerek taşıma kapalı");
}

export async function addTaskComment(taskId: string, formData: FormData) {
  const session = await requireSession();
  const body = z.string().min(1, "Yorum gerekli").parse(formData.get("body"));

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Görev bulunamadı");

  await prisma.taskComment.create({
    data: {
      taskId,
      userId: session.user.id,
      body,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "Göreve yorum eklendi",
    entityType: "Task",
    entityId: taskId,
  });

  revalidateTasks(taskId, task.companyId);
}

export async function deleteTask(id: string) {
  const session = await requireSession();
  if (session.user.role !== Role.ADMIN) {
    throw new Error("İşleri yalnızca admin silebilir");
  }

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw new Error("Görev bulunamadı");

  await suppressDeletedTasks([existing]);

  await logActivity({
    actorId: session.user.id,
    action: "Görev silindi",
    entityType: "Task",
    entityId: id,
    meta: { title: existing.title },
  });

  revalidateTasks(undefined, existing.companyId);
  redirect("/work");
}

export async function deleteTasksByIds(ids: string[]) {
  const session = await requireSession();
  if (session.user.role !== Role.ADMIN) {
    throw new Error("İşleri yalnızca admin silebilir");
  }
  const uniqueIds = [
    ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) {
    throw new Error("Silmek için en az bir iş seçin");
  }

  const existing = await prisma.task.findMany({
    where: { id: { in: uniqueIds } },
  });
  if (existing.length === 0) throw new Error("Seçilen işler bulunamadı");

  await suppressDeletedTasks(existing);

  await logActivity({
    actorId: session.user.id,
    action: "İşler toplu silindi",
    entityType: "Task",
    entityId: existing[0]!.id,
    meta: {
      count: existing.length,
      titles: existing.map((t) => t.title).slice(0, 20),
    },
  });

  const companyIds = [
    ...new Set(existing.map((t) => t.companyId).filter(Boolean)),
  ] as string[];
  revalidateTasks();
  revalidatePath("/calendar");
  for (const companyId of companyIds) {
    revalidatePath(`/companies/${companyId}`);
  }
  return { deleted: existing.length };
}

/**
 * Sayfa render'ında çağrılır — revalidatePath kullanma (render sırasında yasak).
 * Aynı request'teki sonraki sorgular yeni kayıtları görür.
 */
export async function syncRecurringTasks(daysAhead = 7) {
  await requireSession();
  const past = await pruneCompletedPastWork();
  const tasks = await ensureRecurringTaskOccurrences({ daysAhead });
  const contents = await ensureContentSlotsFromTasks({ daysAhead });
  const pruned = await pruneOrphanAutoContents({
    daysAhead: Math.max(daysAhead, 14),
  });
  return {
    pastContentsDeleted: past.contentsDeleted,
    pastTasksDeleted: past.tasksDeleted,
    tasksCreated: tasks.created,
    contentsCreated: contents.created,
    contentsPruned: pruned.deleted,
  };
}
