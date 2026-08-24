"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";

const meetingSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1),
  notes: z.string().optional().nullable(),
  decisions: z.string().optional().nullable(),
  participantIds: z.string().optional().nullable(),
});

function parseMeeting(formData: FormData) {
  return meetingSchema.parse({
    title: formData.get("title"),
    date: formData.get("date"),
    time: formData.get("time"),
    notes: formData.get("notes") || null,
    decisions: formData.get("decisions") || null,
    participantIds: formData.get("participantIds") || null,
  });
}

function parseParticipantIds(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

function parseMeetingDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Geçersiz toplantı tarihi");
  return d;
}

async function syncParticipants(meetingId: string, participantIds: string[]) {
  await prisma.meetingParticipant.deleteMany({ where: { meetingId } });
  if (participantIds.length === 0) return;

  await prisma.meetingParticipant.createMany({
    data: participantIds.map((userId) => ({ meetingId, userId })),
  });
}

function revalidateMeetings(id?: string) {
  revalidatePath("/meetings");
  revalidatePath("/");
  if (id) revalidatePath(`/meetings/${id}`);
}

export async function createMeeting(formData: FormData) {
  const session = await requireSession();
  const data = parseMeeting(formData);
  const participantIds = parseParticipantIds(data.participantIds);

  const meeting = await prisma.meeting.create({
    data: {
      title: data.title,
      date: parseMeetingDate(data.date),
      time: data.time,
      notes: data.notes,
      decisions: data.decisions,
      creatorId: session.user.id,
    },
  });

  await syncParticipants(meeting.id, participantIds);

  await logActivity({
    actorId: session.user.id,
    action: "Toplantı oluşturuldu",
    entityType: "Meeting",
    entityId: meeting.id,
    meta: { title: meeting.title },
  });

  revalidateMeetings(meeting.id);
}

export async function updateMeeting(id: string, formData: FormData) {
  const session = await requireSession();
  const data = parseMeeting(formData);
  const participantIds = parseParticipantIds(data.participantIds);

  await prisma.meeting.update({
    where: { id },
    data: {
      title: data.title,
      date: parseMeetingDate(data.date),
      time: data.time,
      notes: data.notes,
      decisions: data.decisions,
    },
  });

  await syncParticipants(id, participantIds);

  await logActivity({
    actorId: session.user.id,
    action: "Toplantı güncellendi",
    entityType: "Meeting",
    entityId: id,
  });

  revalidateMeetings(id);
}

export async function deleteMeeting(id: string) {
  const session = await requireSession();

  await prisma.meeting.delete({ where: { id } });

  await logActivity({
    actorId: session.user.id,
    action: "Toplantı silindi",
    entityType: "Meeting",
    entityId: id,
  });

  revalidateMeetings();
}
