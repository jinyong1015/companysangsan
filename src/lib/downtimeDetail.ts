import * as XLSX from "xlsx";
import { eachDayOfInterval, format, getDay, parseISO } from "date-fns";
import type { Factory, ProductionRecord } from "@/types";
import { downloadArrayBuffer } from "@/lib/excelParse";
import { toDateString } from "@/lib/dates";
import { parseGpPgFamily } from "@/lib/utilization";

/** 사유 기준표에 기본 등록된 비가동 사유 (복합·기타 제외) */
export const BASE_DOWNTIME_REASON_COLUMNS = [
  "금형교체",
  "금형세척",
  "설비이상",
  "고무이상",
  "근태변경",
  "제품이상",
] as const;

export const COMPOSITE_REASON = "복합 사유";
export const OTHER_REASON = "기타";

export const MTTR_UNAVAILABLE_HINT =
  "선택한 조건에서 설비이상이 포함된 고장 데이터가 없습니다.";

export type ReasonMinutesMap = Record<string, number>;
export type ReasonCountMap = Record<string, number>;

export interface DowntimeDetailSelection {
  date: string | null;
  reason: string | null;
  equipmentId: string | null;
}

export interface PeriodReasonDayRow {
  date: string;
  label: string;
  dayOfWeek: number;
  isSunday: boolean;
  isSaturday: boolean;
  byReason: ReasonMinutesMap;
  dailyMinutes: number;
  dailyCount: number;
}

export interface PeriodReasonSummary {
  minutesByReason: ReasonMinutesMap;
  minutesRankByReason: Record<string, number | null>;
  countByReason: ReasonCountMap;
  countRankByReason: Record<string, number | null>;
  totalMinutes: number;
  totalCount: number;
}

export interface PeriodReasonTable {
  reasonColumns: string[];
  days: PeriodReasonDayRow[];
  summary: PeriodReasonSummary;
}

export interface EquipmentReliabilityRow {
  kind: "equipment" | "factorySubtotal" | "grandTotal";
  factory: Factory | "전체";
  equipmentId: string | null;
  equipmentName: string;
  byReason: ReasonMinutesMap;
  totalDowntimeMinutes: number;
  totalDowntimeHours: number;
  downtimeEventCount: number;
  failureCount: number;
  mttrTargetMinutes: number;
  mttrTargetCount: number;
  operatingHours: number;
  mttrMinutes: number | null;
  referenceMtbfHours: number | null;
}

export interface EquipmentReliabilityTable {
  reasonColumns: string[];
  rows: EquipmentReliabilityRow[];
}

/** GP/PG/PS 호기 평균 셀 (가동률 현황 호기 평균과 동일: 값 있는 호기만 산술 평균) */
export interface EquipmentFamilyAverageSpan {
  equipmentId: string;
  /** 0이면 앞 행 rowspan에 포함되어 셀 생략 */
  rowSpan: number;
  mttrMinutes: number | null;
  referenceMtbfHours: number | null;
  familyLabel: string | null;
}

export function averageNullable(
  values: Array<number | null | undefined>,
): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

/**
 * 가동률 현황 `호기 평균`과 동일하게 GP/PG/PS 계열을 묶어
 * MTTR·MTBF가 있는 호기만 산술 평균한다. 비계열 설비는 "-" 처리용 null.
 */
