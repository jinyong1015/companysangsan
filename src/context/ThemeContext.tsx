"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ThemeMode } from "@/types";
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  applyTheme,
  dispatchThemeChange,
  getInitialTheme,
  saveTheme,
  type ColorTheme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemeMode;
  preference: ThemeMode;
  setPreference: (preference: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);

    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<ColorTheme>).detail;
      if (detail === "light" || detail === "dark") {
        setTheme(detail);
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        applyTheme(event.newValue);
        setTheme(event.newValue);
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
      window.removeEventListener("storage", onStorage);
    };
    // 마운트 시 DOM 동기화 + 구독만
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only
  }, []);

  const setPreference = useCallback((next: ThemeMode) => {
    saveTheme(next);
    dispatchThemeChange(next);
    setTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(theme === "light" ? "dark" : "light");
  }, [setPreference, theme]);

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
