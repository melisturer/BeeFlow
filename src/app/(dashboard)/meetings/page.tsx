import Link from "next/link";
import { Button, Card } from "@heroui/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { createMeeting } from "@/actions/meetings";
import {
  FormField,
  TextAreaInput,
  TextInput,
} from "@/components/ui/form-field";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";

export default async function MeetingsPage() {
  await requireSession();

  const [meetings, users] = await Promise.all([
    prisma.meeting.findMany({
      include: {
        creator: true,
        participants: { include: { user: true } },
      },
      orderBy: [{ date: "desc" }, { time: "desc" }],
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  async function createMeetingAction(formData: FormData) {
    "use server";
    const ids = formData
      .getAll("participantId")
      .map(String)
      .filter(Boolean)
      .join(",");
    formData.set("participantIds", ids);
    await createMeeting(formData);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="bf-page-title">
          Toplantılar
        </h1>
        <p className="mt-1 text-sm text-black/55">
          Toplantı notları ve kararlar.
        </p>
      </div>

      <Card className="bf-panel">
        <Card.Header className="mb-4">
          <Card.Title>Yeni toplantı</Card.Title>
        </Card.Header>
        <Card.Content>
          <form
            action={createMeetingAction}
            className="grid gap-4 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <FormField label="Başlık" htmlFor="title">
                <TextInput id="title" name="title" required />
              </FormField>
            </div>
            <FormField label="Tarih" htmlFor="date">
              <TextInput id="date" name="date" type="date" required />
            </FormField>
            <FormField label="Saat" htmlFor="time">
              <TextInput id="time" name="time" placeholder="14:30" required />
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
                      className="rounded border-black/20"
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <FormField label="Notlar" htmlFor="notes">
                <TextAreaInput id="notes" name="notes" />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Kararlar" htmlFor="decisions">
                <TextAreaInput id="decisions" name="decisions" />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Toplantı oluştur</Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      <Card className="bf-panel overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="bf-table">
            <thead>
              <tr>
                <th>Toplantı</th>
                <th>Tarih</th>
                <th>Saat</th>
                <th>Oluşturan</th>
                <th>Katılımcı</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link
                      href={`/meetings/${m.id}`}
                      className="font-medium hover:text-[var(--bf-accent-deep)]"
                    >
                      {m.title}
                    </Link>
                  </td>
                  <td>{format(m.date, "d MMM yyyy", { locale: tr })}</td>
                  <td>{m.time}</td>
                  <td>{m.creator.name}</td>
                  <td>{m.participants.length}</td>
                </tr>
              ))}
              {meetings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-black/50">
                    Toplantı yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
