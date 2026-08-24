import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card } from "@heroui/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { deleteMeeting, updateMeeting } from "@/actions/meetings";
import {
  FormField,
  TextAreaInput,
  TextInput,
} from "@/components/ui/form-field";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSession();

  const [meeting, users] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id },
      include: {
        creator: true,
        participants: { include: { user: true } },
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!meeting) notFound();

  const selected = new Set(meeting.participants.map((p) => p.userId));

  async function updateMeetingAction(formData: FormData) {
    "use server";
    const meetingId = String(formData.get("meetingId") || "");
    const ids = formData
      .getAll("participantId")
      .map(String)
      .filter(Boolean)
      .join(",");
    formData.set("participantIds", ids);
    await updateMeeting(meetingId, formData);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/meetings"
            className="text-sm text-black/50 hover:text-[var(--bf-accent-deep)]"
          >
            ← Toplantılar
          </Link>
          <h1 className="mt-2 bf-page-title">
            {meeting.title}
          </h1>
          <p className="mt-2 text-sm text-black/55">
            {format(meeting.date, "d MMMM yyyy", { locale: tr })} ·{" "}
            {meeting.time} · {meeting.creator.name}
          </p>
        </div>
        <form action={deleteMeeting.bind(null, meeting.id)}>
          <Button type="submit" variant="danger" size="sm">
            Sil
          </Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bf-panel">
          <Card.Header className="mb-3">
            <Card.Title>Notlar</Card.Title>
          </Card.Header>
          <Card.Content className="whitespace-pre-wrap text-sm">
            {meeting.notes || "—"}
          </Card.Content>
        </Card>
        <Card className="bf-panel">
          <Card.Header className="mb-3">
            <Card.Title>Kararlar</Card.Title>
          </Card.Header>
          <Card.Content className="whitespace-pre-wrap text-sm">
            {meeting.decisions || "—"}
          </Card.Content>
        </Card>
      </div>

      <Card className="bf-panel">
        <Card.Header className="mb-3">
          <Card.Title>Katılımcılar</Card.Title>
        </Card.Header>
        <Card.Content>
          {meeting.participants.length === 0 ? (
            <p className="text-sm text-black/50">Katılımcı yok.</p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-sm">
              {meeting.participants.map((p) => (
                <li
                  key={p.id}
                  className="rounded-full bg-black/5 px-3 py-1"
                >
                  {p.user.name}
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>

      <Card className="bf-panel">
        <Card.Header className="mb-4">
          <Card.Title>Toplantıyı düzenle</Card.Title>
        </Card.Header>
        <Card.Content>
          <form
            action={updateMeetingAction}
            className="grid gap-4 md:grid-cols-2"
          >
            <input type="hidden" name="meetingId" value={meeting.id} />
            <div className="md:col-span-2">
              <FormField label="Başlık" htmlFor="title">
                <TextInput
                  id="title"
                  name="title"
                  required
                  defaultValue={meeting.title}
                />
              </FormField>
            </div>
            <FormField label="Tarih" htmlFor="date">
              <TextInput
                id="date"
                name="date"
                type="date"
                required
                defaultValue={format(meeting.date, "yyyy-MM-dd")}
              />
            </FormField>
            <FormField label="Saat" htmlFor="time">
              <TextInput
                id="time"
                name="time"
                required
                defaultValue={meeting.time}
              />
            </FormField>
            <div className="md:col-span-2">
              <p className="bf-label">Katılımcılar</p>
              <div className="grid gap-2 rounded-xl border border-black/10 bg-white p-3 sm:grid-cols-2">
                {users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="participantId"
                      value={u.id}
                      defaultChecked={selected.has(u.id)}
                      className="rounded border-black/20"
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <FormField label="Notlar" htmlFor="notes">
                <TextAreaInput
                  id="notes"
                  name="notes"
                  defaultValue={meeting.notes ?? ""}
                />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Kararlar" htmlFor="decisions">
                <TextAreaInput
                  id="decisions"
                  name="decisions"
                  defaultValue={meeting.decisions ?? ""}
                />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Kaydet</Button>
            </div>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