export function buildEquipmentFamilyAverageSpans(
  equipmentRows: EquipmentReliabilityRow[],
): Map<string, EquipmentFamilyAverageSpan> {
  const spans = new Map<string, EquipmentFamilyAverageSpan>();
  let i = 0;
  while (i < equipmentRows.length) {
    const row = equipmentRows[i]!;
    const id = row.equipmentId;
    if (!id) {
      i += 1;
      continue;
    }
    const family = parseGpPgFamily(row.equipmentName);
    if (!family) {
      spans.set(id, {
        equipmentId: id,
        rowSpan: 1,
        mttrMinutes: null,
        referenceMtbfHours: null,
        familyLabel: null,
      });
      i += 1;
      continue;
    }

    const members = [row];
    let j = i + 1;
    while (j < equipmentRows.length) {
      const next = equipmentRows[j]!;
      if (next.factory !== row.factory) break;
      if (parseGpPgFamily(next.equipmentName) !== family) break;
      members.push(next);
      j += 1;
    }

    const mttrMinutes = averageNullable(members.map((m) => m.mttrMinutes));
    const referenceMtbfHours = averageNullable(
      members.map((m) => m.referenceMtbfHours),
    );
    const firstId = members[0]!.equipmentId!;
    spans.set(firstId, {
      equipmentId: firstId,
      rowSpan: members.length,
      mttrMinutes,
      referenceMtbfHours,
      familyLabel: family,
    });
    for (let k = 1; k < members.length; k += 1) {
      const mid = members[k]!.equipmentId!;
      spans.set(mid, {
        equipmentId: mid,
        rowSpan: 0,
        mttrMinutes: null,
        referenceMtbfHours: null,
        familyLabel: family,
      });
    }
    i = j;
  }
  return spans;
}

export function isDowntimeEvent(record: ProductionRecord): boolean {
  return (
    record.isAnalysisEligible &&
    record.downtimeMinutes > 0 &&
    Boolean(record.downtimeReasonRaw?.trim()) &&
    record.reasonTokens.length > 0
  );
}

/** 원천·기준표에 등장한 단일·복합 사유의 개별 토큰을 동적 컬럼으로 승격 */
export function discoverExtraReasonColumns(records: ProductionRecord[]): string[] {
  const base = new Set<string>(BASE_DOWNTIME_REASON_COLUMNS);
  const found = new Set<string>();
  for (const r of records) {
    if (!isDowntimeEvent(r)) continue;
    for (const token of r.reasonTokens) {
      if (!base.has(token) && token !== COMPOSITE_REASON && token !== OTHER_REASON) {
        found.add(token);
      }
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b, "ko"));
}

export function buildReasonColumns(records: ProductionRecord[]): string[] {
  return [
    ...BASE_DOWNTIME_REASON_COLUMNS,
    ...discoverExtraReasonColumns(records),
  ];
}

/**
 * 복합 사유는 개별 사유로 분리한다.
 * 알려진 사유만 컬럼에 매핑하고, 알 수 없는 단일 토큰만 기타로 보낸다.
 */
export function resolveReasonBuckets(
  tokens: string[],
  reasonColumns: string[],
): string[] {
  const known = new Set(reasonColumns);
  known.delete(COMPOSITE_REASON);
  known.delete(OTHER_REASON);

  if (tokens.length === 0) {
    return reasonColumns.includes(OTHER_REASON) ? [OTHER_REASON] : [];
  }

  const buckets: string[] = [];
  for (const token of tokens) {
    if (known.has(token)) {
      buckets.push(token);
    } else if (reasonColumns.includes(OTHER_REASON)) {
      buckets.push(OTHER_REASON);
    }
  }
  return [...new Set(buckets)];
}

/** @deprecated 복합은 resolveReasonBuckets로 분리. 단일 버킷이 필요할 때만 사용 */
export function classifyReasonBucket(
  tokens: string[],
  reasonColumns: string[],
): string {
  const buckets = resolveReasonBuckets(tokens, reasonColumns);
  if (buckets.length === 0) return OTHER_REASON;
  if (buckets.length === 1) return buckets[0]!;
  return COMPOSITE_REASON;
}

export function matchesReasonBucket(
  record: ProductionRecord,
  reason: string,
  reasonColumns: string[],
): boolean {
  if (reason === COMPOSITE_REASON) return record.reasonTokens.length >= 2;
  return resolveReasonBuckets(record.reasonTokens, reasonColumns).includes(reason);
}

export function emptyReasonMap(columns: string[]): ReasonMinutesMap {
  return Object.fromEntries(columns.map((c) => [c, 0]));
}

