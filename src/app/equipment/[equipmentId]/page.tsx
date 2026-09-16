"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import {
  DowntimeReasonDonut,
  ProductionUtilizationTrend,
} from "@/components/charts/Charts";
import { KpiCard } from "@/components/ui/KpiCard";
import {
  BackBanner,
  EmptyState,
  PageHeader,
  ResponsiveGrid,
  SectionCard,
} from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { getEquipmentById } from "@/data/mock";
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
  computeKpi,
  downtimeReasonShares,
  filterRecords,
} from "@/lib/metrics";

export default function EquipmentDetailPage() {
  const params = useParams<{ equipmentId: string }>();
  const { filters } = useFilters();
  const { records } = useDataSource();
  const equipment =
    getEquipmentById(params.equipmentId) ??
    (() => {
      const r = records.find((x) => x.equipmentId === params.equipmentId);
      return r
        ? { id: r.equipmentId, name: r.equipmentName, factory: r.factory }
        : null;
    })();

  const rows = useMemo(
    () =>
      filterRecords(records, {
        ...filters,
        equipmentIds: [params.equipmentId],
      }),
    [filters, params.equipmentId],
  );

  const kpi = useMemo(() => computeKpi(rows), [rows]);
  const trends = useMemo(
    () =>
      buildTrends(
        rows,
        filters.startDate,
        filters.endDate,
        autoGrain(filters.startDate, filters.endDate),
      ),
    [rows, filters],
  );
  const reasons = useMemo(() => downtimeReasonShares(rows), [rows]);

  const partRows = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = map.get(r.partId) ?? [];
      list.push(r);
      map.set(r.partId, list);
    }
    return [...map.entries()]
      .map(([id, list]) => ({
        id,
        partNumber: list[0]!.partNumber,
        productType: list[0]!.productType,
        kpi: computeKpi(list),
        moldCount: new Set(list.map((x) => x.moldId)).size,
        operatorCount: new Set(list.map((x) => x.operatorId)).size,
      }))
      .sort((a, b) => b.kpi.productionQuantity - a.kpi.productionQuantity);
  }, [rows]);

  const downtimeEvents = useMemo(
    () =>
      rows
        .filter((r) => r.downtimeMinutes > 0)
        .sort((a, b) => b.downtimeMinutes - a.downtimeMinutes)
        .slice(0, 20),
    [rows],
  );

  if (!equipment) {
    return (
      <EmptyState
        title="설비를 찾을 수 없습니다."
        description="현재 활성 DATA에서 해당 설비를 찾지 못했습니다."
      />
    );
  }

  return (
    <>
      <BackBanner href="/equipment" label="설비 분석으로 돌아가기" />
      <PageHeader
        title={equipment.name}
        description={`${equipment.factory} · 조회기간 ${filters.startDate} ~ ${filters.endDate}`}
      />

      <ResponsiveGrid variant="kpi" className="mb-4">
        <KpiCard title="생산량" value={formatQuantity(kpi.productionQuantity)} />
        <KpiCard title="가동률" value={formatPercent(kpi.utilizationRatePercent)} />
        <KpiCard title="UPH" value={formatUph(kpi.uph)} />
        <KpiCard title="비가동시간" value={formatMinutes(kpi.downtimeMinutes)} />
        <KpiCard title="고장 건수" value={`${formatNumber(kpi.failureCount)}건`} />
        <KpiCard
          title="MTTR"
          value={kpi.mttrMinutes == null ? "-" : `${formatNumber(kpi.mttrMinutes, 1)}분`}
          hint={`산출 ${kpi.mttrEligibleCount}건 / 고장 ${kpi.failureCount}건`}
        />
        <KpiCard
          title="참고 MTBF"
          value={formatHours(kpi.referenceMtbfHours)}
          tooltip="고장·복구 시각이 없어 유효 가동시간을 고장 건수로 나눈 참고 지표입니다."
        />
      </ResponsiveGrid>

      <SectionCard title="생산량·가동률 추이" className="mb-4">
        <ProductionUtilizationTrend data={trends} />
      </SectionCard>

      <ResponsiveGrid variant="split" className="mb-4">
        <SectionCard title="비가동 사유">
          <DowntimeReasonDonut data={reasons} />
        </SectionCard>
        <SectionCard title="품번별 생산실적">
          <div className="table-wrap max-h-[320px]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>품번</th>
                  <th>제품유형</th>
                  <th className="num">생산량</th>
                  <th className="num">가동률</th>
                  <th className="num">UPH</th>
                </tr>
              </thead>
              <tbody>
                {partRows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/parts/${p.id}`} className="linkish">
                        {p.partNumber}
                      </Link>
                    </td>
                    <td>{p.productType}</td>
                    <td className="num">{formatQuantity(p.kpi.productionQuantity)}</td>
                    <td className="num">{formatPercent(p.kpi.utilizationRatePercent)}</td>
                    <td className="num">{formatUph(p.kpi.uph)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </ResponsiveGrid>

      <SectionCard
        title="고장·비가동 이력"
        className="mb-4"
        action={
          <Link href="/downtime" className="linkish text-sm">
            전체 비가동 보기
          </Link>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>작업일자</th>
                <th>구분</th>
                <th>품번</th>
                <th>작업자</th>
                <th className="num">작업시간</th>
                <th className="num">비가동시간</th>
                <th>비가동내역</th>
                <th>고장 후보</th>
                <th>MTTR 포함</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {downtimeEvents.map((r) => (
                <tr key={r.id}>
                  <td>{r.workDate}</td>
                  <td>{r.shiftType}</td>
                  <td>{r.partNumber}</td>
                  <td>{r.operatorName}</td>
                  <td className="num">{formatMinutes(r.elapsedMinutes)}</td>
                  <td className="num">{formatMinutes(r.downtimeMinutes)}</td>
                  <td>{r.downtimeReasonRaw ?? "-"}</td>
                  <td>
                    {r.isFailureCandidate ? (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--error)_15%,transparent)] px-2 py-0.5 text-xs text-[var(--error)]">
                        고장 후보
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {r.isMttrEligible ? (
                      "포함"
                    ) : r.isFailureCandidate ? (
                      <span title="복합 사유는 설비이상 시간만 분리할 수 없어 MTTR 계산에서 제외했습니다.">
                        제외
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <Link href={`/downtime/${r.id}`} className="linkish">
                      →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="원본 작업행"
        action={
          <Link href="/production-data" className="linkish text-sm">
            전체 원본 DATA 보기
          </Link>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>작업일자</th>
                <th>품번</th>
                <th>작업자</th>
                <th className="num">실적수량</th>
                <th className="num">불량수량</th>
                <th className="num">작업시간</th>
                <th className="num">비가동시간</th>
                <th className="num">가동시간</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r) => (
                <tr key={r.id}>
                  <td>{r.workDate}</td>
                  <td>{r.partNumber}</td>
                  <td>{r.operatorName}</td>
                  <td className="num">{formatQuantity(r.productionQuantity)}</td>
                  <td className="num">{formatQuantity(r.defectQuantity)}</td>
                  <td className="num">{formatMinutes(r.elapsedMinutes)}</td>
                  <td className="num">{formatMinutes(r.downtimeMinutes)}</td>
                  <td className="num">{formatMinutes(r.operatingMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
