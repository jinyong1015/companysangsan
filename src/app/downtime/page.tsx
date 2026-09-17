"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { DowntimeReasonDonut } from "@/components/charts/Charts";
import {
  EquipmentReliabilitySection,
  PeriodReasonSection,
} from "@/components/downtime/DowntimeDetailTables";
import { DowntimeEquipmentHeatmap } from "@/components/downtime/DowntimeEquipmentHeatmap";
import { DowntimeReasonDetailList } from "@/components/downtime/DowntimeReasonDetailList";
import { DowntimeTopPartsChart } from "@/components/downtime/DowntimeTopPartsChart";
import { QueryFilterShell } from "@/components/filters/FilterCards";
import { KpiCard } from "@/components/ui/KpiCard";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader, ResponsiveGrid, SectionCard } from "@/components/ui/PageBits";
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
import type {
  DowntimeHeatmapMetric,
  DowntimeHeatmapProductTab,
  DowntimeHeatmapSelection,
} from "@/lib/downtimeHeatmap";
import type {
  DowntimeTopPartsProductTab,
  DowntimeTopPartsView,
} from "@/lib/downtimeTopParts";
import {
  formatMinutes,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import {
  computeKpi,
  downtimeReasonShares,
  filterRecords,
  paginate,
  sortBy,
} from "@/lib/metrics";
import { inferEquipmentType, monthDateRange } from "@/lib/utilization";
import { withFromParam } from "@/lib/navigation";
import { downloadExcel } from "@/lib/excelParse";
import { saveFilters } from "@/lib/storage";
import type { EquipmentType, GlobalFilters, ProductType, ProductionRecord } from "@/types";

type ProductTab = "전체" | ProductType;
type EqTypeFilter = "전체" | EquipmentType;

function isProductTab(value: unknown): value is ProductTab {
  return value === "전체" || value === "GROMMET" || value === "SEAL";
}

function isEqTypeFilter(value: unknown): value is EqTypeFilter {
  return value === "전체" || value === "PRESS" || value === "INJECTION";
}

function isTopPartsView(value: unknown): value is DowntimeTopPartsView {
  return value === "rank" || value === "bar" || value === "pareto";
}

function isHeatmapMetric(value: unknown): value is DowntimeHeatmapMetric {
  return value === "minutes" || value === "count" || value === "rate";
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
  const router = useRouter();
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
      setExtra({
        yearMonth: ym,
        heatmapSelDate: null,
        heatmapSelEqId: null,
        heatmapSelEqName: null,
        heatmapSelProduct: null,
      });
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
    setExtra({
      equipmentType: next,
      heatmapSelDate: null,
      heatmapSelEqId: null,
      heatmapSelEqName: null,
      heatmapSelProduct: null,
    });
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

  const periodProductTab: ProductTab = isProductTab(state.extra?.periodProductTab)
    ? state.extra.periodProductTab
    : "전체";

  const reliabilityProductTab: ProductTab = isProductTab(
    state.extra?.reliabilityProductTab,
  )
    ? state.extra.reliabilityProductTab
    : "전체";

  const topPartsProductTab: DowntimeTopPartsProductTab = isProductTab(
    state.extra?.topPartsProductTab,
  )
    ? state.extra.topPartsProductTab
    : "전체";

  const topPartsView: DowntimeTopPartsView = isTopPartsView(
    state.extra?.topPartsView,
  )
    ? state.extra.topPartsView
    : "rank";

  const heatmapProductTab: DowntimeHeatmapProductTab = isProductTab(
    state.extra?.heatmapProductTab,
  )
    ? state.extra.heatmapProductTab
    : "전체";

  const heatmapMetric: DowntimeHeatmapMetric = isHeatmapMetric(
    state.extra?.heatmapMetric,
  )
    ? state.extra.heatmapMetric
    : "minutes";

  const heatmapSelection = useMemo<DowntimeHeatmapSelection | null>(() => {
    const workDate =
      typeof state.extra?.heatmapSelDate === "string"
        ? state.extra.heatmapSelDate
        : "";
    const equipmentId =
      typeof state.extra?.heatmapSelEqId === "string"
        ? state.extra.heatmapSelEqId
        : "";
    const equipmentName =
      typeof state.extra?.heatmapSelEqName === "string"
        ? state.extra.heatmapSelEqName
        : "";
    if (!workDate || !equipmentId) return null;
    const productType: DowntimeHeatmapProductTab = isProductTab(
      state.extra?.heatmapSelProduct,
    )
      ? state.extra.heatmapSelProduct
      : heatmapProductTab;
    return {
      workDate,
      equipmentId,
      equipmentName: equipmentName || equipmentId,
      productType,
    };
  }, [state.extra, heatmapProductTab]);

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

  const topPartsRecords = useMemo(
    () =>
      filterByEquipmentType(
        filterRecords(records, {
          ...queryFilters,
          productType: topPartsProductTab,
        }),
        equipmentType,
      ),
    [records, queryFilters, topPartsProductTab, equipmentType],
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
    if (heatmapSelection) {
      list = list.filter((r) => {
        if (r.workDate !== heatmapSelection.workDate) return false;
        if (r.equipmentId !== heatmapSelection.equipmentId) return false;
        if (
          heatmapSelection.productType !== "전체" &&
          r.productType !== heatmapSelection.productType
        ) {
          return false;
        }
        return true;
      });
    }
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
  }, [baseAnalysisRecords, heatmapSelection, state]);

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

  const setTopPartsProductTab = (next: DowntimeTopPartsProductTab) => {
    setExtra({ topPartsProductTab: next });
  };

  const setTopPartsView = (next: DowntimeTopPartsView) => {
    setExtra({ topPartsView: next });
  };

  const setHeatmapProductTab = (next: DowntimeHeatmapProductTab) => {
    setExtra({
      heatmapProductTab: next,
      heatmapSelDate: null,
      heatmapSelEqId: null,
      heatmapSelEqName: null,
      heatmapSelProduct: null,
    });
  };

  const setHeatmapMetric = (next: DowntimeHeatmapMetric) => {
    setExtra({ heatmapMetric: next });
  };

  const setHeatmapSelection = (next: DowntimeHeatmapSelection | null) => {
    if (!next) {
      setExtra({
        heatmapSelDate: null,
        heatmapSelEqId: null,
        heatmapSelEqName: null,
        heatmapSelProduct: null,
      });
      return;
    }
    setExtra({
      heatmapSelDate: next.workDate,
      heatmapSelEqId: next.equipmentId,
      heatmapSelEqName: next.equipmentName,
      heatmapSelProduct: next.productType,
    });
    patch({ page: 1 });
    requestAnimationFrame(() => {
      document
        .getElementById("downtime-detail")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openTopPartDetail = (partId: string) => {
    // 조회월 범위를 전역 필터에 반영한 뒤 품번 상세로 이동
    const range = monthDateRange(yearMonth);
    const nextFilters: GlobalFilters = {
      ...filters,
      datePreset: "custom",
      startDate: range.startDate,
      endDate: range.endDate,
    };
    setExtra({ yearMonth });
    setFilters({
      datePreset: "custom",
      startDate: range.startDate,
      endDate: range.endDate,
    });
    saveFilters(nextFilters);
    router.push(withFromParam(`/parts/${partId}`, "downtime"));
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
      topPartsProductTab: "전체",
      topPartsView: "rank",
      heatmapProductTab: "전체",
      heatmapMetric: "minutes",
      heatmapSelDate: null,
      heatmapSelEqId: null,
      heatmapSelEqName: null,
      heatmapSelProduct: null,
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

      <QueryFilterShell
        title="조회조건"
        activeCount={equipmentType !== "전체" ? 1 : 0}
        onReset={resetQuery}
      >
        <div className="query-filter-grid">
          <div className="query-filter-field">
            <p className="query-filter-label">조회월</p>
            <input
              type="month"
              className="query-filter-input"
              value={yearMonth}
              onChange={(e) => applyYearMonth(e.target.value)}
            />
            <p className="query-filter-hint">
              {monthLabel} ({periodLabel}) 기준 비가동 현황
            </p>
          </div>
          <div className="query-filter-field">
            <p className="query-filter-label">설비</p>
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
      </QueryFilterShell>

      <ResponsiveGrid variant="kpi" className="mb-4">
        <KpiCard title="총 비가동시간" value={formatMinutes(kpi.downtimeMinutes)} accent="var(--metric-downtime)" />
        <KpiCard title="비가동 발생 건수" value={`${formatNumber(downtimeRecords.length)}건`} />
        <KpiCard title="고장 건수" value={`${formatNumber(kpi.failureCount)}건`} />
        <KpiCard
          title="비가동률"
          value={formatPercent(
            kpi.elapsedMinutes > 0
              ? (kpi.downtimeMinutes / kpi.elapsedMinutes) * 100
              : null,
          )}
          hint={
            kpi.elapsedMinutes > 0
              ? `비가동 ${formatMinutes(kpi.downtimeMinutes)} / 작업 ${formatMinutes(kpi.elapsedMinutes)}`
              : undefined
          }
          accent="var(--metric-downtime)"
        />
      </ResponsiveGrid>

      <div className="dt-overview-layout mb-4">
        <div className="dt-overview-left">
          <SectionCard title="비가동 사유 구성">
            <DowntimeReasonDonut data={reasons} />
          </SectionCard>
          <SectionCard
            title="비가동 사유별 상세"
            description="사유별 귀속시간 · 발생 건수 · 건당 평균시간"
          >
            <DowntimeReasonDetailList records={downtimeRecords} />
          </SectionCard>
        </div>
        <SectionCard
          title="설비별 일자 비가동 현황"
          className="dt-overview-heatmap"
        >
          <DowntimeEquipmentHeatmap
            records={baseAnalysisRecords}
            startDate={monthRange.startDate}
            endDate={monthRange.endDate}
            productTab={heatmapProductTab}
            onProductTabChange={setHeatmapProductTab}
            metric={heatmapMetric}
            onMetricChange={setHeatmapMetric}
            selection={heatmapSelection}
            onSelectionChange={setHeatmapSelection}
          />
        </SectionCard>
      </div>

      <DowntimeTopPartsChart
        records={topPartsRecords}
        productTab={topPartsProductTab}
        onProductTabChange={setTopPartsProductTab}
        view={topPartsView}
        onViewChange={setTopPartsView}
        onOpenPart={openTopPartDetail}
      />

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

      <SectionCard title="비가동 상세 내역" className="mb-4" id="downtime-detail">
        {heatmapSelection ? (
          <div className="dt-heat-chips mb-3" aria-label="히트맵 선택 필터">
            <span className="dt-heat-chip">{heatmapSelection.workDate}</span>
            <span className="dt-heat-chip">{heatmapSelection.equipmentName}</span>
            <span className="dt-heat-chip">{heatmapSelection.productType}</span>
            <button
              type="button"
              className="dt-heat-chip-clear"
              onClick={() => setHeatmapSelection(null)}
            >
              필터 해제
            </button>
          </div>
        ) : null}
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