/** 큰 값부터 순위. 동점은 동일 순위(경쟁 순위: 1,2,2,4). */
export function rankDescending(values: Record<string, number>): Record<string, number | null> {
  const entries = Object.entries(values).filter(([, v]) => v > 0);
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
  const ranks: Record<string, number | null> = {};
  for (const key of Object.keys(values)) ranks[key] = null;
  let i = 0;
  while (i < entries.length) {
    const value = entries[i]![1];
    const rank = i + 1;
    let j = i;
    while (j < entries.length && entries[j]![1] === value) {
      ranks[entries[j]![0]] = rank;
      j += 1;
    }
    i = j;
  }
  return ranks;
}

function dateLabel(iso: string): string {
  const d = parseISO(iso);
  return format(d, "MM월 dd일");
}

export function applyDetailSelection(
  records: ProductionRecord[],
  selection: DowntimeDetailSelection,
  reasonColumns: string[],
): ProductionRecord[] {
  return records.filter((r) => {
    if (selection.date && r.workDate !== selection.date) return false;
    if (selection.equipmentId && r.equipmentId !== selection.equipmentId) {
      return false;
    }
    if (selection.reason) {
      if (!isDowntimeEvent(r)) return false;
      if (!matchesReasonBucket(r, selection.reason, reasonColumns)) return false;
    }
    return true;
  });
}

export function buildPeriodReasonTable(
  records: ProductionRecord[],
  startDate: string,
  endDate: string,
): PeriodReasonTable {
  const reasonColumns = buildReasonColumns(records);
  const events = records.filter(isDowntimeEvent);

  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).map((d) => {
    const iso = toDateString(d);
    const dow = getDay(d);
    return {
      date: iso,
      label: dateLabel(iso),
      dayOfWeek: dow,
      isSunday: dow === 0,
      isSaturday: dow === 6,
      byReason: emptyReasonMap(reasonColumns),
      dailyMinutes: 0,
      dailyCount: 0,
    } satisfies PeriodReasonDayRow;
  });

  const byDate = new Map(days.map((row) => [row.date, row]));

  for (const r of events) {
    const row = byDate.get(r.workDate);
    if (!row) continue;
    const buckets = resolveReasonBuckets(r.reasonTokens, reasonColumns);
    const share =
      buckets.length > 0 ? r.downtimeMinutes / buckets.length : 0;
    for (const bucket of buckets) {
      row.byReason[bucket] = (row.byReason[bucket] ?? 0) + share;
    }
    row.dailyMinutes += r.downtimeMinutes;
    row.dailyCount += Math.max(buckets.length, 1);
  }

  const minutesByReason = emptyReasonMap(reasonColumns);
  const countByReason = emptyReasonMap(reasonColumns);
  let totalMinutes = 0;
  let totalCount = 0;

  for (const r of events) {
    if (r.workDate < startDate || r.workDate > endDate) continue;
    const buckets = resolveReasonBuckets(r.reasonTokens, reasonColumns);
    const share =
      buckets.length > 0 ? r.downtimeMinutes / buckets.length : 0;
    for (const bucket of buckets) {
      minutesByReason[bucket] = (minutesByReason[bucket] ?? 0) + share;
      countByReason[bucket] = (countByReason[bucket] ?? 0) + 1;
    }
    totalMinutes += r.downtimeMinutes;
    totalCount += Math.max(buckets.length, 1);
  }

  return {
    reasonColumns,
    days,
    summary: {
      minutesByReason,
      minutesRankByReason: rankDescending(minutesByReason),
      countByReason,
      countRankByReason: rankDescending(countByReason),
      totalMinutes,
      totalCount,
    },
  };
}

