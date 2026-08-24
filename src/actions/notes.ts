"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { NoteCategory, NoteType } from "@/generated/prisma/client";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";

const noteSchema = z.object({
  companyId: z.string().optional().nullable(),
  type: z.enum(["GENERAL", "QUICK", "MEETING", "PINNED"]),
  category: z.enum([
    "GENERAL",
    "DESIGN",
    "CONTENT",
    "ADS",
    "MEETING",
    "REMINDER",
    "OTHER",
  ]),
  tags: z.string().optional().nullable(),
  body: z.string().min(1),
});

function parseNote(formData: FormData) {
  return noteSchema.parse({
    companyId: formData.get("companyId") || null,
    type: formData.get("type") || "GENERAL",
    category: formData.get("category") || "GENERAL",
    tags: formData.get("tags") || null,
    body: formData.get("body"),
  });
}

function revalidateNotes() {
  revalidatePath("/notes");
  revalidatePath("/");
}

export async function createNote(formData: FormData) {
  const session = await requireSession();
  const data = parseNote(formData);

  const note = await prisma.agencyNote.create({
    data: {
      companyId: data.companyId,
      type: data.type as NoteType,
      category: data.category as NoteCategory,
      tags: data.tags,
      body: data.body,
      createdById: session.user.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "Ajans notu oluşturuldu",
    entityType: "AgencyNote",
    entityId: note.id,
  });

  revalidateNotes();
}

export async function updateNote(id: string, formData: FormData) {
  const session = await requireSession();
  const data = parseNote(formData);

  await prisma.agencyNote.update({
    where: { id },
    data: {
      companyId: data.companyId,
      type: data.type as NoteType,
      category: data.category as NoteCategory,
      tags: data.tags,
      body: data.body,
      updatedById: session.user.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "Ajans notu güncellendi",
    entityType: "AgencyNote",
    entityId: id,
  });

  revalidateNotes();
}

export async function deleteNote(id: string) {
  const session = await requireSession();

  await prisma.agencyNote.delete({ where: { id } });

  await logActivity({
    actorId: session.user.id,
    action: "Ajans notu silindi",
    entityType: "AgencyNote",
    entityId: id,
  });

  revalidateNotes();
}
