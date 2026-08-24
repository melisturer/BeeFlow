"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, Card, Chip } from "@heroui/react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { tr } from "date-fns/locale";
import { toggleCompanyDayDone } from "@/actions/contents";
import { toggleTaskDone } from "@/actions/tasks";
import {
  contentTypeLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/lib/labels";
import type {
  ContentType,
  TaskPriority,
  TaskStatus,
} from "@/generated/prisma/enums";

export type CalendarCompanyDayItem = {
  kind: "company-day";
  id: string;
  companyId: string;
  companyName: string;
  date: string;
  contentIds: string[];
  doneCount: number;
  totalCount: number;
  typeCounts: Partial<Record<ContentType, number>>;
  allDone: boolean;
  taskIds: string[];
  canToggle?: boolean;
};

export type CalendarTaskItem = {
  kind: "task";
  id: string;
  title: string;
  date: string;
  companyId?: string | null;
  companyName: string;
  personName: string;
  priority: TaskPriority;
  status: TaskStatus;
  recurring?: boolean;
  canToggle?: boolean;
};

/** @deprecated içerikler firma-gün kartında birleşti */
export type CalendarContentItem = {
  kind: "content";
  id: string;
  title: string;
  date: string;
  companyName: string;
  personName: string;
  type: ContentType;
  status: string;
};

export type CalendarItem = CalendarCompanyDayItem | CalendarTaskItem;

/** Geriye uyumluluk */
export type CalendarContent = CalendarItem;

type ViewMode = "day" | "week" | "month";

const TYPE_ORDER: ContentType[] = ["POST", "STORY", "REEL", "VIDEO"];

function itemKey(item: CalendarItem) {
  return `${item.kind}:${item.id}`;
}

function sortByDeadline(list: CalendarItem[]) {
  return [...list].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
  );
}

function typeSummary(counts: Partial<Record<ContentType, number>>) {
  return TYPE_ORDER.filter((t) => (counts[t] ?? 0) > 0)
    .map((t) => `${counts[t]} ${contentTypeLabels[t]}`)
    .join(" · ");
}