function aggregateReliabilityMetrics(
  records: ProductionRecord[],
  reasonColumns: string[],
  factory: Factory | "전체",
  equipmentId: string | null,
  equipmentName: string,
  kind: EquipmentReliabilityRow["kind"],
): EquipmentReliabilityRow {
  const byReason = emptyReasonMap(reasonColumns);
  let totalDowntimeMinutes = 0;
  let downtimeEventCount = 0;
  let failureCount = 0;
  let mttrTargetMinutes = 0;
  let mttrTargetCount = 0;
  let operatingMinutes = 0;

  for (const r of records) {
    if (!r.isAnalysisEligible) continue;
    operatingMinutes += r.operatingMinutes;

    if (isDowntimeEvent(r)) {
      const buckets = resolveReasonBuckets(r.reasonTokens, reasonColumns);
      const share =
        buckets.length > 0 ? r.downtimeMinutes / buckets.length : 0;
      for (const bucket of buckets) {
        byReason[bucket] = (byReason[bucket] ?? 0) + share;
      }
      totalDowntimeMinutes += r.downtimeMinutes;
      downtimeEventCount += Math.max(buckets.length, 1);
    }

    if (r.isAnalysisEligible && r.reasonTokens.includes("설비이상")) {
      failureCount += 1;
      mttrTargetMinutes += r.downtimeMinutes;
      mttrTargetCount += 1;
    }
  }

  return {
    kind,
    factory,
    equipmentId,
    equipmentName,
    byReason,
    totalDowntimeMinutes,
    totalDowntimeHours: totalDowntimeMinutes / 60,
    downtimeEventCount,
    failureCount,
    mttrTargetMinutes,
    mttrTargetCount,
    operatingHours: operatingMinutes / 60,
    mttrMinutes: mttrTargetCount > 0 ? mttrTargetMinutes / mttrTargetCount : null,
    referenceMtbfHours:
      failureCount > 0 ? operatingMinutes / failureCount / 60 : null,
  };
}

const FACTORY_ORDER: Factory[] = ["본사", "2공장"];

export function buildEquipmentReliabilityTable(
  records: ProductionRecord[],
): EquipmentReliabilityTable {
  const reasonColumns = buildReasonColumns(records);
  const eligible = records.filter((r) => r.isAnalysisEligible);

  const byEquipment = new Map<string, ProductionRecord[]>();
  for (const r of eligible) {
    const list = byEquipment.get(r.equipmentId) ?? [];
    list.push(r);
    byEquipment.set(r.equipmentId, list);
  }

  const equipmentRows: EquipmentReliabilityRow[] = [...byEquipment.entries()]
    .map(([id, rows]) => {
      const first = rows[0]!;
      return aggregateReliabilityMetrics(
        rows,
        reasonColumns,
        first.factory,
        id,
        first.equipmentName,
        "equipment",
      );
    })
    .sort((a, b) => {
      const fa = FACTORY_ORDER.indexOf(a.factory as Factory);
      const fb = FACTORY_ORDER.indexOf(b.factory as Factory);
      if (fa !== fb) return fa - fb;
      return a.equipmentName.localeCompare(b.equipmentName, "ko");
    });

  const rows: EquipmentReliabilityRow[] = [];
  for (const factory of FACTORY_ORDER) {
    const group = equipmentRows.filter((r) => r.factory === factory);
    if (group.length === 0) continue;
    rows.push(...group);
    const factoryRecords = eligible.filter((r) => r.factory === factory);
    const subtotal = aggregateReliabilityMetrics(
      factoryRecords,
      reasonColumns,
      factory,
      null,
      `${factory} 소계`,
      "factorySubtotal",
    );
    rows.push({
      ...subtotal,
      mttrMinutes: averageNullable(group.map((r) => r.mttrMinutes)),
      referenceMtbfHours: averageNullable(group.map((r) => r.referenceMtbfHours)),
    });
  }

  if (eligible.length > 0) {
    const grand = aggregateReliabilityMetrics(
      eligible,
      reasonColumns,
      "전체",
      null,
      "전체 합계",
      "grandTotal",
    );
    rows.push({
      ...grand,
      mttrMinutes: averageNullable(equipmentRows.map((r) => r.mttrMinutes)),
      referenceMtbfHours: averageNullable(
        equipmentRows.map((r) => r.referenceMtbfHours),
      ),
    });
  }

  return { reasonColumns, rows };
}

