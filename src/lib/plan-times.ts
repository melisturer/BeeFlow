import { setHours, setMinutes, setSeconds, startOfDay } from "date-fns";
import type { ContentType } from "@/generated/prisma/enums";

export type PlanTimes = Partial<Record<ContentType, string[]>>;

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function normalizePlanTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!TIME_RE.test(trimmed)) return null;
  const [h, m] = trimmed.split(":");
  return `${h!.padStart(2, "0")}:${m}`;
}

export function parsePlanTimesFromForm(
  formData: FormData,
  counts: {
    planPosts: number;
    planStories: number;
    planReels: number;
    planVideos: number;
  },
): PlanTimes {
  const specs: Array<{ type: ContentType; count: number }> = [
    { type: "POST", count: counts.planPosts },
    { type: "STORY", count: counts.planStories },
    { type: "REEL", count: counts.planReels },
    { type: "VIDEO", count: counts.planVideos },
  ];

  const result: PlanTimes = {};
  for (const { type, count } of specs) {
    if (count <= 0) continue;
    const times: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const raw = formData.get(`planTime_${type}_${i}`);
      times.push(normalizePlanTime(raw) ?? "12:00");
    }
    result[type] = times;
  }
  return result;
}

export function parseStoredPlanTimes(value: unknown): PlanTimes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: PlanTimes = {};
  for (const type of ["POST", "STORY", "REEL", "VIDEO"] as ContentType[]) {
    const list = (value as Record<string, unknown>)[type];
    if (!Array.isArray(list)) continue;
    const times = list
      .map((t) => normalizePlanTime(t))
      .filter((t): t is string => !!t);
    if (times.length > 0) result[type] = times;
  }
  return result;
}

/** Günün belirtilen HH:mm anı (yerel). */
export function publishAtOnDay(day: Date, hhmm: string): Date {
  const normalized = normalizePlanTime(hhmm) ?? "12:00";
  const [h, m] = normalized.split(":").map(Number);
  return setSeconds(
    setMinutes(setHours(startOfDay(day), h ?? 12), m ?? 0),
    0,
  );
}

export function timeForSlot(
  schedule: PlanTimes | undefined,
  type: ContentType,
  indexZeroBased: number,
): string {
  const list = schedule?.[type];
  return list?.[indexZeroBased] ?? "12:00";
}
