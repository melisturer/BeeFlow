import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@heroui/react";
import { updateEmployee } from "@/actions/users";
import {
  FormField,
  SelectInput,
  TextInput,
} from "@/components/ui/form-field";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { roleLabels } from "@/lib/labels";
import { requireAdmin } from "@/lib/session";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();
  const employeeId = user.id;

  async function action(formData: FormData) {
    "use server";
    await updateEmployee(employeeId, formData);
    redirect("/employees");
  }

  return (
    <div className="bf-page mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/employees" className="bf-link text-sm">
          ← Çalışanlar
        </Link>
        <h1 className="bf-page-title mt-2">Çalışan düzenle</h1>
        <p className="bf-page-sub">{user.email}</p>
      </div>

      <Card className="bf-panel">
        <Card.Content>
          <form action={action} className="grid gap-4 md:grid-cols-2">
            <FormField label="Ad soyad" htmlFor="name">
              <TextInput
                id="name"
                name="name"
                required
                minLength={2}
                defaultValue={user.name}
              />
            </FormField>
            <FormField label="E-posta" htmlFor="email">
              <TextInput
                id="email"
                name="email"
                type="email"
                required
                defaultValue={user.email}
              />
            </FormField>
            <FormField label="Yeni şifre (opsiyonel)" htmlFor="password">
              <TextInput
                id="password"
                name="password"
                type="password"
                minLength={6}
                placeholder="Değiştirmek istemiyorsan boş bırak"
              />
            </FormField>
            <FormField label="Rol" htmlFor="role">
              <SelectInput id="role" name="role" defaultValue={user.role}>
                <option value={Role.EMPLOYEE}>{roleLabels.EMPLOYEE}</option>
                <option value={Role.ADMIN}>{roleLabels.ADMIN}</option>
              </SelectInput>
            </FormField>
            <FormField label="Durum" htmlFor="active">
              <SelectInput
                id="active"
                name="active"
                defaultValue={user.active ? "true" : "false"}
              >
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </SelectInput>
            </FormField>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button type="submit" className="bf-btn bf-btn-dark">
                Kaydet
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
