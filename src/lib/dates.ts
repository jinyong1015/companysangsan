import {
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfWeek,
  endOfWeek,
  addDays,
} from "date-fns";
import type { DatePreset, Grain } from "@/types";

const TZ_LABEL = "Asia/Seoul";

export function todaySeoul(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_LABEL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return parseISO(`${y}-${m}-${d}`);
}

export function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function resolveDateRange(
  preset: DatePreset,
  startDate?: string,
  endDate?: string,
): { startDate: string; endDate: string } {
  const today = todaySeoul();
  switch (preset) {
    case "today":
      return { startDate: toDateString(today), endDate: toDateString(today) };
    case "last7":
      return {
        startDate: toDateString(subDays(today, 6)),
        endDate: toDateString(today),
      };
    case "thisMonth":
      return {
        startDate: toDateString(startOfMonth(today)),
        endDate: toDateString(today),
      };
    case "lastMonth": {
      const prev = subMonths(today, 1);
      return {
        startDate: toDateString(startOfMonth(prev)),
        endDate: toDateString(endOfMonth(prev)),
      };
    }
    case "thisYear":
      return {
        startDate: toDateString(startOfYear(today)),
        endDate: toDateString(today),
      };
    case "custom":
      return {
        startDate: startDate ?? toDateString(startOfMonth(today)),
        endDate: endDate ?? toDateString(today),
      };
  }
}

export function previousPeriod(
  startDate: string,
  endDate: string,
): { startDate: string; endDate: string } {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const days = differenceInCalendarDays(end, start) + 1;
  const prevEnd = subDays(start, 1);
  const prevStart = subDays(prevEnd, days - 1);
  return { startDate: toDateString(prevStart), endDate: toDateString(prevEnd) };
}

export function autoGrain(startDate: string, endDate: string): Grain {
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  return days <= 62 ? "day" : "month";
}

export function periodBuckets(
  startDate: string,
  endDate: string,
  grain: Grain,
): Array<{ period: string; label: string; start: string; end: string }> {
  const start = startOfDay(parseISO(startDate));
  const end = endOfDay(parseISO(endDate));

  if (grain === "day") {
    return eachDayOfInterval({ start, end }).map((d) => ({
      period: toDateString(d),
      label: format(d, "MM/dd"),
      start: toDateString(d),
      end: toDateString(d),
    }));
  }

  if (grain === "week") {
    return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((d) => {
      const wStart = startOfWeek(d, { weekStartsOn: 1 });
      const wEnd = endOfWeek(d, { weekStartsOn: 1 });
      const clippedStart = wStart < start ? start : wStart;
      const clippedEnd = wEnd > end ? end : wEnd;
      return {
        period: toDateString(clippedStart),
        label: `${format(clippedStart, "MM/dd")}~${format(clippedEnd, "MM/dd")}`,
        start: toDateString(clippedStart),
        end: toDateString(clippedEnd),
      };
    });
  }

  return eachMonthOfInterval({ start, end }).map((d) => {
    const mStart = startOfMonth(d);
    const mEnd = endOfMonth(d);
    const clippedStart = mStart < start ? start : mStart;
    const clippedEnd = mEnd > end ? end : mEnd;
    return {
      period: format(d, "yyyy-MM"),
      label: format(d, "yyyy-MM"),
      start: toDateString(clippedStart),
      end: toDateString(clippedEnd),
    };
  });
}

export function nowLabel(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ_LABEL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(now)
    .replace(/\. /g, "-")
    .replace(".", "")
    .replace(",", "");
}

export { addDays, parseISO, differenceInCalendarDays };
