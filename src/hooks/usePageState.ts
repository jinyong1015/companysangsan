"use client";

import { useCallback, useEffect, useState } from "react";
import type { PageListState } from "@/types";
import { defaultPageState, loadPageState, savePageState } from "@/lib/storage";

export function usePageState(screenKey: string, sort: string, order: "asc" | "desc" = "desc") {
  const [state, setState] = useState<PageListState>(() => defaultPageState(sort, order));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = loadPageState(screenKey);
    if (saved) setState(saved);
    else setState(defaultPageState(sort, order));
    setReady(true);
  }, [screenKey, sort, order]);

  useEffect(() => {
    if (!ready) return;
    savePageState(screenKey, state);
  }, [screenKey, state, ready]);

  const patch = useCallback((next: Partial<PageListState> & { resetPage?: boolean }) => {
    setState((prev) => {
      const { resetPage, ...rest } = next;
      const merged = { ...prev, ...rest };
      if (rest.extra) {
        merged.extra = { ...prev.extra, ...rest.extra };
      }
      if (
        resetPage ||
        next.search !== undefined ||
        next.sort !== undefined ||
        next.order !== undefined ||
        next.pageSize !== undefined
      ) {
        if (next.page === undefined) merged.page = 1;
      }
      return merged;
    });
  }, []);

  return { state, patch, ready };
}
