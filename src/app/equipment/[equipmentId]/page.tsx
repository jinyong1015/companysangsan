"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { DowntimeReasonDonut } from "@/components/charts/Charts";
import { KpiCard } from "@/components/ui/KpiCard";
import { DetailHero } from "@/components/ui/DetailHero";
import {
  BackBanner,
  EmptyState,
  ResponsiveGrid,
  SectionCard,
} from "@/components/ui/PageBits";
import { Factory } from "lucide-react";
import { WorkPartSelect } from "@/components/ui/WorkPartSelect";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { getEquipmentById } from "@/data/mock";
import {
  formatMinutes,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatUph,
} from "@/lib/format";
import {
  computeKpi,
  downtimeReasonShares,
  filterRecords,
} from "@/lib/metrics";
import { detailBackNav } from "@/lib/navigation";

export default function EquipmentDetailPage() {
  const params = useParams<{ equipmentId: string }>();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const periodStart = searchParams.get("startDate");
  const periodEnd = searchParams.get("endDate");
  const back = detailBackNav(from, "equipment");
  const { filters } = useFilters();
  const { records } = useDataSource();
  const [selectedPartId, setSelectedPartId] = useState("");

  const equipment =
    getEquipmentById(params.equipmentId) ??
    (() => {
      const r = records.find((x) => x.equipmentId === params.equipmentId);
      return r
        ? { id: r.equipmentId, name: r.equipmentName, factory: r.factory }
        : null;
    })();

  const allRows = useMemo(
    () =>
      filterRecords(records, {
        ...filters,
        ...(periodStart && periodEnd
          ? {
              datePreset: "custom" as const,
              startDate: periodStart,
              endDate: periodEnd,
            }
          : null),
        equipmentIds: [params.equipmentId],
      }),
    [filters, params.equipmentId, periodEnd, periodStart, records],
  );

  const partRows = useMemo(() => {
    const map = new Map<string, typeof allRows>();
    for (const r of allRows) {
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
      }))
      .sort(
        (a, b) =>
          b.kpi.productionQuantity - a.kpi.productionQuantity ||
          a.partNumber.localeCompare(b.partNumber, "ko"),
      );
  }, [allRows]);

  const activePartId = partRows.some((p) => p.id === selectedPartId)
    ? selectedPartId
    : "";
  const hasSelection = Boolean(activePartId);
  const activePart = hasSelection
    ? partRows.find((p) => p.id === activePartId)
    : null;

  const rows = useMemo(() => {
    if (!hasSelection) return allRows;
    return allRows.filter((r) => r.partId === activePartId);
  }, [allRows, hasSelection, activePartId]);

  const kpi = useMemo(() => computeKpi(rows), [rows]);
  const reasons = useMemo(() => downtimeReasonShares(rows), [rows]);

  const downtimeEvents = useMemo(
    () =>
      rows
        .filter((r) => r.downtimeMinutes > 0)
        .sort((a, b) => b.downtimeMinutes - a.downtimeMinutes)
        .slice(0, 20),
    [rows],
  );

  const scopeLabel = hasSelection
    ? `품번 ${activePart?.partNumber ?? ""} 기준`
    : "전체 품번 기준";

  if (!equipment) {
    return (
      <EmptyState
        title="설비를 찾을 수 없습니다."
        description="현재 활성 DATA에서 해당 설비를 찾지 못했습니다."
      />
    );
  }

  return (
    <div className="detail-page">
      <BackBanner
        href={back.href}
        label={back.label}
        icon={back.icon}
        periodStart={periodStart || filters.startDate}
        periodEnd={periodEnd || filters.endDate}
      />
      <DetailHero
        eyebrow="설비 상세내역"
        title={equipment.name}
        description={`${equipment.factory} · ${scopeLabel}`}
        icon={Factory}
        tone="equipment"
        chips={[
          { label: "공장", value: equipment.factory },
          { label: "기준", value: scopeLabel },
          {
            label: "조회기간",
            value: `${periodStart || filters.startDate} ~ ${periodEnd || filters.endDate}`,
          },
        ]}
      />

      <WorkPartSelect
        parts={partRows}
        selectedPartId={activePartId}
        onSelect={setSelectedPartId}
        selectId="equipment-product-select"
      />

      <ResponsiveGrid variant="kpi" className="detail-kpi-grid mb-4">
        <KpiCard title="생산량" value={formatQuantity(kpi.productionQuantity)} accent="var(--metric-production)" />
        <KpiCard title="가동률" value={formatPercent(kpi.utilizationRatePercent)} accent="var(--metric-util)" />
        <KpiCard title="UPH" value={formatUph(kpi.uph)} accent="var(--metric-uph)" />
        <KpiCard title="비가동시간" value={formatMinutes(kpi.downtimeMinutes)} accent="var(--metric-downtime)" />
        <KpiCard title="고장 건수" value={`${formatNumber(kpi.failureCount)}건`} accent="var(--metric-mttr)" />
      </ResponsiveGrid>

      <ResponsiveGrid variant="split" className="mb-4">
        <SectionCard title="비가동 사유">
          <DowntimeReasonDonut data={reasons} />
        </SectionCard>
        <SectionCard title="비가동이력">
          <div className="table-wrap max-h-[320px]">
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
                  </tr>
                ))}
                {!downtimeEvents.length ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-4 text-sm text-muted">
                      표시할 비가동 이력이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </ResponsiveGrid>
    </div>
  );
}
