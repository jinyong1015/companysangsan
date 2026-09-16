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
import { getOperatorById } from "@/data/mock";
import { autoGrain } from "@/lib/dates";
import {
  formatMinutes,
  formatPercent,
  formatQuantity,
  formatUph,
} from "@/lib/format";
import { buildTrends, computeKpi, filterRecords } from "@/lib/metrics";

export default function OperatorDetailPage() {
  const params = useParams<{ operatorId: string }>();
  const { filters } = useFilters();
  const { records } = useDataSource();
  const operator =
    getOperatorById(params.operatorId) ??
    (() => {
      const r = records.find((x) => x.operatorId === params.operatorId);
      return r ? { id: r.operatorId, name: r.operatorName } : null;
    })();
  const rows = useMemo(
    () =>
      filterRecords(records, {
        ...filters,
        operatorIds: [params.operatorId],
      }),
    [filters, params.operatorId],
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

  const byPart = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = map.get(r.partId) ?? [];
      list.push(r);
      map.set(r.partId, list);
    }
    return [...map.entries()].map(([id, list]) => ({
      id,
      partNumber: list[0]!.partNumber,
      productType: list[0]!.productType,
      kpi: computeKpi(list),
    }));
  }, [rows]);

  const byEq = useMemo(() => {
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

  if (!operator) {
    return (
      <EmptyState title="작업자를 찾을 수 없습니다." description="잘못된 주소이거나 데이터가 없습니다." />
    );
  }

  return (
    <>
      <BackBanner href="/operators" label="작업자 분석으로 돌아가기" />
      <PageHeader title={operator.name} />
      <div className="card mb-4 border-[var(--warning)]/30 px-4 py-3 text-sm text-[var(--text-secondary)]">
        작업자 성과는 작업한 품번과 설비 구성에 영향을 받으므로 단순 순위만으로 인사평가에 사용하지 마세요.
      </div>
      <ResponsiveGrid variant="kpi" className="mb-4">
        <KpiCard title="생산량" value={formatQuantity(kpi.productionQuantity)} />
        <KpiCard title="불량수량" value={formatQuantity(kpi.defectQuantity)} />
        <KpiCard title="생산불량률" value={formatPercent(kpi.defectRatePercent, 2)} />
        <KpiCard title="작업시간" value={formatMinutes(kpi.elapsedMinutes)} />
        <KpiCard title="UPH" value={formatUph(kpi.uph)} />
        <KpiCard title="가동률" value={formatPercent(kpi.utilizationRatePercent)} />
      </ResponsiveGrid>
      <SectionCard title="생산량·UPH 추이" className="mb-4">
        <ProductionUtilizationTrend
          data={trends.map((t) => ({ ...t, utilizationRatePercent: t.uph }))}
        />
      </SectionCard>
      <ResponsiveGrid variant="split">
        <SectionCard title="품번별 실적">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>품번</th>
                  <th>제품유형</th>
                  <th className="num">생산량</th>
                  <th className="num">UPH</th>
                </tr>
              </thead>
              <tbody>
                {byPart.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/parts/${p.id}`} className="linkish">
                        {p.partNumber}
                      </Link>
                    </td>
                    <td>{p.productType}</td>
                    <td className="num">{formatQuantity(p.kpi.productionQuantity)}</td>
                    <td className="num">{formatUph(p.kpi.uph)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard title="설비별 실적">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>설비명</th>
                  <th>공장</th>
                  <th className="num">생산량</th>
                  <th className="num">가동률</th>
                </tr>
              </thead>
              <tbody>
                {byEq.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/equipment/${e.id}`} className="linkish">
                        {e.name}
                      </Link>
                    </td>
                    <td>{e.factory}</td>
                    <td className="num">{formatQuantity(e.kpi.productionQuantity)}</td>
                    <td className="num">{formatPercent(e.kpi.utilizationRatePercent)}</td>
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
