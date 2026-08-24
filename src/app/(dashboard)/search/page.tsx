import Link from "next/link";
import { Button, Card, Chip } from "@heroui/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  FormField,
  SelectInput,
  TextInput,
} from "@/components/ui/form-field";
import {
  SocialPlatform,
  TaskPriority,
  TaskStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  contentStatusLabels,
  platformLabels,
  roleLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/lib/labels";
import { requireSession } from "@/lib/session";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    platform?: string;
    from?: string;
    to?: string;
    assignee?: string;
    company?: string;
  }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const status =
    sp.status && Object.keys(TaskStatus).includes(sp.status)
      ? (sp.status as TaskStatus)
      : undefined;
  const priority =
    sp.priority && Object.keys(TaskPriority).includes(sp.priority)
      ? (sp.priority as TaskPriority)
      : undefined;
  const platform =
    sp.platform && Object.keys(SocialPlatform).includes(sp.platform)
      ? (sp.platform as SocialPlatform)
      : undefined;

  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(sp.to) : undefined;
  const dateFilter =
    from || to
      ? {
          ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
          ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
        }
      : undefined;

  const [companiesList, employees] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const hasQuery =
    Boolean(q) ||
    Boolean(status) ||
    Boolean(priority) ||
    Boolean(platform) ||
    Boolean(sp.assignee) ||
    Boolean(sp.company) ||
    Boolean(dateFilter);

  const [companies, tasks, contents, users] = hasQuery
    ? await Promise.all([
        q || sp.company
          ? prisma.company.findMany({
              where: {
                ...(sp.company ? { id: sp.company } : {}),
                ...(q
                  ? {
                      OR: [
                        { name: { contains: q } },
                        { sector: { contains: q } },
                        { email: { contains: q } },
                      ],
                    }
                  : {}),
              },
              take: 20,
              orderBy: { name: "asc" },
            })
          : Promise.resolve([]),
        prisma.task.findMany({
          where: {
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { description: { contains: q } },
                  ],
                }
              : {}),
            ...(status ? { status } : {}),
            ...(priority ? { priority } : {}),
            ...(sp.assignee ? { assigneeId: sp.assignee } : {}),
            ...(sp.company ? { companyId: sp.company } : {}),
            ...(dateFilter ? { dueDate: dateFilter } : {}),
          },
          include: { company: true, assignee: true },
          take: 30,
          orderBy: { updatedAt: "desc" },
        }),
        prisma.content.findMany({
          where: {
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { body: { contains: q } },
                  ],
                }
              : {}),
            ...(platform ? { platform } : {}),
            ...(sp.company ? { companyId: sp.company } : {}),
            ...(sp.assignee ? { authorId: sp.assignee } : {}),
            ...(dateFilter ? { publishAt: dateFilter } : {}),
          },
          include: { company: true, author: true },
          take: 30,
          orderBy: { updatedAt: "desc" },
        }),
        q
          ? prisma.user.findMany({
              where: {
                OR: [
                  { name: { contains: q } },
                  { email: { contains: q } },
                ],
              },
              take: 20,
              orderBy: { name: "asc" },
            })
          : Promise.resolve([]),
      ])
    : [[], [], [], []];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="bf-page-title">
          Arama
        </h1>
        <p className="mt-1 text-sm text-black/55">
          Firma, görev, içerik ve çalışanlarda ara.
        </p>
      </div>

      <Card className="bf-panel">
        <form className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-3">
            <FormField label="Anahtar kelime" htmlFor="q">
              <TextInput
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Ara..."
              />
            </FormField>
          </div>
          <FormField label="Görev durumu" htmlFor="status">
            <SelectInput id="status" name="status" defaultValue={status ?? ""}>
              <option value="">Tümü</option>
              {Object.entries(taskStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Öncelik" htmlFor="priority">
            <SelectInput
              id="priority"
              name="priority"
              defaultValue={priority ?? ""}
            >
              <option value="">Tümü</option>
              {Object.entries(taskPriorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Platform" htmlFor="platform">
            <SelectInput
              id="platform"
              name="platform"
              defaultValue={platform ?? ""}
            >
              <option value="">Tümü</option>
              {Object.entries(platformLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Başlangıç tarihi" htmlFor="from">
            <TextInput
              id="from"
              name="from"
              type="date"
              defaultValue={sp.from ?? ""}
            />
          </FormField>
          <FormField label="Bitiş tarihi" htmlFor="to">
            <TextInput
              id="to"
              name="to"
              type="date"
              defaultValue={sp.to ?? ""}
            />
          </FormField>
          <FormField label="Atanan / yazar" htmlFor="assignee">
            <SelectInput
              id="assignee"
              name="assignee"
              defaultValue={sp.assignee ?? ""}
            >
              <option value="">Tümü</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Firma" htmlFor="company">
            <SelectInput
              id="company"
              name="company"
              defaultValue={sp.company ?? ""}
            >
              <option value="">Tümü</option>
              {companiesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <div className="flex items-end md:col-span-3">
            <Button type="submit">Ara</Button>
          </div>
        </form>
      </Card>

      {!hasQuery ? (
        <p className="text-sm text-black/50">
          Arama yapmak için bir filtre veya anahtar kelime girin.
        </p>
      ) : (
        <div className="space-y-6">
          <ResultSection title="Firmalar" count={companies.length}>
            {companies.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/companies/${c.id}`}
                  className="font-medium hover:text-[var(--bf-accent-deep)]"
                >
                  {c.name}
                </Link>
                <span className="ml-2 text-xs text-black/45">
                  {c.sector ?? ""}
                </span>
              </li>
            ))}
          </ResultSection>

          <ResultSection title="Görevler" count={tasks.length}>
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/tasks/${t.id}`}
                  className="font-medium hover:text-[var(--bf-accent-deep)]"
                >
                  {t.title}
                </Link>
                <Chip size="sm">{taskStatusLabels[t.status]}</Chip>
                <span className="text-xs text-black/45">
                  {t.company?.name ?? "—"} · {t.assignee?.name ?? "—"}
                  {t.dueDate
                    ? ` · ${format(t.dueDate, "d MMM", { locale: tr })}`
                    : ""}
                </span>
              </li>
            ))}
          </ResultSection>

          <ResultSection title="İçerikler" count={contents.length}>
            {contents.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/contents/${c.id}`}
                  className="font-medium hover:text-[var(--bf-accent-deep)]"
                >
                  {c.title}
                </Link>
                <Chip size="sm">{platformLabels[c.platform]}</Chip>
                <Chip size="sm">{contentStatusLabels[c.status]}</Chip>
                <span className="text-xs text-black/45">
                  {c.company.name} · {c.author.name}
                </span>
              </li>
            ))}
          </ResultSection>

          <ResultSection title="Çalışanlar" count={users.length}>
            {users.map((u) => (
              <li key={u.id}>
                <span className="font-medium">{u.name}</span>
                <span className="ml-2 text-xs text-black/45">
                  {u.email} · {roleLabels[u.role]}
                </span>
              </li>
            ))}
          </ResultSection>
        </div>
      )}
    </div>
  );
}

function ResultSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="bf-panel">
      <Card.Header className="mb-3">
        <Card.Title>
          {title}{" "}
          <span className="text-sm font-normal text-black/45">({count})</span>
        </Card.Title>
      </Card.Header>
      <Card.Content>
        {count === 0 ? (
          <p className="text-sm text-black/50">Sonuç yok.</p>
        ) : (
          <ul className="space-y-2">{children}</ul>
        )}
      </Card.Content>
    </Card>
  );
}
