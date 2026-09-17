"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  DowntimeReasonDonut,
  PeriodQtyBarChart,
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
import { getPartById } from "@/data/mock";
import { detailTrendGrain } from "@/lib/dates";
import {
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
import { detailBackNav, detailHref } from "@/lib/navigation";

export default function PartDetailPage() {
  const params = useParams<{ partId: string }>();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const back = detailBackNav(from, "parts");
  const { filters } = useFilters();
  const { records } = useDataSource();
  const part =
    getPartById(params.partId) ??
    (() => {
      const r = records.find((x) => x.partId === params.partId);
      return r
        ? { id: r.partId, partNumber: r.partNumber, productType: r.productType }
        : null;
    })();

  const rows = useMemo(
    () => filterRecords(records, { ...filters, partIds: [params.partId] }),
    [filters, params.partId, records],
  );
  const kpi = useMemo(() => computeKpi(rows), [rows]);
  const trendGrain = useMemo(
    () => detailTrendGrain(filters.startDate, filters.endDate),
    [filters.startDate, filters.endDate],
  );
  const grainLabel = trendGrain === "month" ? "월별" : "일별";
  const trends = useMemo(
    () =>
      buildTrends(rows, filters.startDate, filters.endDate, trendGrain),
    [rows, filters.startDate, filters.endDate, trendGrain],
  );
  const chartData = useMemo(() => {
    const mapped = trends.map((t) => ({
      label: t.label,
      qty: t.productionQuantity,
      uph: t.uph == null ? 0 : Math.round(t.uph),
    }));
    if (trendGrain === "day") {
      return mapped.filter((d) => d.qty > 0);
    }
    return mapped;
  }, [trends, trendGrain]);
  const showValueLabels = trendGrain === "month" || chartData.length <= 15;
  const reasons = useMemo(() => downtimeReasonShares(rows), [rows]);

  const byEquipment = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = map.get(r.equipmentId) ?? [];
      list.push(r);
      map.set(r.equipmentId, list);
    }
    return [...map.entries()].map(([id, list]) => ({
      id,
      name: list[0]!.equipmentName,
      factory: list[0]!.factory,
      kpi: computeKpi(list),
    }));
  }, [rows]);

  const byMold = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = map.get(r.moldId) ?? [];
      list.push(r);
      map.set(r.moldId, list);
    }
    return [...map.entries()].map(([id, list]) => ({
      id,
      moldNumber: list[0]!.moldNumber,
      workCount: list.length,
      shotCount: list.reduce((s, r) => s + r.shotCount, 0),
      kpi: computeKpi(list),
    }));
  }, [rows]);

  const byOperator = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = map.get(r.operatorId) ?? [];
      list.push(r);
      map.set(r.operatorId, list);
    }
    return [...map.entries()].map(([id, list]) => ({
      id,
      name: list[0]!.operatorName,
      kpi: computeKpi(list),
    }));
  }, [rows]);

  const downtimeEvents = useMemo(
    () =>
      rows
        .filter((r) => r.downtimeMinutes > 0)
        .sort((a, b) => b.downtimeMinutes - a.downtimeMinutes)
        .slice(0, 20),
    [rows],
  );

  if (!part) {
    return (
      <EmptyState title="품번을 찾을 수 없습니다." description="잘못된 주소이거나 데이터가 없습니다." />
    );
  }

  return (
    <>
      <BackBanner
        href={back.href}
        label={back.label}
        icon={back.icon}
        periodStart={filters.startDate}
        periodEnd={filters.endDate}
      />
      <PageHeader title={part.partNumber} description={part.productType} />
      <ResponsiveGrid variant="kpi" className="mb-4">
        <KpiCard title="생산량" value={formatQuantity(kpi.productionQuantity)} />
        <KpiCard title="불량수량" value={formatQuantity(kpi.defectQuantity)} />
        <KpiCard title="생산불량률" value={formatPercent(kpi.defectRatePercent, 2)} />
        <KpiCard title="UPH" value={formatUph(kpi.uph)} />
        <KpiCard title="가동률" value={formatPercent(kpi.utilizationRatePercent)} />
        <KpiCard title="비가동시간" value={formatMinutes(kpi.downtimeMinutes)} />
        <KpiCard title="고장 건수" value={`${formatNumber(kpi.failureCount)}건`} />
        <KpiCard title="생산 설비 수" value={`${formatNumber(byEquipment.length)}대`} />
      </ResponsiveGrid>

      <SectionCard
        title={`기간별 생산량 추이 (${grainLabel})`}
        description={`${grainLabel} 생산량 추이 · 조회기간 3개월 이상이면 월별, 미만이면 일별`}
        className="mb-4"
      >
        <PeriodQtyBarChart
          data={chartData}
          showValueLabels={showValueLabels}
          periodLabel={trendGrain === "month" ? "월" : "날짜"}
          metricLabel="생산량"
        />
      </SectionCard>

      <ResponsiveGrid variant="split" className="mb-4">
        <SectionCard title="비가동 사유">
          {reasons.length > 0 ? (
            <DowntimeReasonDonut data={reasons} />
          ) : (
            <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
              조회기간에 비가동 사유가 없습니다.
            </p>
          )}
        </SectionCard>
        <SectionCard title="비가동 발생 이력">
          {downtimeEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
              조회기간에 비가동 발생 이력이 없습니다.
            </p>
          ) : (
            <div className="table-wrap max-h-[320px]">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>작업일자</th>
                    <th>구분</th>
                    <th>설비명</th>
                    <th>작업자</th>
                    <th className="num">작업시간</th>
                    <th className="num">비가동시간</th>
                    <th>비가동내역</th>
                  </tr>
                </thead>
                <tbody>
                  {downtimeEvents.map((r) => (
                    <tr key={r.id}>
                      <td>{r.workDate}</td>
                      <td>{r.shiftType}</td>
                      <td>
                        <Link
                          href={detailHref(
                            `/equipment/${r.equipmentId}`,
                            from,
                            "parts",
                          )}
                          className="linkish"
                        >
                          {r.equipmentName}
                        </Link>
                      </td>
                      <td>{r.operatorName}</td>
                      <td className="num">{formatMinutes(r.elapsedMinutes)}</td>
                      <td className="num">{formatMinutes(r.downtimeMinutes)}</td>
                      <td>{r.downtimeReasonRaw ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </ResponsiveGrid>

      <SectionCard title="설비별 생산량·가동률" className="mb-4">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>설비명</th>
                <th>공장</th>
                <th className="num">생산량</th>
                <th className="num">가동률</th>
                <th className="num">UPH</th>
                <th className="num">고장 건수</th>
              </tr>
            </thead>
            <tbody>
              {byEquipment.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link
                      href={detailHref(`/equipment/${e.id}`, from, "parts")}
                      className="linkish"
                    >
                      {e.name}
                    </Link>
                  </td>
                  <td>{e.factory}</td>
                  <td className="num">{formatQuantity(e.kpi.productionQuantity)}</td>
                  <td className="num">{formatPercent(e.kpi.utilizationRatePercent)}</td>
                  <td className="num">{formatUph(e.kpi.uph)}</td>
                  <td className="num">{e.kpi.failureCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ResponsiveGrid variant="split" className="mb-4">
        <SectionCard title="금형별 실적">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>금형번호</th>
                  <th className="num">작업 건수</th>
                  <th className="num">생산량</th>
                  <th className="num">UPH</th>
                </tr>
              </thead>
              <tbody>
                {byMold.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link
                        href={detailHref(`/molds/${m.id}`, from, "parts")}
                        className="linkish"
                      >
                        {m.moldNumber}
                      </Link>
                    </td>
                    <td className="num">{m.workCount}</td>
                    <td className="num">{formatQuantity(m.kpi.productionQuantity)}</td>
                    <td className="num">{formatUph(m.kpi.uph)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard title="작업자별 실적">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>작업자</th>
                  <th className="num">생산량</th>
                  <th className="num">작업시간</th>
                  <th className="num">UPH</th>
                </tr>
              </thead>
              <tbody>
                {byOperator.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link
                        href={`${detailHref(`/operators/${o.id}`, from, "parts")}&partId=${params.partId}`}
                        className="linkish"
                      >
                        {o.name}
                      </Link>
                    </td>
                    <td className="num">{formatQuantity(o.kpi.productionQuantity)}</td>
                    <td className="num">{formatMinutes(o.kpi.elapsedMinutes)}</td>
                    <td className="num">{formatUph(o.kpi.uph)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </ResponsiveGrid>
    </>
  );
}
