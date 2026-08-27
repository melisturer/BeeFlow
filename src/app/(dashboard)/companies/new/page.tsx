import Link from "next/link";
import { redirect } from "next/navigation";
import { createCompany } from "@/actions/companies";
import {
  FormField,
  SelectInput,
  TextInput,
} from "@/components/ui/form-field";
import { CompanyStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { companyStatusLabels } from "@/lib/labels";
import { requireAdmin } from "@/lib/session";

export default async function NewCompanyPage() {
  await requireAdmin();

  const employees = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  async function action(formData: FormData) {
    "use server";
    await createCompany(formData);
    redirect("/companies");
  }

  return (
    <div className="bf-page mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/companies" className="bf-link text-sm">
          ← Firmalar
        </Link>
        <h1 className="bf-page-title mt-2">Yeni firma</h1>
        <p className="bf-page-sub">
          Müşteri firmayı ekle; görev ve içerik akışını buradan bağla.
        </p>
      </div>

      <div className="bf-panel">
        <form action={action} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <FormField label="Firma adı" htmlFor="name">
              <TextInput
                id="name"
                name="name"
                required
                minLength={2}
                placeholder="Örn. Nova Medya"
              />
            </FormField>
          </div>
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
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button type="submit" className="bf-btn bf-btn-dark">
              Firma ekle
            </button>
            <Link href="/companies" className="bf-btn bf-btn-ghost">
              İptal
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
