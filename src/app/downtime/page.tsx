"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";
import {
  DowntimeReasonDonut,
  ProductionUtilizationTrend,
} from "@/components/charts/Charts";
import {
  EquipmentReliabilitySection,
  PeriodReasonSection,
} from "@/components/downtime/DowntimeDetailTables";
import { KpiCard } from "@/components/ui/KpiCard";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader, ResponsiveGrid, SectionCard } from "@/components/ui/PageBits";
import { TopRankCards } from "@/components/ui/TopRankCards";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { useToast } from "@/context/ToastContext";

import { usePageState } from "@/hooks/usePageState";
import { todaySeoul } from "@/lib/dates";
import {
  buildEquipmentReliabilityTable,
  buildPeriodReasonTable,
  buildProductTypeDowntimeSummary,
  isDowntimeEvent,
} from "@/lib/downtimeDetail";
import {
  formatHours,
  formatMinutes,
  formatNumber,
} from "@/lib/format";
import {
  buildTrends,
  computeKpi,
  downtimeReasonShares,
  filterRecords,
  paginate,
  sortBy,
} from "@/lib/metrics";
import { inferEquipmentType, monthDateRange } from "@/lib/utilization";
import { withFromParam } from "@/lib/navigation";
import { downloadExcel } from "@/lib/excelParse";
import type { EquipmentType, GlobalFilters, ProductType, ProductionRecord } from "@/types";

type ProductTab = "전체" | ProductType;
type EqTypeFilter = "전체" | EquipmentType;

function isProductTab(value: unknown): value is ProductTab {
  return value === "전체" || value === "GROMMET" || value === "SEAL";
}

function isEqTypeFilter(value: unknown): value is EqTypeFilter {
  return value === "전체" || value === "PRESS" || value === "INJECTION";
}

function mainDowntimeReason(rows: ProductionRecord[]): string {
  return downtimeReasonShares(rows)[0]?.reason ?? "-";
}

function defaultYearMonth() {
  return format(todaySeoul(), "yyyy-MM");
}

function yearMonthFromDate(date: string) {
  return date.slice(0, 7);
}

function filterByEquipmentType(
  list: ProductionRecord[],
  equipmentType: EqTypeFilter,
): ProductionRecord[] {
  if (equipmentType === "전체") return list;
  return list.filter(
    (r) => inferEquipmentType(r.equipmentName) === equipmentType,
  );
}

