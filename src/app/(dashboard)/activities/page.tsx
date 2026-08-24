import { Card } from "@heroui/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function ActivitiesPage() {
  await requireAdmin();

  const activities = await prisma.activityLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="bf-page-title">
          Aktiviteler
        </h1>
        <p className="mt-1 text-sm text-black/55">
          Sistemdeki işlem geçmişi.
        </p>
      </div>

      <Card className="bf-panel overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="bf-table">
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Kullanıcı</th>
                <th>Aksiyon</th>
                <th>Varlık</th>
                <th>Detay</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-sm">
                    {format(a.createdAt, "d MMM yyyy HH:mm", { locale: tr })}
                  </td>
                  <td>{a.actor?.name ?? "Sistem"}</td>
                  <td className="font-medium">{a.action}</td>
                  <td className="text-sm">
                    {a.entityType}
                    {a.entityId ? (
                      <span className="text-black/40">
                        {" "}
                        · {a.entityId.slice(0, 8)}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-xs truncate text-xs text-black/50">
                    {a.meta ?? "—"}
                  </td>
                </tr>
              ))}
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-black/50">
                    Aktivite kaydı yok.
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
