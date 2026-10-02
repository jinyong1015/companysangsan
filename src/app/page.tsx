"use client";

import { useCallback, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { PeriodReasonOccurrenceView } from "@/components/downtime/DowntimeDetailTables";
import { QueryFilterShell } from "@/components/filters/FilterCards";
import { OperatorProductionQuantityBoard } from "@/components/operators/OperatorProductionQuantityBoard";
import { PartProductionQuantityBoard } from "@/components/production/PartProductionQuantityBoard";
import { ProductionVariationTrend } from "@/components/production/ProductionVariationTrend";
import { ProductShotTopWorst } from "@/components/production/ProductShotTopWorst";
import { ProductTypeTabs } from "@/components/production/ProductTypeTabs";
import type { ProductTab } from "@/components/production/ProductPerformanceSummary";
import {
  UtilizationMonthCompareModal,
  type UtilizationMonthCompareSnapshot,
} from "@/components/utilization/UtilizationMonthCompareModal";
import { UtilizationOverviewPanel } from "@/components/utilization/UtilizationOverviewPanel";
import { PageHeader } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { useToast } from "@/context/ToastContext";

import { aggregateProductPerformance } from "@/lib/aggregates";
import {
  buildEquipmentFamilyMttrMtbfSummary,
  buildEquipmentReliabilityTable,
  buildPeriodReasonTable,
} from "@/lib/downtimeDetail";
import { todaySeoul } from "@/lib/dates";
import { filterRecords } from "@/lib/metrics";
import {
  buildUtilizationOverviewBundle,
  filterByEquipmentProductLine,
  inferEquipmentType,
  loadTargetMinutes,
  loadTargetShotCounts,
  monthDateRange,
} from "@/lib/utilization";
import type { EquipmentType, WorkPattern } from "@/types";

type EqTypeFilter = "전체" | EquipmentType;
type WorkPatternFilter = "전체" | WorkPattern;

function yearMonthFromDate(date: string) {
  return date.slice(0, 7);
}

function defaultYearMonth() {
  return format(todaySeoul(), "yyyy-MM");
}

export default function DashboardPage() {
  const { filters } = useFilters();
  const { records } = useDataSource();
  const { pushToast } = useToast();
  const [yearMonth, setYearMonth] = useState(
    () => yearMonthFromDate(filters.startDate) || defaultYearMonth(),
  );
  const [equipmentType, setEquipmentType] = useState<EqTypeFilter>("전체");
  const [workPattern, setWorkPattern] = useState<WorkPatternFilter>("전체");

  const [shotTopProductTab, setShotTopProductTab] =
    useState<ProductTab>("전체");
  const [occurProductTab, setOccurProductTab] =
    useState<"전체" | "GROMMET" | "SEAL">("전체");
  const [monthCompareOpen, setMonthCompareOpen] = useState(false);

  const invalidRange = filters.endDate < filters.startDate;

  const monthRange = useMemo(() => monthDateRange(yearMonth), [yearMonth]);
  const monthLabel = useMemo(() => {
    try {
      return format(parseISO(`${yearMonth}-01`), "yyyy년 M월");
    } catch {
      return yearMonth;
    }
  }, [yearMonth]);
  const periodLabel = useMemo(() => {
    try {
      return `${format(parseISO(monthRange.startDate), "yyyy.MM.dd")} ~ ${format(
        parseISO(monthRange.endDate),
        "yyyy.MM.dd",
      )}`;
    } catch {
      return `${monthRange.startDate} ~ ${monthRange.endDate}`;
    }
  }, [monthRange.endDate, monthRange.startDate]);

  const monthScopedFilters = useMemo(
    () => ({
      ...filters,
      datePreset: "custom" as const,
      startDate: monthRange.startDate,
      endDate: monthRange.endDate,
    }),
    [filters, monthRange.endDate, monthRange.startDate],
  );

  const monthRecords = useMemo(() => {
    let list = filterRecords(records, monthScopedFilters);
    if (equipmentType !== "전체") {
      list = list.filter(
        (r) => inferEquipmentType(r.equipmentName) === equipmentType,
      );
    }
    return list;
  }, [equipmentType, monthScopedFilters, records]);

  const productPerfRows = useMemo(
    () =>
      aggregateProductPerformance(monthRecords, {
        ...monthScopedFilters,
        productType: "전체",
      }),
    [monthRecords, monthScopedFilters],
  );

  const shotTopRows = useMemo(() => {
    if (shotTopProductTab === "전체") return productPerfRows;
    return productPerfRows.filter((r) => r.productType === shotTopProductTab);
  }, [productPerfRows, shotTopProductTab]);

  const shotTabCounts = useMemo(
    () => ({
      전체: productPerfRows.length,
      GROMMET: productPerfRows.filter((r) => r.productType === "GROMMET")
        .length,
      SEAL: productPerfRows.filter((r) => r.productType === "SEAL").length,
    }),
    [productPerfRows],
  );

  const utilizationOverview = useMemo(
    () =>
      buildUtilizationOverviewBundle(monthRecords, monthScopedFilters, {
        workPattern,
        metric: "time",
        targetSettings: loadTargetMinutes(),
        targetShotTable: loadTargetShotCounts(),
        startDate: monthRange.startDate,
        endDate: monthRange.endDate,
      }),
    [monthRecords, monthRange.endDate, monthRange.startDate, monthScopedFilters, workPattern],
  );

  const mttrMtbfSummary = useMemo(
    () =>
      buildEquipmentFamilyMttrMtbfSummary(
        buildEquipmentReliabilityTable(monthRecords),
      ),
    [monthRecords],
  );

  const buildMonthCompareSnapshot = useCallback(
    (ym: string): UtilizationMonthCompareSnapshot => {
      const range = monthDateRange(ym);
      const scoped = {
        ...filters,
        datePreset: "custom" as const,
        startDate: range.startDate,
        endDate: range.endDate,
      };
      let list = filterRecords(records, scoped);
      if (equipmentType !== "전체") {
        list = list.filter(
          (r) => inferEquipmentType(r.equipmentName) === equipmentType,
        );
      }
      const bundle = buildUtilizationOverviewBundle(list, scoped, {
        workPattern,
        metric: "time",
        targetSettings: loadTargetMinutes(),
        targetShotTable: loadTargetShotCounts(),
        startDate: range.startDate,
        endDate: range.endDate,
      });
      return {
        yearMonth: ym,
        monthLabel: format(parseISO(`${ym}-01`), "yyyy년 M월"),
        overview: bundle.overview,
        trends: bundle.trends,
        equipmentByProduct: bundle.equipmentByProduct,
        mttrMtbfSummary: buildEquipmentFamilyMttrMtbfSummary(
          buildEquipmentReliabilityTable(list),
        ),
      };
    },
    [equipmentType, filters, records, workPattern],
  );

  const periodReasonTable = useMemo(() => {
    let list = filterRecords(records, {
      ...monthScopedFilters,
      productType: "전체",
    });
    if (equipmentType !== "전체") {
      list = list.filter(
        (r) => inferEquipmentType(r.equipmentName) === equipmentType,
      );
    }
    return buildPeriodReasonTable(
      filterByEquipmentProductLine(list, occurProductTab),
      monthRange.startDate,
      monthRange.endDate,
    );
  }, [
    equipmentType,
    monthRange.endDate,
    monthRange.startDate,
    monthScopedFilters,
    occurProductTab,
    records,
  ]);

  const queryActiveCount =
    (equipmentType !== "전체" ? 1 : 0) + (workPattern !== "전체" ? 1 : 0);

  const resetMonthQuery = () => {
    const ym = defaultYearMonth();
    setYearMonth(ym);
    setEquipmentType("전체");
    setWorkPattern("전체");
    pushToast("조회조건을 초기화했습니다.", "info");
  };

  if (invalidRange) {
    return (
      <>
        <PageHeader title="월별 KPI" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="월별 KPI" />

      <QueryFilterShell
        title="조회조건"
        activeCount={queryActiveCount}
        onReset={resetMonthQuery}
      >
        <div className="query-filter-grid">
          <div className="query-filter-field">
            <p className="query-filter-label">조회월</p>
            <input
              type="month"
              className="query-filter-input"
              value={yearMonth}
              onChange={(e) => {
                if (e.target.value) setYearMonth(e.target.value);
              }}
            />
            <p className="query-filter-hint">
              {monthLabel} ({periodLabel}) 기준 종합 현황 · 히트맵
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
          <div className="query-filter-field">
            <p className="query-filter-label">근무형태</p>
            <div className="filter-pills">
              {(
                ["전체", "주간+야간", "주간", "야간"] as const
              ).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className="filter-pill"
                  data-active={workPattern === opt}
                  onClick={() => setWorkPattern(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </QueryFilterShell>

      <UtilizationOverviewPanel
        monthLabel={monthLabel}
        overview={utilizationOverview.overview}
        trends={utilizationOverview.trends}
        grommetEmphasized={
          filters.productType === "전체" || filters.productType === "GROMMET"
        }
        sealEmphasized={
          filters.productType === "전체" || filters.productType === "SEAL"
        }
        equipmentByProduct={utilizationOverview.equipmentByProduct}
        showEquipmentBlock={false}
        mttrMtbfSummary={mttrMtbfSummary}
        onMonthCompare={() => setMonthCompareOpen(true)}
      />

      <UtilizationMonthCompareModal
        open={monthCompareOpen}
        onClose={() => setMonthCompareOpen(false)}
        initialLeftMonth={yearMonth}
        buildSnapshot={buildMonthCompareSnapshot}
      />

      <div className="mb-4">
        <PeriodReasonOccurrenceView
          table={periodReasonTable}
          variant="dashboard"
          productTab={occurProductTab}
          onProductTabChange={setOccurProductTab}
        />
      </div>

      <ProductionVariationTrend
        grain="day"
        filtersOverride={monthScopedFilters}
        description={`${monthLabel} (${periodLabel}) 일별 추이 · 공장은 상단 필터 적용`}
        showMonthCompare
      />

      <PartProductionQuantityBoard
        rows={productPerfRows}
        from="home"
        startDate={monthRange.startDate}
        endDate={monthRange.endDate}
      />

      <OperatorProductionQuantityBoard
        records={monthRecords}
        filters={monthScopedFilters}
        startDate={monthRange.startDate}
        endDate={monthRange.endDate}
        from="home"
      />

      <ProductTypeTabs
        value={shotTopProductTab}
        onChange={setShotTopProductTab}
        counts={shotTabCounts}
        ariaLabel="TOP & WORST 제품유형"
      />
      <ProductShotTopWorst
        rows={shotTopRows}
        productTab={shotTopProductTab}
        from="home"
        startDate={monthRange.startDate}
        endDate={monthRange.endDate}
      />

    </>
  );
}
