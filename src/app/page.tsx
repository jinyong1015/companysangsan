"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DowntimeReasonDonut,
  HorizontalRankBars,
  ProductionUtilizationTrend,
} from "@/components/charts/Charts";
import { DataQualityBanner } from "@/components/ui/DataQualityBanner";
import { KpiCard, buildCompareLabel } from "@/components/ui/KpiCard";
import { EmptyState, PageHeader, ResponsiveGrid, SectionCard } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";

import { aggregateEquipment } from "@/lib/aggregates";
import { autoGrain } from "@/lib/dates";
import {
  formatHours,
  formatMinutes,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatUph,
} from "@/lib/format";
import {
  buildTrends,
  comparePeriodKpis,
  computeKpi,
  downtimeReasonShares,
  filterRecords,
} from "@/lib/metrics";
import type { DowntimeReason } from "@/types";

export default function DashboardPage() {
  const { filters, setFilters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const router = useRouter();

  const invalidRange = filters.endDate < filters.startDate;

  const filtered = useMemo(
    () => (invalidRange ? [] : filterRecords(records, filters)),
    [filters, invalidRange, records],
  );

  const kpi = useMemo(
    () => (invalidRange ? null : comparePeriodKpis(records, filters)),
    [filters, invalidRange, records],
  );

  const trends = useMemo(
    () =>
      invalidRange
        ? []
        : buildTrends(
            filtered,
            filters.startDate,
            filters.endDate,
            autoGrain(filters.startDate, filters.endDate),
          ),
    [filtered, filters, invalidRange],
  );

  const reasons = useMemo(() => downtimeReasonShares(filtered), [filtered]);
  const equipment = useMemo(
    () => aggregateEquipment(records, filters),
    [filters, records],
  );

  const utilBottom = useMemo(
    () =>
      [...equipment]
        .sort(
          (a, b) =>
            (a.kpi.utilizationRatePercent ?? 999) -
            (b.kpi.utilizationRatePercent ?? 999),
        )
        .slice(0, 10),
    [equipment],
  );

  const downtimeTop = useMemo(
    () =>
      [...equipment]
        .sort((a, b) => b.kpi.downtimeMinutes - a.kpi.downtimeMinutes)
        .slice(0, 10),
    [equipment],
  );

  if (invalidRange) {
    return (
      <>
        <PageHeader title="대시보드" description="핵심 생산·설비 KPI와 주요 문제 요약" />
      </>
    );
  }

  if (!kpi || kpi.validRows === 0) {
    return (
      <>
        <PageHeader title="대시보드" description="핵심 생산·설비 KPI와 주요 문제 요약" />
        <DataQualityBanner />
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
        description="핵심 생산·설비 KPI와 주요 문제 요약"
        excelName="생산현황_대시보드"
      />
      <DataQualityBanner />

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
        <KpiCard
          title="UPH"
          value={formatUph(kpi.uph)}
          compare={buildCompareLabel("percent", kpi.uphChangePercent)}
          compareValue={kpi.uphChangePercent}
          accent="var(--metric-uph)"
        />
        <KpiCard
          title="MTTR"
          value={kpi.mttrMinutes == null ? "-" : `${formatNumber(kpi.mttrMinutes, 1)}분`}
          hint={
            kpi.failureCount === 0
              ? "산출 가능한 단일 설비이상 이력이 없습니다."
              : `고장 ${kpi.failureCount}건 · 산출 ${kpi.mttrEligibleCount}건`
          }
          comparePositiveIsGood={false}
          accent="var(--metric-mttr)"
        />
        <KpiCard
          title="참고 MTBF"
          value={formatHours(kpi.referenceMtbfHours)}
          tooltip="고장·복구 시각이 없어 유효 가동시간을 고장 건수로 나눈 참고 지표입니다."
          hint={
            kpi.failureCount === 0
              ? "고장 이력이 없어 참고 MTBF를 계산할 수 없습니다."
              : undefined
          }
          accent="var(--metric-mtbf)"
        />
      </ResponsiveGrid>

      <SectionCard title="생산량·가동률 추이" className="mb-4">
        <ProductionUtilizationTrend data={trends} />
      </SectionCard>

      <ResponsiveGrid variant="split" className="mb-4">
        <SectionCard title="GROMMET / SEAL 비교">
          <ProductTypeMini />
        </SectionCard>
        <SectionCard title="비가동 사유 구성">
          <DowntimeReasonDonut
            data={reasons}
            onSelect={(reason) => {
              setFilters({ downtimeReason: reason as DowntimeReason });
              router.push("/downtime");
            }}
          />
        </SectionCard>
      </ResponsiveGrid>

      <ResponsiveGrid variant="split" className="mb-4">
        <SectionCard title="가동률 하위 설비 TOP 10">
          <HorizontalRankBars
            rows={utilBottom.map((e) => ({
              id: e.id,
              name: e.name,
              value: e.kpi.utilizationRatePercent ?? 0,
              secondary: formatQuantity(e.kpi.productionQuantity),
            }))}
            valueFormatter={(v) => formatPercent(v)}
            onClick={(id) => router.push(`/equipment/${id}`)}
          />
        </SectionCard>
        <SectionCard title="비가동시간 TOP 설비">
          <HorizontalRankBars
            rows={downtimeTop.map((e) => ({
              id: e.id,
              name: e.name,
              value: e.kpi.downtimeMinutes,
              secondary: `고장 ${e.kpi.failureCount}건`,
            }))}
            valueFormatter={(v) => formatMinutes(v)}
            onClick={(id) => router.push(`/equipment/${id}`)}
          />
        </SectionCard>
      </ResponsiveGrid>

      <SectionCard
        title="설비 요약"
        action={
          <Link href="/equipment" className="linkish text-sm">
            전체 설비 보기 →
          </Link>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>설비명</th>
                <th>공장</th>
                <th>주요 제품유형</th>
                <th className="num">생산량</th>
                <th className="num">불량수량</th>
                <th className="num">작업시간</th>
                <th className="num">비가동시간</th>
                <th className="num">가동률</th>
                <th className="num">UPH</th>
                <th className="num">고장 건수</th>
                <th className="num">MTTR</th>
                <th className="num">참고 MTBF</th>
              </tr>
            </thead>
            <tbody>
              {utilBottom.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/equipment/${e.id}`} className="linkish">
                      {e.name}
                    </Link>
                  </td>
                  <td>{e.factory}</td>
                  <td>
                    {e.productMix.grommetPercent >= e.productMix.sealPercent
                      ? "GROMMET"
                      : "SEAL"}
                  </td>
                  <td className="num">{formatQuantity(e.kpi.productionQuantity)}</td>
                  <td className="num">{formatQuantity(e.kpi.defectQuantity)}</td>
                  <td className="num">{formatMinutes(e.kpi.elapsedMinutes)}</td>
                  <td className="num">{formatMinutes(e.kpi.downtimeMinutes)}</td>
                  <td className="num">{formatPercent(e.kpi.utilizationRatePercent)}</td>
                  <td className="num">{formatUph(e.kpi.uph)}</td>
                  <td className="num">{formatNumber(e.kpi.failureCount)}</td>
                  <td className="num">
                    {e.kpi.mttrMinutes == null
                      ? "-"
                      : `${formatNumber(e.kpi.mttrMinutes, 1)}분`}
                  </td>
                  <td className="num">{formatHours(e.kpi.referenceMtbfHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

function ProductTypeMini() {
  const { filters } = useFilters();
  const { records } = useDataSource();
  const data = useMemo(() => {
    const types = ["GROMMET", "SEAL"] as const;
    return types.map((productType) => {
      const rows = filterRecords(records, { ...filters, productType });
      const kpi = computeKpi(rows);
      return {
        label: productType,
        productionQuantity: kpi.productionQuantity,
        defectQuantity: kpi.defectQuantity,
        utilizationRatePercent: kpi.utilizationRatePercent ?? 0,
      };
    });
  }, [filters, records]);

  return (
    <div className="space-y-4">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span
              className="font-semibold"
              style={{ color: d.label === "GROMMET" ? "var(--grommet)" : "var(--seal)" }}
            >
              {d.label}
            </span>
            <span className="text-[var(--text-secondary)]">
              {formatQuantity(d.productionQuantity)} · 가동률{" "}
              {formatPercent(d.utilizationRatePercent)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_70%,transparent)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (d.productionQuantity / Math.max(...data.map((x) => x.productionQuantity), 1)) * 100)}%`,
                background: d.label === "GROMMET" ? "var(--grommet)" : "var(--seal)",
              }}
            />
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            불량 {formatQuantity(d.defectQuantity)}
          </p>
        </div>
      ))}
    </div>
  );
}
