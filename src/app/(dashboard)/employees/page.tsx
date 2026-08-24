import { Button, Card, Chip } from "@heroui/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { createEmployee, deleteEmployee } from "@/actions/users";
import {
  FormField,
  SelectInput,
  TextInput,
} from "@/components/ui/form-field";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { roleLabels } from "@/lib/labels";
import { requireAdmin } from "@/lib/session";

export default async function EmployeesPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="bf-page-title">
          Çalışanlar
        </h1>
        <p className="mt-1 text-sm text-black/55">
          Ekip üyelerini yönetin.
        </p>
      </div>

      <Card className="bf-panel">
        <Card.Header className="mb-4">
          <Card.Title>Yeni çalışan</Card.Title>
        </Card.Header>
        <Card.Content>
          <form action={createEmployee} className="grid gap-4 md:grid-cols-2">
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
            <div className="md:col-span-2">
              <button type="submit" className="bf-btn">
                Çalışan ekle
              </button>
            </div>
          </form>
        </Card.Content>
      </Card>

      <Card className="bf-panel overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="bf-table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>E-posta</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Kayıt</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="font-medium">{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <Chip size="sm">{roleLabels[user.role]}</Chip>
                  </td>
                  <td>{user.active ? "Aktif" : "Pasif"}</td>
                  <td>
                    {format(user.createdAt, "d MMM yyyy", { locale: tr })}
                  </td>
                  <td>
                    <form action={deleteEmployee.bind(null, user.id)}>
                      <Button type="submit" size="sm" variant="danger">
                        Sil
                      </Button>
                    </form>
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
