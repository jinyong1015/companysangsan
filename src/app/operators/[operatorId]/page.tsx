"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { use, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PeriodQtyBarChart,
  PeriodUphLineChart,
} from "@/components/charts/Charts";
import { KpiCard } from "@/components/ui/KpiCard";
import {
  BackBanner,
  EmptyState,
  PageHeader,
  ResponsiveGrid,
  SectionCard,
} from "@/components/ui/PageBits";
import { WorkPartSelect } from "@/components/ui/WorkPartSelect";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { getOperatorById, getPartById } from "@/data/mock";
import { resolveOperator, resolveRouteParamId } from "@/lib/dimensions";
import { detailTrendGrain } from "@/lib/dates";
import {
  formatMinutes,
  formatPercent,
  formatQuantity,
  formatUph,
} from "@/lib/format";
import { buildTrends, computeKpi, filterRecords } from "@/lib/metrics";
import {
  detailBackNav,
  detailHref,
  resolveFrom,
  withFromParam,
} from "@/lib/navigation";

export default function OperatorDetailPage({
  params,
}: {
  params: Promise<{ operatorId: string }>;
}) {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const scopePartId = searchParams.get("partId");
  const { operatorId: rawOperatorId } = use(params);
  const operatorId = resolveRouteParamId(rawOperatorId);
  const { filters } = useFilters();
  const { records } = useDataSource();
  const [selectedPartId, setSelectedPartId] = useState("");

  const operator = useMemo(() => {
    if (!operatorId) return null;
    const fromRecords = resolveOperator(operatorId, records);
    if (fromRecords) return fromRecords;
    const fromMock = getOperatorById(operatorId);
    return fromMock ? { id: fromMock.id, name: fromMock.name } : null;
  }, [operatorId, records]);

  const matchedOperatorId = operator?.id ?? operatorId;

  const scopePart = useMemo(() => {
    if (!scopePartId) return null;
    const fromMock = getPartById(scopePartId);
    if (fromMock) {
      return {
        id: fromMock.id,
        partNumber: fromMock.partNumber,
        productType: fromMock.productType,
      };
    }
    const r = records.find((x) => x.partId === scopePartId);
    return r
      ? {
          id: r.partId,
          partNumber: r.partNumber,
          productType: r.productType,
        }
      : { id: scopePartId, partNumber: scopePartId, productType: "" };
  }, [scopePartId, records]);

  const back = useMemo(() => {
    if (scopePart) {
      return {
        href: withFromParam(
          `/parts/${scopePart.id}`,
          resolveFrom(from, "parts"),
        ),
        label: scopePart.partNumber,
        icon: Package,
      };
    }
    return detailBackNav(from, "operators");
  }, [scopePart, from]);

  const allRows = useMemo(
    () =>
      filterRecords(records, {
        ...filters,
        operatorIds: matchedOperatorId ? [matchedOperatorId] : [],
        partIds: scopePartId ? [scopePartId] : filters.partIds,
      }),
    [filters, matchedOperatorId, records, scopePartId],
  );

  const byPart = useMemo(() => {
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

  const activePartId = byPart.some((p) => p.id === selectedPartId)
    ? selectedPartId
    : "";
  const hasSelection = Boolean(activePartId) && !scopePart;

  const rows = useMemo(() => {
    if (!hasSelection) return allRows;
    return allRows.filter((r) => r.partId === activePartId);
  }, [allRows, hasSelection, activePartId]);

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
      return mapped.filter((d) => d.qty > 0 || d.uph > 0);
    }
    return mapped;
  }, [trends, trendGrain]);
  const showValueLabels = trendGrain === "month" || chartData.length <= 15;

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

  const activePart = hasSelection
    ? byPart.find((p) => p.id === activePartId)
    : null;
  const scopeLabel = scopePart
    ? `${scopePart.partNumber} 품번 기준`
    : hasSelection
      ? `품번 ${activePart?.partNumber ?? ""} 기준`
      : "전체 품번 기준";

  if (!operator) {
    return (
      <EmptyState
        title="작업자를 찾을 수 없습니다."
        description="잘못된 주소이거나 데이터가 없습니다."
      />
    );
  }

  return (
    <>
      <BackBanner
        href={back.href}
        label={back.label}
        icon={back.icon}
        scopeLabel={scopePart ? "품번" : undefined}
        scopeValue={scopePart?.partNumber}
        periodStart={filters.startDate}
        periodEnd={filters.endDate}
      />
      <PageHeader
        title={operator.name}
        description={
          scopePart
            ? `${scopePart.partNumber} 품번 기준 실적${
                scopePart.productType ? ` · ${scopePart.productType}` : ""
              }`
            : `선택한 기간 기준 · ${scopeLabel}`
        }
      />
      {!scopePart ? (
        <WorkPartSelect
          parts={byPart}
          selectedPartId={activePartId}
          onSelect={setSelectedPartId}
          selectId="operator-product-select"
        />
      ) : null}

      <ResponsiveGrid variant="kpi" className="mb-4">
        <KpiCard title="생산량" value={formatQuantity(kpi.productionQuantity)} />
        <KpiCard title="불량수량" value={formatQuantity(kpi.defectQuantity)} />
        <KpiCard
          title="생산불량률"
          value={formatPercent(kpi.defectRatePercent, 2)}
        />
        <KpiCard title="작업시간" value={formatMinutes(kpi.elapsedMinutes)} />
        <KpiCard title="UPH" value={formatUph(kpi.uph)} />
        <KpiCard
          title="가동률"
          value={formatPercent(kpi.utilizationRatePercent)}
        />
      </ResponsiveGrid>
      <ResponsiveGrid variant="cards" className="mb-4">
        <SectionCard
          title={`기간별 작업량 (${grainLabel})`}
          description={`${grainLabel} 생산량 추이 · 품번 선택에 따라 갱신`}
        >
          <PeriodQtyBarChart
            data={chartData}
            showValueLabels={showValueLabels}
            periodLabel={trendGrain === "month" ? "월" : "날짜"}
            metricLabel="작업량"
          />
        </SectionCard>
        <SectionCard
          title={`기간별 UPH (${grainLabel})`}
          description={`${grainLabel} UPH 추이 · 품번 선택에 따라 갱신`}
        >
          <PeriodUphLineChart
            data={chartData}
            showValueLabels={showValueLabels}
            periodLabel={trendGrain === "month" ? "월" : "날짜"}
          />
        </SectionCard>
      </ResponsiveGrid>
      <SectionCard
        title={scopePart ? "해당 품번 실적" : "설비별 실적"}
        description={
          scopePart
            ? undefined
            : hasSelection
              ? `${activePart?.partNumber} 품번 기준 설비 실적`
              : "선택한 품번 기준 설비 실적"
        }
      >
        {scopePart ? (
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
                      <Link
                        href={detailHref(`/parts/${p.id}`, from, "operators")}
                        className="linkish"
                      >
                        {p.partNumber}
                      </Link>
                    </td>
                    <td>{p.productType}</td>
                    <td className="num">
                      {formatQuantity(p.kpi.productionQuantity)}
                    </td>
                    <td className="num">{formatUph(p.kpi.uph)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
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
                      <Link
                        href={detailHref(
                          `/equipment/${e.id}`,
                          from,
                          "operators",
                        )}
                        className="linkish"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td>{e.factory}</td>
                    <td className="num">
                      {formatQuantity(e.kpi.productionQuantity)}
                    </td>
                    <td className="num">
                      {formatPercent(e.kpi.utilizationRatePercent)}
                    </td>
                  </tr>
                ))}
                {!byEq.length ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-sm text-muted">
                      표시할 설비 실적이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
