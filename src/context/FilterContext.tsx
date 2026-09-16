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
import type { GlobalFilters } from "@/types";
import { resolveDateRange } from "@/lib/dates";
import {
  clearAllPageStates,
  defaultFilters,
  loadFilters,
  resetFilters as resetStored,
  saveFilters,
} from "@/lib/storage";

interface FilterContextValue {
  filters: GlobalFilters;
  setFilters: (patch: Partial<GlobalFilters>) => void;
  resetGlobal: () => void;
  resetDetail: () => void;
  resetAllAfterActivation: () => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<GlobalFilters>(defaultFilters);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFiltersState(loadFilters());
    setReady(true);
  }, []);

  const setFilters = useCallback((patch: Partial<GlobalFilters>) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...patch };
      if (patch.datePreset && patch.datePreset !== "custom") {
        const range = resolveDateRange(patch.datePreset);
        next.startDate = range.startDate;
        next.endDate = range.endDate;
      }
      if (patch.startDate || patch.endDate) {
        next.datePreset = "custom";
      }
      saveFilters(next);
      return next;
    });
  }, []);

  const resetGlobal = useCallback(() => {
    const next = resetStored();
    setFiltersState(next);
  }, []);

  const resetDetail = useCallback(() => {
    setFilters({
      equipmentIds: [],
      partIds: [],
      operatorIds: [],
      moldIds: [],
      shiftType: "전체",
      downtimeReason: "전체",
    });
  }, [setFilters]);

  const resetAllAfterActivation = useCallback(() => {
    clearAllPageStates();
    const next = defaultFilters();
    saveFilters(next);
    setFiltersState(next);
  }, []);

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      resetGlobal,
      resetDetail,
      resetAllAfterActivation,
    }),
    [filters, setFilters, resetGlobal, resetDetail, resetAllAfterActivation],
  );

  if (!ready) {
    return <div className="min-h-screen bg-[var(--app-bg)]" />;
  }

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}
