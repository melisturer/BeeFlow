import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { requireSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <Providers>
      <div className="bf-shell flex">
        <Sidebar
          userName={session.user.name ?? "Kullanıcı"}
          role={session.user.role}
        />
        <main className="bf-main">{children}</main>
      </div>
    </Providers>
  );
}
