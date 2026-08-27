import Link from "next/link";
import { Button, Card, Chip } from "@heroui/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { deleteEmployee } from "@/actions/users";
import { ConfirmDeleteForm } from "@/components/ui/confirm-delete-form";
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="bf-page-title">Çalışanlar</h1>
          <p className="mt-1 text-sm text-black/55">Ekip üyelerini yönetin.</p>
        </div>
        <Link href="/employees/new" className="bf-btn bf-btn-dark">
          Yeni çalışan
        </Link>
      </div>

      {users.length === 0 ? (
        <Card className="bf-panel">
          <p className="text-sm text-black/50">Henüz çalışan yok.</p>
          <Link
            href="/employees/new"
            className="bf-link mt-2 inline-block text-sm"
          >
            İlk çalışanı ekle
          </Link>
        </Card>
      ) : (
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
                  <th>İşlem</th>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/employees/${user.id}`}
                          className="bf-link text-sm"
                        >
                          Düzenle
                        </Link>
                        <ConfirmDeleteForm
                          action={deleteEmployee.bind(null, user.id)}
                          message={`“${user.name}” silinecek. Emin misiniz?`}
                        >
                          <Button type="submit" size="sm" variant="danger">
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
