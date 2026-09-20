import type {
  GlobalFilters,
  Grain,
  KpiSummary,
  KpiWithCompare,
  ProductionRecord,
  ReasonShare,
  TrendPoint,
} from "@/types";
import { periodBuckets, previousPeriod } from "@/lib/dates";

export function emptyKpi(): KpiSummary {
  return {
    productionQuantity: 0,
    defectQuantity: 0,
    defectRatePercent: null,
    elapsedMinutes: 0,
    downtimeMinutes: 0,
    operatingMinutes: 0,
    utilizationRatePercent: null,
    uph: null,
    failureCount: 0,
    mttrEligibleCount: 0,
    mttrMinutes: null,
    referenceMtbfHours: null,
    validRows: 0,
  };
}

export function computeKpi(records: ProductionRecord[]): KpiSummary {
  const valid = records.filter((r) => r.isAnalysisEligible);
  if (valid.length === 0) return emptyKpi();

  const productionQuantity = valid.reduce((s, r) => s + r.productionQuantity, 0);
  const defectQuantity = valid.reduce((s, r) => s + r.defectQuantity, 0);
  const elapsedMinutes = valid.reduce((s, r) => s + r.elapsedMinutes, 0);
  const downtimeMinutes = valid.reduce((s, r) => s + r.downtimeMinutes, 0);
  const operatingMinutes = valid.reduce((s, r) => s + r.operatingMinutes, 0);
  const failureCount = valid.filter((r) =>
    r.reasonTokens.includes("설비이상"),
  ).length;
  const mttrEligible = valid.filter((r) =>
    r.reasonTokens.includes("설비이상"),
  );
  const mttrEligibleCount = mttrEligible.length;
  const mttrSum = mttrEligible.reduce((s, r) => s + r.downtimeMinutes, 0);

  const denom = productionQuantity + defectQuantity;
  const defectRatePercent = denom > 0 ? (defectQuantity / denom) * 100 : null;
  const utilizationRatePercent =
    elapsedMinutes > 0 ? (operatingMinutes / elapsedMinutes) * 100 : null;
  const uph = elapsedMinutes > 0 ? (productionQuantity / elapsedMinutes) * 60 : null;
  const mttrMinutes = mttrEligibleCount > 0 ? mttrSum / mttrEligibleCount : null;
  const referenceMtbfHours =
    failureCount > 0 ? operatingMinutes / failureCount / 60 : null;

  return {
    productionQuantity,
    defectQuantity,
    defectRatePercent,
    elapsedMinutes,
    downtimeMinutes,
    operatingMinutes,
    utilizationRatePercent,
    uph,
    failureCount,
    mttrEligibleCount,
    mttrMinutes,
    referenceMtbfHours,
    validRows: valid.length,
  };
}

export function withCompare(
  current: KpiSummary,
  previous: KpiSummary,
): KpiWithCompare {
  const pct = (cur: number, prev: number) =>
    prev === 0 ? null : ((cur - prev) / prev) * 100;

  return {
    ...current,
    previous,
    productionChangePercent: pct(current.productionQuantity, previous.productionQuantity),
    defectChangePercent: pct(current.defectQuantity, previous.defectQuantity),
    defectRateChangePp:
      current.defectRatePercent == null || previous.defectRatePercent == null
        ? null
        : current.defectRatePercent - previous.defectRatePercent,
    utilizationChangePp:
      current.utilizationRatePercent == null || previous.utilizationRatePercent == null
        ? null
        : current.utilizationRatePercent - previous.utilizationRatePercent,
    uphChangePercent:
      current.uph == null || previous.uph == null || previous.uph === 0
        ? null
        : ((current.uph - previous.uph) / previous.uph) * 100,
  };
}

export function matchesGlobalFilters(
  record: ProductionRecord,
  filters: GlobalFilters,
  options?: { includeErrors?: boolean; requireDowntime?: boolean },
): boolean {
  if (!options?.includeErrors && !record.isAnalysisEligible) return false;
  if (options?.requireDowntime && record.downtimeMinutes <= 0) return false;

  if (filters.factory !== "전체" && record.factory !== filters.factory) return false;
  if (filters.productType !== "전체" && record.productType !== filters.productType)
    return false;
  if (record.workDate < filters.startDate || record.workDate > filters.endDate)
    return false;
  if (
    filters.equipmentIds.length > 0 &&
    !filters.equipmentIds.includes(record.equipmentId)
  )
    return false;
  if (filters.partIds.length > 0 && !filters.partIds.includes(record.partId))
    return false;
  if (
    filters.operatorIds.length > 0 &&
    !filters.operatorIds.some(
      (id) => id.normalize("NFC") === record.operatorId.normalize("NFC"),
    )
  )
    return false;
  if (filters.moldIds.length > 0 && !filters.moldIds.includes(record.moldId))
    return false;
  if (filters.shiftType !== "전체" && record.shiftType !== filters.shiftType)
    return false;

  if (filters.downtimeReason !== "전체") {
    if (filters.downtimeReason === "복합 사유") {
      if (record.reasonTokens.length < 2) return false;
    } else if (!record.reasonTokens.includes(filters.downtimeReason)) {
      return false;
    }
  }

  return true;
}