/** 비가동시간 강조색 단계 (0=없음, 1~4=강도) */
export function downtimeHeatLevel(minutes: number, maxMinutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0 || maxMinutes <= 0) return 0;
  const ratio = minutes / maxMinutes;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

export function periodTitle(productType: "전체" | "GROMMET" | "SEAL"): string {
  if (productType === "전체") return "전체 기간별 비가동 사유 현황";
  return `${productType} 기간별 비가동 사유 현황`;
}

export function equipmentReliabilityTitle(
  productType: "전체" | "GROMMET" | "SEAL",
): string {
  if (productType === "전체") return "전체 설비별 비가동·신뢰성 현황";
  return `${productType} 설비별 비가동·신뢰성 현황`;
}

export type ProductTypeSummaryKey = "overall" | "grommet" | "seal";

export interface ProductTypeMetricPair {
  minutes: number;
  count: number;
}

export interface ProductTypeDaySummary {
  date: string;
  label: string;
  isSunday: boolean;
  isSaturday: boolean;
  overall: ProductTypeMetricPair;
  grommet: ProductTypeMetricPair;
  seal: ProductTypeMetricPair;
}

export interface ProductTypeDowntimeSummaryTable {
  days: ProductTypeDaySummary[];
  totals: {
    overall: ProductTypeMetricPair;
    grommet: ProductTypeMetricPair;
    seal: ProductTypeMetricPair;
  };
}

/**
 * 제품유형별 비가동 요약.
 * 원본 행 기준(복합 사유 분리 없음): 시간은 행 비가동시간 1회, 횟수는 행 1건.
 */
export function buildProductTypeDowntimeSummary(
  records: ProductionRecord[],
  startDate: string,
  endDate: string,
): ProductTypeDowntimeSummaryTable {
  const events = records.filter(isDowntimeEvent);
  const emptyPair = (): ProductTypeMetricPair => ({ minutes: 0, count: 0 });

  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).map((d) => {
    const iso = toDateString(d);
    const dow = getDay(d);
    return {
      date: iso,
      label: dateLabel(iso),
      isSunday: dow === 0,
      isSaturday: dow === 6,
      overall: emptyPair(),
      grommet: emptyPair(),
      seal: emptyPair(),
    } satisfies ProductTypeDaySummary;
  });

  const byDate = new Map(days.map((row) => [row.date, row]));
  const totals = {
    overall: emptyPair(),
    grommet: emptyPair(),
    seal: emptyPair(),
  };

  for (const r of events) {
    if (r.workDate < startDate || r.workDate > endDate) continue;
    const row = byDate.get(r.workDate);
    if (!row) continue;

    const target =
      r.productType === "GROMMET"
        ? "grommet"
        : r.productType === "SEAL"
          ? "seal"
          : null;
    if (!target) continue;

    row[target].minutes += r.downtimeMinutes;
    row[target].count += 1;
    row.overall.minutes += r.downtimeMinutes;
    row.overall.count += 1;

    totals[target].minutes += r.downtimeMinutes;
    totals[target].count += 1;
    totals.overall.minutes += r.downtimeMinutes;
    totals.overall.count += 1;
  }

  return { days, totals };
}

