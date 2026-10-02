"use client";

import { useMemo } from "react";
import {
  ProductPerformanceSummary,
  type ProductTab,
} from "@/components/production/ProductPerformanceSummary";
import { ProductionVariationTrend } from "@/components/production/ProductionVariationTrend";
import { EmptyState, PageHeader } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { usePageState } from "@/hooks/usePageState";
import { aggregateProductPerformance } from "@/lib/aggregates";
import type { GlobalFilters, ProductPerformanceRow } from "@/types";

function parseProductTab(value: unknown): ProductTab {
  if (value === "GROMMET" || value === "SEAL" || value === "전체") return value;
  return "전체";
}

function parseHiddenColumns(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function byProductTab(
  rows: ProductPerformanceRow[],
  tab: ProductTab,
): ProductPerformanceRow[] {
  if (tab === "전체") return rows;
  return rows.filter((r) => r.productType === tab);
}

export default function ProductionPage() {
  const { filters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const { state, patch } = usePageState("production", "productionQuantity", "desc");

  /** 제품별 생산 종합 실적 전용 */
  const summaryProductTab = parseProductTab(state.extra?.summaryProductTab);
  const hiddenColumns = parseHiddenColumns(state.extra?.hiddenColumns);

  const setSummaryProductTab = (tab: ProductTab) => {
    patch({
      extra: { summaryProductTab: tab },
      page: 1,
    });
  };

  const setHiddenColumns = (keys: string[]) => {
    patch({ extra: { hiddenColumns: keys.join(",") } });
  };

  const baseFilters: GlobalFilters = useMemo(
    () => ({
      ...filters,
      productType: "전체",
      equipmentIds: [],
      partIds: [],
      operatorIds: [],
      moldIds: [],
      shiftType: "전체",
    }),
    [filters],
  );

  const allRows = useMemo(
    () => aggregateProductPerformance(records, baseFilters),
    [records, baseFilters],
  );

  const summaryRows = useMemo(
    () => byProductTab(allRows, summaryProductTab),
    [allRows, summaryProductTab],
  );

  const tabCounts = useMemo(
    () => ({
      전체: allRows.length,
      GROMMET: allRows.filter((r) => r.productType === "GROMMET").length,
      SEAL: allRows.filter((r) => r.productType === "SEAL").length,
    }),
    [allRows],
  );

  if (allRows.length === 0) {
    return (
      <>
        <PageHeader title="생산 분석" description="품번별 생산 종합 실적을 확인합니다." />
        <EmptyState
          title="분석 가능한 DATA가 없습니다."
          description="선택한 조건에 정상 생산 DATA가 없습니다."
          actionLabel="조회조건 초기화"
          onAction={resetGlobal}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="생산 분석"
        description="품번별 생산 종합 실적을 확인합니다."
      />

      <ProductionVariationTrend grain="month" lastMonths={12} />

      <ProductPerformanceSummary
        rows={summaryRows}
        productTab={summaryProductTab}
        onProductTab={setSummaryProductTab}
        tabCounts={tabCounts}
        search={state.search}
        onSearch={(search) => patch({ search })}
        sort={state.sort}
        onSort={(sort) => patch({ sort })}
        order={state.order}
        onOrder={(order) => patch({ order })}
        page={state.page}
        onPage={(page) => patch({ page })}
        pageSize={state.pageSize}
        onPageSize={(pageSize) => patch({ pageSize })}
        hiddenColumns={hiddenColumns}
        onHiddenColumns={setHiddenColumns}
        onResetFilters={resetGlobal}
      />
    </>
  );
}
