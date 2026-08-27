import Link from "next/link";
import { redirect } from "next/navigation";
import { createContent } from "@/actions/contents";
import { NewContentForm } from "@/components/contents/new-content-form";
import { Role } from "@/generated/prisma/client";
import { getCompaniesContentPlans } from "@/lib/content-plan";
import { requireSession } from "@/lib/session";

export default async function NewContentPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  // Admin: iş/içerik tek oluşturma sayfasında
  if (session.user.role === Role.ADMIN) {
    const qs = new URLSearchParams({ type: "content" });
    if (sp.company) qs.set("company", sp.company);
    redirect(`/work/new?${qs.toString()}`);
  }

  const companies = await getCompaniesContentPlans();
  const ordered = sp.company
    ? [
        ...companies.filter((c) => c.id === sp.company),
        ...companies.filter((c) => c.id !== sp.company),
      ]
    : companies;

  async function action(formData: FormData) {
    "use server";
    await createContent(formData);
    redirect("/");
  }

  return (
    <div className="bf-page mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/" className="bf-link text-sm">
          ← Dashboard
        </Link>
        <h1 className="bf-page-title mt-2">Yeni içerik</h1>
        <p className="bf-page-sub">
          Firma seçince günlük / haftalık / aylık hedefleri görürsün.
        </p>
      </div>

      <NewContentForm action={action} companies={ordered} cancelHref="/" />
    </div>
  );
}