function sheetFromAoa(name: string, aoa: (string | number)[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  return { name, sheet };
}

export function exportPeriodReasonExcel(
  table: PeriodReasonTable,
  title: string,
  fileName?: string,
) {
  const header = [
    "날짜",
    ...table.reasonColumns.map((c) => `${c}(분)`),
    "일일 비가동시간(분)",
    "일일 비가동횟수",
  ];
  const rows: (string | number)[][] = [header];
  for (const day of table.days) {
    rows.push([
      day.label,
      ...table.reasonColumns.map((c) => day.byReason[c] || "-"),
      day.dailyMinutes || "-",
      day.dailyCount || "-",
    ]);
  }
  const { summary } = table;
  rows.push([
    "사유별 비가동시간 합계",
    ...table.reasonColumns.map((c) => summary.minutesByReason[c] || "-"),
    summary.totalMinutes || "-",
    "",
  ]);
  rows.push([
    "사유별 비가동시간 순위",
    ...table.reasonColumns.map((c) => summary.minutesRankByReason[c] ?? "-"),
    "",
    "",
  ]);
  rows.push([
    "사유별 비가동 발생 횟수",
    ...table.reasonColumns.map((c) => summary.countByReason[c] || "-"),
    "",
    summary.totalCount || "-",
  ]);
  rows.push([
    "사유별 발생 횟수 순위",
    ...table.reasonColumns.map((c) => summary.countRankByReason[c] ?? "-"),
    "",
    "",
  ]);
  rows.push(["전체 비가동시간(분)", summary.totalMinutes]);
  rows.push(["전체 비가동 발생 횟수", summary.totalCount]);

  const { sheet } = sheetFromAoa(title.slice(0, 31), rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "기간별 비가동");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadArrayBuffer(buffer, fileName ?? `${title}.xlsx`);
}

export function exportEquipmentReliabilityExcel(
  table: EquipmentReliabilityTable,
  title: string,
  fileName?: string,
) {
  const header = [
    "공장",
    "설비명",
    ...table.reasonColumns.map((c) => `${c}(분)`),
    "月비가동시간(min)",
    "설비part 비가동시간(min)",
    "설비part 비가동시간(hr)",
    "발생건수",
    "정상 가동시간(hr)",
    "MTTR [설비복구시간](min)",
    "MTBF [고장간격시간](hr)",
    "호기 평균 MTTR [설비복구시간](min)",
    "호기 평균 MTBF [고장간격시간](hr)",
  ];
  const equipmentOnly = table.rows.filter((r) => r.kind === "equipment");
  const familySpans = buildEquipmentFamilyAverageSpans(equipmentOnly);
  const rows: (string | number)[][] = [header];
  for (const row of table.rows) {
    const family =
      row.kind === "equipment" && row.equipmentId
        ? familySpans.get(row.equipmentId)
        : null;
    const familyMttr =
      row.kind === "equipment"
        ? family && family.rowSpan > 0
          ? family.mttrMinutes
          : family?.rowSpan === 0
            ? ""
            : null
        : row.mttrMinutes;
    const familyMtbf =
      row.kind === "equipment"
        ? family && family.rowSpan > 0
          ? family.referenceMtbfHours
          : family?.rowSpan === 0
            ? ""
            : null
        : row.referenceMtbfHours;
    rows.push([
      row.factory,
      row.equipmentName,
      ...table.reasonColumns.map((c) => row.byReason[c] || "-"),
      row.totalDowntimeMinutes || "-",
      row.mttrTargetMinutes || "-",
      row.mttrTargetMinutes > 0
        ? Number((row.mttrTargetMinutes / 60).toFixed(1))
        : "-",
      row.mttrTargetCount || "-",
      row.operatingHours > 0 ? Number(row.operatingHours.toFixed(1)) : "-",
      row.mttrMinutes == null ? "-" : Number(row.mttrMinutes.toFixed(1)),
      row.referenceMtbfHours == null
        ? "-"
        : Number(row.referenceMtbfHours.toFixed(1)),
      familyMttr === ""
        ? ""
        : familyMttr == null
          ? "-"
          : Number(familyMttr.toFixed(1)),
      familyMtbf === ""
        ? ""
        : familyMtbf == null
          ? "-"
          : Number(familyMtbf.toFixed(1)),
    ]);
  }
  const { sheet } = sheetFromAoa(title.slice(0, 31), rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "설비별 신뢰성");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadArrayBuffer(buffer, fileName ?? `${title}.xlsx`);
}
