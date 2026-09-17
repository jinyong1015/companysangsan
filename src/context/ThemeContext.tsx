"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ThemeMode } from "@/types";
import { loadThemePreference, saveThemePreference } from "@/lib/storage";

interface ThemeContextValue {
  theme: ThemeMode;
  preference: ThemeMode;
  setPreference: (preference: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** 색상 전환 시간 — CSS `.theme-transitioning` / html @property 와 맞출 것 */
const THEME_TRANSITION_MS = 200;

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return loadThemePreference();
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(readTheme);
  const clearTransitionTimer = useRef<number | null>(null);

  useEffect(() => {
    applyTheme(theme);
    return () => {
      if (clearTransitionTimer.current != null) {
        window.clearTimeout(clearTransitionTimer.current);
      }
      document.documentElement.classList.remove("theme-transitioning");
    };
    // 마운트 시 DOM만 동기화 (boot script와 일치). theme 변경 시마다 재실행하지 않음.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only hydrate
  }, []);

  const runThemeChange = useCallback((next: ThemeMode) => {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    if (next === current && next === theme) return;

    if (clearTransitionTimer.current != null) {
      window.clearTimeout(clearTransitionTimer.current);
      clearTransitionTimer.current = null;
    }

    const allowMotion = !prefersReducedMotion();
    if (allowMotion) {
      root.classList.add("theme-transitioning");
    }

    // DOM 테마를 먼저 바꿔 브라우저가 색상 보간을 즉시 시작하게 함
    applyTheme(next);
    saveThemePreference(next);

    // React 구독 UI(설정 선택 상태)는 transition으로 낮춰 페인트를 막지 않음
    startTransition(() => {
      setTheme(next);
    });

    if (allowMotion) {
      clearTransitionTimer.current = window.setTimeout(() => {
        root.classList.remove("theme-transitioning");
        clearTransitionTimer.current = null;
      }, THEME_TRANSITION_MS);
    }
  }, [theme]);

  const setPreference = useCallback(
    (next: ThemeMode) => {
      runThemeChange(next);
    },
    [runThemeChange],
  );

  const toggleTheme = useCallback(() => {
    runThemeChange(theme === "light" ? "dark" : "light");
  }, [runThemeChange, theme]);

  const value = useMemo(
    () => ({
      theme,
      preference: theme,
      setPreference,
      toggleTheme,
    }),
    [theme, setPreference, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
