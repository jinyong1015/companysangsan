"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductionUtilizationTrend, SimpleBarChart } from "@/components/charts/Charts";
import { DetailFilterCard } from "@/components/filters/FilterCards";
import { KpiCard } from "@/components/ui/KpiCard";
import { NumberPagination } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader, ResponsiveGrid, SectionCard } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";

import { autoGrain } from "@/lib/dates";
import {
  formatMinutes,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatUph,
} from "@/lib/format";
import { buildTrends, computeKpi, filterRecords, paginate } from "@/lib/metrics";
import type { Grain } from "@/types";

export default function ProductionPage() {
  const { filters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const [metric, setMetric] = useState<"production" | "defect" | "uph" | "util">(
    "production",
  );
  const [grain, setGrain] = useState<Grain>(
    autoGrain(filters.startDate, filters.endDate),
  );
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => filterRecords(records, filters), [filters, records]);
  const kpi = useMemo(() => computeKpi(filtered), [filtered]);
  const trends = useMemo(
    () => buildTrends(filtered, filters.startDate, filters.endDate, grain),
    [filtered, filters, grain],
  );

  const factoryCompare = useMemo(() => {
    const combos = [
      { factory: "본사" as const, productType: "GROMMET" as const },
      { factory: "본사" as const, productType: "SEAL" as const },
      { factory: "2공장" as const, productType: "GROMMET" as const },
      { factory: "2공장" as const, productType: "SEAL" as const },
    ];
    return combos.map((c) => {
      const rows = filterRecords(records, {
        ...filters,
        factory: c.factory,
        productType: c.productType,
      });
      const k = computeKpi(rows);
      return {
        label: `${c.factory}\n${c.productType}`,
        value:
          metric === "production"
            ? k.productionQuantity
            : metric === "defect"
              ? k.defectQuantity
              : metric === "uph"
                ? k.uph ?? 0
                : k.utilizationRatePercent ?? 0,
      };
    });
  }, [filters, metric, records]);

  const tableRows = useMemo(() => {
    const factories = filters.factory === "전체" ? (["본사", "2공장"] as const) : [filters.factory];
    const types =
      filters.productType === "전체"
        ? (["GROMMET", "SEAL"] as const)
        : [filters.productType];
    const rows = [];
    for (const t of trends) {
      for (const factory of factories) {
        for (const productType of types) {
          const subset = filtered.filter(
            (r) =>
              r.workDate >= t.period &&
              r.workDate <= (grain === "day" ? t.period : filters.endDate) &&
              r.factory === factory &&
              r.productType === productType,
          );
          // Better: use period from trends by filtering workDate in label range via rebuild
          const periodRows = records.filter((r) => {
            if (!r.isAnalysisEligible) return false;
            if (r.factory !== factory || r.productType !== productType) return false;
            if (filters.shiftType !== "전체" && r.shiftType !== filters.shiftType)
              return false;
            // match trend bucket by scanning - use production from trend build approach
            return true;
          });
          void periodRows;
          const dayRows = filtered.filter(
            (r) =>
              r.factory === factory &&
              r.productType === productType &&
              r.workDate.replace(/-/g, "").startsWith(
                grain === "month" ? t.period.replace("-", "") : "",
              ),
          );
          void dayRows;
          void subset;
        }
      }
    }

    // Simpler reliable table: one row per trend period (total)
    return trends.map((t) => {
      const k = {
        productionQuantity: t.productionQuantity,
        defectQuantity: t.defectQuantity,
        defectRatePercent:
          t.productionQuantity + t.defectQuantity > 0
            ? (t.defectQuantity / (t.productionQuantity + t.defectQuantity)) * 100
            : null,
        elapsedMinutes: t.elapsedMinutes,
        downtimeMinutes: t.downtimeMinutes,
        operatingMinutes: t.operatingMinutes,
        utilizationRatePercent: t.utilizationRatePercent,
        uph: t.uph,
        failureCount: t.failureCount,
      };
      return { period: t.period, label: t.label, ...k };
    });
  }, [trends, filtered, filters, grain, records]);

  const paged = paginate(tableRows, page, 20);

  if (kpi.validRows === 0) {
    return (
      <>
        <PageHeader title="생산 분석" description="기간별 생산량과 생산성 변화를 확인합니다." />
        <DetailFilterCard showMolds />
        <EmptyState
          title="분석 가능한 DATA가 없습니다."
          description="선택한 조건에 정상 생산 DATA가 없습니다."
          actionLabel="조회조건 초기화"
          onAction={resetGlobal}
        />
      </>
    );
  }

  const chartData = trends.map((t) => ({
    ...t,
    chartValue:
      metric === "production"
        ? t.productionQuantity
        : metric === "defect"
          ? t.defectQuantity
          : metric === "uph"
            ? t.uph
            : t.utilizationRatePercent,
  }));

  return (
    <>
      <PageHeader title="생산 분석" description="기간별 생산량과 생산성 변화를 확인합니다." />
      <DetailFilterCard showMolds />

      <ResponsiveGrid variant="kpi" className="mb-4">
        <KpiCard title="생산량" value={formatQuantity(kpi.productionQuantity)} accent="var(--metric-production)" />
        <KpiCard title="불량수량" value={formatQuantity(kpi.defectQuantity)} accent="var(--metric-defect)" />
        <KpiCard title="생산불량률" value={formatPercent(kpi.defectRatePercent, 2)} />
        <KpiCard title="UPH" value={formatUph(kpi.uph)} accent="var(--metric-uph)" />
        <KpiCard title="가동률" value={formatPercent(kpi.utilizationRatePercent)} accent="var(--metric-util)" />
      </ResponsiveGrid>

      <SectionCard title="지표 추이" className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["production", "생산량"],
                ["defect", "불량수량"],
                ["uph", "UPH"],
                ["util", "가동률"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="pill"
                data-active={metric === key}
                onClick={() => setMetric(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["day", "week", "month"] as const).map((g) => (
              <button
                key={g}
                type="button"
                className="pill"
                data-active={grain === g}
                onClick={() => setGrain(g)}
              >
                {g === "day" ? "일" : g === "week" ? "주" : "월"}
              </button>
            ))}
          </div>
        </div>
        {metric === "production" || metric === "util" ? (
          <ProductionUtilizationTrend data={trends} height={320} />
        ) : (
          <SimpleBarChart
            data={chartData.map((d) => ({
              label: d.label,
              value: Number(d.chartValue ?? 0),
            }))}
            dataKey="value"
            name={metric === "defect" ? "불량수량" : "UPH"}
            color={metric === "defect" ? "var(--metric-defect)" : "var(--metric-uph)"}
          />
        )}
      </SectionCard>

      <SectionCard title="공장 × 제품유형 비교" className="mb-4">
        <SimpleBarChart
          data={factoryCompare}
          dataKey="value"
          name="지표"
          color="var(--accent)"
        />
      </SectionCard>

      <SectionCard title="집계 테이블">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>기간</th>
                <th className="num">생산량</th>
                <th className="num">불량수량</th>
                <th className="num">생산불량률</th>
                <th className="num">작업시간</th>
                <th className="num">비가동시간</th>
                <th className="num">가동시간</th>
                <th className="num">가동률</th>
                <th className="num">UPH</th>
                <th className="num">고장 건수</th>
                <th>원본 DATA</th>
              </tr>
            </thead>
            <tbody>
              {paged.items.map((row) => (
                <tr key={row.period}>
                  <td>
                    <Link
                      href={`/production-data?startDate=${row.period}&endDate=${row.period}`}
                      className="linkish"
                    >
                      {row.label}
                    </Link>
                  </td>
                  <td className="num">{formatQuantity(row.productionQuantity)}</td>
                  <td className="num">{formatQuantity(row.defectQuantity)}</td>
                  <td className="num">{formatPercent(row.defectRatePercent, 2)}</td>
                  <td className="num">{formatMinutes(row.elapsedMinutes)}</td>
                  <td className="num">{formatMinutes(row.downtimeMinutes)}</td>
                  <td className="num">{formatMinutes(row.operatingMinutes)}</td>
                  <td className="num">{formatPercent(row.utilizationRatePercent)}</td>
                  <td className="num">{formatUph(row.uph)}</td>
                  <td className="num">
                    <Link href="/downtime" className="linkish">
                      {formatNumber(row.failureCount)}
                    </Link>
                  </td>
                  <td>
                    <Link href="/production-data" className="linkish">
                      →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <NumberPagination
          page={paged.page}
          totalPages={paged.totalPages}
          total={paged.total}
          onPage={setPage}
        />
      </SectionCard>
    </>
  );
}
