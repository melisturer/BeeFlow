"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CompanyStatus } from "@/generated/prisma/client";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import {
  formOptionalString,
  formString,
  parseOrThrow,
} from "@/lib/form";
import { requireAdmin } from "@/lib/session";

const companySchema = z.object({
  name: z.string().min(2, "Firma adı en az 2 karakter olmalı"),
  logo: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  brandColors: z.string().nullable().optional(),
  brandVoice: z.string().nullable().optional(),
  brandNotes: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "PASSIVE", "ARCHIVED"]),
  assigneeId: z.string().nullable().optional(),
});

function parseCompany(formData: FormData) {
  return parseOrThrow(companySchema, {
    name: formString(formData, "name"),
    logo: formOptionalString(formData, "logo"),
    sector: formOptionalString(formData, "sector"),
    phone: formOptionalString(formData, "phone"),
    email: formOptionalString(formData, "email"),
    website: formOptionalString(formData, "website"),
    address: formOptionalString(formData, "address"),
    brandColors: formOptionalString(formData, "brandColors"),
    brandVoice: formOptionalString(formData, "brandVoice"),
    brandNotes: formOptionalString(formData, "brandNotes"),
    status: formString(formData, "status") || "ACTIVE",
    assigneeId: formOptionalString(formData, "assigneeId"),
  });
}

function companyWriteData(data: ReturnType<typeof parseCompany>) {
  const { assigneeId, status, ...rest } = data;
  return {
    ...rest,
    status: status as CompanyStatus,
    assignee: assigneeId
      ? { connect: { id: assigneeId } }
      : { disconnect: true },
  };
}

export async function createCompany(formData: FormData) {
  const session = await requireAdmin();
  const data = parseCompany(formData);
  const { assigneeId, status, ...rest } = data;

  const company = await prisma.company.create({
    data: {
      ...rest,
      status: status as CompanyStatus,
      ...(assigneeId
        ? { assignee: { connect: { id: assigneeId } } }
        : { assignee: { connect: { id: session.user.id } } }),
    },
  });
  await logActivity({
    actorId: session.user.id,
    action: "Yeni firma oluşturuldu",
    entityType: "Company",
    entityId: company.id,
    meta: { name: company.name },
  });
  revalidatePath("/companies");
}

export async function updateCompany(id: string, formData: FormData) {
  const session = await requireAdmin();
  const data = parseCompany(formData);
  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) throw new Error("Firma bulunamadı");

  await prisma.company.update({
    where: { id },
    data: companyWriteData(data),
  });
  await logActivity({
    actorId: session.user.id,
    action: "Firma güncellendi",
    entityType: "Company",
    entityId: id,
  });
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}

export async function archiveCompany(id: string) {
  const session = await requireAdmin();
  await prisma.company.update({
    where: { id },
    data: { status: CompanyStatus.ARCHIVED },
  });
  await logActivity({
    actorId: session.user.id,
    action: "Firma arşivlendi",
    entityType: "Company",
    entityId: id,
  });
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}

export async function deleteCompany(id: string) {
  const session = await requireAdmin();
  const company = await prisma.company.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!company) throw new Error("Firma bulunamadı");

  await prisma.company.delete({ where: { id } });

  await logActivity({
    actorId: session.user.id,
    action: "Firma silindi",
    entityType: "Company",
    entityId: id,
    meta: { name: company.name },
  });

  revalidatePath("/companies");
  revalidatePath("/work");
  revalidatePath("/contents");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
  redirect("/companies");
}

export async function listCompanies() {
  await requireAdmin();
  return prisma.company.findMany({
    include: { assignee: true, socialAccounts: true },
    orderBy: { createdAt: "desc" },
  });
}
