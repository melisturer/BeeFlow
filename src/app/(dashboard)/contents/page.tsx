import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";

export default async function ContentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    platform?: string;
    company?: string;
  }>;
}) {
  const session = await auth();
  if (session?.user?.role !== Role.ADMIN) {
    redirect("/");
  }
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.company) qs.set("company", sp.company);
  // içerik durumu ≠ görev durumu; sadece firma filtresini taşı
  const q = qs.toString();
  redirect(q ? `/work?${q}` : "/work");
}
