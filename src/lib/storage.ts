import type { GlobalFilters, PageListState, ThemeMode } from "@/types";
import { resolveDateRange, todaySeoul, toDateString } from "@/lib/dates";
import { startOfMonth } from "date-fns";

const FILTER_KEY = "production-analytics-filters";
const THEME_KEY = "production-analytics-color-theme";
const PAGE_PREFIX = "production-analytics-page:";
const COMPARE_KEY = "production-analytics-compare";

export function defaultFilters(): GlobalFilters {
  const range = resolveDateRange("thisMonth");
  return {
    factory: "전체",
    productType: "전체",
    datePreset: "thisMonth",
    startDate: range.startDate,
    endDate: range.endDate,
    equipmentIds: [],
    partIds: [],
    operatorIds: [],
    moldIds: [],
    shiftType: "전체",
    downtimeReason: "전체",
  };
}

export function loadFilters(): GlobalFilters {
  if (typeof window === "undefined") return defaultFilters();
  try {
    const raw = sessionStorage.getItem(FILTER_KEY);
    if (!raw) return defaultFilters();
    const parsed = JSON.parse(raw) as Partial<GlobalFilters>;
    const base = { ...defaultFilters(), ...parsed };
    if (base.datePreset !== "custom") {
      const range = resolveDateRange(base.datePreset);
      base.startDate = range.startDate;
      base.endDate = range.endDate;
    }
    return base;
  } catch {
    return defaultFilters();
  }
}

export function saveFilters(filters: GlobalFilters) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(FILTER_KEY, JSON.stringify(filters));
}

export function resetFilters() {
  const next = defaultFilters();
  saveFilters(next);
  return next;
}

export function loadTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const raw = localStorage.getItem(THEME_KEY);
  return raw === "dark" ? "dark" : "light";
}

export function saveTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
}

export function loadPageState(screenKey: string): PageListState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PAGE_PREFIX + screenKey);
    return raw ? (JSON.parse(raw) as PageListState) : null;
  } catch {
    return null;
  }
}

export function savePageState(screenKey: string, state: PageListState) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PAGE_PREFIX + screenKey, JSON.stringify(state));
}

export function clearAllPageStates() {
  if (typeof window === "undefined") return;
  const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(PAGE_PREFIX));
  keys.forEach((k) => sessionStorage.removeItem(k));
  sessionStorage.removeItem(COMPARE_KEY);
  sessionStorage.removeItem(FILTER_KEY);
}

export function defaultPageState(
  sort: string,
  order: "asc" | "desc" = "desc",
): PageListState {
  return {
    search: "",
    sort,
    order,
    page: 1,
    pageSize: 20,
  };
}

export { FILTER_KEY, THEME_KEY, COMPARE_KEY, todaySeoul, toDateString, startOfMonth };
