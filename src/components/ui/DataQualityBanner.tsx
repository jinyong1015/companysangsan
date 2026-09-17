"use client";

import Link from "next/link";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { formatNumber } from "@/lib/format";

export function DataQualityBanner() {
  const { filters } = useFilters();
  const { batch, isDemo } = useDataSource();
  const excluded = batch.excludedRowCount;
  const valid = batch.validRowCount;

  if (isDemo) {
    return (
      <div className="card mb-4 border-[var(--border)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        가데이터 품질 · 분석 {formatNumber(valid)}건 · 제외 {formatNumber(excluded)}건
        <span className="mt-1 block text-xs">
          엑셀 업로드 전에는 샘플 데이터만 집계됩니다.
        </span>
      </div>
    );
  }

  if (excluded === 0) {
    return (
      <div className="card mb-4 border-[var(--success)]/30 px-4 py-3 text-sm text-[var(--success)]">
        데이터 품질 · 제외된 데이터가 없습니다. 분석 {formatNumber(valid)}건
      </div>
    );
  }

  const href = `/data-errors?batchId=${batch.id}&startDate=${filters.startDate}&endDate=${filters.endDate}`;

  return (
    <div className="card mb-4 flex flex-col gap-3 border-[var(--warning)]/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold">
          데이터 품질 · 분석 {formatNumber(valid)}건 · 제외 {formatNumber(excluded)}건
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          오류 행은 생산량과 불량수량을 포함한 모든 분석에서 제외됩니다.
        </p>
      </div>
      <Link href={href} className="btn shrink-0">
        오류 DATA 보기
      </Link>
    </div>
  );
}
