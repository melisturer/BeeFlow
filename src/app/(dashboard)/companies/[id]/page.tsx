import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Button, Chip } from "@heroui/react";
import {
  archiveCompany,
  deleteCompany,
  updateCompany,
} from "@/actions/companies";
import {
  createSocialAccount,
  deleteSocialAccount,
} from "@/actions/social-accounts";
import {
  FormField,
  SelectInput,
  TextInput,
} from "@/components/ui/form-field";
import {
  ContentStatus,
  SocialPlatform,
  TaskStatus,
} from "@/generated/prisma/client";
import { ContentPlanSummary } from "@/components/contents/content-plan-summary";
import { GeneratePlanContentsForm } from "@/components/contents/generate-plan-contents-form";
import { getCompanyContentPlan } from "@/lib/content-plan";
import { prisma } from "@/lib/db";
import {
  companyStatusLabels,
  contentStatusLabels,
  platformLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/lib/labels";
import { requireAdmin } from "@/lib/session";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();
  const admin = true;

  const [company, employees, contentPlan] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
        assignee: true,
        socialAccounts: {
          where: { status: "ACTIVE" },
          orderBy: { platform: "asc" },
        },
        contents: {
          where: {
            status: {
              in: [
                ContentStatus.PREPARING,
                ContentStatus.TEAM_REVIEW,
                ContentStatus.APPROVED,
                ContentStatus.SCHEDULED,
              ],
            },
          },
          orderBy: [{ publishAt: "asc" }, { updatedAt: "desc" }],
          take: 8,
          include: { author: true },
        },
        tasks: {
          where: { status: { not: TaskStatus.DONE } },
          orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
          take: 10,
          include: { assignee: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    getCompanyContentPlan(id),
  ]);

  if (!company) notFound();

  return (
    <div className="bf-page space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/companies" className="bf-link text-sm">
            ← Firmalar
          </Link>
          <h1 className="bf-page-title mt-2">{company.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="bf-chip">{companyStatusLabels[company.status]}</span>
            <span className="text-sm text-[var(--da-muted)]">
              Sorumlu: {company.assignee?.name ?? "Atanmamış"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {admin ? (
            <Link href={`/work?company=${company.id}`} className="bf-btn">
              İşler
            </Link>
          ) : null}
          <Link href="#ayarlar" className="bf-btn">
            Düzenle
          </Link>
          <form action={archiveCompany.bind(null, company.id)}>
            <Button type="submit" size="sm">
              Arşivle
            </Button>
          </form>
          <form action={deleteCompany.bind(null, company.id)}>
            <Button type="submit" variant="danger" size="sm">
              Sil
            </Button>
          </form>
        </div>
      </div>

      {contentPlan ? (
        <div>
          <ContentPlanSummary
            title={`${contentPlan.periodLabel} içerik planı`}
            subtitle="Açık görevlerdeki hedeflere göre"
            items={contentPlan.items}
          />
          {contentPlan.items.some((i) => i.target > 0) ? (
            <GeneratePlanContentsForm
              companyId={company.id}
              platforms={company.socialAccounts.map((a) => a.platform)}
            />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="bf-panel">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="bf-panel-title">Açık görevler</h2>
              <p className="mt-1 text-sm text-[var(--da-muted)]">
                Takip ve hatırlatma
              </p>
            </div>
            {admin ? (
              <Link
                href={`/work?company=${company.id}`}
                className="bf-link text-sm"
              >
                Tümü
              </Link>
            ) : null}
          </div>
          {company.tasks.length === 0 ? (
            <p className="text-sm text-[var(--da-muted)]">Açık görev yok.</p>
          ) : (
            company.tasks.map((task) => (
              <div key={task.id} className="bf-list-row">
                <div>
                  <Link href={`/tasks/${task.id}`} className="bf-link font-semibold">
                    {task.title}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--da-muted)]">
                    {task.assignee?.name ?? "Atanmamış"}
                    {task.dueDate
                      ? ` · ${format(task.dueDate, "d MMM", { locale: tr })}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="bf-chip">{taskStatusLabels[task.status]}</span>
                  <span className="text-xs text-[var(--da-muted)]">
                    {taskPriorityLabels[task.priority]}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bf-panel">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="bf-panel-title">Akıştaki içerikler</h2>
              <p className="mt-1 text-sm text-[var(--da-muted)]">
                Hazırlık, onay ve plan
              </p>
            </div>
            {admin ? (
              <Link
                href={`/work?company=${company.id}`}
                className="bf-link text-sm"
              >
                Tümü
              </Link>
            ) : null}
          </div>
          {company.contents.length === 0 ? (
            <p className="text-sm text-[var(--da-muted)]">Akışta içerik yok.</p>
          ) : (
            company.contents.map((content) => (
              <div key={content.id} className="bf-list-row">
                <div>
                  <Link
                    href={`/contents/${content.id}`}
                    className="bf-link font-semibold"
                  >
                    {content.title}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--da-muted)]">
                    {platformLabels[content.platform]} · {content.author.name}
                    {content.publishAt
                      ? ` · ${format(content.publishAt, "d MMM HH:mm", { locale: tr })}`
                      : ""}
                  </p>
                </div>
                <span className="bf-chip">
                  {contentStatusLabels[content.status]}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bf-panel">
        <h2 className="bf-panel-title">Sosyal hesaplar</h2>
        <p className="mt-1 text-sm text-[var(--da-muted)]">
          İçerik platformları
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {company.socialAccounts.length === 0 ? (
            <p className="text-sm text-[var(--da-muted)]">Hesap eklenmemiş.</p>
          ) : (
            company.socialAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-2 rounded-[5px] border border-[var(--da-line)] bg-white px-3 py-2"
              >
                <Chip size="sm">{platformLabels[account.platform]}</Chip>
                <span className="text-sm font-semibold">@{account.username}</span>
                <form action={deleteSocialAccount.bind(null, account.id)}>
                  <button type="submit" className="text-xs text-[var(--da-danger)]">
                    Sil
                  </button>
                </form>
              </div>
            ))
          )}
        </div>

        <form
          action={createSocialAccount}
          className="mt-4 grid gap-3 border-t border-[var(--da-line)] pt-4 md:grid-cols-4"
        >
          <input type="hidden" name="companyId" value={company.id} />
          <input type="hidden" name="status" value="ACTIVE" />
          <FormField label="Platform" htmlFor="platform">
            <SelectInput
              id="platform"
              name="platform"
              defaultValue={SocialPlatform.INSTAGRAM}
            >
              {Object.entries(platformLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Kullanıcı adı" htmlFor="username">
            <TextInput id="username" name="username" required />
          </FormField>
          <FormField label="Profil URL" htmlFor="profileUrl">
            <TextInput id="profileUrl" name="profileUrl" />
          </FormField>
          <div className="flex items-end">
            <button type="submit" className="bf-btn w-full">
              Ekle
            </button>
          </div>
        </form>
      </div>

      <details id="ayarlar" className="bf-panel" open>
        <summary className="bf-panel-title cursor-pointer">
          Firma ayarları
        </summary>
        <form
          action={updateCompany.bind(null, company.id)}
          className="mt-4 grid gap-4 md:grid-cols-3"
        >
          <FormField label="Firma adı" htmlFor="name">
            <TextInput
              id="name"
              name="name"
              required
              minLength={2}
              defaultValue={company.name}
            />
          </FormField>
          <FormField label="Sorumlu" htmlFor="assigneeId">
            <SelectInput
              id="assigneeId"
              name="assigneeId"
              defaultValue={company.assigneeId ?? ""}
            >
              <option value="">Seçilmedi</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Durum" htmlFor="status">
            <SelectInput
              id="status"
              name="status"
              defaultValue={company.status}
            >
              {Object.entries(companyStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <input type="hidden" name="sector" value={company.sector ?? ""} />
          <input type="hidden" name="email" value={company.email ?? ""} />
          <input type="hidden" name="phone" value={company.phone ?? ""} />
          <input type="hidden" name="website" value={company.website ?? ""} />
          <input type="hidden" name="address" value={company.address ?? ""} />
          <input
            type="hidden"
            name="brandColors"
            value={company.brandColors ?? ""}
          />
          <input
            type="hidden"
            name="brandVoice"
            value={company.brandVoice ?? ""}
          />
          <input
            type="hidden"
            name="brandNotes"
            value={company.brandNotes ?? ""}
          />
          <input type="hidden" name="logo" value={company.logo ?? ""} />
          <div className="md:col-span-3">
            <button type="submit" className="bf-btn bf-btn-dark">
              Kaydet
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
