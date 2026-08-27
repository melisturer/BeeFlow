import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Chip } from "@heroui/react";
import { addDays, format, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import {
  addTaskComment,
  deleteTask,
  toggleTaskDone,
  updateTask,
  updateTaskStatus,
} from "@/actions/tasks";
import { GeneratePlanContentsForm } from "@/components/contents/generate-plan-contents-form";
import { PlanScheduleFields } from "@/components/contents/plan-schedule-fields";
import {
  FormField,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "@/components/ui/form-field";
import { ConfirmDeleteForm } from "@/components/ui/confirm-delete-form";
import { Role, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  contentStatusLabels,
  contentTypeLabels,
  planPeriodLabels,
  taskPriorityLabels,
  taskRecurrenceLabels,
  taskStatusLabels,
} from "@/lib/labels";
import { parseStoredPlanTimes } from "@/lib/plan-times";
import { isTaskTemplate } from "@/lib/recurring-tasks";
import { requireSession } from "@/lib/session";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const admin = session.user.role === Role.ADMIN;

  const [task, companies, employees] = await Promise.all([
    prisma.task.findUnique({
      where: { id },
      include: {
        company: {
          include: {
            socialAccounts: {
              where: { status: "ACTIVE" },
              select: { platform: true },
            },
          },
        },
        assignee: true,
        creator: true,
        comments: {
          include: { user: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.company.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!task) notFound();

  const canUpdateStatus =
    admin ||
    task.assigneeId === session.user.id ||
    (!task.assigneeId && task.creatorId === session.user.id);

  const planTotal =
    task.planPosts + task.planStories + task.planReels + task.planVideos;
  const template = isTaskTemplate(task);
  const contentDay = task.occurrenceDate ?? task.dueDate;
  const dayContents =
    task.companyId && contentDay
      ? await prisma.content.findMany({
          where: {
            companyId: task.companyId,
            publishAt: {
              gte: startOfDay(contentDay),
              lt: addDays(startOfDay(contentDay), 1),
            },
          },
          orderBy: [{ type: "asc" }, { publishAt: "asc" }],
        })
      : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={admin ? "/work" : "/"}
            className="text-sm text-black/50 hover:text-[var(--bf-accent-deep)]"
          >
            {admin ? "← İşler" : "← Dashboard"}
          </Link>
          <h1 className="mt-2 bf-page-title">
            {task.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip size="sm">{taskStatusLabels[task.status]}</Chip>
            <Chip size="sm">{taskPriorityLabels[task.priority]}</Chip>
            {template ? (
              <Chip size="sm">
                Şablon · {taskRecurrenceLabels[task.recurrence]}
              </Chip>
            ) : null}
            {task.recurrenceOfId ? <Chip size="sm">Tekrar kopyası</Chip> : null}
          </div>
          <p className="mt-2 text-sm text-black/55">
            {task.company?.name ?? "Firma yok"} ·{" "}
            {task.assignee?.name ?? "Atanmamış"} · Oluşturan:{" "}
            {task.creator.name}
            {template
              ? " · Bu şablon her gün/hafta otomatik görev üretir"
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdateStatus ? (
            <form action={toggleTaskDone.bind(null, task.id)}>
              <Button type="submit" size="sm">
                {task.status === TaskStatus.DONE
                  ? "Tamamlandı işaretini kaldır"
                  : "Tamamlandı ✓"}
              </Button>
            </form>
          ) : null}
          {task.companyId ? (
            <Link
              href={`/contents/new?company=${task.companyId}`}
              className="bf-btn"
            >
              Yeni içerik
            </Link>
          ) : null}
          {admin ? (
            <Link href="#duzenle" className="bf-btn">
              Düzenle
            </Link>
          ) : null}
          {admin ? (
            <ConfirmDeleteForm
              action={deleteTask.bind(null, task.id)}
              message={`“${task.title}” işi silinecek. Emin misiniz?`}
            >
              <Button type="submit" variant="danger" size="sm">
                Sil
              </Button>
            </ConfirmDeleteForm>
          ) : null}
        </div>
      </div>

      {task.description ? (
        <Card className="bf-panel">
          <Card.Header className="mb-2">
            <Card.Title>Açıklama</Card.Title>
          </Card.Header>
          <Card.Content className="whitespace-pre-wrap text-sm">
            {task.description}
          </Card.Content>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="bf-panel">
          <p className="text-sm text-black/55">Başlangıç</p>
          <p className="mt-1 font-medium">
            {task.startDate
              ? format(task.startDate, "d MMM yyyy", { locale: tr })
              : "—"}
          </p>
        </Card>
        <Card className="bf-panel">
          <p className="text-sm text-black/55">Deadline</p>
          <p className="mt-1 font-medium">
            {task.dueDate
              ? format(task.dueDate, "d MMM yyyy HH:mm", { locale: tr })
              : "—"}
          </p>
        </Card>
      </div>

      {task.companyId && planTotal > 0 && task.status !== TaskStatus.DONE ? (
        <Card className="bf-panel">
          <Card.Header className="mb-2">
            <Card.Title>İçerik hedefleri</Card.Title>
          </Card.Header>
          <Card.Content>
            <p className="text-sm text-black/55">
              {planPeriodLabels[task.planPeriod]} ·{" "}
              {[
                task.planPosts > 0
                  ? `${task.planPosts} ${contentTypeLabels.POST}`
                  : null,
                task.planStories > 0
                  ? `${task.planStories} ${contentTypeLabels.STORY}`
                  : null,
                task.planReels > 0
                  ? `${task.planReels} ${contentTypeLabels.REEL}`
                  : null,
                task.planVideos > 0
                  ? `${task.planVideos} ${contentTypeLabels.VIDEO}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <GeneratePlanContentsForm
              companyId={task.companyId}
              taskId={task.id}
              platforms={
                task.company?.socialAccounts.map((a) => a.platform) ?? []
              }
            />
          </Card.Content>
        </Card>
      ) : null}

      {task.companyId && contentDay ? (
        <Card className="bf-panel">
          <Card.Header className="mb-2">
            <Card.Title>
              Günlük içerikler ·{" "}
              {format(contentDay, "d MMM yyyy", { locale: tr })}
            </Card.Title>
          </Card.Header>
          <Card.Content>
            {dayContents.length === 0 ? (
              <p className="text-sm text-black/50">
                Bu gün için içerik yok.{" "}
                <Link
                  href={`/contents/new?company=${task.companyId}`}
                  className="bf-link"
                >
                  Ekle
                </Link>
              </p>
            ) : (
              <ul className="space-y-2">
                {dayContents.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <Chip size="sm">{contentTypeLabels[c.type]}</Chip>
                    <Link
                      href={`/contents/${c.id}`}
                      className="bf-link font-medium"
                    >
                      {c.title}
                    </Link>
                    <Chip size="sm">{contentStatusLabels[c.status]}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </Card.Content>
        </Card>
      ) : null}

      {canUpdateStatus ? (
        <Card className="bf-panel">
          <Card.Header className="mb-4">
            <Card.Title>Durum güncelle</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-wrap gap-2">
            {Object.entries(taskStatusLabels).map(([value, label]) => (
              <form
                key={value}
                action={updateTaskStatus.bind(
                  null,
                  task.id,
                  value as TaskStatus,
                )}
              >
                <Button
                  type="submit"
                  size="sm"
                  variant={task.status === value ? "primary" : "secondary"}
                >
                  {label}
                </Button>
              </form>
            ))}
          </Card.Content>
        </Card>
      ) : null}

      {admin ? (
        <Card id="duzenle" className="bf-panel">
          <Card.Header className="mb-4">
            <Card.Title>İşi düzenle</Card.Title>
          </Card.Header>
          <Card.Content>
            <form
              action={updateTask.bind(null, task.id)}
              className="grid gap-4 md:grid-cols-2"
            >
              <div className="md:col-span-2">
                <FormField label="Başlık" htmlFor="title">
                  <TextInput
                    id="title"
                    name="title"
                    required
                    defaultValue={task.title}
                  />
                </FormField>
              </div>
              <div className="md:col-span-2">
                <FormField label="Açıklama" htmlFor="description">
                  <TextAreaInput
                    id="description"
                    name="description"
                    defaultValue={task.description ?? ""}
                  />
                </FormField>
              </div>
              <FormField label="Firma" htmlFor="companyId">
                <SelectInput
                  id="companyId"
                  name="companyId"
                  defaultValue={task.companyId ?? ""}
                >
                  <option value="">Seçilmedi</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Atanan" htmlFor="assigneeId">
                <SelectInput
                  id="assigneeId"
                  name="assigneeId"
                  defaultValue={task.assigneeId ?? ""}
                >
                  <option value="">Seçilmedi</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Öncelik" htmlFor="priority">
                <SelectInput
                  id="priority"
                  name="priority"
                  defaultValue={task.priority}
                >
                  {Object.entries(taskPriorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Durum" htmlFor="status">
                <SelectInput
                  id="status"
                  name="status"
                  defaultValue={task.status}
                >
                  {Object.entries(taskStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Başlangıç" htmlFor="startDate">
                <TextInput
                  id="startDate"
                  name="startDate"
                  type="datetime-local"
                  defaultValue={
                    task.startDate
                      ? format(task.startDate, "yyyy-MM-dd'T'HH:mm")
                      : ""
                  }
                />
              </FormField>
              <FormField label="Deadline" htmlFor="dueDate">
                <TextInput
                  id="dueDate"
                  name="dueDate"
                  type="datetime-local"
                  defaultValue={
                    task.dueDate
                      ? format(task.dueDate, "yyyy-MM-dd'T'HH:mm")
                      : ""
                  }
                />
              </FormField>
              {task.recurrenceOfId ? (
                <input type="hidden" name="recurrence" value="NONE" />
              ) : (
                <FormField label="Otomatik yineleme" htmlFor="recurrence">
                  <SelectInput
                    id="recurrence"
                    name="recurrence"
                    defaultValue={task.recurrence}
                  >
                    {Object.entries(taskRecurrenceLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </SelectInput>
                </FormField>
              )}
              <FormField label="Plan dönemi" htmlFor="planPeriod">
                <SelectInput
                  id="planPeriod"
                  name="planPeriod"
                  defaultValue={task.planPeriod}
                >
                  {Object.entries(planPeriodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <PlanScheduleFields
                initialCounts={{
                  planPosts: task.planPosts,
                  planStories: task.planStories,
                  planReels: task.planReels,
                  planVideos: task.planVideos,
                }}
                initialTimes={parseStoredPlanTimes(task.planTimes)}
              />
              <div className="md:col-span-2">
                <Button type="submit">Kaydet</Button>
              </div>
            </form>
          </Card.Content>
        </Card>
      ) : null}

      <Card className="bf-panel">
        <Card.Header className="mb-4">
          <Card.Title>Yorumlar</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-4">
          <form
            action={addTaskComment.bind(null, task.id)}
            className="space-y-3"
          >
            <FormField label="Yorum ekle" htmlFor="body">
              <TextAreaInput id="body" name="body" required />
            </FormField>
            <Button type="submit" size="sm">
              Gönder
            </Button>
          </form>
          <ul className="space-y-3">
            {task.comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-xl border border-black/8 bg-white/50 p-3"
              >
                <div className="flex justify-between gap-2 text-xs text-black/50">
                  <span>{comment.user.name}</span>
                  <span>
                    {format(comment.createdAt, "d MMM HH:mm", { locale: tr })}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {comment.body}
                </p>
              </li>
            ))}
            {task.comments.length === 0 ? (
              <p className="text-sm text-black/50">Henüz yorum yok.</p>
            ) : null}
          </ul>
        </Card.Content>
      </Card>
    </div>
  );
}
