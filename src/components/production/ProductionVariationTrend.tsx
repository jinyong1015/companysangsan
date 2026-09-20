"use client";

import { useMemo, useState } from "react";
import { startOfMonth, subMonths } from "date-fns";
import { PeriodProductSplitTrendCharts } from "@/components/charts/Charts";
import { SectionCard } from "@/components/ui/PageBits";
import { useDataSource } from "@/context/DataSourceContext";
import { useFilters } from "@/context/FilterContext";
import { todaySeoul, toDateString } from "@/lib/dates";
import {
  formatMinutes,
  formatNumber,
  formatQuantity,
} from "@/lib/format";
import {
  buildMonthlyDashboardTrends,
  filterRecords,
} from "@/lib/metrics";
import type { GlobalFilters } from "@/types";

export type ProductionTrendMetric =
  | "production"
  | "partKinds"
  | "avgShot"
  | "downtime";

type Props = {
  /** 대시보드: day|month 자동 / 생산 분석: month 고정 */
  grain: "day" | "month";
  className?: string;
  /** 집계에 쓸 필터 오버라이드 (미지정 시 전역 필터) */
  filtersOverride?: Partial<GlobalFilters>;
  /**
   * 지정 시 전역 조회기간 대신 오늘 기준 최근 N개월로 고정
   * (예: 12 → 이번 달 포함 최근 12개월)
   */
  lastMonths?: number;
};

const METRIC_OPTIONS: { key: ProductionTrendMetric; label: string }[] = [
  { key: "production", label: "생산량" },
  { key: "partKinds", label: "작업품목(품번) 종류" },
  { key: "avgShot", label: "평균 SHOT" },
  { key: "downtime", label: "비가동시간(분)" },
];

function lastNMonthsRange(months: number): {
  startDate: string;
  endDate: string;
} {
  const today = todaySeoul();
  const start = startOfMonth(subMonths(today, Math.max(1, months) - 1));
  return {
    startDate: toDateString(start),
    endDate: toDateString(today),
  };
}

export function ProductionVariationTrend({
  grain,
  className = "mb-4",
  filtersOverride,
  lastMonths,
}: Props) {
  const { filters: globalFilters } = useFilters();
  const { records } = useDataSource();
  const [metric, setMetric] = useState<ProductionTrendMetric>("production");

  const filters: GlobalFilters = useMemo(() => {
    const base = { ...globalFilters, ...filtersOverride };
    if (lastMonths == null || lastMonths <= 0) return base;
    const range = lastNMonthsRange(lastMonths);
    return {
      ...base,
      datePreset: "custom" as const,
      startDate: range.startDate,
      endDate: range.endDate,
    };
  }, [filtersOverride, globalFilters, lastMonths]);

  const invalidRange = filters.endDate < filters.startDate;
  const grainLabel = grain === "day" ? "일별" : "월별";
  const periodAvgLabel = grain === "day" ? "일평균" : "월평균";
  const periodLabel = grain === "day" ? "일" : "월";
  const title =
    lastMonths != null && lastMonths > 0
      ? `${grainLabel} 생산변동 추이 (최근 ${lastMonths}개월)`
      : `${grainLabel} 생산변동 추이`;

  const trendsByProduct = useMemo(() => {
    if (invalidRange) return [];
    const build = (productType: "GROMMET" | "SEAL") =>
      buildMonthlyDashboardTrends(
        filterRecords(records, { ...filters, productType }),
        filters.startDate,
        filters.endDate,
        grain,
      );
    const grommet = build("GROMMET");
    const seal = build("SEAL");
    const labels = grommet.length >= seal.length ? grommet : seal;
    return labels.map((row, i) => {
      const g = grommet[i];
      const s = seal[i];
      let label = row.label;
      if (grain === "month" && /^\d{4}-\d{2}$/.test(row.period)) {
        const [year, month] = row.period.split("-");
        const m = Number(month);
        label =
          i === 0 || m === 1 ? `${year!.slice(2)}년 ${m}월` : `${m}월`;
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
  }, [filters, grain, invalidRange, records]);

  const chart = useMemo(() => {
    const seriesKey =
      metric === "production"
        ? "production"
        : metric === "partKinds"
          ? "partKinds"
          : metric === "avgShot"
            ? "avgShot"
            : "downtime";
    const data = trendsByProduct.map((row) => ({
      label: row.label,
      ...row[seriesKey],
    }));

    const avgOf = (values: number[]) => {
      const positive = values.filter((v) => v > 0);
      return positive.length
        ? positive.reduce((s, v) => s + v, 0) / positive.length
        : 0;
    };

    if (metric === "production") {
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

    if (metric === "partKinds") {
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

    if (metric === "downtime") {
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
  }, [metric, periodAvgLabel, trendsByProduct]);

  if (invalidRange) return null;

  return (
    <SectionCard
      title={title}
      description={
        lastMonths != null && lastMonths > 0
          ? `상단 조회기간과 무관하게 오늘 기준 최근 ${lastMonths}개월을 표시합니다.`
          : undefined
      }
      className={className}
      action={
        <div
          className="flex flex-wrap justify-end gap-2"
          role="tablist"
          aria-label={`${grainLabel} 생산변동 지표`}
        >
          {METRIC_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={metric === opt.key}
              className="pill"
              data-active={metric === opt.key}
              onClick={() => setMetric(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      }
    >
      <PeriodProductSplitTrendCharts
        data={chart.data}
        periodLabel={periodLabel}
        metricLabel={chart.metricLabel}
        formatValue={chart.formatValue}
        height={260}
      />
    </SectionCard>
  );
}
