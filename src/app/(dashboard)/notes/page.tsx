import { Button, Card, Chip } from "@heroui/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { createNote, deleteNote } from "@/actions/notes";
import {
  FormField,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "@/components/ui/form-field";
import { NoteCategory, NoteType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { noteCategoryLabels, noteTypeLabels } from "@/lib/labels";
import { requireSession } from "@/lib/session";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    category?: string;
  }>;
}) {
  await requireSession();
  const sp = await searchParams;

  const type =
    sp.type && Object.keys(NoteType).includes(sp.type)
      ? (sp.type as NoteType)
      : undefined;
  const category =
    sp.category && Object.keys(NoteCategory).includes(sp.category)
      ? (sp.category as NoteCategory)
      : undefined;
  const q = sp.q?.trim();

  const [notes, companies] = await Promise.all([
    prisma.agencyNote.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { body: { contains: q } },
                { tags: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        company: true,
        createdBy: true,
        updatedBy: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.company.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="bf-page-title">
          Ajans notları
        </h1>
        <p className="mt-1 text-sm text-black/55">
          Hızlı notlar, toplantı notları ve sabit bilgiler.
        </p>
      </div>

      <Card className="bf-panel">
        <form className="grid gap-3 md:grid-cols-4">
          <FormField label="Ara" htmlFor="q">
            <TextInput
              id="q"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Metin veya etiket"
            />
          </FormField>
          <FormField label="Tür" htmlFor="type">
            <SelectInput id="type" name="type" defaultValue={type ?? ""}>
              <option value="">Tümü</option>
              {Object.entries(noteTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Kategori" htmlFor="category">
            <SelectInput
              id="category"
              name="category"
              defaultValue={category ?? ""}
            >
              <option value="">Tümü</option>
              {Object.entries(noteCategoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <div className="flex items-end">
            <Button type="submit" fullWidth>
              Filtrele
            </Button>
          </div>
        </form>
      </Card>

      <Card className="bf-panel">
        <Card.Header className="mb-4">
          <Card.Title>Yeni not</Card.Title>
        </Card.Header>
        <Card.Content>
          <form action={createNote} className="grid gap-4 md:grid-cols-2">
            <FormField label="Tür" htmlFor="new-type">
              <SelectInput
                id="new-type"
                name="type"
                defaultValue={NoteType.GENERAL}
              >
                {Object.entries(noteTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Kategori" htmlFor="new-category">
              <SelectInput
                id="new-category"
                name="category"
                defaultValue={NoteCategory.GENERAL}
              >
                {Object.entries(noteCategoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Firma" htmlFor="companyId">
              <SelectInput id="companyId" name="companyId" defaultValue="">
                <option value="">Genel</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Etiketler" htmlFor="tags">
              <TextInput
                id="tags"
                name="tags"
                placeholder="kampanya, brief"
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Not" htmlFor="body">
                <TextAreaInput id="body" name="body" required />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Not ekle</Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      <div className="grid gap-4">
        {notes.map((note) => (
          <Card key={note.id} className="bf-stat p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Chip size="sm">{noteTypeLabels[note.type]}</Chip>
                <Chip size="sm">{noteCategoryLabels[note.category]}</Chip>
                {note.company ? (
                  <Chip size="sm">{note.company.name}</Chip>
                ) : null}
              </div>
              <form action={deleteNote.bind(null, note.id)}>
                <Button type="submit" size="sm" variant="danger">
                  Sil
                </Button>
              </form>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {note.body}
            </p>
            {note.tags ? (
              <p className="mt-2 text-xs text-[var(--bf-signal)]">{note.tags}</p>
            ) : null}
            <p className="mt-3 text-xs text-black/45">
              {note.createdBy.name} ·{" "}
              {format(note.updatedAt, "d MMM yyyy HH:mm", { locale: tr })}
            </p>
          </Card>
        ))}
        {notes.length === 0 ? (
          <p className="text-sm text-black/50">Not bulunamadı.</p>
        ) : null}
      </div>
    </div>
  );
}
