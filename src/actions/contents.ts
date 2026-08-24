"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays, format, setHours, setMinutes, setSeconds, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import { z } from "zod";
import {
  ContentStatus,
  ContentType,
  NotificationType,
  Role,
  SocialPlatform,
} from "@/generated/prisma/client";
import { logActivity } from "@/lib/activity";
import {
  targetsFromOpenTasks,
  targetsToTypeCounts,
} from "@/lib/content-plan";
import { syncCompanyDayTaskCompletion } from "@/lib/day-completion";
import { contentTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import {
  parseStoredPlanTimes,
  publishAtOnDay,
  timeForSlot,
} from "@/lib/plan-times";
import { excludeTaskTemplatesFilter } from "@/lib/recurring-tasks";
import { requireAdmin, requireSession } from "@/lib/session";

const platformEnum = z.enum([
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "TIKTOK",
  "X",
  "YOUTUBE",
]);

const typeEnum = z.enum(["POST", "STORY", "REEL", "VIDEO"]);

const contentSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  platform: platformEnum,
  type: typeEnum,
  publishAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  companyId: z.string().min(1),
  status: z
    .enum([
      "DRAFT",
      "PREPARING",
      "TEAM_REVIEW",
      "APPROVED",
      "SCHEDULED",
      "PUBLISHED",
    ])
    .optional(),
});

const multiCreateContentSchema = contentSchema
  .omit({ platform: true, type: true })
  .extend({
    platforms: z.array(platformEnum).min(1, "En az bir platform seçin"),
    types: z.array(typeEnum).min(1, "En az bir tür seçin"),
  });

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Geçersiz tarih");
  return d;
}

function parseContent(formData: FormData) {
  return contentSchema.parse({
    title: formData.get("title"),
    body: formData.get("body"),
    platform: formData.get("platform"),
    type: formData.get("type") || "POST",
    publishAt: formData.get("publishAt") || null,
    notes: formData.get("notes") || null,
    companyId: formData.get("companyId"),
    status: formData.get("status") || undefined,
  });
}

function parseMultiCreateContent(formData: FormData) {
  const platforms = [
    ...new Set(
      formData
        .getAll("platform")
        .map((v) => String(v))
        .filter(Boolean),
    ),
  ];
  const types = [
    ...new Set(
      formData
        .getAll("type")
        .map((v) => String(v))
        .filter(Boolean),
    ),
  ];
  return multiCreateContentSchema.parse({
    title: formData.get("title"),
    body: formData.get("body"),
    platforms,
    types,
    publishAt: formData.get("publishAt") || null,
    notes: formData.get("notes") || null,
    companyId: formData.get("companyId"),
    status: formData.get("status") || undefined,
  });
}

function revalidateContent(id?: string, companyId?: string | null) {
  revalidatePath("/work");
  revalidatePath("/contents");
  revalidatePath("/calendar");
  revalidatePath("/");
  if (id) revalidatePath(`/contents/${id}`);
  if (companyId) revalidatePath(`/companies/${companyId}`);
}

const generatePlanSchema = z.object({
  startDate: z.string().min(1),
  days: z.number().int().min(1).max(31),
  platform: platformEnum,
});

function parseGeneratePlan(formData: FormData) {
  const daysRaw = Number(formData.get("days") || 7);
  return generatePlanSchema.parse({
    startDate: formData.get("startDate"),
    days: Number.isFinite(daysRaw) ? daysRaw : 7,
    platform: formData.get("platform") || "INSTAGRAM",
  });
}

/**
 * Açık görev hedeflerini (tercihen günlük) seçilen günlere içerik olarak dağıtır.
 * O gün zaten dolu olan türleri tekrar üretmez.
 */
