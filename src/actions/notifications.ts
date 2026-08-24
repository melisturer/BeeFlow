"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";

function revalidateNotifications() {
  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function markNotificationRead(id: string) {
  const session = await requireSession();

  const notification = await prisma.notification.findUnique({
    where: { id },
  });
  if (!notification) throw new Error("Bildirim bulunamadı");
  if (notification.userId !== session.user.id) {
    throw new Error("Bu bildirimi okuma yetkiniz yok");
  }

  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  revalidateNotifications();
}

export async function markAllNotificationsRead() {
  const session = await requireSession();

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidateNotifications();
}
