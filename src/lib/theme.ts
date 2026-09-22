import type { ThemeMode } from "@/types";

export type ColorTheme = ThemeMode;

export const THEME_STORAGE_KEY = "production-analytics-color-theme";

/** DOM·React 구독자가 테마 변경을 즉시 반영할 때 사용 */
export const THEME_CHANGE_EVENT = "production-analytics-theme-change";

export function getInitialTheme(): ColorTheme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // 저장소를 사용할 수 없으면 라이트 기본
  }
  return "light";
}

/**
 * 테마를 DOM에 즉시 반영한다.
 * CSS는 `[data-theme="dark"]` 규칙을 사용한다. (전환 애니메이션 없음 — 버벅임 방지)
 */
export function applyTheme(theme: ColorTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function saveTheme(theme: ColorTheme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 저장 실패 시에도 현재 화면의 테마 전환은 유지
  }
}

export function dispatchThemeChange(theme: ColorTheme) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }),
  );
}
