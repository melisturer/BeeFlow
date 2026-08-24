import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== Role.ADMIN) {
    redirect("/");
  }
  return session;
}

export function isAdmin(role: Role) {
  return role === Role.ADMIN;
}
