"use client";

import { useEffect, useRef } from "react";
import { useFilters } from "@/context/FilterContext";
import type { DatePreset } from "@/types";

type PeriodSnapshot = {
  datePreset: DatePreset;
  startDate: string;
  endDate: string;
};

/**
 * 가동률·비가동처럼 화면 내 조회월만 쓰는 페이지에서
 * 전역 헤더 조회기간이 바뀌지 않도록 진입 시 스냅샷 → 이탈 시 복원한다.
 */
export function usePreserveGlobalPeriod(enabled: boolean) {
  const { filters, setFilters } = useFilters();
  const snapshotRef = useRef<PeriodSnapshot | null>(null);

  useEffect(() => {
    if (!enabled) return;

    snapshotRef.current = {
      datePreset: filters.datePreset,
      startDate: filters.startDate,
      endDate: filters.endDate,
    };

    return () => {
      const snap = snapshotRef.current;
      snapshotRef.current = null;
      if (!snap) return;
      setFilters({
        datePreset: snap.datePreset,
        startDate: snap.startDate,
        endDate: snap.endDate,
      });
    };
    // 진입 시점의 조회기간만 고정 복원
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, setFilters]);
}
