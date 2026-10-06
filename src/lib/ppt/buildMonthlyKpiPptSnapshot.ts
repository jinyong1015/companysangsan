import { format, parseISO, subMonths } from "date-fns";
import {
  aggregateOperators,
  aggregateProductPerformance,
} from "@/lib/aggregates";
import {
  buildEquipmentFamilyMttrMtbfSummary,
  buildEquipmentReliabilityTable,
  buildPeriodReasonTable,
  type EquipmentFamilyMttrMtbfSummaryTable,
} from "@/lib/downtimeDetail";
import {
  buildMonthlyDashboardTrends,
  filterRecords,
} from "@/lib/metrics";
import {
  buildUtilizationOverviewBundle,
  combineProductYieldPercent,
  computeOeePercent,
  filterByEquipmentProductLine,
  inferEquipmentType,
  loadManualYieldPercent,
  loadTargetMinutes,
  loadTargetShotCounts,
  monthDateRange,
  type UtilizationOverview,
} from "@/lib/utilization";
import type {
  EquipmentType,
  GlobalFilters,
  ProductType,
  ProductionRecord,
  WorkPattern,
} from "@/types";
import type {
  MonthlyKpiPptSnapshot,
  PptEfficiencySummary,
  PptKpiRow,
  PptProdMonthSummary,
  PptRankRow,
} from "@/lib/ppt/types";

function previousYearMonth(yearMonth: string): string {
  return format(subMonths(parseISO(`${yearMonth}-01`), 1), "yyyy-MM");
}

function shortMonthLabel(yearMonth: string): string {
  return format(parseISO(`${yearMonth}-01`), "M월");
}

