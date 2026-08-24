import Link from "next/link";
import { Button, Card, Chip } from "@heroui/react";
import { createCompany, deleteCompany } from "@/actions/companies";
import {
  FormField,
  SelectInput,
  TextInput,
} from "@/components/ui/form-field";
import { CompanyStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { companyStatusLabels } from "@/lib/labels";
import { requireAdmin } from "@/lib/session";

export default async function CompaniesPage() {
  await requireAdmin();

  const [companies, employees] = await Promise.all([
    prisma.company.findMany({
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
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="bf-page space-y-8">
      <div>
        <h1 className="bf-page-title">Firmalar</h1>
        <p className="bf-page-sub">
          Görev ve içerik akışını firma bazında takip et.
        </p>
      </div>

      <div className="bf-panel">
        <h2 className="bf-panel-title mb-4">Yeni firma</h2>
        <form action={createCompany} className="grid gap-4 md:grid-cols-3">
          <FormField label="Firma adı" htmlFor="name">
            <TextInput
              id="name"
              name="name"
              required
              minLength={2}
              placeholder="Örn. Nova Medya"
            />
          </FormField>
          <FormField label="Sorumlu" htmlFor="assigneeId">
            <SelectInput id="assigneeId" name="assigneeId" defaultValue="">
              <option value="">Seçilmedi</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Durum" htmlFor="status">
            <SelectInput
              id="status"
              name="status"
              defaultValue={CompanyStatus.ACTIVE}
            >
              {Object.entries(companyStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <input type="hidden" name="sector" value="" />
          <input type="hidden" name="email" value="" />
          <input type="hidden" name="phone" value="" />
          <input type="hidden" name="website" value="" />
          <input type="hidden" name="address" value="" />
          <input type="hidden" name="brandColors" value="" />
          <input type="hidden" name="brandVoice" value="" />
          <input type="hidden" name="brandNotes" value="" />
          <div className="md:col-span-3">
            <button type="submit" className="bf-btn bf-btn-dark">
              Firma ekle
            </button>
          </div>
        </form>
      </div>

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
                      <form action={deleteCompany.bind(null, company.id)}>
                        <Button type="submit" variant="danger" size="sm">
                          Sil
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