function CardBody({
  item,
  compact = false,
  onToggleDone,
}: {
  item: CalendarItem;
  compact?: boolean;
  onToggleDone?: () => void;
}) {
  const isCompanyDay = item.kind === "company-day";
  const done =
    (isCompanyDay && item.allDone) ||
    (item.kind === "task" && item.status === "DONE");
  const href = item.kind === "task" ? `/tasks/${item.id}` : null;
  const title = isCompanyDay ? item.companyName : item.title;
  const subtitle = isCompanyDay
    ? `${item.doneCount}/${item.totalCount} · ${typeSummary(item.typeCounts) || "İçerik"}`
    : item.companyName;

  return (
    <>
      <div className="flex items-center gap-2">
        {onToggleDone ? (
          <input
            type="checkbox"
            className="bf-check"
            checked={done}
            aria-label="Tamamlandı"
            title={done ? "Tamamlandı — geri al" : "Tamamlandı işaretle"}
            onChange={() => onToggleDone()}
          />
        ) : null}
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.06em] ${
            isCompanyDay
              ? "text-[var(--da-muted)]"
              : "text-[var(--da-purple)]"
          }`}
        >
          {done
            ? "Tamam"
            : isCompanyDay
              ? "Firma"
              : item.kind === "task" && item.recurring
                ? "Tekrar"
                : "Görev"}
        </span>
      </div>
      {href ? (
        <Link
          href={href}
          className={`mt-1 block truncate text-sm font-semibold text-[var(--da-ink)] hover:text-[var(--da-purple)] ${
            done ? "opacity-55 line-through" : ""
          }`}
        >
          {title}
        </Link>
      ) : (
        <p
          className={`mt-1 block truncate text-sm font-semibold text-[var(--da-ink)] ${
            done ? "opacity-55 line-through" : ""
          }`}
        >
          {title}
        </p>
      )}
      <p
        className={`mt-0.5 text-[11px] text-black/50 ${compact ? "truncate" : ""}`}
      >
        {subtitle}
      </p>
      {!compact && item.kind === "task" ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {item.recurring ? <Chip size="sm">Yenilenen</Chip> : null}
          <Chip size="sm">{taskPriorityLabels[item.priority]}</Chip>
          <Chip size="sm">{taskStatusLabels[item.status]}</Chip>
        </div>
      ) : null}
    </>
  );
}

function cardClassName(item: CalendarItem) {
  const done =
    (item.kind === "company-day" && item.allDone) ||
    (item.kind === "task" && item.status === "DONE");
  const isTask = item.kind === "task";
  return `rounded-lg border p-2 shadow-sm ${
    isTask
      ? "border-[var(--da-purple)]/25 bg-[#f6f2ff]"
      : done
        ? "border-[var(--da-yellow)] bg-[#fffceb]"
        : "border-black/8 bg-white"
  }`;
}

function CalendarCard({
  item,
  compact,
  onToggleDone,
}: {
  item: CalendarItem;
  compact?: boolean;
  onToggleDone?: () => void;
}) {
  return (
    <div className={cardClassName(item)}>
      <CardBody item={item} compact={compact} onToggleDone={onToggleDone} />
    </div>
  );
}

function dayContentsAllDone(items: CalendarItem[]) {
  const companyDays = items.filter((i) => i.kind === "company-day");
  if (companyDays.length === 0) return false;
  return companyDays.every((i) => i.allDone);
}

function DayHeader({ day, complete }: { day: Date; complete: boolean }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p
        className="text-xs font-semibold text-black/55"
        suppressHydrationWarning
      >
        {format(day, "EEE d MMM", { locale: tr })}
      </p>
      {complete ? (
        <span className="rounded-[4px] bg-[var(--da-purple)]/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--da-purple)]">
          Yapıldı
        </span>
      ) : null}
    </div>
  );
}

function DayCell({
  day,
  items,
  isOutside,
  onToggleItemDone,
}: {
  day: Date;
  items: CalendarItem[];
  isOutside?: boolean;
  onToggleItemDone: (item: CalendarItem) => void;
}) {
  const complete = dayContentsAllDone(items);

  return (
    <div
      className={`min-h-28 rounded-xl border p-2 ${
        isOutside
          ? "border-black/5 bg-black/[0.02] opacity-60"
          : complete
            ? "border-[var(--da-purple)]/35 bg-[var(--da-purple)]/[0.04]"
            : "border-black/8 bg-white/70"
      }`}
    >
      <DayHeader day={day} complete={complete} />
      <div className="space-y-2">
        {sortByDeadline(items).map((item) => (
          <CalendarCard
            key={itemKey(item)}
            item={item}
            compact
            onToggleDone={
              item.canToggle ? () => onToggleItemDone(item) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

export function ContentCalendar({
  initialContents,
  initialItems,
  defaultView = "week",
  compact = false,
}: {
  /** @deprecated use initialItems */
  initialContents?: CalendarItem[];
  initialItems?: CalendarItem[];
  defaultView?: ViewMode;
  compact?: boolean;
}) {
  const seed = initialItems ?? initialContents ?? [];
  const [items, setItems] = useState(seed);
  const [view, setView] = useState<ViewMode>(defaultView);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setAnchor(startOfDay(new Date()));
  }, []);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      const end = endOfWeek(anchor, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [anchor, view]);

  function itemsForDay(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    return items.filter((item) => {
      if (item.date.length >= 10 && !item.date.endsWith("Z")) {
        return item.date.slice(0, 10) === key;
      }
      return isSameDay(parseISO(item.date), day);
    });
  }

  function shift(dir: -1 | 1) {
    if (view === "day") setAnchor((d) => addDays(d, dir));
    else if (view === "week") setAnchor((d) => addDays(d, dir * 7));
    else setAnchor((d) => addMonths(d, dir));
  }

  function onToggleItemDone(item: CalendarItem) {
    if (!item.canToggle) return;
    if (item.kind === "company-day") {
      const nextDone = !item.allDone;
      setItems((list) =>
        list.map((i) =>
          i.kind === "company-day" && i.id === item.id
            ? {
                ...i,
                allDone: nextDone,
                doneCount: nextDone ? i.totalCount : 0,
              }
            : i,
        ),
      );
      startTransition(async () => {
        try {
          await toggleCompanyDayDone(item.companyId, item.date);
        } catch {
          setItems((list) =>
            list.map((i) =>
              i.kind === "company-day" && i.id === item.id ? item : i,
            ),
          );
        }
      });
      return;
    }

    const wasDone = item.status === "DONE";
    const nextStatus = wasDone ? "IN_PROGRESS" : "DONE";
    setItems((list) =>
      list.map((i) =>
        i.kind === "task" && i.id === item.id
          ? { ...i, status: nextStatus as TaskStatus }
          : i,
      ),
    );
    startTransition(async () => {
      try {
        await toggleTaskDone(item.id);
      } catch {
        setItems((list) =>
          list.map((i) =>
            i.kind === "task" && i.id === item.id
              ? { ...i, status: item.status }
              : i,
          ),
        );
      }
    });
  }

  const title =
    view === "month"
      ? format(anchor, "MMMM yyyy", { locale: tr })
      : view === "week"
        ? `${format(days[0], "d MMM", { locale: tr })} – ${format(days[days.length - 1], "d MMM yyyy", { locale: tr })}`
        : format(anchor, "d MMMM yyyy", { locale: tr });

  const modes: ViewMode[] = compact
    ? ["week", "month"]
    : ["day", "week", "month"];

  const gridClass =
    view === "day"
      ? "grid-cols-1"
      : view === "week"
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-7"
        : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7";

  return (
    <Card className={`bf-panel ${compact ? "p-3 md:p-4" : "p-4 md:p-6"}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onPress={() => shift(-1)}>
            Önceki
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => setAnchor(startOfDay(new Date()))}
          >
            Bugün
          </Button>
          <Button size="sm" variant="secondary" onPress={() => shift(1)}>
            Sonraki
          </Button>
          <p
            className="ml-2 text-sm font-semibold capitalize"
            suppressHydrationWarning
          >
            {title}
          </p>
          {pending ? (
            <span className="text-xs text-black/45">Kaydediliyor…</span>
          ) : null}
        </div>
        <div className="flex gap-1">
          {modes.map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={view === mode ? "primary" : "secondary"}
              onPress={() => setView(mode)}
            >
              {mode === "day" ? "Gün" : mode === "week" ? "Hafta" : "Ay"}
            </Button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-xs text-[var(--da-muted)]">
        Tik yalnızca sana atanan işlerde (admin her şeyi yapabilir). Ayrıntı
        için Dashboard’daki kontrol listesi.
      </p>

      <div className={`grid gap-2 ${gridClass}`}>
        {days.map((day) => (
          <DayCell
            key={format(day, "yyyy-MM-dd")}
            day={day}
            items={itemsForDay(day)}
            isOutside={view === "month" && !isSameMonth(day, anchor)}
            onToggleItemDone={onToggleItemDone}
          />
        ))}
      </div>
    </Card>
  );
}
