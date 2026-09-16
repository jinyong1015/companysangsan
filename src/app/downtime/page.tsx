"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DowntimeReasonDonut,
  HorizontalRankBars,
  ProductionUtilizationTrend,
} from "@/components/charts/Charts";
import { DetailFilterCard } from "@/components/filters/FilterCards";
import { KpiCard } from "@/components/ui/KpiCard";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader, ResponsiveGrid, SectionCard } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";

import { usePageState } from "@/hooks/usePageState";
import { aggregateEquipment } from "@/lib/aggregates";
import { autoGrain } from "@/lib/dates";
import {
  formatHours,
  formatMinutes,
  formatNumber,
  formatPercent,
  formatQuantity,
} from "@/lib/format";
import {
  buildTrends,
  computeKpi,
  downtimeReasonShares,
  filterRecords,
  paginate,
  sortBy,
} from "@/lib/metrics";

export default function DowntimePage() {
  const { filters, setFilters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const router = useRouter();
  const { state, patch } = usePageState("downtime", "downtime", "desc");

  const filtered = useMemo(
    () => filterRecords(records, filters, { requireDowntime: true }),
    [filters],
  );
  const kpi = useMemo(() => computeKpi(filtered), [filtered]);
  const reasons = useMemo(() => downtimeReasonShares(filtered), [filtered]);
  const trends = useMemo(
    () =>
      buildTrends(
        filtered,
        filters.startDate,
        filters.endDate,
        autoGrain(filters.startDate, filters.endDate),
      ),
    [filtered, filters],
  );

  const topEq = useMemo(() => {
    return [...aggregateEquipment(records, filters)]
      .sort((a, b) => b.kpi.downtimeMinutes - a.kpi.downtimeMinutes)
      .slice(0, 10);
  }, [filters, records]);

  const events = useMemo(() => {
    let list = [...filtered];
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.equipmentName.toLowerCase().includes(q) ||
          r.partNumber.toLowerCase().includes(q) ||
          (r.downtimeReasonRaw ?? "").toLowerCase().includes(q),
      );
    }
    return sortBy(list, state.sort, state.order, {
      downtime: (r) => r.downtimeMinutes,
      date: (r) => r.workDate,
      failure: (r) => (r.isFailureCandidate ? 1 : 0),
    });
  }, [filtered, state]);

  const paged = paginate(events, state.page, state.pageSize);

  return (
    <>
      <PageHeader title="비가동 분석" description="비가동 사유와 고장 이력 분석" />
      <DetailFilterCard showOperators={false} showMolds={false} showDowntimeReason />

      <ResponsiveGrid variant="kpi" className="mb-4">
        <KpiCard title="총 비가동시간" value={formatMinutes(kpi.downtimeMinutes)} accent="var(--metric-downtime)" />
        <KpiCard title="비가동 발생 건수" value={`${formatNumber(filtered.length)}건`} />
        <KpiCard title="고장 건수" value={`${formatNumber(kpi.failureCount)}건`} />
        <KpiCard
          title="MTTR"
          value={kpi.mttrMinutes == null ? "-" : `${formatNumber(kpi.mttrMinutes, 1)}분`}
          comparePositiveIsGood={false}
        />
        <KpiCard title="참고 MTBF" value={formatHours(kpi.referenceMtbfHours)} tooltip="고장·복구 시각이 없어 유효 가동시간을 고장 건수로 나눈 참고 지표입니다." />
      </ResponsiveGrid>

      <ResponsiveGrid variant="split" className="mb-4">
        <SectionCard title="비가동 사유 구성">
          <DowntimeReasonDonut
            data={reasons}
            onSelect={(reason) =>
              setFilters({
                downtimeReason: reason as typeof filters.downtimeReason,
              })
            }
          />
        </SectionCard>
        <SectionCard title="기간별 비가동·고장">
          <ProductionUtilizationTrend
            data={trends.map((t) => ({
              ...t,
              productionQuantity: t.downtimeMinutes,
              utilizationRatePercent: t.failureCount,
            }))}
            height={280}
          />
        </SectionCard>
      </ResponsiveGrid>

      <SectionCard title="비가동시간 TOP 10 설비" className="mb-4">
        <HorizontalRankBars
          rows={topEq.map((e) => ({
            id: e.id,
            name: e.name,
            value: e.kpi.downtimeMinutes,
            secondary: `가동률 ${formatPercent(e.kpi.utilizationRatePercent)} · 고장 ${e.kpi.failureCount}`,
          }))}
          valueFormatter={(v) => formatMinutes(v)}
          onClick={(id) => router.push(`/equipment/${id}`)}
        />
      </SectionCard>

      <SearchSortBar
        search={state.search}
        onSearch={(search) => patch({ search })}
        searchPlaceholder="설비명·품번·비가동내역 검색"
        sort={state.sort}
        onSort={(sort) => patch({ sort })}
        order={state.order}
        onOrder={(order) => patch({ order })}
        pageSize={state.pageSize}
        onPageSize={(pageSize) => patch({ pageSize })}
        sortOptions={[
          { value: "downtime", label: "비가동시간" },
          { value: "date", label: "작업일자" },
          { value: "failure", label: "고장 후보" },
        ]}
      />

      {events.length === 0 ? (
        <EmptyState
          title="고장 후보가 없습니다."
          description="선택 범위에 설비이상 이력이 없습니다."
          actionLabel="조회조건 초기화"
          onAction={resetGlobal}
        />
      ) : (
        <SectionCard>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>작업일자</th>
                  <th>공장</th>
                  <th>설비명</th>
                  <th>제품유형</th>
                  <th>품번</th>
                  <th>구분</th>
                  <th>작업자</th>
                  <th className="num">작업시간</th>
                  <th className="num">비가동시간</th>
                  <th className="num">가동시간</th>
                  <th>비가동내역</th>
                  <th>고장 후보</th>
                  <th>MTTR 포함</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.workDate}</td>
                    <td>{r.factory}</td>
                    <td>
                      <Link href={`/equipment/${r.equipmentId}`} className="linkish">
                        {r.equipmentName}
                      </Link>
                    </td>
                    <td>{r.productType}</td>
                    <td>{r.partNumber}</td>
                    <td>{r.shiftType}</td>
                    <td>{r.operatorName}</td>
                    <td className="num">{formatMinutes(r.elapsedMinutes)}</td>
                    <td className="num">{formatMinutes(r.downtimeMinutes)}</td>
                    <td className="num">{formatMinutes(r.operatingMinutes)}</td>
                    <td>{r.downtimeReasonRaw ?? "-"}</td>
                    <td>{r.isFailureCandidate ? "예" : "아니오"}</td>
                    <td>{r.isMttrEligible ? "포함" : r.isFailureCandidate ? "제외" : "-"}</td>
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
          <NumberPagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            onPage={(page) => patch({ page })}
          />
        </SectionCard>
      )}
    </>
  );
}
