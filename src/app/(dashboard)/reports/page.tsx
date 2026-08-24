import { Card } from "@heroui/react";
import { format, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import {
  CompanyStatus,
  ContentStatus,
  TaskStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function ReportsPage() {
  await requireAdmin();

  const now = new Date();
  const twelveMonthsAgo = startOfMonth(
    new Date(now.getFullYear(), now.getMonth() - 11, 1),
  );

  const [
    totalCompanies,
    activeCompanies,
    completedTasks,
    inProgressTasks,
    overdueTasks,
    publishedContents,
    companiesWithCounts,
    employeesWithTasks,
    contentsLastYear,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { status: CompanyStatus.ACTIVE } }),
    prisma.task.count({ where: { status: TaskStatus.DONE } }),
    prisma.task.count({
      where: {
        status: { in: [TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] },
      },
    }),
    prisma.task.count({
      where: {
        status: { not: TaskStatus.DONE },
        dueDate: { lt: now },
      },
    }),
    prisma.content.count({ where: { status: ContentStatus.PUBLISHED } }),
    prisma.company.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { contents: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        _count: { select: { assignedTasks: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.content.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
    }),
  ]);

  const monthlyMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    monthlyMap.set(format(d, "yyyy-MM"), 0);
  }
  for (const c of contentsLastYear) {
    const key = format(c.createdAt, "yyyy-MM");
    if (monthlyMap.has(key)) {
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
    }
  }
  const monthly = [...monthlyMap.entries()].map(([month, count]) => ({
    month,
    count,
    label: format(new Date(`${month}-01`), "MMM yyyy", { locale: tr }),
  }));

  const stats = [
    { label: "Toplam firma", value: totalCompanies },
    { label: "Aktif firma", value: activeCompanies },
    { label: "Tamamlanan görev", value: completedTasks },
    { label: "Devam eden görev", value: inProgressTasks },
    { label: "Gecikmiş görev", value: overdueTasks },
    { label: "Yayınlanan içerik", value: publishedContents },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="bf-page-title">
          Raporlar
        </h1>
        <p className="mt-1 text-sm text-black/55">
          Ajans performans özeti (yalnızca admin).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="bf-stat p-5">
            <p className="text-sm text-black/55">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bf-panel overflow-hidden p-0">
          <div className="border-b border-black/8 px-5 py-4">
            <h2 className="font-semibold">Firma bazlı içerik</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>İçerik</th>
                </tr>
              </thead>
              <tbody>
                {companiesWithCounts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c._count.contents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="bf-panel overflow-hidden p-0">
          <div className="border-b border-black/8 px-5 py-4">
            <h2 className="font-semibold">Çalışan bazlı görev</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Çalışan</th>
                  <th>Görev</th>
                </tr>
              </thead>
              <tbody>
                {employeesWithTasks.map((e) => (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td>{e._count.assignedTasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="bf-panel overflow-hidden p-0">
        <div className="border-b border-black/8 px-5 py-4">
          <h2 className="font-semibold">Aylık içerik üretimi</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="bf-table">
            <thead>
              <tr>
                <th>Ay</th>
                <th>İçerik sayısı</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row) => (
                <tr key={row.month}>
                  <td className="capitalize">{row.label}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
