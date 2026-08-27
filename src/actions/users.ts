"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@/generated/prisma/client";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { formString, parseOrThrow } from "@/lib/form";
import { requireAdmin } from "@/lib/session";

const userSchema = z.object({
  name: z.string().min(2, "Ad soyad en az 2 karakter olmalı"),
  email: z.string().email("Geçerli bir e-posta girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı").optional(),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
  active: z.boolean().optional(),
});

export async function createEmployee(formData: FormData) {
  const session = await requireAdmin();
  const password = formString(formData, "password");
  const parsed = parseOrThrow(userSchema, {
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    password: password || undefined,
    role: formString(formData, "role") || "EMPLOYEE",
  });

  if (!parsed.password) throw new Error("Şifre gerekli");

  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      passwordHash: await bcrypt.hash(parsed.password, 10),
      role: parsed.role as Role,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "Çalışan oluşturuldu",
    entityType: "User",
    entityId: user.id,
    meta: { email: user.email },
  });

  revalidatePath("/employees");
}

export async function updateEmployee(id: string, formData: FormData) {
  const session = await requireAdmin();
  const password = formString(formData, "password");
  const parsed = parseOrThrow(userSchema, {
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    password: password || undefined,
    role: formString(formData, "role") || "EMPLOYEE",
    active:
      formData.get("active") === "on" || formData.get("active") === "true",
  });

  await prisma.user.update({
    where: { id },
    data: {
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      role: parsed.role as Role,
      active: parsed.active ?? true,
      ...(parsed.password
        ? { passwordHash: await bcrypt.hash(parsed.password, 10) }
        : {}),
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "Çalışan güncellendi",
    entityType: "User",
    entityId: id,
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
}

export async function deleteEmployee(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) throw new Error("Kendinizi silemezsiniz");

  await prisma.user.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "Çalışan silindi",
    entityType: "User",
    entityId: id,
  });
  revalidatePath("/employees");
}
