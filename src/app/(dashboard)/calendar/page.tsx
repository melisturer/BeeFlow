import { syncRecurringTasks } from "@/actions/tasks";
import { Role } from "@/generated/prisma/client";
import { getCalendarItems } from "@/lib/calendar-contents";
import { requireSession } from "@/lib/session";
import { ContentCalendar } from "./calendar-client";

export default async function CalendarPage() {
  const session = await requireSession();
  const admin = session.user.role === Role.ADMIN;
  // Ay görünümünü de dolduracak kadar kopya üret
  await syncRecurringTasks(31);
  const items = await getCalendarItems({
    userId: session.user.id,
    admin,
  });

  return (
    <div className="bf-page space-y-6">
      <div>
        <h1 className="bf-page-title">Takvim</h1>
        <p className="bf-page-sub">
          İçerikler ve görevler — günlere göre takip.
        </p>
      </div>
      <ContentCalendar initialItems={items} />
    </div>
  );
}