export function filterRecords(
  records: ProductionRecord[],
  filters: GlobalFilters,
  options?: { includeErrors?: boolean; requireDowntime?: boolean },
): ProductionRecord[] {
  return records.filter((r) => matchesGlobalFilters(r, filters, options));
}

export function buildTrends(
  records: ProductionRecord[],
  startDate: string,
  endDate: string,
  grain: Grain,
): TrendPoint[] {
  const buckets = periodBuckets(startDate, endDate, grain);
  return buckets.map((b) => {
    const subset = records.filter(
      (r) => r.isAnalysisEligible && r.workDate >= b.start && r.workDate <= b.end,
    );
    const kpi = computeKpi(subset);
    return {
      period: b.period,
      label: b.label,
      productionQuantity: kpi.productionQuantity,
      defectQuantity: kpi.defectQuantity,
      elapsedMinutes: kpi.elapsedMinutes,
      downtimeMinutes: kpi.downtimeMinutes,
      operatingMinutes: kpi.operatingMinutes,
      utilizationRatePercent: kpi.utilizationRatePercent,
      uph: kpi.uph,
      failureCount: kpi.failureCount,
      validRows: kpi.validRows,
    };
  });
}

/** 대시보드 기간 추이: 생산량 · 품번 종류 · 평균 SHOT · 비가동시간(분) */
export type MonthlyDashboardPoint = {
  period: string;
  label: string;
  productionQuantity: number;
  partKindCount: number;
  /** 총 SHOT ÷ 가동시간(hr) */
  avgShot: number;
  /** 비가동시간 합계(분) */
  downtimeMinutes: number;
};

export function buildMonthlyDashboardTrends(
  records: ProductionRecord[],
  startDate: string,
  endDate: string,
  grain: "day" | "month" = "month",
): MonthlyDashboardPoint[] {
  const buckets = periodBuckets(startDate, endDate, grain);
  return buckets.map((b) => {
    const subset = records.filter(
      (r) => r.isAnalysisEligible && r.workDate >= b.start && r.workDate <= b.end,
    );
    const kpi = computeKpi(subset);
    const shotCount = subset.reduce((s, r) => s + r.shotCount, 0);
    const operatingHours = kpi.operatingMinutes / 60;
    return {
      period: b.period,
      label: b.label,
      productionQuantity: kpi.productionQuantity,
      partKindCount: new Set(
        subset.map((r) => r.partId).filter((id) => Boolean(id)),
      ).size,
      avgShot: operatingHours > 0 ? shotCount / operatingHours : 0,
      downtimeMinutes: kpi.downtimeMinutes,
    };
  });
}

export function downtimeReasonShares(records: ProductionRecord[]): ReasonShare[] {
  const withDt = records.filter(
    (r) => r.isAnalysisEligible && r.downtimeMinutes > 0 && r.reasonTokens.length > 0,
  );
  const map = new Map<string, { minutes: number; count: number }>();

  for (const r of withDt) {
    const tokens = r.reasonTokens;
    const share = tokens.length > 0 ? r.downtimeMinutes / tokens.length : 0;
    for (const key of tokens) {
      const cur = map.get(key) ?? { minutes: 0, count: 0 };
      cur.minutes += share;
      cur.count += 1;
      map.set(key, cur);
    }
  }

  const total = [...map.values()].reduce((s, v) => s + v.minutes, 0) || 1;
  return [...map.entries()]
    .map(([reason, v]) => ({
      reason,
      downtimeMinutes: v.minutes,
      sharePercent: (v.minutes / total) * 100,
      count: v.count,
    }))
    .sort((a, b) => b.downtimeMinutes - a.downtimeMinutes);
}

export function comparePeriodKpis(
  records: ProductionRecord[],
  filters: GlobalFilters,
): KpiWithCompare {
  const current = computeKpi(filterRecords(records, filters));
  const prev = previousPeriod(filters.startDate, filters.endDate);
  const previous = computeKpi(
    filterRecords(records, { ...filters, startDate: prev.startDate, endDate: prev.endDate }),
  );
  return withCompare(current, previous);
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    totalPages,
    page: safePage,
  };
}

export function sortBy<T>(
  items: T[],
  sort: string,
  order: "asc" | "desc",
  getters: Record<string, (item: T) => number | string | null | undefined>,
): T[] {
  const getter = getters[sort];
  if (!getter) return items;
  const dir = order === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv, "ko") * dir;
    }
    return ((av as number) - (bv as number)) * dir;
  });
}