function round1(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function averageNullable(
  values: Array<number | null | undefined>,
): number | null {
  const nums = values.filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (!nums.length) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

function monthScoped(
  filters: GlobalFilters,
  yearMonth: string,
): GlobalFilters {
  const range = monthDateRange(yearMonth);
  return {
    ...filters,
    datePreset: "custom",
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

function filterByEqType(
  list: ProductionRecord[],
  equipmentType: "전체" | EquipmentType,
): ProductionRecord[] {
  if (equipmentType === "전체") return list;
  return list.filter(
    (r) => inferEquipmentType(r.equipmentName) === equipmentType,
  );
}

function monthRecordsFor(
  records: ProductionRecord[],
  filters: GlobalFilters,
  yearMonth: string,
  equipmentType: "전체" | EquipmentType = "전체",
): ProductionRecord[] {
  return filterByEqType(
    filterRecords(records, monthScoped(filters, yearMonth)),
    equipmentType,
  );
}

function buildOverview(
  records: ProductionRecord[],
  filters: GlobalFilters,
  yearMonth: string,
  workPattern: WorkPattern | "전체",
  equipmentType: "전체" | EquipmentType,
) {
  const scoped = monthScoped(filters, yearMonth);
  const list = filterByEqType(filterRecords(records, scoped), equipmentType);
  const range = monthDateRange(yearMonth);
  return buildUtilizationOverviewBundle(list, scoped, {
    workPattern,
    metric: "time",
    targetSettings: loadTargetMinutes(),
    targetShotTable: loadTargetShotCounts(),
    startDate: range.startDate,
    endDate: range.endDate,
  });
}

function mttrSummaryFor(
  records: ProductionRecord[],
  filters: GlobalFilters,
  yearMonth: string,
  equipmentType: "전체" | EquipmentType,
): EquipmentFamilyMttrMtbfSummaryTable {
  const list = monthRecordsFor(records, filters, yearMonth, equipmentType);
  return buildEquipmentFamilyMttrMtbfSummary(
    buildEquipmentReliabilityTable(list),
  );
}

function kpiFromOverview(
  yearMonth: string,
  overview: UtilizationOverview,
  mttrMtbfSummary: EquipmentFamilyMttrMtbfSummaryTable,
  scope: "ALL" | ProductType = "ALL",
): PptKpiRow {
  const monthLabel = format(parseISO(`${yearMonth}-01`), "yyyy년 M월");
  const gKey = `${monthLabel}::GROMMET`;
  const sKey = `${monthLabel}::SEAL`;
  const gYield =
    loadManualYieldPercent(gKey) ?? overview.grommet.yieldPercent;
  const sYield = loadManualYieldPercent(sKey) ?? overview.seal.yieldPercent;

  let performance: number | null;
  let time: number | null;
  let yieldPercent: number | null;
  let mttrRows: Array<{ mttrMinutes: number | null; referenceMtbfHours: number | null }>;

  if (scope === "GROMMET") {
    performance = overview.grommet.performancePercent;
    time = overview.grommet.timePercent;
    yieldPercent = gYield;
    mttrRows = [
      ...mttrMtbfSummary.grommet.press,
      ...mttrMtbfSummary.grommet.injection,
    ];
  } else if (scope === "SEAL") {
    performance = overview.seal.performancePercent;
    time = overview.seal.timePercent;
    yieldPercent = sYield;
    mttrRows = [
      ...mttrMtbfSummary.seal.press,
      ...mttrMtbfSummary.seal.injection,
    ];
  } else {
    performance = overview.allProducts.performancePercent;
    time = overview.allProducts.timePercent;
    yieldPercent = combineProductYieldPercent(
      overview.grommet.productionQuantity,
      gYield,
      overview.seal.productionQuantity,
      sYield,
    );
    mttrRows = [
      ...mttrMtbfSummary.grommet.press,
      ...mttrMtbfSummary.grommet.injection,
      ...mttrMtbfSummary.seal.press,
      ...mttrMtbfSummary.seal.injection,
    ];
  }

  const oee = computeOeePercent(time, performance, yieldPercent);
  return {
    yearMonth,
    monthNum: Number(yearMonth.slice(5, 7)),
    label: shortMonthLabel(yearMonth),
    oee: round1(oee),
    performance: round1(performance),
    time: round1(time),
    yieldRate: round1(yieldPercent),
    mttr: round1(averageNullable(mttrRows.map((r) => r.mttrMinutes))),
    mtbf: round1(averageNullable(mttrRows.map((r) => r.referenceMtbfHours))),
  };
}

function prodSummary(
  records: ProductionRecord[],
  filters: GlobalFilters,
  yearMonth: string,
  productType: ProductType,
  equipmentType: "전체" | EquipmentType,
): PptProdMonthSummary {
  const range = monthDateRange(yearMonth);
  // 화면 생산변동 추이와 동일: record.productType 기준
  const list = filterByEqType(
    filterRecords(records, {
      ...monthScoped(filters, yearMonth),
      productType,
    }),
    equipmentType,
  );
  const point = buildMonthlyDashboardTrends(
    list,
    range.startDate,
    range.endDate,
    "month",
  )[0];
  return {
    yearMonth,
    monthNum: Number(yearMonth.slice(5, 7)),
    partKindCount: point?.partKindCount ?? 0,
    productionQuantity: point?.productionQuantity ?? 0,
    avgShot: point?.avgShot ?? 0,
    dailyAvgShots: point?.dailyAvgShots ?? 0,
  };
}

/** 전년 12월 ~ 당해 12월 (조회월 이후는 축만 두고 값은 비움) */
function yearWindowLabels(year: number): {
  labels: string[];
  yearMonths: string[];
} {
  const prev = year - 1;
  const labels = [`${String(prev).slice(2)}년 12월`];
  const yearMonths = [`${prev}-12`];
  for (let m = 1; m <= 12; m += 1) {
    labels.push(`${m}월`);
    yearMonths.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return { labels, yearMonths };
}

/**
 * @param classify equipment=설비라인(비가동), product=record.productType(생산변동)
 */
function monthlyMetricSeries(
  records: ProductionRecord[],
  filters: GlobalFilters,
  year: number,
  throughMonth: number,
  productType: ProductType | "ALL",
  equipmentType: "전체" | EquipmentType,
  classify: "equipment" | "product",
): {
  downtimeMinutes: number[];
  productionQuantity: number[];
  partKindCount: number[];
  avgShot: number[];
  labels: string[];
  /** 조회월 카테고리 인덱스 (0=전년12월, 1=1월 …) */
  queryMonthIndex: number;
} {
  const { labels, yearMonths } = yearWindowLabels(year);
  const queryMonthIndex = Math.min(12, Math.max(1, throughMonth));
  const downtimeMinutes: number[] = [];
  const productionQuantity: number[] = [];
  const partKindCount: number[] = [];
  const avgShot: number[] = [];

  for (let i = 0; i < yearMonths.length; i += 1) {
    // 조회월 이후: 선·점이 이어지지 않도록 NaN (축 라벨만 유지)
    if (i > queryMonthIndex) {
      downtimeMinutes.push(Number.NaN);
      productionQuantity.push(Number.NaN);
      partKindCount.push(Number.NaN);
      avgShot.push(Number.NaN);
      continue;
    }
    const ym = yearMonths[i]!;
    const range = monthDateRange(ym);
    const productFilter =
      classify === "product" && productType !== "ALL" ? productType : "전체";
    let list = filterByEqType(
      filterRecords(records, {
        ...filters,
        datePreset: "custom",
        startDate: range.startDate,
        endDate: range.endDate,
        productType: productFilter,
      }),
      equipmentType,
    );
    if (classify === "equipment" && productType !== "ALL") {
      list = filterByEquipmentProductLine(list, productType);
    }
    const point = buildMonthlyDashboardTrends(
      list,
      range.startDate,
      range.endDate,
      "month",
    )[0];
    downtimeMinutes.push(point?.downtimeMinutes ?? 0);
    productionQuantity.push(point?.productionQuantity ?? 0);
    partKindCount.push(point?.partKindCount ?? 0);
    avgShot.push(point?.avgShot ?? 0);
  }

  return {
    downtimeMinutes,
    productionQuantity,
    partKindCount,
    avgShot,
    labels,
    queryMonthIndex,
  };
}

function dailyQty(
  records: ProductionRecord[],
  filters: GlobalFilters,
  yearMonth: string,
  productType: ProductType,
  equipmentType: "전체" | EquipmentType,
): { days: number[]; quantities: number[] } {
  const range = monthDateRange(yearMonth);
  const list = filterByEqType(
    filterRecords(records, {
      ...monthScoped(filters, yearMonth),
      productType,
    }),
    equipmentType,
  );
  const points = buildMonthlyDashboardTrends(
    list,
    range.startDate,
    range.endDate,
    "day",
  );
  const days = points.map((_, i) => i + 1);
  const quantities = points.map((p) => p.productionQuantity);
  while (days.length < 31) {
    days.push(days.length + 1);
    quantities.push(0);
  }
  return { days: days.slice(0, 31), quantities: quantities.slice(0, 31) };
}

function partQtyTop(
  records: ProductionRecord[],
  filters: GlobalFilters,
  yearMonth: string,
  productType: ProductType,
  equipmentType: "전체" | EquipmentType,
  limit = 10,
): PptRankRow[] {
  const scopedRecords = filterByEqType(
    filterRecords(records, monthScoped(filters, yearMonth)),
    equipmentType,
  );
  const rows = aggregateProductPerformance(scopedRecords, {
    ...monthScoped(filters, yearMonth),
    productType,
  })
    .filter((r) => r.productionQuantity > 0)
    .sort((a, b) => b.productionQuantity - a.productionQuantity)
    .slice(0, limit);
  const total = rows.reduce((s, r) => s + r.productionQuantity, 0) || 1;
  return rows.map((r) => ({
    name: r.partNumber,
    value: r.productionQuantity,
    sharePercent: (r.productionQuantity / total) * 100,
  }));
}

function operatorQtyTop(
  records: ProductionRecord[],
  filters: GlobalFilters,
  yearMonth: string,
  productType: ProductType,
  equipmentType: "전체" | EquipmentType,
  limit = 10,
): PptRankRow[] {
  const scopedRecords = filterByEqType(
    filterRecords(records, monthScoped(filters, yearMonth)),
    equipmentType,
  );
  const rows = aggregateOperators(scopedRecords, {
    ...monthScoped(filters, yearMonth),
    productType,
  })
    .filter((r) => r.kpi.productionQuantity > 0)
    .sort((a, b) => b.kpi.productionQuantity - a.kpi.productionQuantity)
    .slice(0, limit);
  const total = rows.reduce((s, r) => s + r.kpi.productionQuantity, 0) || 1;
  return rows.map((r) => ({
    name: r.name,
    value: r.kpi.productionQuantity,
    sharePercent: (r.kpi.productionQuantity / total) * 100,
  }));
}

function efficiencyFor(
  records: ProductionRecord[],
  filters: GlobalFilters,
  yearMonth: string,
  productType: ProductType,
  equipmentType: "전체" | EquipmentType,
): PptEfficiencySummary {
  const scopedRecords = filterByEqType(
    filterRecords(records, monthScoped(filters, yearMonth)),
    equipmentType,
  );
  const rows = aggregateProductPerformance(scopedRecords, {
    ...monthScoped(filters, yearMonth),
    productType,
  });
  const elapsedMinutes = rows.reduce((s, r) => s + r.elapsedMinutes, 0);
  const operatingMinutes = rows.reduce((s, r) => s + r.operatingMinutes, 0);
  const shotCount = rows.reduce((s, r) => s + r.shotCount, 0);
  const workDaysSum = rows.reduce((s, r) => s + r.workDays, 0);
  const downtimeTop = [...rows]
    .filter((r) => r.downtimeMinutes > 0)
    .sort((a, b) => b.downtimeMinutes - a.downtimeMinutes)
    .slice(0, 5)
    .map((r) => ({
      name: r.partNumber,
      value: r.downtimeMinutes,
      sharePercent: 0,
    }));
  const workTimeTop = [...rows]
    .filter((r) => r.elapsedMinutes > 0)
    .sort((a, b) => b.elapsedMinutes - a.elapsedMinutes)
    .slice(0, 5)
    .map((r) => ({
      name: r.partNumber,
      value: r.elapsedMinutes,
      sharePercent: 0,
    }));
  return {
    elapsedMinutes,
    operatingMinutes,
    shotCount,
    dailyAvgShots: workDaysSum > 0 ? shotCount / workDaysSum : 0,
    downtimeTop,
    workTimeTop,
  };
}

function downtimeTables(
  records: ProductionRecord[],
  filters: GlobalFilters,
  yearMonth: string,
  previous: string,
  productType: ProductType,
  equipmentType: "전체" | EquipmentType,
) {
  const curRange = monthDateRange(yearMonth);
  const prevRange = monthDateRange(previous);
  const curList = filterByEquipmentProductLine(
    filterByEqType(
      filterRecords(records, {
        ...monthScoped(filters, yearMonth),
        productType: "전체",
      }),
      equipmentType,
    ),
    productType,
  );
  const prevList = filterByEquipmentProductLine(
    filterByEqType(
      filterRecords(records, {
        ...monthScoped(filters, previous),
        productType: "전체",
      }),
      equipmentType,
    ),
    productType,
  );
  return {
    current: buildPeriodReasonTable(
      curList,
      curRange.startDate,
      curRange.endDate,
    ),
    previous: buildPeriodReasonTable(
      prevList,
      prevRange.startDate,
      prevRange.endDate,
    ),
  };
}

/** 월별 KPI 화면과 동일 계산 경로로 PPT 스냅샷을 만든다. */
export function buildMonthlyKpiPptSnapshot(options: {
  yearMonth: string;
  records: ProductionRecord[];
  filters: GlobalFilters;
  workPattern?: WorkPattern | "전체";
  equipmentType?: "전체" | EquipmentType;
}): MonthlyKpiPptSnapshot {
  const { yearMonth, records, filters } = options;
  const workPattern = options.workPattern ?? "전체";
  const equipmentType = options.equipmentType ?? "전체";
  const previous = previousYearMonth(yearMonth);
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));

  const curBundle = buildOverview(
    records,
    filters,
    yearMonth,
    workPattern,
    equipmentType,
  );
  const prevBundle = buildOverview(
    records,
    filters,
    previous,
    workPattern,
    equipmentType,
  );
  const curMttr = mttrSummaryFor(records, filters, yearMonth, equipmentType);
  const prevMttr = mttrSummaryFor(records, filters, previous, equipmentType);

  const monthLabel = format(parseISO(`${yearMonth}-01`), "yyyy년 M월");
  const fileName = `${format(parseISO(`${yearMonth}-01`), "yyyy년 MM월")} 월간 생산현황.pptx`;

  return {
    yearMonth,
    previousYearMonth: previous,
    year,
    month,
    monthLabel,
    fileName,
    kpiPrev: kpiFromOverview(previous, prevBundle.overview, prevMttr, "ALL"),
    kpiCurrent: kpiFromOverview(
      yearMonth,
      curBundle.overview,
      curMttr,
      "ALL",
    ),
    kpiPrevGrommet: kpiFromOverview(
      previous,
      prevBundle.overview,
      prevMttr,
      "GROMMET",
    ),
    kpiCurrentGrommet: kpiFromOverview(
      yearMonth,
      curBundle.overview,
      curMttr,
      "GROMMET",
    ),
    kpiPrevSeal: kpiFromOverview(
      previous,
      prevBundle.overview,
      prevMttr,
      "SEAL",
    ),
    kpiCurrentSeal: kpiFromOverview(
      yearMonth,
      curBundle.overview,
      curMttr,
      "SEAL",
    ),
    overview: curBundle.overview,
    equipmentByProduct: curBundle.equipmentByProduct,
    mttrMtbfSummary: curMttr,
    downtime: {
      GROMMET: downtimeTables(
        records,
        filters,
        yearMonth,
        previous,
        "GROMMET",
        equipmentType,
      ),
      SEAL: downtimeTables(
        records,
        filters,
        yearMonth,
        previous,
        "SEAL",
        equipmentType,
      ),
    },
    monthlyTrends: {
      ALL: monthlyMetricSeries(
        records,
        filters,
        year,
        month,
        "ALL",
        equipmentType,
        "equipment",
      ),
      GROMMET: monthlyMetricSeries(
        records,
        filters,
        year,
        month,
        "GROMMET",
        equipmentType,
        "equipment",
      ),
      SEAL: monthlyMetricSeries(
        records,
        filters,
        year,
        month,
        "SEAL",
        equipmentType,
        "equipment",
      ),
    },
    productionTrends: {
      GROMMET: (() => {
        const s = monthlyMetricSeries(
          records,
          filters,
          year,
          month,
          "GROMMET",
          equipmentType,
          "product",
        );
        return {
          labels: s.labels,
          productionQuantity: s.productionQuantity,
          partKindCount: s.partKindCount,
          avgShot: s.avgShot,
          queryMonthIndex: s.queryMonthIndex,
        };
      })(),
      SEAL: (() => {
        const s = monthlyMetricSeries(
          records,
          filters,
          year,
          month,
          "SEAL",
          equipmentType,
          "product",
        );
        return {
          labels: s.labels,
          productionQuantity: s.productionQuantity,
          partKindCount: s.partKindCount,
          avgShot: s.avgShot,
          queryMonthIndex: s.queryMonthIndex,
        };
      })(),
    },
    productionSummary: {
      GROMMET: {
        previous: prodSummary(
          records,
          filters,
          previous,
          "GROMMET",
          equipmentType,
        ),
        current: prodSummary(
          records,
          filters,
          yearMonth,
          "GROMMET",
          equipmentType,
        ),
      },
      SEAL: {
        previous: prodSummary(
          records,
          filters,
          previous,
          "SEAL",
          equipmentType,
        ),
        current: prodSummary(
          records,
          filters,
          yearMonth,
          "SEAL",
          equipmentType,
        ),
      },
    },
    dailyProduction: {
      GROMMET: dailyQty(
        records,
        filters,
        yearMonth,
        "GROMMET",
        equipmentType,
      ),
      SEAL: dailyQty(records, filters, yearMonth, "SEAL", equipmentType),
    },
    partQtyTop: {
      GROMMET: partQtyTop(
        records,
        filters,
        yearMonth,
        "GROMMET",
        equipmentType,
      ),
      SEAL: partQtyTop(records, filters, yearMonth, "SEAL", equipmentType),
    },
    operatorQtyTop: {
      GROMMET: operatorQtyTop(
        records,
        filters,
        yearMonth,
        "GROMMET",
        equipmentType,
      ),
      SEAL: operatorQtyTop(
        records,
        filters,
        yearMonth,
        "SEAL",
        equipmentType,
      ),
    },
    efficiency: {
      GROMMET: efficiencyFor(
        records,
        filters,
        yearMonth,
        "GROMMET",
        equipmentType,
      ),
      SEAL: efficiencyFor(
        records,
        filters,
        yearMonth,
        "SEAL",
        equipmentType,
      ),
    },
    dailyTrendPoints: {
      GROMMET: buildMonthlyDashboardTrends(
        filterByEquipmentProductLine(
          monthRecordsFor(records, filters, yearMonth, equipmentType),
          "GROMMET",
        ),
        monthDateRange(yearMonth).startDate,
        monthDateRange(yearMonth).endDate,
        "day",
      ),
      SEAL: buildMonthlyDashboardTrends(
        filterByEquipmentProductLine(
          monthRecordsFor(records, filters, yearMonth, equipmentType),
          "SEAL",
        ),
        monthDateRange(yearMonth).startDate,
        monthDateRange(yearMonth).endDate,
        "day",
      ),
    },
  };
}

export function normalizeEquipmentLabel(name: string): string {
  const t = name.trim().toUpperCase().replace(/\s+/g, "");
  const fam = t.match(/^(GP|PG|PS)-?(\d+)/);
  if (fam) {
    return `${fam[1]}-${String(Number(fam[2])).padStart(2, "0")}`;
  }
  const p = t.match(/^P-?(\d+)$/);
  if (p) return `P-${String(Number(p[1])).padStart(2, "0")}`;
  const inn = t.match(/^IN-?(\d+)$/);
  if (inn) return `IN-${String(Number(inn[1])).padStart(2, "0")}`;
  return t;
}