export default function DowntimePage() {
  const { filters, setFilters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const { pushToast } = useToast();
  const { state, patch, ready } = usePageState("downtime", "downtime", "desc");
  const didSyncMonth = useRef(false);

  const yearMonth =
    typeof state.extra?.yearMonth === "string" && state.extra.yearMonth
      ? state.extra.yearMonth
      : yearMonthFromDate(filters.startDate) || defaultYearMonth();

  const equipmentType: EqTypeFilter = isEqTypeFilter(state.extra?.equipmentType)
    ? state.extra.equipmentType
    : "전체";

  const monthRange = useMemo(() => monthDateRange(yearMonth), [yearMonth]);

  const queryFilters = useMemo<GlobalFilters>(
    () => ({
      ...filters,
      datePreset: "custom",
      startDate: monthRange.startDate,
      endDate: monthRange.endDate,
    }),
    [filters, monthRange.startDate, monthRange.endDate],
  );

  const setExtra = useCallback(
    (extra: Record<string, string | number | boolean | null>) => {
      patch({ extra });
    },
    [patch],
  );

  const applyYearMonth = useCallback(
    (ym: string) => {
      const range = monthDateRange(ym);
      setExtra({ yearMonth: ym });
      setFilters({
        datePreset: "custom",
        startDate: range.startDate,
        endDate: range.endDate,
      });
      patch({ page: 1 });
    },
    [setExtra, setFilters, patch],
  );

  const setEquipmentType = (next: EqTypeFilter) => {
    setFilters({ equipmentIds: [] });
    setExtra({ equipmentType: next });
    patch({ page: 1 });
  };

  useEffect(() => {
    if (!ready || didSyncMonth.current) return;
    didSyncMonth.current = true;
    setExtra({ yearMonth, equipmentType });
    if (
      filters.startDate !== monthRange.startDate ||
      filters.endDate !== monthRange.endDate
    ) {
      setFilters({
        datePreset: "custom",
        startDate: monthRange.startDate,
        endDate: monthRange.endDate,
      });
    }
  }, [
    ready,
    yearMonth,
    equipmentType,
    monthRange.startDate,
    monthRange.endDate,
    filters.startDate,
    filters.endDate,
    setExtra,
    setFilters,
  ]);

  const analysisRecords = useMemo(
    () => filterByEquipmentType(filterRecords(records, queryFilters), equipmentType),
    [queryFilters, records, equipmentType],
  );

  const downtimeRecords = useMemo(
    () => analysisRecords.filter(isDowntimeEvent),
    [analysisRecords],
  );

  const kpi = useMemo(() => computeKpi(downtimeRecords), [downtimeRecords]);
  const reasons = useMemo(() => downtimeReasonShares(downtimeRecords), [downtimeRecords]);
  const trends = useMemo(
    () =>
      buildTrends(
        downtimeRecords,
        monthRange.startDate,
        monthRange.endDate,
        "day",
      ),
    [downtimeRecords, monthRange.startDate, monthRange.endDate],
  );

  const topParts = useMemo(() => {
    const map = new Map<string, typeof analysisRecords>();
    for (const r of analysisRecords) {
      const list = map.get(r.partId) ?? [];
      list.push(r);
      map.set(r.partId, list);
    }
    return [...map.entries()]
      .map(([id, partRows]) => {
        const first = partRows[0]!;
        const kpi = computeKpi(partRows);
        return {
          id,
          partNumber: first.partNumber,
          kpi,
          mainReason: mainDowntimeReason(partRows),
        };
      })
      .sort((a, b) => b.kpi.downtimeMinutes - a.kpi.downtimeMinutes)
      .slice(0, 10);
  }, [analysisRecords]);

  const periodProductTab: ProductTab = isProductTab(state.extra?.periodProductTab)
    ? state.extra.periodProductTab
    : "전체";

  const reliabilityProductTab: ProductTab = isProductTab(
    state.extra?.reliabilityProductTab,
  )
    ? state.extra.reliabilityProductTab
    : "전체";

  const baseAnalysisRecords = useMemo(
    () => filterByEquipmentType(filterRecords(records, queryFilters), equipmentType),
    [records, queryFilters, equipmentType],
  );

  const periodAnalysisRecords = useMemo(
    () =>
      filterByEquipmentType(
        filterRecords(records, {
          ...queryFilters,
          productType: periodProductTab,
        }),
        equipmentType,
      ),
    [records, queryFilters, periodProductTab, equipmentType],
  );

  const reliabilityAnalysisRecords = useMemo(
    () =>
      filterByEquipmentType(
        filterRecords(records, {
          ...queryFilters,
          productType: reliabilityProductTab,
        }),
        equipmentType,
      ),
    [records, queryFilters, reliabilityProductTab, equipmentType],
  );

  const productTypeSummary = useMemo(
    () =>
      buildProductTypeDowntimeSummary(
        baseAnalysisRecords,
        monthRange.startDate,
        monthRange.endDate,
      ),
    [baseAnalysisRecords, monthRange.startDate, monthRange.endDate],
  );

  const periodTable = useMemo(
    () =>
      buildPeriodReasonTable(
        periodAnalysisRecords,
        monthRange.startDate,
        monthRange.endDate,
      ),
    [periodAnalysisRecords, monthRange.startDate, monthRange.endDate],
  );

  const equipmentTable = useMemo(
    () => buildEquipmentReliabilityTable(reliabilityAnalysisRecords),
    [reliabilityAnalysisRecords],
  );

  const events = useMemo(() => {
    let list = baseAnalysisRecords.filter(isDowntimeEvent);
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
  }, [baseAnalysisRecords, state]);

  const paged = paginate(events, state.page, state.pageSize);

  const monthLabel = format(parseISO(`${yearMonth}-01`), "yyyy년 M월");
  const periodLabel = `${format(parseISO(monthRange.startDate), "yyyy.MM.dd")} ~ ${format(
    parseISO(monthRange.endDate),
    "yyyy.MM.dd",
  )}`;

  const setPeriodProductTab = (next: ProductTab) => {
    setExtra({ periodProductTab: next });
  };

  const setReliabilityProductTab = (next: ProductTab) => {
    setExtra({ reliabilityProductTab: next });
  };

  const resetQuery = () => {
    setFilters({
      equipmentIds: [],
      partIds: [],
      operatorIds: [],
      moldIds: [],
      shiftType: "전체",
      downtimeReason: "전체",
    });
    setExtra({
      equipmentType: "전체",
      periodProductTab: "전체",
      reliabilityProductTab: "전체",
    });
    applyYearMonth(defaultYearMonth());
    pushToast("조회조건을 초기화했습니다.", "info");
  };

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="비가동 분석"
        description={`${monthLabel} 기준 비가동 사유와 고장 이력 분석`}
      />

      <aside
        className="card mb-4 border-[var(--accent)]/35 bg-[color-mix(in_srgb,var(--accent-soft)_55%,var(--card))] px-4 py-4 md:px-5"
        aria-label="자사 관리기준"
      >
        <p className="mb-3 text-center text-[15px] font-bold tracking-tight text-[var(--accent)]">
          ※자사 관리기준
        </p>
        <div className="space-y-3 text-sm leading-relaxed">
          <div>
            <p className="font-bold text-[var(--text)]">1. MTTR [설비복구시간]</p>
            <p className="mt-1 font-semibold text-[var(--error)]">
              - 1,440min 초과 발생시 설비점검 진행
            </p>
            <p className="mt-0.5 pl-3 text-[var(--text-secondary)]">
              └ 1,440min = 1日
            </p>
          </div>
          <div>
            <p className="font-bold text-[var(--text)]">2. MTBF [고장간격시간]</p>
            <p className="mt-1 font-semibold text-[var(--error)]">
              - 50hr 미만 발생시 설비점검 진행
            </p>
          </div>
        </div>
      </aside>

      <section className="card mb-4 p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">조회조건</h2>
          <button type="button" className="btn btn-ghost" onClick={resetQuery}>
            초기화
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-[var(--text-secondary)]">조회월</p>
            <input
              type="month"
              className="w-full rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              value={yearMonth}
              onChange={(e) => applyYearMonth(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {monthLabel} ({periodLabel}) 기준 비가동 현황
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-[var(--text-secondary)]">설비</p>
            <div className="filter-pills">
              {(
                [
                  { value: "전체" as const, label: "전체설비" },
                  { value: "PRESS" as const, label: "PRESS" },
                  { value: "INJECTION" as const, label: "INJECTION" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="filter-pill"
                  data-active={equipmentType === opt.value}
                  onClick={() => setEquipmentType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ResponsiveGrid variant="kpi" className="mb-4">
        <KpiCard title="총 비가동시간" value={formatMinutes(kpi.downtimeMinutes)} accent="var(--metric-downtime)" />
        <KpiCard title="비가동 발생 건수" value={`${formatNumber(downtimeRecords.length)}건`} />
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
            showTableToggle={false}
          />
        </SectionCard>
      </ResponsiveGrid>

      <SectionCard title="비가동시간 TOP 10 품번" className="mb-4">
        <TopRankCards
          items={topParts.map((p) => ({
            id: p.id,
            title: p.partNumber,
            detail: `비가동 ${formatMinutes(p.kpi.downtimeMinutes)} · ${p.mainReason}`,
            href: withFromParam(`/parts/${p.id}`, "downtime"),
          }))}
        />
      </SectionCard>

      <PeriodReasonSection
        table={periodTable}
        productType={periodProductTab}
        onProductTypeChange={setPeriodProductTab}
        summaryTable={productTypeSummary}
      />

      <EquipmentReliabilitySection
        table={equipmentTable}
        productType={reliabilityProductTab}
        onProductTypeChange={setReliabilityProductTab}
      />

      <SectionCard
        title="비가동 상세 내역"
        className="mb-4"
      >
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
          onExcel={() =>
            downloadExcel(
              "비가동상세내역.xlsx",
              events.map((r) => ({
                작업일자: r.workDate,
                공장: r.factory,
                설비명: r.equipmentName,
                제품유형: r.productType,
                품번: r.partNumber,
                구분: r.shiftType,
                작업자: r.operatorName,
                작업시간분: r.elapsedMinutes,
                비가동시간분: r.downtimeMinutes,
                가동시간분: r.operatingMinutes,
                비가동내역: r.downtimeReasonRaw ?? "",
                고장후보: r.isFailureCandidate ? "예" : "아니오",
                MTTR포함: r.isMttrEligible ? "포함" : "",
              })),
            )
          }
        />

        {events.length === 0 ? (
          <EmptyState
            title="표시할 비가동 내역이 없습니다."
            description="조회월·설비유형·제품유형 탭을 변경해 주세요."
            actionLabel="조회조건 초기화"
            onAction={() => {
              resetGlobal();
              resetQuery();
            }}
          />
        ) : (
          <>
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
                        <Link
                          href={withFromParam(
                            `/equipment/${r.equipmentId}`,
                            "downtime",
                          )}
                          className="linkish"
                        >
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
                      <td title={r.downtimeReasonRaw ?? undefined}>
                        {r.downtimeReasonRaw ?? "-"}
                      </td>
                      <td>{r.isFailureCandidate ? "예" : "아니오"}</td>
                      <td>{r.isMttrEligible ? "포함" : "-"}</td>
                      <td>
                        <Link
                          href={withFromParam(`/downtime/${r.id}`, "downtime")}
                          className="linkish"
                        >
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
          </>
        )}
      </SectionCard>
    </>
  );
}