export async function generatePlanContents(
  companyId: string,
  formData: FormData,
  opts?: { taskId?: string },
) {
  const session = await requireSession();
  const input = parseGeneratePlan(formData);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new Error("Firma bulunamadı");

  let schedule: ReturnType<typeof parseStoredPlanTimes> = {};
  if (opts?.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: opts.taskId },
      select: {
        id: true,
        companyId: true,
        status: true,
        planTimes: true,
      },
    });
    if (!task || task.companyId !== companyId) {
      throw new Error("Görev bu firmaya ait değil");
    }
    if (task.status === "DONE") {
      throw new Error("Tamamlanmış görevden içerik üretilemez");
    }
    schedule = parseStoredPlanTimes(task.planTimes);
  }

  let targets = await targetsFromOpenTasks(companyId, {
    dailyOnly: true,
    taskId: opts?.taskId,
  });
  const dailyTotal =
    targets.planPosts +
    targets.planStories +
    targets.planReels +
    targets.planVideos;

  if (dailyTotal === 0) {
    targets = await targetsFromOpenTasks(companyId, {
      taskId: opts?.taskId,
    });
  }

  const typeCounts = targetsToTypeCounts(targets);
  if (typeCounts.length === 0) {
    throw new Error("Dağıtılacak içerik hedefi yok. Görevde post/story hedefleri girin.");
  }

  const parts = input.startDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error("Geçersiz başlangıç tarihi");
  }
  const [year, month, dayNum] = parts;
  const start = startOfDay(new Date(year, month - 1, dayNum));
  if (Number.isNaN(start.getTime())) throw new Error("Geçersiz başlangıç tarihi");

  const platform = input.platform as SocialPlatform;
  const rows: Array<{
    title: string;
    body: string;
    platform: SocialPlatform;
    type: ContentType;
    publishAt: Date;
    notes: string;
    autoGenerated: boolean;
    companyId: string;
    authorId: string;
    status: ContentStatus;
  }> = [];

  for (let i = 0; i < input.days; i += 1) {
    const day = addDays(start, i);
    const dayStart = startOfDay(day);
    const dayEnd = addDays(dayStart, 1);
    const existing = await prisma.content.groupBy({
      by: ["type"],
      where: {
        companyId,
        publishAt: { gte: dayStart, lt: dayEnd },
      },
      _count: { _all: true },
    });
    const existingMap = Object.fromEntries(
      existing.map((row) => [row.type, row._count._all]),
    ) as Partial<Record<ContentType, number>>;

    const dayLabel = format(day, "d MMM", { locale: tr });

    for (const { type, count } of typeCounts) {
      const have = existingMap[type] ?? 0;
      const need = Math.max(0, count - have);
      for (let n = 1; n <= need; n += 1) {
        const index = have + n;
        const slotIndex = have + n - 1;
        const hhmm = timeForSlot(schedule, type as ContentType, slotIndex);
        rows.push({
          title: `${company.name} · ${contentTypeLabels[type]} ${index} · ${dayLabel}`,
          body: "(Taslak — otomatik oluşturuldu)",
          platform,
          type: type as ContentType,
          publishAt: publishAtOnDay(dayStart, hhmm),
          notes: "Görev hedeflerinden otomatik dağıtıldı",
          autoGenerated: true,
          companyId,
          authorId: session.user.id,
          status: ContentStatus.SCHEDULED,
        });
      }
    }
  }

  if (rows.length === 0) {
    throw new Error("Seçilen günlerde hedefler zaten dolu.");
  }

  if (rows.length > 500) {
    throw new Error("Çok fazla içerik oluşacak. Gün sayısını azaltın.");
  }

  await prisma.content.createMany({ data: rows });

  await logActivity({
    actorId: session.user.id,
    action: "İçerik hedefleri günlere dağıtıldı",
    entityType: "Company",
    entityId: companyId,
    meta: {
      created: rows.length,
      days: input.days,
      platform,
      taskId: opts?.taskId ?? null,
    },
  });

  revalidateContent(undefined, companyId);
  revalidatePath("/work");
  revalidatePath("/tasks");
  if (opts?.taskId) revalidatePath(`/tasks/${opts.taskId}`);
}

