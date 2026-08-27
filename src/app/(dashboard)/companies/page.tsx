import Link from "next/link";
import { Button, Card, Chip } from "@heroui/react";
import { deleteCompany } from "@/actions/companies";
import { ConfirmDeleteForm } from "@/components/ui/confirm-delete-form";
import { prisma } from "@/lib/db";
import { companyStatusLabels } from "@/lib/labels";
import { requireAdmin } from "@/lib/session";

export default async function CompaniesPage() {
  await requireAdmin();

  const companies = await prisma.company.findMany({
    include: {
      assignee: true,
      _count: {
        select: {
          contents: true,
          tasks: { where: { status: { not: "DONE" } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="bf-page space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="bf-page-title">Firmalar</h1>
          <p className="bf-page-sub">
            Görev ve içerik akışını firma bazında takip et.
          </p>
        </div>
        <Link href="/companies/new" className="bf-btn bf-btn-dark">
          Yeni firma
        </Link>
      </div>

      {companies.length === 0 ? (
        <Card className="bf-panel">
          <p className="text-sm text-black/50">Henüz firma yok.</p>
          <Link href="/companies/new" className="bf-link mt-2 inline-block text-sm">
            İlk firmayı ekle
          </Link>
        </Card>
      ) : (
        <Card className="bf-panel overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>Sorumlu</th>
                  <th>Durum</th>
                  <th>Açık görev</th>
                  <th>İçerik</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <Link
                        href={`/companies/${company.id}`}
                        className="bf-link font-semibold"
                      >
                        {company.name}
                      </Link>
                    </td>
                    <td>{company.assignee?.name ?? "—"}</td>
                    <td>
                      <Chip size="sm">
                        {companyStatusLabels[company.status]}
                      </Chip>
                    </td>
                    <td>{company._count.tasks}</td>
                    <td>{company._count.contents}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/companies/${company.id}#ayarlar`}
                          className="bf-link text-sm"
                        >
                          Düzenle
                        </Link>
                        <ConfirmDeleteForm
                          action={deleteCompany.bind(null, company.id)}
                          message={`“${company.name}” firması silinecek. Emin misiniz?`}
                        >
                          <Button type="submit" variant="danger" size="sm">
                            Sil
                          </Button>
                        </ConfirmDeleteForm>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
