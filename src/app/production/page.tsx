"use client";

import { useMemo } from "react";
import {
  ProductPerformanceSummary,
  type ProductTab,
} from "@/components/production/ProductPerformanceSummary";
import { ProductTypeTabs } from "@/components/production/ProductTypeTabs";
import { ProductShotTopWorst } from "@/components/production/ProductShotTopWorst";
import { EmptyState, PageHeader } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { usePageState } from "@/hooks/usePageState";
import { aggregateProductPerformance } from "@/lib/aggregates";
import { downloadExcel } from "@/lib/excelParse";
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

  /** TOP & WORST 전용 (종합 실적과 독립) */
  const topProductTab = parseProductTab(
    state.extra?.topProductTab ?? state.extra?.productTab,
  );
  /** 제품별 생산 종합 실적 전용 */
  const summaryProductTab = parseProductTab(state.extra?.summaryProductTab);
  const hiddenColumns = parseHiddenColumns(state.extra?.hiddenColumns);

  const setTopProductTab = (tab: ProductTab) => {
    patch({ extra: { topProductTab: tab } });
  };

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

  const topRows = useMemo(
    () => byProductTab(allRows, topProductTab),
    [allRows, topProductTab],
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
        onExcel={() =>
          downloadExcel(
            "제품별_생산_종합_실적.xlsx",
            summaryRows.map((r, i) => ({
              NO: i + 1,
              제품유형: r.productType,
              품번: r.partNumber,
              "비가동시간(분)": r.downtimeMinutes,
              "작업시간(분)": r.elapsedMinutes,
              "가동시간(분)": r.operatingMinutes,
              "총 SHOT": r.shotCount,
              "가동시간 기준 평균 SHOT": r.avgShotByOperating,
              "전체 작업시간 기준 평균 SHOT": r.avgShotByElapsed,
              작업일수: r.workDays,
              "일 평균 판수":
                r.dailyAvgShots == null ? null : Math.round(r.dailyAvgShots),
              "생산수량(EA)": r.productionQuantity,
              "불량수량(EA)": r.defectQuantity,
              "양품수량(EA)": r.goodQuantity,
              UPH: r.uph,
            })),
          )
        }
      />

      <ProductTypeTabs
        value={topProductTab}
        onChange={setTopProductTab}
        counts={tabCounts}
        ariaLabel="TOP & WORST 제품유형"
      />

      <ProductShotTopWorst rows={topRows} productTab={topProductTab} />

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