export async function createContent(formData: FormData) {
  const session = await requireSession();
  const data = parseMultiCreateContent(formData);
  const publishAt = parseOptionalDate(data.publishAt) ?? new Date();
  const status = (data.status as ContentStatus) || ContentStatus.DRAFT;

  const variants = data.platforms.flatMap((platform) =>
    data.types.map((type) => ({ platform, type })),
  );

  const created = await prisma.$transaction(
    variants.map(({ platform, type }) =>
      prisma.content.create({
        data: {
          title: data.title,
          body: data.body,
          platform: platform as SocialPlatform,
          type: type as ContentType,
          publishAt,
          notes: data.notes,
          companyId: data.companyId,
          authorId: session.user.id,
          status,
        },
      }),
    ),
  );

  await Promise.all(
    created.map((content) =>
      logActivity({
        actorId: session.user.id,
        action: "İçerik oluşturuldu",
        entityType: "Content",
        entityId: content.id,
        meta: {
          title: content.title,
          platform: content.platform,
          type: content.type,
        },
      }),
    ),
  );

  revalidateContent(created[0]?.id);
}

export async function updateContent(id: string, formData: FormData) {
  const session = await requireSession();
  const data = parseContent(formData);

  const existing = await prisma.content.findUnique({ where: { id } });
  if (!existing) throw new Error("İçerik bulunamadı");

  const isOwner = existing.authorId === session.user.id;
  const isAdmin = session.user.role === Role.ADMIN;
  if (!isOwner && !isAdmin) {
    throw new Error("Bu içeriği güncelleme yetkiniz yok");
  }

  await prisma.content.update({
    where: { id },
    data: {
      title: data.title,
      body: data.body,
      platform: data.platform as SocialPlatform,
      type: data.type as ContentType,
      publishAt: parseOptionalDate(data.publishAt),
      notes: data.notes,
      companyId: data.companyId,
      ...(data.status ? { status: data.status as ContentStatus } : {}),
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "İçerik güncellendi",
    entityType: "Content",
    entityId: id,
  });

  revalidateContent(id, data.companyId);
}

export async function deleteContent(id: string) {
  const session = await requireSession();
  if (session.user.role !== Role.ADMIN) {
    throw new Error("İşleri yalnızca admin silebilir");
  }
  const existing = await prisma.content.findUnique({ where: { id } });
  if (!existing) throw new Error("İçerik bulunamadı");

  await prisma.content.delete({ where: { id } });

  await logActivity({
    actorId: session.user.id,
    action: "İçerik silindi",
    entityType: "Content",
    entityId: id,
    meta: { title: existing.title },
  });

  revalidateContent(undefined, existing.companyId);
  redirect("/work");
}

export async function submitForReview(id: string) {
  const session = await requireSession();

  const existing = await prisma.content.findUnique({ where: { id } });
  if (!existing) throw new Error("İçerik bulunamadı");

  const isOwner = existing.authorId === session.user.id;
  const isAdmin = session.user.role === Role.ADMIN;
  if (!isOwner && !isAdmin) {
    throw new Error("Bu içeriği onaya gönderme yetkiniz yok");
  }

  await prisma.content.update({
    where: { id },
    data: { status: ContentStatus.TEAM_REVIEW },
  });

  await logActivity({
    actorId: session.user.id,
    action: "İçerik onaya gönderildi",
    entityType: "Content",
    entityId: id,
  });

  revalidateContent(id);
}

export async function approveContent(id: string) {
  const session = await requireAdmin();

  const content = await prisma.content.findUnique({ where: { id } });
  if (!content) throw new Error("İçerik bulunamadı");

  await prisma.content.update({
    where: { id },
    data: { status: ContentStatus.APPROVED },
  });

  await createNotification({
    userId: content.authorId,
    type: NotificationType.CONTENT_APPROVED,
    title: "İçerik onaylandı",
    body: `"${content.title}" içeriği onaylandı.`,
    entityType: "Content",
    entityId: id,
  });

  await logActivity({
    actorId: session.user.id,
    action: "İçerik onaylandı",
    entityType: "Content",
    entityId: id,
  });

  revalidateContent(id);
}

export async function requestRevision(id: string, formData: FormData) {
  const session = await requireAdmin();
  const comment = z.string().min(1, "Revizyon yorumu gerekli").parse(
    formData.get("comment"),
  );

  const content = await prisma.content.findUnique({ where: { id } });
  if (!content) throw new Error("İçerik bulunamadı");

  await prisma.$transaction([
    prisma.contentRevision.create({
      data: {
        contentId: id,
        comment,
        action: "REVISION_REQUESTED",
        requestedById: session.user.id,
      },
    }),
    prisma.content.update({
      where: { id },
      data: { status: ContentStatus.PREPARING },
    }),
  ]);

  await createNotification({
    userId: content.authorId,
    type: NotificationType.CONTENT_REVISION,
    title: "Revizyon istendi",
    body: `"${content.title}" için revizyon: ${comment}`,
    entityType: "Content",
    entityId: id,
  });

  await logActivity({
    actorId: session.user.id,
    action: "İçerik için revizyon istendi",
    entityType: "Content",
    entityId: id,
    meta: { comment },
  });

  revalidateContent(id);
}

export async function markPublished(id: string) {
  const session = await requireSession();
  const existing = await prisma.content.findUnique({ where: { id } });
  if (!existing) throw new Error("İçerik bulunamadı");

  const isOwner = existing.authorId === session.user.id;
  const isAdmin = session.user.role === Role.ADMIN;
  if (!isOwner && !isAdmin) {
    throw new Error("Bu içeriği yayınlandı işaretleme yetkiniz yok");
  }

  await prisma.content.update({
    where: { id },
    data: { status: ContentStatus.PUBLISHED },
  });

  await logActivity({
    actorId: session.user.id,
    action: "İçerik yayınlandı olarak işaretlendi",
    entityType: "Content",
    entityId: id,
  });

  revalidateContent(id);
}

/** Takvim: firmanın o günkü tüm içeriklerini tek seferde tamamla / geri al */
export async function toggleCompanyDayDone(
  companyId: string,
  dayIso: string,
) {
  const session = await requireSession();
  const day = startOfDay(new Date(dayIso));
  if (Number.isNaN(day.getTime())) throw new Error("Geçersiz tarih");
  const dayEnd = addDays(day, 1);

  const [contents, dayTasks] = await Promise.all([
    prisma.content.findMany({
      where: {
        companyId,
        publishAt: { gte: day, lt: dayEnd },
      },
      select: { id: true, status: true, publishAt: true, authorId: true },
    }),
    prisma.task.findMany({
      where: {
        companyId,
        ...excludeTaskTemplatesFilter(),
        OR: [
          { occurrenceDate: { gte: day, lt: dayEnd } },
          {
            occurrenceDate: null,
            dueDate: { gte: day, lt: dayEnd },
          },
        ],
      },
      select: { assigneeId: true, creatorId: true },
    }),
  ]);

  if (contents.length === 0) throw new Error("Bu gün için içerik yok");

  const admin = session.user.role === Role.ADMIN;
  const uid = session.user.id;
  const canMark =
    admin ||
    (contents.every((c) => c.authorId === uid) &&
      dayTasks.every(
        (t) =>
          t.assigneeId === uid || (!t.assigneeId && t.creatorId === uid),
      ));
  if (!canMark) {
    throw new Error(
      "Bu günü yalnızca tüm işleri size aitse veya admin işaretleyebilir",
    );
  }

  const allDone = contents.every((c) => c.status === ContentStatus.PUBLISHED);
  const nextStatus = allDone
    ? ContentStatus.SCHEDULED
    : ContentStatus.PUBLISHED;

  await prisma.content.updateMany({
    where: { id: { in: contents.map((c) => c.id) } },
    data: { status: nextStatus },
  });

  await syncCompanyDayTaskCompletion(companyId, day);

  revalidateContent(undefined, companyId);
  revalidatePath("/work");
  revalidatePath("/tasks");
}

/** Günlük / takvim kontrolü: tik at / geri al — atanan veya admin */
export async function toggleContentDone(id: string) {
  const session = await requireSession();
  const existing = await prisma.content.findUnique({
    where: { id },
  });
  if (!existing) throw new Error("İçerik bulunamadı");

  if (
    session.user.role !== Role.ADMIN &&
    existing.authorId !== session.user.id
  ) {
    throw new Error("Bu içeriği yalnızca atanan kişi işaretleyebilir");
  }

  const done = existing.status === ContentStatus.PUBLISHED;
  const nextStatus = done
    ? existing.publishAt
      ? ContentStatus.SCHEDULED
      : ContentStatus.APPROVED
    : ContentStatus.PUBLISHED;

  await prisma.content.update({
    where: { id },
    data: { status: nextStatus },
  });

  const day = startOfDay(existing.publishAt ?? existing.createdAt);
  const daySync = await syncCompanyDayTaskCompletion(existing.companyId, day);

  await logActivity({
    actorId: session.user.id,
    action: done
      ? "İçerik tamamlandı işareti kaldırıldı"
      : "İçerik tamamlandı olarak işaretlendi",
    entityType: "Content",
    entityId: id,
    meta: daySync.allDone
      ? { dayComplete: true, companyId: existing.companyId }
      : undefined,
  });

  revalidateContent(id, existing.companyId);
  revalidatePath("/work");
  revalidatePath("/tasks");
}

export async function scheduleContent(id: string, formData: FormData) {
  const session = await requireAdmin();
  const publishAtRaw = z.string().min(1, "Yayın tarihi gerekli").parse(
    formData.get("publishAt"),
  );
  const publishAt = parseOptionalDate(publishAtRaw);
  if (!publishAt) throw new Error("Yayın tarihi gerekli");

  await prisma.content.update({
    where: { id },
    data: {
      status: ContentStatus.SCHEDULED,
      publishAt,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "İçerik planlandı",
    entityType: "Content",
    entityId: id,
    meta: { publishAt: publishAt.toISOString() },
  });

  revalidateContent(id);
}

/** Takvim sürükleme kapalı — admin dahil kimse taşıyamaz */
export async function moveCompanyDayDate(
  _companyId: string,
  _fromDayIso: string,
  _toDayIso: string,
) {
  await requireSession();
  throw new Error("Takvimde sürükleyerek taşıma kapalı");
}

export async function moveContentDate(id: string, publishAt: string) {
  const session = await requireSession();
  const date = parseOptionalDate(publishAt);
  if (!date) throw new Error("Geçersiz tarih");

  const existing = await prisma.content.findUnique({ where: { id } });
  if (!existing) throw new Error("İçerik bulunamadı");

  if (
    session.user.role !== Role.ADMIN &&
    existing.authorId !== session.user.id
  ) {
    throw new Error("İçerik tarihini yalnızca atanan kişi değiştirebilir");
  }

  await prisma.content.update({
    where: { id },
    data: { publishAt: date },
  });

  await logActivity({
    actorId: session.user.id,
    action: "İçerik tarihi taşındı",
    entityType: "Content",
    entityId: id,
    meta: { publishAt: date.toISOString() },
  });

  revalidateContent(id);
}

export async function uploadMedia(formData: FormData) {
  await requireSession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Dosya gerekli");
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const ext = path.extname(file.name) || "";
  const safeBase = path
    .basename(file.name, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 80);
  const filename = `${Date.now()}-${safeBase}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  return `/uploads/${filename}`;
}
 ""