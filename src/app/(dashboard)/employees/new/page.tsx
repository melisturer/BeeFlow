import Link from "next/link";
import { Card } from "@heroui/react";
import { redirect } from "next/navigation";
import { createEmployee } from "@/actions/users";
import {
  FormField,
  SelectInput,
  TextInput,
} from "@/components/ui/form-field";
import { Role } from "@/generated/prisma/client";
import { roleLabels } from "@/lib/labels";
import { requireAdmin } from "@/lib/session";

export default async function NewEmployeePage() {
  await requireAdmin();

  async function action(formData: FormData) {
    "use server";
    await createEmployee(formData);
    redirect("/employees");
  }

  return (
    <div className="bf-page mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/employees" className="bf-link text-sm">
          ← Çalışanlar
        </Link>
        <h1 className="bf-page-title mt-2">Yeni çalışan</h1>
        <p className="bf-page-sub">Ekibe yeni üye ekle.</p>
      </div>

      <Card className="bf-panel">
        <Card.Content>
          <form action={action} className="grid gap-4 md:grid-cols-2">
            <FormField label="Ad soyad" htmlFor="name">
              <TextInput id="name" name="name" required minLength={2} />
            </FormField>
            <FormField label="E-posta" htmlFor="email">
              <TextInput id="email" name="email" type="email" required />
            </FormField>
            <FormField label="Şifre" htmlFor="password">
              <TextInput
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
              />
            </FormField>
            <FormField label="Rol" htmlFor="role">
              <SelectInput id="role" name="role" defaultValue={Role.EMPLOYEE}>
                <option value={Role.EMPLOYEE}>{roleLabels.EMPLOYEE}</option>
                <option value={Role.ADMIN}>{roleLabels.ADMIN}</option>
              </SelectInput>
            </FormField>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button type="submit" className="bf-btn bf-btn-dark">
                Çalışan ekle
              </button>
              <Link href="/employees" className="bf-btn bf-btn-ghost">
                İptal
              </Link>
            </div>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
