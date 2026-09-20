"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { AnalysisGroupComparison } from "@/components/dashboard/AnalysisGroupComparison";
import { DowntimeEquipmentHeatmap } from "@/components/downtime/DowntimeEquipmentHeatmap";
import { DowntimeTopPartsChart } from "@/components/downtime/DowntimeTopPartsChart";
import { ProductionVariationTrend } from "@/components/production/ProductionVariationTrend";
import { ProductShotTopWorst } from "@/components/production/ProductShotTopWorst";
import { ProductTypeTabs } from "@/components/production/ProductTypeTabs";
import type { ProductTab } from "@/components/production/ProductPerformanceSummary";
import { UtilizationOverviewPanel } from "@/components/utilization/UtilizationOverviewPanel";
import { KpiCard, buildCompareLabel } from "@/components/ui/KpiCard";
import {
  EmptyState,
  PageHeader,
  ResponsiveGrid,
  SectionCard,
} from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";

import {
  buildAnalysisGroupBundle,
  resolveSelectedAnalysisGroup,
} from "@/lib/analysisGroups";
import { aggregateProductPerformance } from "@/lib/aggregates";
import type {
  DowntimeHeatmapMetric,
  DowntimeHeatmapProductTab,
} from "@/lib/downtimeHeatmap";
import type {
  DowntimeTopPartsProductTab,
  DowntimeTopPartsView,
} from "@/lib/downtimeTopParts";
import { dashboardTrendGrain, todaySeoul } from "@/lib/dates";
import {
  formatMinutes,
  formatPercent,
  formatQuantity,
} from "@/lib/format";
import {
  buildTrends,
  comparePeriodKpis,
  filterRecords,
} from "@/lib/metrics";
import { withFromParam } from "@/lib/navigation";
import { downloadExcel } from "@/lib/excelParse";
import {
  buildUtilizationOverviewBundle,
  loadTargetMinutes,
  loadTargetShotCounts,
  monthDateRange,
} from "@/lib/utilization";

function yearMonthFromDate(date: string) {
  return date.slice(0, 7);
}

function defaultYearMonth() {
  return format(todaySeoul(), "yyyy-MM");
}

