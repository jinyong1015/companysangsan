"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { KpiCard } from "@/components/ui/KpiCard";
import { DetailHero } from "@/components/ui/DetailHero";
import {
  BackBanner,
  EmptyState,
  ResponsiveGrid,
  SectionCard,
} from "@/components/ui/PageBits";
import { Boxes } from "lucide-react";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { getMoldById } from "@/data/mock";
import {
  formatMinutes,
  formatNumber,
  formatPercent,
  formatQuantity,
} from "@/lib/format";
import { computeKpi, filterRecords } from "@/lib/metrics";
import { detailBackNav, detailHref } from "@/lib/navigation";

export default function MoldDetailPage() {
  const params = useParams<{ moldId: string }>();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const back = detailBackNav(from, "molds");
  const { filters } = useFilters();
  const { records } = useDataSource();
  const mold =
    getMoldById(params.moldId) ??
    (() => {
      const r = records.find((x) => x.moldId === params.moldId);
      return r ? { id: r.moldId, moldNumber: r.moldNumber } : null;
    })();
  const rows = useMemo(
    () => filterRecords(records, { ...filters, moldIds: [params.moldId] }),
    [filters, params.moldId, records],
  );
  const kpi = useMemo(() => computeKpi(rows), [rows]);
  const shotCount = rows.reduce((s, r) => s + r.shotCount, 0);

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
      workCount: list.length,
      shotCount: list.reduce((s, r) => s + r.shotCount, 0),
      kpi: computeKpi(list),
    }));
  }, [rows]);

  if (!mold) {
    return (
      <EmptyState title="금형을 찾을 수 없습니다." description="잘못된 주소이거나 데이터가 없습니다." />
    );
  }

  return (
    <div className="detail-page">
      <BackBanner
        href={back.href}
        label={back.label}
        icon={back.icon}
        periodStart={filters.startDate}
        periodEnd={filters.endDate}
      />
      <DetailHero
        eyebrow="금형 상세내역"
        title={mold.moldNumber}
        description="대표 품번 기준 조회"
        icon={Boxes}
        tone="mold"
        chips={[
          { label: "조회기간", value: `${filters.startDate} ~ ${filters.endDate}` },
          { label: "작업 설비", value: `${byEq.length}대` },
          { label: "작업판수", value: formatNumber(shotCount) },
        ]}
      />
      <ResponsiveGrid variant="kpi" className="detail-kpi-grid mb-4">
        <KpiCard title="생산량" value={formatQuantity(kpi.productionQuantity)} accent="var(--metric-production)" />
        <KpiCard title="불량수량" value={formatQuantity(kpi.defectQuantity)} accent="var(--metric-defect)" />
        <KpiCard title="생산불량률" value={formatPercent(kpi.defectRatePercent, 2)} accent="var(--metric-defect)" />
        <KpiCard title="작업판수" value={formatNumber(shotCount)} accent="var(--metric-uph)" />
        <KpiCard title="비가동시간" value={formatMinutes(kpi.downtimeMinutes)} accent="var(--metric-downtime)" />
      </ResponsiveGrid>
      <SectionCard title="설비별 사용 실적">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>설비명</th>
                <th>공장</th>
                <th className="num">작업 건수</th>
                <th className="num">작업판수</th>
                <th className="num">생산량</th>
                <th className="num">불량수량</th>
                <th className="num">비가동시간</th>
              </tr>
            </thead>
            <tbody>
              {byEq.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link
                      href={detailHref(`/equipment/${e.id}`, from, "molds")}
                      className="linkish"
                    >
                      {e.name}
                    </Link>
                  </td>
                  <td>{e.factory}</td>
                  <td className="num">{e.workCount}</td>
                  <td className="num">{e.shotCount}</td>
                  <td className="num">{formatQuantity(e.kpi.productionQuantity)}</td>
                  <td className="num">{formatQuantity(e.kpi.defectQuantity)}</td>
                  <td className="num">{formatMinutes(e.kpi.downtimeMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
