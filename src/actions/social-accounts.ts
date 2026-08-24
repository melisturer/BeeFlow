"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AccountStatus,
  SocialPlatform,
} from "@/generated/prisma/client";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const socialAccountSchema = z.object({
  companyId: z.string().min(1),
  platform: z.enum([
    "INSTAGRAM",
    "FACEBOOK",
    "LINKEDIN",
    "TIKTOK",
    "X",
    "YOUTUBE",
  ]),
  username: z.string().min(1),
  profileUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "PASSIVE"]),
});

function parseSocialAccount(formData: FormData) {
  return socialAccountSchema.parse({
    companyId: formData.get("companyId"),
    platform: formData.get("platform"),
    username: formData.get("username"),
    profileUrl: formData.get("profileUrl") || null,
    description: formData.get("description") || null,
    status: formData.get("status") || "ACTIVE",
  });
}

function revalidateSocial(companyId: string) {
  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
}

export async function createSocialAccount(formData: FormData) {
  const session = await requireAdmin();
  const data = parseSocialAccount(formData);

  const account = await prisma.socialAccount.create({
    data: {
      companyId: data.companyId,
      platform: data.platform as SocialPlatform,
      username: data.username,
      profileUrl: data.profileUrl,
      description: data.description,
      status: data.status as AccountStatus,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "Sosyal hesap eklendi",
    entityType: "SocialAccount",
    entityId: account.id,
    meta: { platform: account.platform, username: account.username },
  });

  revalidateSocial(data.companyId);
}

export async function updateSocialAccount(id: string, formData: FormData) {
  const session = await requireAdmin();
  const data = parseSocialAccount(formData);

  await prisma.socialAccount.update({
    where: { id },
    data: {
      companyId: data.companyId,
      platform: data.platform as SocialPlatform,
      username: data.username,
      profileUrl: data.profileUrl,
      description: data.description,
      status: data.status as AccountStatus,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "Sosyal hesap güncellendi",
    entityType: "SocialAccount",
    entityId: id,
  });

  revalidateSocial(data.companyId);
}

export async function deleteSocialAccount(id: string) {
  const session = await requireAdmin();

  const account = await prisma.socialAccount.findUnique({ where: { id } });
  if (!account) throw new Error("Sosyal hesap bulunamadı");

  await prisma.socialAccount.delete({ where: { id } });

  await logActivity({
    actorId: session.user.id,
    action: "Sosyal hesap silindi",
    entityType: "SocialAccount",
    entityId: id,
  });

  revalidateSocial(account.companyId);
}
