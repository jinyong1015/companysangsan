"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { PeriodProductSplitTrendCharts } from "@/components/charts/Charts";
import { DowntimeEquipmentHeatmap } from "@/components/downtime/DowntimeEquipmentHeatmap";
import { DowntimeTopPartsChart } from "@/components/downtime/DowntimeTopPartsChart";
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
  formatNumber,
  formatPercent,
  formatQuantity,
} from "@/lib/format";
import {
  buildMonthlyDashboardTrends,
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
  const [monthlyMetric, setMonthlyMetric] = useState<
    "production" | "partKinds" | "avgShot" | "downtime"
  >("production");

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
  const trendGrainLabel = trendGrain === "day" ? "일별" : "월별";
  const periodAvgLabel = trendGrain === "day" ? "일평균" : "월평균";

  const monthlyTrendsByProduct = useMemo(() => {
    if (invalidRange) return [];
    const build = (productType: "GROMMET" | "SEAL") =>
      buildMonthlyDashboardTrends(
        filterRecords(records, { ...filters, productType }),
        filters.startDate,
        filters.endDate,
        trendGrain,
      );
    const grommet = build("GROMMET");
    const seal = build("SEAL");
    const labels = grommet.length >= seal.length ? grommet : seal;
    return labels.map((row, i) => {
      const g = grommet[i];
      const s = seal[i];
      let label = row.label;
      if (trendGrain === "month" && /^\d{4}-\d{2}$/.test(row.period)) {
        const [year, month] = row.period.split("-");
        const m = Number(month);
        label =
          i === 0 || m === 1
            ? `${year!.slice(2)}년 ${m}월`
            : `${m}월`;
      }
      return {
        label,
        production: {
          GROMMET: g?.productionQuantity ?? 0,
          SEAL: s?.productionQuantity ?? 0,
        },
        partKinds: {
          GROMMET: g?.partKindCount ?? 0,
          SEAL: s?.partKindCount ?? 0,
        },
        avgShot: {
          GROMMET: g?.avgShot ?? 0,
          SEAL: s?.avgShot ?? 0,
        },
        downtime: {
          GROMMET: g?.downtimeMinutes ?? 0,
          SEAL: s?.downtimeMinutes ?? 0,
        },
      };
    });
  }, [filters, invalidRange, records, trendGrain]);

  const monthlyChart = useMemo(() => {
    const seriesKey =
      monthlyMetric === "production"
        ? "production"
        : monthlyMetric === "partKinds"
          ? "partKinds"
          : monthlyMetric === "avgShot"
            ? "avgShot"
            : "downtime";
    const data = monthlyTrendsByProduct.map((row) => ({
      label: row.label,
      ...row[seriesKey],
    }));

    const avgOf = (values: number[]) => {
      const positive = values.filter((v) => v > 0);
      return positive.length
        ? positive.reduce((s, v) => s + v, 0) / positive.length
        : 0;
    };

    if (monthlyMetric === "production") {
      const gTotal = data.reduce((s, p) => s + p.GROMMET, 0);
      const sTotal = data.reduce((s, p) => s + p.SEAL, 0);
      return {
        data,
        metricLabel: "생산량",
        formatValue: (v: number) => formatQuantity(v),
        stats: [
          { label: "GROMMET 합계", value: formatQuantity(gTotal) },
          { label: "SEAL 합계", value: formatQuantity(sTotal) },
          {
            label: `GROMMET ${periodAvgLabel}`,
            value: formatQuantity(data.length ? gTotal / data.length : 0),
          },
          {
            label: `SEAL ${periodAvgLabel}`,
            value: formatQuantity(data.length ? sTotal / data.length : 0),
          },
        ],
      };
    }

    if (monthlyMetric === "partKinds") {
      return {
        data,
        metricLabel: "작업품목(품번) 종류",
        formatValue: (v: number) => `${formatNumber(v)}종`,
        stats: [
          {
            label: `GROMMET ${periodAvgLabel}`,
            value: `${formatNumber(avgOf(data.map((p) => p.GROMMET)), 1)}종`,
          },
          {
            label: `SEAL ${periodAvgLabel}`,
            value: `${formatNumber(avgOf(data.map((p) => p.SEAL)), 1)}종`,
          },
          {
            label: "GROMMET 최고",
            value: `${formatNumber(Math.max(0, ...data.map((p) => p.GROMMET), 0))}종`,
          },
          {
            label: "SEAL 최고",
            value: `${formatNumber(Math.max(0, ...data.map((p) => p.SEAL), 0))}종`,
          },
        ],
      };
    }

    if (monthlyMetric === "downtime") {
      const gTotal = data.reduce((s, p) => s + p.GROMMET, 0);
      const sTotal = data.reduce((s, p) => s + p.SEAL, 0);
      return {
        data,
        metricLabel: "비가동시간(분)",
        formatValue: (v: number) => formatMinutes(v),
        stats: [
          { label: "GROMMET 합계", value: formatMinutes(gTotal) },
          { label: "SEAL 합계", value: formatMinutes(sTotal) },
          {
            label: `GROMMET ${periodAvgLabel}`,
            value: formatMinutes(data.length ? gTotal / data.length : 0),
          },
          {
            label: `SEAL ${periodAvgLabel}`,
            value: formatMinutes(data.length ? sTotal / data.length : 0),
          },
        ],
      };
    }

    return {
      data,
      metricLabel: "평균 SHOT",
      formatValue: (v: number) => formatNumber(v, 1),
      stats: [
        {
          label: "GROMMET 평균",
          value: formatNumber(avgOf(data.map((p) => p.GROMMET)), 1),
        },
        {
          label: "SEAL 평균",
          value: formatNumber(avgOf(data.map((p) => p.SEAL)), 1),
        },
      ],
    };
  }, [monthlyMetric, monthlyTrendsByProduct, periodAvgLabel]);

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
          title="총 생산량"
          value={formatQuantity(kpi.productionQuantity)}
          compare={buildCompareLabel("percent", kpi.productionChangePercent)}
          compareValue={kpi.productionChangePercent}
          accent="var(--metric-production)"
        />
        <KpiCard
          title="불량수량"
          value={formatQuantity(kpi.defectQuantity)}
          hint={`생산불량률 ${formatPercent(kpi.defectRatePercent, 2)}`}
          accent="var(--metric-defect)"
          comparePositiveIsGood={false}
        />
        <KpiCard
          title="가동률"
          value={formatPercent(kpi.utilizationRatePercent)}
          hint={`${formatMinutes(kpi.operatingMinutes)} / ${formatMinutes(kpi.elapsedMinutes)}`}
          compare={buildCompareLabel("pp", kpi.utilizationChangePp)}
          compareValue={kpi.utilizationChangePp}
          accent="var(--metric-util)"
        />
      </ResponsiveGrid>

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

      <SectionCard
        title={`${trendGrainLabel} 생산변동 추이`}
        className="mb-4"
        action={
          <div
            className="flex flex-wrap justify-end gap-2"
            role="tablist"
            aria-label={`${trendGrainLabel} 생산변동 지표`}
          >
            {(
              [
                { key: "production" as const, label: "생산량" },
                { key: "partKinds" as const, label: "작업품목(품번) 종류" },
                { key: "avgShot" as const, label: "평균 SHOT" },
                { key: "downtime" as const, label: "비가동시간(분)" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                role="tab"
                aria-selected={monthlyMetric === opt.key}
                className="pill"
                data-active={monthlyMetric === opt.key}
                onClick={() => setMonthlyMetric(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      >
        <PeriodProductSplitTrendCharts
          data={monthlyChart.data}
          periodLabel={trendGrain === "day" ? "일" : "월"}
          metricLabel={monthlyChart.metricLabel}
          formatValue={monthlyChart.formatValue}
          height={260}
        />
      </SectionCard>

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
