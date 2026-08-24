import { Button, Card, Chip } from "@heroui/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";

export default async function NotificationsPage() {
  const session = await requireSession();

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="bf-page-title">
            Bildirimler
          </h1>
          <p className="mt-1 text-sm text-black/55">
            {unread > 0
              ? `${unread} okunmamış bildirim`
              : "Tüm bildirimler okundu"}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="secondary">
              Tümünü okundu işaretle
            </Button>
          </form>
        ) : null}
      </div>

      <div className="space-y-3">
        {notifications.map((n) => (
          <Card
            key={n.id}
            className={`bf-stat p-5 ${n.readAt ? "opacity-70" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="font-medium">{n.title}</p>
                  {!n.readAt ? <Chip size="sm">Yeni</Chip> : null}
                </div>
                <p className="text-sm text-black/65">{n.body}</p>
                <p className="mt-2 text-xs text-black/45">
                  {format(n.createdAt, "d MMM yyyy HH:mm", { locale: tr })}
                  {n.entityType ? ` · ${n.entityType}` : ""}
                </p>
              </div>
              {!n.readAt ? (
                <form action={markNotificationRead.bind(null, n.id)}>
                  <Button type="submit" size="sm" variant="secondary">
                    Okundu
                  </Button>
                </form>
              ) : null}
            </div>
          </Card>
        ))}
        {notifications.length === 0 ? (
          <p className="text-sm text-black/50">Bildirim yok.</p>
        ) : null}
      </div>
    </div>
  );
}
