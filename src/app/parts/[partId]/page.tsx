"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { ProductionUtilizationTrend } from "@/components/charts/Charts";
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
import { autoGrain } from "@/lib/dates";
import {
  formatMinutes,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatUph,
} from "@/lib/format";
import { buildTrends, computeKpi, filterRecords } from "@/lib/metrics";

export default function PartDetailPage() {
  const params = useParams<{ partId: string }>();
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
    [filters, params.partId],
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

  if (!part) {
    return (
      <EmptyState title="품번을 찾을 수 없습니다." description="잘못된 주소이거나 데이터가 없습니다." />
    );
  }

  return (
    <>
      <BackBanner href="/parts" label="품번 분석으로 돌아가기" />
      <PageHeader title={part.partNumber} description={part.productType} />
      <ResponsiveGrid variant="kpi" className="mb-4">
        <KpiCard title="생산량" value={formatQuantity(kpi.productionQuantity)} />
        <KpiCard title="불량수량" value={formatQuantity(kpi.defectQuantity)} />
        <KpiCard title="생산불량률" value={formatPercent(kpi.defectRatePercent, 2)} />
        <KpiCard title="UPH" value={formatUph(kpi.uph)} />
        <KpiCard title="가동률" value={formatPercent(kpi.utilizationRatePercent)} />
        <KpiCard title="생산 설비 수" value={`${formatNumber(byEquipment.length)}대`} />
      </ResponsiveGrid>
      <SectionCard title="생산량·UPH 추이" className="mb-4">
        <ProductionUtilizationTrend
          data={trends.map((t) => ({
            ...t,
            utilizationRatePercent: t.uph,
          }))}
        />
      </SectionCard>
      <SectionCard title="설비별 생산량·가동률" className="mb-4">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>설비명</th>
                <th>공장</th>
                <th className="num">생산량</th>
                <th className="num">불량수량</th>
                <th className="num">가동률</th>
                <th className="num">UPH</th>
                <th className="num">고장 건수</th>
              </tr>
            </thead>
            <tbody>
              {byEquipment.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/equipment/${e.id}`} className="linkish">
                      {e.name}
                    </Link>
                  </td>
                  <td>{e.factory}</td>
                  <td className="num">{formatQuantity(e.kpi.productionQuantity)}</td>
                  <td className="num">{formatQuantity(e.kpi.defectQuantity)}</td>
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
                      <Link href={`/molds/${m.id}`} className="linkish">
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
                      <Link href={`/operators/${o.id}`} className="linkish">
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
