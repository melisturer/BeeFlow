import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; status?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== Role.ADMIN) {
    redirect("/");
  }
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.company) qs.set("company", sp.company);
  if (sp.status) qs.set("status", sp.status);
  const q = qs.toString();
  redirect(q ? `/work?${q}` : "/work");
}
