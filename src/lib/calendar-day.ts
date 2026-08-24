import { format, startOfDay } from "date-fns";

/** Takvim gün eşlemesi için TZ-güvenli yerel öğle ISO (Z yok). */
export function calendarDayIso(day: Date) {
  return `${format(startOfDay(day), "yyyy-MM-dd")}T12:00:00`;
}

export function calendarDateKey(day: Date) {
  return format(startOfDay(day), "yyyy-MM-dd");
}
