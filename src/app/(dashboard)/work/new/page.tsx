import Link from "next/link";
import { Button, Card } from "@heroui/react";
import { redirect } from "next/navigation";
import { createContent } from "@/actions/contents";
import { createTask } from "@/actions/tasks";
import { NewContentForm } from "@/components/contents/new-content-form";
import { PlanScheduleFields } from "@/components/contents/plan-schedule-fields";
import {
  FormField,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "@/components/ui/form-field";
import { TaskPriority, TaskStatus } from "@/generated/prisma/client";
import { getCompaniesContentPlans } from "@/lib/content-plan";
import { prisma } from "@/lib/db";
import {
  planPeriodLabels,
  taskPriorityLabels,
  taskRecurrenceLabels,
} from "@/lib/labels";
import { requireAdmin } from "@/lib/session";

export default async function NewWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; company?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const mode = sp.type === "content" ? "content" : "task";

  const [companies, employees, contentCompanies] = await Promise.all([
    prisma.company.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    getCompaniesContentPlans(),
  ]);

  const orderedContentCompanies = sp.company
    ? [
        ...contentCompanies.filter((c) => c.id === sp.company),
        ...contentCompanies.filter((c) => c.id !== sp.company),
      ]
    : contentCompanies;

  async function createTaskAction(formData: FormData) {
    "use server";
    await createTask(formData);
    redirect("/work");
  }

  async function createContentAction(formData: FormData) {
    "use server";
    await createContent(formData);
    redirect("/work");
  }

  return (
    <div className="bf-page mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/work" className="bf-link text-sm">
          ← İşler
        </Link>
        <h1 className="bf-page-title mt-2">Yeni</h1>
        <p className="bf-page-sub">
          Görev tanımla veya tek bir paylaşım (içerik) ekle.
        </p>
      </div>

      <div className="flex gap-2 rounded-[10px] border border-black/8 bg-white/70 p-1">
        <Link
          href="/work/new"
          className={`flex-1 rounded-[8px] px-3 py-2 text-center text-sm font-semibold ${
            mode === "task"
              ? "bg-[var(--bf-ink)] text-white"
              : "text-black/55 hover:bg-black/4"
          }`}
        >
          İş
        </Link>
        <Link
          href={
            sp.company
              ? `/work/new?type=content&company=${sp.company}`
              : "/work/new?type=content"
          }
          className={`flex-1 rounded-[8px] px-3 py-2 text-center text-sm font-semibold ${
            mode === "content"
              ? "bg-[var(--bf-ink)] text-white"
              : "text-black/55 hover:bg-black/4"
          }`}
        >
          İçerik
        </Link>
      </div>

      {mode === "task" ? (
        <Card className="bf-panel">
          <Card.Content>
            <form
              action={createTaskAction}
              className="grid gap-4 md:grid-cols-2"
            >
              <div className="md:col-span-2">
                <FormField label="Başlık" htmlFor="title">
                  <TextInput id="title" name="title" required />
                </FormField>
              </div>
              <div className="md:col-span-2">
                <FormField label="Açıklama" htmlFor="description">
                  <TextAreaInput id="description" name="description" />
                </FormField>
              </div>
              <FormField label="Firma" htmlFor="companyId">
                <SelectInput id="companyId" name="companyId" defaultValue="">
                  <option value="">Seçilmedi</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Atanan" htmlFor="assigneeId">
                <SelectInput id="assigneeId" name="assigneeId" defaultValue="">
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
                  defaultValue={TaskPriority.NORMAL}
                >
                  {Object.entries(taskPriorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Otomatik yineleme" htmlFor="recurrence">
                <SelectInput
                  id="recurrence"
                  name="recurrence"
                  defaultValue="NONE"
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
              <input type="hidden" name="status" value={TaskStatus.WAITING} />
              <input type="hidden" name="startDate" value="" />
              <input type="hidden" name="dueDate" value="" />
              <p className="text-xs text-black/45 md:col-span-2">
                Yok = sadece bugün. Her gün / hafta / ay = seçtiğin periyotta
                takvime otomatik yazılır.
              </p>
              <FormField label="Hedef dönemi" htmlFor="planPeriod">
                <SelectInput
                  id="planPeriod"
                  name="planPeriod"
                  defaultValue="WEEKLY"
                >
                  {Object.entries(planPeriodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <PlanScheduleFields />
              <div className="flex flex-wrap gap-3 md:col-span-2">
                <Button type="submit">İş oluştur</Button>
                <Link href="/work" className="bf-btn bf-btn-ghost">
                  İptal
                </Link>
              </div>
            </form>
          </Card.Content>
        </Card>
      ) : (
        <NewContentForm
          action={createContentAction}
          companies={orderedContentCompanies}
          cancelHref="/work"
        />
      )}
    </div>
  );
}