export default function DashboardPage() {
  const { filters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const router = useRouter();
  const [topPartsProductTab, setTopPartsProductTab] =
    useState<DowntimeTopPartsProductTab>("전체");
  const [topPartsView, setTopPartsView] =
    useState<DowntimeTopPartsView>("rank");
  const [shotTopProductTab, setShotTopProductTab] =
    useState<ProductTab>("전체");
  const [heatmapProductTab, setHeatmapProductTab] =
    useState<DowntimeHeatmapProductTab>("전체");
  const [heatmapMetric, setHeatmapMetric] =
    useState<DowntimeHeatmapMetric>("minutes");
  const [heatmapYearMonth, setHeatmapYearMonth] = useState(
    () => yearMonthFromDate(filters.startDate) || defaultYearMonth(),
  );

  const invalidRange = filters.endDate < filters.startDate;

  const heatmapMonthRange = useMemo(
    () => monthDateRange(heatmapYearMonth),
    [heatmapYearMonth],
  );
  const heatmapMonthLabel = useMemo(() => {
    try {
      return format(parseISO(`${heatmapYearMonth}-01`), "yyyy년 M월");
    } catch {
      return heatmapYearMonth;
    }
  }, [heatmapYearMonth]);
  const heatmapPeriodLabel = useMemo(() => {
    try {
      return `${format(parseISO(heatmapMonthRange.startDate), "yyyy.MM.dd")} ~ ${format(
        parseISO(heatmapMonthRange.endDate),
        "yyyy.MM.dd",
      )}`;
    } catch {
      return `${heatmapMonthRange.startDate} ~ ${heatmapMonthRange.endDate}`;
    }
  }, [heatmapMonthRange.endDate, heatmapMonthRange.startDate]);

  const topPartsRecords = useMemo(
    () =>
      invalidRange
        ? []
        : filterRecords(records, {
            ...filters,
            productType: topPartsProductTab,
          }),
    [filters, invalidRange, records, topPartsProductTab],
  );

  const heatmapRecords = useMemo(
    () =>
      filterRecords(records, {
        ...filters,
        datePreset: "custom",
        startDate: heatmapMonthRange.startDate,
        endDate: heatmapMonthRange.endDate,
      }),
    [filters, heatmapMonthRange.endDate, heatmapMonthRange.startDate, records],
  );

  const trendGrain = useMemo(
    () =>
      invalidRange
        ? ("month" as const)
        : dashboardTrendGrain(filters.startDate, filters.endDate),
    [filters.endDate, filters.startDate, invalidRange],
  );

  const productPerfRows = useMemo(
    () =>
      invalidRange
        ? []
        : aggregateProductPerformance(records, {
            ...filters,
            productType: "전체",
          }),
    [filters, invalidRange, records],
  );

  const shotTopRows = useMemo(() => {
    if (shotTopProductTab === "전체") return productPerfRows;
    return productPerfRows.filter((r) => r.productType === shotTopProductTab);
  }, [productPerfRows, shotTopProductTab]);

  const shotTabCounts = useMemo(
    () => ({
      전체: productPerfRows.length,
      GROMMET: productPerfRows.filter((r) => r.productType === "GROMMET")
        .length,
      SEAL: productPerfRows.filter((r) => r.productType === "SEAL").length,
    }),
    [productPerfRows],
  );

  const utilizationOverview = useMemo(() => {
    if (invalidRange) return null;
    return buildUtilizationOverviewBundle(records, filters, {
      workPattern: "전체",
      metric: "time",
      targetSettings: loadTargetMinutes(),
      targetShotTable: loadTargetShotCounts(),
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
  }, [filters, invalidRange, records]);

  const overviewPeriodLabel = useMemo(() => {
    try {
      const start = format(parseISO(filters.startDate), "yyyy.MM.dd");
      const end = format(parseISO(filters.endDate), "yyyy.MM.dd");
      return `${start} ~ ${end}`;
    } catch {
      return `${filters.startDate} ~ ${filters.endDate}`;
    }
  }, [filters.startDate, filters.endDate]);

  const kpi = useMemo(
    () => (invalidRange ? null : comparePeriodKpis(records, filters)),
    [filters, invalidRange, records],
  );

  const analysisGroups = useMemo(
    () =>
      invalidRange ? null : buildAnalysisGroupBundle(records, filters),
    [filters, invalidRange, records],
  );

  const selectedGroup = useMemo(
    () => resolveSelectedAnalysisGroup(filters),
    [filters],
  );

  const headerDescription = selectedGroup
    ? `${selectedGroup.label} 기준 생산·불량 현황`
    : "SEAL · GROMMET 기준 생산·불량 현황";

  const sparkSeries = useMemo(() => {
    if (invalidRange) {
      return {
        production: [] as number[],
        defectRate: [] as number[],
        defect: [] as number[],
        utilization: [] as number[],
      };
    }
    const points = buildTrends(
      filterRecords(records, filters),
      filters.startDate,
      filters.endDate,
      trendGrain,
    );
    return {
      production: points.map((p) => p.productionQuantity),
      defectRate: points.map((p) => {
        const denom = p.productionQuantity + p.defectQuantity;
        return denom > 0 ? (p.defectQuantity / denom) * 100 : 0;
      }),
      defect: points.map((p) => p.defectQuantity),
      utilization: points.map((p) => p.utilizationRatePercent ?? 0),
    };
  }, [filters, invalidRange, records, trendGrain]);

  if (invalidRange) {
    return (
      <>
        <PageHeader title="대시보드" />
      </>
    );
  }

  if (!kpi || kpi.validRows === 0) {
    return (
      <>
        <PageHeader title="대시보드" />
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
        title="대시보드"
        description={headerDescription}
        excelName="생산현황_대시보드"
        onExcel={() =>
          downloadExcel(
            "생산현황_대시보드.xlsx",
            productPerfRows.map((r) => ({
              제품유형: r.productType,
              품번: r.partNumber,
              생산량: r.productionQuantity,
              불량수량: r.defectQuantity,
              작업시간분: r.elapsedMinutes,
              비가동시간분: r.downtimeMinutes,
              UPH: r.uph,
            })),
          )
        }
      />

      <ResponsiveGrid variant="kpi" className="mb-4">
        <KpiCard
          title="생산량"
          value={formatQuantity(kpi.productionQuantity)}
          compare={buildCompareLabel("percent", kpi.productionChangePercent)}
          compareValue={kpi.productionChangePercent}
          sparkline={sparkSeries.production}
          sparklineColor="var(--success)"
        />
        <KpiCard
          title="불량률"
          value={formatPercent(kpi.defectRatePercent, 2)}
          compare={buildCompareLabel("pp", kpi.defectRateChangePp)}
          compareValue={kpi.defectRateChangePp}
          comparePositiveIsGood={false}
          sparkline={sparkSeries.defectRate}
          sparklineColor="var(--error)"
        />
        <KpiCard
          title="불량수량"
          value={formatQuantity(kpi.defectQuantity)}
          compare={buildCompareLabel("percent", kpi.defectChangePercent)}
          compareValue={kpi.defectChangePercent}
          comparePositiveIsGood={false}
          sparkline={sparkSeries.defect}
          sparklineColor="var(--error)"
        />
        <KpiCard
          title="가동률"
          value={formatPercent(kpi.utilizationRatePercent)}
          hint={`${formatMinutes(kpi.operatingMinutes)} / ${formatMinutes(kpi.elapsedMinutes)}`}
          compare={buildCompareLabel("pp", kpi.utilizationChangePp)}
          compareValue={kpi.utilizationChangePp}
          sparkline={sparkSeries.utilization}
          sparklineColor="var(--metric-util)"
        />
      </ResponsiveGrid>

      {analysisGroups ? (
        <AnalysisGroupComparison bundle={analysisGroups} />
      ) : null}

      {utilizationOverview ? (
        <UtilizationOverviewPanel
          monthLabel={overviewPeriodLabel}
          overview={utilizationOverview.overview}
          trends={utilizationOverview.trends}
          grommetEmphasized={
            filters.productType === "전체" || filters.productType === "GROMMET"
          }
          sealEmphasized={
            filters.productType === "전체" || filters.productType === "SEAL"
          }
          injectionEmphasized
          pressEmphasized
          variant="overall"
        />
      ) : null}

      <ProductionVariationTrend grain={trendGrain} />

      <ProductTypeTabs
        value={shotTopProductTab}
        onChange={setShotTopProductTab}
        counts={shotTabCounts}
        ariaLabel="TOP & WORST 제품유형"
      />
      <ProductShotTopWorst rows={shotTopRows} productTab={shotTopProductTab} />

      <SectionCard
        title="설비별 일자 비가동 현황"
        description={`${heatmapMonthLabel} (${heatmapPeriodLabel}) 기준 · 공장·제품유형은 상단 필터 적용`}
        action={
          <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span className="whitespace-nowrap font-medium">조회월</span>
            <input
              type="month"
              className="query-filter-input"
              value={heatmapYearMonth}
              aria-label="설비별 일자 비가동 현황 조회월"
              onChange={(e) => {
                if (e.target.value) setHeatmapYearMonth(e.target.value);
              }}
            />
          </label>
        }
        className="mb-4"
      >
        <DowntimeEquipmentHeatmap
          records={heatmapRecords}
          startDate={heatmapMonthRange.startDate}
          endDate={heatmapMonthRange.endDate}
          productTab={heatmapProductTab}
          onProductTabChange={setHeatmapProductTab}
          metric={heatmapMetric}
          onMetricChange={setHeatmapMetric}
          selectable={false}
        />
      </SectionCard>

      <DowntimeTopPartsChart
        records={topPartsRecords}
        productTab={topPartsProductTab}
        onProductTabChange={setTopPartsProductTab}
        view={topPartsView}
        onViewChange={setTopPartsView}
        onOpenPart={(partId) =>
          router.push(withFromParam(`/parts/${partId}`, "home"))
        }
      />
    </>
  );
}
