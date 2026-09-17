import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
} from "date-fns";
import * as XLSX from "xlsx";
import type {
  EquipmentType,
  GlobalFilters,
  PerformanceShiftPattern,
  ProductType,
  ProductionRecord,
  TargetMinutesSettings,
  TargetShotCountTable,
  UtilizationMetric,
  WorkPattern,
} from "@/types";
import { toDateString } from "@/lib/dates";
import { downloadArrayBuffer } from "@/lib/excelParse";
import { filterRecords } from "@/lib/metrics";

export const DEFAULT_TARGET_MINUTES: TargetMinutesSettings = {
  "주간+야간": 1280,
  연장: 620,
  주간: 540,
};

/** GROMMET·SEAL PRESS 기본 240/120. SEAL에는 INJECTION이 없음. */
export const DEFAULT_TARGET_SHOT_COUNTS: TargetShotCountTable = {
  GROMMET: {
    PRESS: { "주간+야간": 240, "단일 교대": 120 },
    INJECTION: { "주간+야간": 240, "단일 교대": 120 },
  },
  SEAL: {
    PRESS: { "주간+야간": 240, "단일 교대": 120 },
    INJECTION: { "주간+야간": null, "단일 교대": null },
  },
};

export type HeatmapTone = "blue" | "green" | "yellow" | "red" | "empty";

export type CellDisplayKind = "rate" | "empty" | "no-target";

export interface UtilizationCell {
  date: string;
  equipmentId: string;
  equipmentName: string;
  factory: string;
  equipmentType: EquipmentType;
  productTypes: ProductType[];
  /** 시간가동률용 근무형태 (연장 자동판정 없음) */
  workPattern: WorkPattern | null;
  /** 성능가동률용 교대 구분 */
  performanceShiftPattern: PerformanceShiftPattern | null;
  targetMinutes: number | null;
  targetShotCount: number | null;
  elapsedMinutes: number;
  downtimeMinutes: number;
  operatingMinutes: number;
  shotCount: number;
  productionQuantity: number;
  defectQuantity: number;
  failureCount: number;
  downtimeReasons: string[];
  /** 시간가동률 = 유효 가동시간 ÷ 목표 가동시간 × 100 */
  timeUtilizationPercent: number | null;
  /** 성능가동률 = 작업판수 ÷ 목표 작업판수 × 100 */
  performanceUtilizationPercent: number | null;
  /** 양품률 = 실적수량 ÷ (실적수량 + 불량수량) × 100 */
  yieldRatePercent: number | null;
  /** 종합설비효율(OEE) = 시간 × MIN(성능,100) × 양품 */
  oeePercent: number | null;
  /** 기존 가동률 = 가동시간 ÷ 작업시간 × 100 */
  utilizationRatePercent: number | null;
  hasData: boolean;
  /** 데이터는 있으나 목표가 없어 비율을 계산할 수 없음 */
  missingTarget: boolean;
  recordIds: string[];
}

/** 제품유형·설비유형 종합 지표 (합계 기준, 단순 평균 아님) */
export interface UtilizationMetricSummary {
  performancePercent: number | null;
  timePercent: number | null;
  yieldPercent: number | null;
  oeePercent: number | null;
  shotCount: number;
  targetShotCount: number | null;
  operatingMinutes: number;
  targetMinutes: number | null;
  productionQuantity: number;
  defectQuantity: number;
  hasData: boolean;
}

export interface UtilizationOverview {
  /** GROMMET + SEAL 합계 기준 종합 */
  allProducts: UtilizationMetricSummary;
  grommet: UtilizationMetricSummary;
  seal: UtilizationMetricSummary;
  /** INJECTION + PRESS 합계 기준 종합 */
  allEquipment: UtilizationMetricSummary;
  injection: UtilizationMetricSummary;
  press: UtilizationMetricSummary;
}

export type UtilizationTrendSegment =
  | "allProducts"
  | "grommet"
  | "seal"
  | "allEquipment"
  | "injection"
  | "press";

export interface UtilizationDailyPoint {
  date: string;
  label: string;
  performancePercent: number | null;
  timePercent: number | null;
  yieldPercent: number | null;
  oeePercent: number | null;
  hasData: boolean;
}

export type UtilizationDailyTrends = Record<
  UtilizationTrendSegment,
  UtilizationDailyPoint[]
>;

export const UTILIZATION_TREND_SEGMENT_OPTIONS: Array<{
  value: UtilizationTrendSegment;
  label: string;
}> = [
  { value: "allProducts", label: "전체 (제품)" },
  { value: "grommet", label: "GROMMET" },
  { value: "seal", label: "SEAL" },
  { value: "allEquipment", label: "전체 (설비)" },
  { value: "injection", label: "INJECTION" },
  { value: "press", label: "PRESS" },
];

export interface UtilizationEquipmentCol {
  id: string;
  name: string;
  factory: string;
  type: EquipmentType;
}

export interface UtilizationFamilyGroup {
  /** GP01, PG12 등. 비 GP/PG는 설비 id */
  key: string;
  label: string;
  equipmentIds: string[];
  colSpan: number;
  /** GP/PG/PS 호기 그룹이면 true */
  isFamily: boolean;
  total: UtilizationCell | null;
}

export interface UtilizationMatrix {
  dates: string[];
  equipment: UtilizationEquipmentCol[];
  injection: UtilizationEquipmentCol[];
  press: UtilizationEquipmentCol[];
  cells: Map<string, UtilizationCell>;
  equipmentTotals: Map<string, UtilizationCell>;
  /** GP/PG/PS -N 호기 평균 행용 그룹 */
  familyGroups: UtilizationFamilyGroup[];
  injectionTotal: UtilizationCell | null;
  pressTotal: UtilizationCell | null;
  grandTotal: UtilizationCell | null;
}

function cellKey(date: string, equipmentId: string) {
  return `${date}__${equipmentId}`;
}

/** 설비명 앞이 IN이면 INJECTION, 그 외는 PRESS */
export function inferEquipmentType(name: string): EquipmentType {
  const upper = name.trim().toUpperCase();
  if (upper.startsWith("IN")) return "INJECTION";
  return "PRESS";
}

/**
 * GP01-1 / PG12-3 / PS10-2 → "GP01" / "PG12" / "PS10"
 * 그 외 설비명은 null
 */
export function parseGpPgFamily(name: string): string | null {
  const m = name.trim().toUpperCase().match(/^(GP|PG|PS)(\d+)-\d+$/);
  if (!m) return null;
  return `${m[1]}${m[2]}`;
}

/**
 * 시간가동률 근무형태.
 * 원천에 연장 여부가 없으므로 연장은 자동 판정하지 않는다.
 * 주간+야간 / 주간(단일 교대·야간만 포함)만 데이터로 판정한다.
 */
export function resolveWorkPattern(
  records: ProductionRecord[],
): WorkPattern | null {
  const valid = records.filter((r) => r.isAnalysisEligible);
  if (valid.length === 0) return null;

  const shifts = new Set(valid.map((r) => r.shiftType));
  const hasDay = shifts.has("주간");
  const hasNight = shifts.has("야간");

  if (hasDay && hasNight) return "주간+야간";
  if (hasDay || hasNight) return "주간";
  return null;
}

/** 성능가동률: 주간·야간 모두 있으면 주간+야간, 하나만 있으면 단일 교대 */
export function resolvePerformanceShiftPattern(
  records: ProductionRecord[],
): PerformanceShiftPattern | null {
  const valid = records.filter((r) => r.isAnalysisEligible);
  if (valid.length === 0) return null;

  const shifts = new Set(valid.map((r) => r.shiftType));
  const hasDay = shifts.has("주간");
  const hasNight = shifts.has("야간");

  if (hasDay && hasNight) return "주간+야간";
  if (hasDay || hasNight) return "단일 교대";
  return null;
}

export function getTargetMinutes(
  pattern: WorkPattern | null,
  settings: TargetMinutesSettings = DEFAULT_TARGET_MINUTES,
): number | null {
  if (!pattern) return null;
  const value = settings[pattern];
  return value != null && value > 0 ? value : null;
}

/**
 * 목표 작업판수.
 * - SEAL에는 INJECTION이 없으므로 SEAL+INJECTION은 항상 미설정
 * - GROMMET 목표를 SEAL에 적용하지 않음
 */
export function getTargetShotCount(
  productTypes: ProductType[],
  equipmentType: EquipmentType,
  shiftPattern: PerformanceShiftPattern | null,
  table: TargetShotCountTable = DEFAULT_TARGET_SHOT_COUNTS,
): number | null {
  if (!shiftPattern) return null;
  if (productTypes.length === 0) return null;
  if (productTypes.includes("SEAL") && equipmentType === "INJECTION") {
    return null;
  }
  if (productTypes.includes("SEAL") && productTypes.includes("GROMMET")) {
    return null;
  }
  if (productTypes.includes("SEAL") && !productTypes.includes("GROMMET")) {
    const sealTarget = table.SEAL.PRESS[shiftPattern];
    return sealTarget != null && sealTarget > 0 ? sealTarget : null;
  }
  if (!productTypes.includes("GROMMET")) return null;
  const target = table.GROMMET[equipmentType][shiftPattern];
  return target != null && target > 0 ? target : null;
}

export function computeTimeUtilizationPercent(
  operatingMinutes: number,
  targetMinutes: number | null,
): number | null {
  if (targetMinutes == null || targetMinutes <= 0) return null;
  return (operatingMinutes / targetMinutes) * 100;
}

export function computePerformanceUtilizationPercent(
  shotCount: number,
  targetShotCount: number | null,
): number | null {
  if (targetShotCount == null || targetShotCount <= 0) return null;
  return (shotCount / targetShotCount) * 100;
}

/** 양품률: 실적수량 ÷ (실적수량 + 불량수량) × 100. 분모 0이면 null(-) */
export function computeYieldRatePercent(
  productionQuantity: number,
  defectQuantity: number,
): number | null {
  const total = productionQuantity + defectQuantity;
  if (total <= 0) return null;
  return (productionQuantity / total) * 100;
}

/**
 * 종합설비효율(OEE) = 시간가동률 × MIN(성능가동률, 100%) × 양품률.
 * 화면의 성능가동률은 그대로 두고, OEE 계산에만 100% 상한을 적용한다.
 */
export function computeOeePercent(
  timePercent: number | null,
  performancePercent: number | null,
  yieldPercent: number | null,
): number | null {
  if (timePercent == null || performancePercent == null || yieldPercent == null) {
    return null;
  }
  const perfCapped = Math.min(performancePercent, 100);
  return (timePercent / 100) * (perfCapped / 100) * (yieldPercent / 100) * 100;
}

/** 기존 가동률: 총 가동시간 ÷ 총 작업시간 × 100 */
export function computeUtilizationRatePercent(
  operatingMinutes: number,
  elapsedMinutes: number,
): number | null {
  if (elapsedMinutes <= 0) return null;
  return (operatingMinutes / elapsedMinutes) * 100;
}

function emptyMetricSummary(): UtilizationMetricSummary {
  return {
    performancePercent: null,
    timePercent: null,
    yieldPercent: null,
    oeePercent: null,
    shotCount: 0,
    targetShotCount: null,
    operatingMinutes: 0,
    targetMinutes: null,
    productionQuantity: 0,
    defectQuantity: 0,
    hasData: false,
  };
}

function summaryFromCells(cells: UtilizationCell[]): UtilizationMetricSummary {
  const withData = cells.filter((c) => c.hasData);
  if (withData.length === 0) return emptyMetricSummary();

  const timed = withData.filter(
    (c) => c.targetMinutes != null && c.targetMinutes > 0,
  );
  const shotTargeted = withData.filter(
    (c) => c.targetShotCount != null && c.targetShotCount > 0,
  );

  const targetMinutes = timed.reduce((s, c) => s + (c.targetMinutes ?? 0), 0);
  const targetShotCount = shotTargeted.reduce(
    (s, c) => s + (c.targetShotCount ?? 0),
    0,
  );
  const operatingForTime = timed.reduce((s, c) => s + c.operatingMinutes, 0);
  const shotsForPerf = shotTargeted.reduce((s, c) => s + c.shotCount, 0);
  const operatingMinutes = withData.reduce((s, c) => s + c.operatingMinutes, 0);
  const shotCount = withData.reduce((s, c) => s + c.shotCount, 0);
  const productionQuantity = withData.reduce(
    (s, c) => s + c.productionQuantity,
    0,
  );
  const defectQuantity = withData.reduce((s, c) => s + c.defectQuantity, 0);

  const timePercent =
    timed.length > 0
      ? computeTimeUtilizationPercent(operatingForTime, targetMinutes)
      : null;
  const performancePercent =
    shotTargeted.length > 0
      ? computePerformanceUtilizationPercent(shotsForPerf, targetShotCount)
      : null;
  const yieldPercent = computeYieldRatePercent(
    productionQuantity,
    defectQuantity,
  );
  const oeePercent = computeOeePercent(
    timePercent,
    performancePercent,
    yieldPercent,
  );

  return {
    performancePercent,
    timePercent,
    yieldPercent,
    oeePercent,
    shotCount,
    targetShotCount: shotTargeted.length > 0 ? targetShotCount : null,
    operatingMinutes,
    targetMinutes: timed.length > 0 ? targetMinutes : null,
    productionQuantity,
    defectQuantity,
    hasData: true,
  };
}

export function heatmapTone(rate: number | null, hasData: boolean): HeatmapTone {
  if (!hasData || rate == null) return "empty";
  if (rate >= 95) return "blue";
  if (rate >= 90) return "green";
  if (rate >= 80) return "yellow";
  return "red";
}

export function cellDisplay(
  cell: UtilizationCell | undefined,
  metric: UtilizationMetric,
): {
  kind: CellDisplayKind;
  rate: number | null;
  tone: HeatmapTone;
  label: string;
} {
  if (!cell || !cell.hasData) {
    return { kind: "empty", rate: null, tone: "empty", label: "-" };
  }
  const rate =
    metric === "time"
      ? cell.timeUtilizationPercent
      : cell.performanceUtilizationPercent;
  if (rate == null || cell.missingTarget) {
    return {
      kind: "no-target",
      rate: null,
      tone: "empty",
      label: "목표 미설정",
    };
  }
  const label =
    rate === 0
      ? "0.0%"
      : `${rate.toLocaleString("ko-KR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`;
  return {
    kind: "rate",
    rate,
    tone: heatmapTone(rate, true),
    label,
  };
}

function emptyCell(
  base: Omit<
    UtilizationCell,
    | "workPattern"
    | "performanceShiftPattern"
    | "targetMinutes"
    | "targetShotCount"
    | "elapsedMinutes"
    | "downtimeMinutes"
    | "operatingMinutes"
    | "shotCount"
    | "productionQuantity"
    | "defectQuantity"
    | "failureCount"
    | "downtimeReasons"
    | "timeUtilizationPercent"
    | "performanceUtilizationPercent"
    | "yieldRatePercent"
    | "oeePercent"
    | "utilizationRatePercent"
    | "hasData"
    | "missingTarget"
    | "recordIds"
    | "productTypes"
  > & { productTypes?: ProductType[] },
): UtilizationCell {
  return {
    ...base,
    productTypes: base.productTypes ?? [],
    workPattern: null,
    performanceShiftPattern: null,
    targetMinutes: null,
    targetShotCount: null,
    elapsedMinutes: 0,
    downtimeMinutes: 0,
    operatingMinutes: 0,
    shotCount: 0,
    productionQuantity: 0,
    defectQuantity: 0,
    failureCount: 0,
    downtimeReasons: [],
    timeUtilizationPercent: null,
    performanceUtilizationPercent: null,
    yieldRatePercent: null,
    oeePercent: null,
    utilizationRatePercent: null,
    hasData: false,
    missingTarget: false,
    recordIds: [],
  };
}

function aggregateCell(
  date: string,
  equipmentId: string,
  equipmentName: string,
  factory: string,
  equipmentType: EquipmentType,
  rows: ProductionRecord[],
  targetMinutesSettings: TargetMinutesSettings,
  targetShotTable: TargetShotCountTable,
): UtilizationCell {
  const valid = rows.filter((r) => r.isAnalysisEligible);
  const hasData = valid.length > 0;
  if (!hasData) {
    return emptyCell({
      date,
      equipmentId,
      equipmentName,
      factory,
      equipmentType,
    });
  }

  const workPattern = resolveWorkPattern(valid);
  const performanceShiftPattern = resolvePerformanceShiftPattern(valid);
  const productTypes = [...new Set(valid.map((r) => r.productType))];
  const targetMinutes = getTargetMinutes(workPattern, targetMinutesSettings);
  const targetShotCount = getTargetShotCount(
    productTypes,
    equipmentType,
    performanceShiftPattern,
    targetShotTable,
  );

  const elapsedMinutes = valid.reduce((s, r) => s + r.elapsedMinutes, 0);
  const downtimeMinutes = valid.reduce((s, r) => s + r.downtimeMinutes, 0);
  const operatingMinutes = valid.reduce((s, r) => s + r.operatingMinutes, 0);
  const shotCount = valid.reduce((s, r) => s + r.shotCount, 0);
  const productionQuantity = valid.reduce((s, r) => s + r.productionQuantity, 0);
  const defectQuantity = valid.reduce((s, r) => s + r.defectQuantity, 0);
  const failureCount = valid.filter((r) =>
    r.reasonTokens.includes("설비이상"),
  ).length;
  const reasonSet = new Set<string>();
  valid.forEach((r) => {
    if (r.downtimeReasonRaw) reasonSet.add(r.downtimeReasonRaw);
  });

  const timeUtilizationPercent = computeTimeUtilizationPercent(
    operatingMinutes,
    targetMinutes,
  );
  const performanceUtilizationPercent = computePerformanceUtilizationPercent(
    shotCount,
    targetShotCount,
  );
  const yieldRatePercent = computeYieldRatePercent(
    productionQuantity,
    defectQuantity,
  );
  const oeePercent = computeOeePercent(
    timeUtilizationPercent,
    performanceUtilizationPercent,
    yieldRatePercent,
  );

  return {
    date,
    equipmentId,
    equipmentName,
    factory,
    equipmentType,
    productTypes,
    workPattern,
    performanceShiftPattern,
    targetMinutes,
    targetShotCount,
    elapsedMinutes,
    downtimeMinutes,
    operatingMinutes,
    shotCount,
    productionQuantity,
    defectQuantity,
    failureCount,
    downtimeReasons: [...reasonSet],
    timeUtilizationPercent,
    performanceUtilizationPercent,
    yieldRatePercent,
    oeePercent,
    utilizationRatePercent: computeUtilizationRatePercent(
      operatingMinutes,
      elapsedMinutes,
    ),
    hasData: true,
    missingTarget: false,
    recordIds: valid.map((r) => r.id),
  };
}

function withMetricMissingTarget(
  cell: UtilizationCell,
  metric: UtilizationMetric,
): UtilizationCell {
  if (!cell.hasData) return cell;
  if (metric === "time" && cell.timeUtilizationPercent == null) {
    return { ...cell, missingTarget: true };
  }
  if (metric === "performance" && cell.performanceUtilizationPercent == null) {
    return { ...cell, missingTarget: true };
  }
  return { ...cell, missingTarget: false };
}

function sumCells(
  cells: UtilizationCell[],
  meta: Partial<UtilizationCell> & {
    date: string;
    equipmentId: string;
    equipmentName: string;
  },
  metric: UtilizationMetric,
): UtilizationCell | null {
  const withData = cells.filter((c) => c.hasData);
  if (withData.length === 0) return null;

  const operatingMinutes = withData.reduce((s, c) => s + c.operatingMinutes, 0);
  const elapsedMinutes = withData.reduce((s, c) => s + c.elapsedMinutes, 0);
  const downtimeMinutes = withData.reduce((s, c) => s + c.downtimeMinutes, 0);
  const shotCount = withData.reduce((s, c) => s + c.shotCount, 0);
  const productionQuantity = withData.reduce((s, c) => s + c.productionQuantity, 0);
  const defectQuantity = withData.reduce((s, c) => s + c.defectQuantity, 0);
  const failureCount = withData.reduce((s, c) => s + c.failureCount, 0);
  const reasonSet = new Set<string>();
  withData.forEach((c) => c.downtimeReasons.forEach((r) => reasonSet.add(r)));
  const productTypes = [
    ...new Set(withData.flatMap((c) => c.productTypes)),
  ] as ProductType[];

  // 목표가 있는 셀만 분모에 합산 (목표 미설정 셀은 분자·분모에서 제외)
  const timed = withData.filter((c) => c.targetMinutes != null && c.targetMinutes > 0);
  const shotTargeted = withData.filter(
    (c) => c.targetShotCount != null && c.targetShotCount > 0,
  );

  const targetMinutes = timed.reduce((s, c) => s + (c.targetMinutes ?? 0), 0);
  const targetShotCount = shotTargeted.reduce(
    (s, c) => s + (c.targetShotCount ?? 0),
    0,
  );
  const operatingForTime = timed.reduce((s, c) => s + c.operatingMinutes, 0);
  const shotsForPerf = shotTargeted.reduce((s, c) => s + c.shotCount, 0);

  const timeUtilizationPercent =
    timed.length > 0
      ? computeTimeUtilizationPercent(operatingForTime, targetMinutes)
      : null;
  const performanceUtilizationPercent =
    shotTargeted.length > 0
      ? computePerformanceUtilizationPercent(shotsForPerf, targetShotCount)
      : null;
  const yieldRatePercent = computeYieldRatePercent(
    productionQuantity,
    defectQuantity,
  );
  const oeePercent = computeOeePercent(
    timeUtilizationPercent,
    performanceUtilizationPercent,
    yieldRatePercent,
  );

  const base: UtilizationCell = {
    date: meta.date,
    equipmentId: meta.equipmentId,
    equipmentName: meta.equipmentName,
    factory: meta.factory ?? "",
    equipmentType: meta.equipmentType ?? "INJECTION",
    productTypes,
    workPattern: null,
    performanceShiftPattern: null,
    targetMinutes: timed.length > 0 ? targetMinutes : null,
    targetShotCount: shotTargeted.length > 0 ? targetShotCount : null,
    elapsedMinutes,
    downtimeMinutes,
    operatingMinutes,
    shotCount,
    productionQuantity,
    defectQuantity,
    failureCount,
    downtimeReasons: [...reasonSet],
    timeUtilizationPercent,
    performanceUtilizationPercent,
    yieldRatePercent,
    oeePercent,
    utilizationRatePercent: computeUtilizationRatePercent(
      operatingMinutes,
      elapsedMinutes,
    ),
    hasData: true,
    missingTarget: false,
    recordIds: withData.flatMap((c) => c.recordIds),
  };

  return withMetricMissingTarget(base, metric);
}

/** GP/PG/PS 호기별 가동률 산술 평균 (목표 있는 호기만, 존재하는 호기 수만큼) */
function averageFamilyCells(
  cells: UtilizationCell[],
  meta: Partial<UtilizationCell> & {
    date: string;
    equipmentId: string;
    equipmentName: string;
  },
  metric: UtilizationMetric,
): UtilizationCell | null {
  const withRate = cells.filter((c) => {
    if (!c.hasData || c.missingTarget) return false;
    const rate =
      metric === "time"
        ? c.timeUtilizationPercent
        : c.performanceUtilizationPercent;
    return rate != null;
  });
  if (withRate.length === 0) return null;

  const avg =
    withRate.reduce((sum, c) => {
      const rate =
        metric === "time"
          ? (c.timeUtilizationPercent as number)
          : (c.performanceUtilizationPercent as number);
      return sum + rate;
    }, 0) / withRate.length;

  const summed = sumCells(withRate, meta, metric);
  if (!summed) return null;

  if (metric === "time") {
    return {
      ...summed,
      timeUtilizationPercent: avg,
      missingTarget: false,
    };
  }
  return {
    ...summed,
    performanceUtilizationPercent: avg,
    missingTarget: false,
  };
}

function buildFamilyGroups(
  equipment: UtilizationEquipmentCol[],
  equipmentTotals: Map<string, UtilizationCell>,
  startDate: string,
  metric: UtilizationMetric,
): UtilizationFamilyGroup[] {
  const groups: UtilizationFamilyGroup[] = [];
  let i = 0;
  while (i < equipment.length) {
    const eq = equipment[i];
    const family = parseGpPgFamily(eq.name);
    if (!family) {
      groups.push({
        key: eq.id,
        label: eq.name,
        equipmentIds: [eq.id],
        colSpan: 1,
        isFamily: false,
        total: null,
      });
      i += 1;
      continue;
    }

    const members = [eq];
    let j = i + 1;
    while (j < equipment.length) {
      const next = equipment[j];
      if (parseGpPgFamily(next.name) !== family) break;
      members.push(next);
      j += 1;
    }

    const memberTotals = members
      .map((m) => equipmentTotals.get(m.id))
      .filter((c): c is UtilizationCell => !!c);

    groups.push({
      key: family,
      label: family,
      equipmentIds: members.map((m) => m.id),
      colSpan: members.length,
      isFamily: true,
      total: averageFamilyCells(
        memberTotals,
        {
          date: startDate,
          equipmentId: `family-${family}`,
          equipmentName: family,
          equipmentType: eq.type,
          factory: eq.factory,
        },
        metric,
      ),
    });
    i = j;
  }
  return groups;
}

export function monthDateRange(yearMonth: string): {
  startDate: string;
  endDate: string;
} {
  const start = startOfMonth(parseISO(`${yearMonth}-01`));
  const end = endOfMonth(start);
  return { startDate: toDateString(start), endDate: toDateString(end) };
}

export function formatMonthLabel(date: string): string {
  const d = parseISO(date);
  return format(d, "MM월 dd일");
}

export function isWeekendDate(date: string): boolean {
  const dow = getDay(parseISO(date));
  return dow === 0 || dow === 6;
}

/** 0=일, 6=토 */
export function getDateWeekdayClass(date: string): string {
  const dow = getDay(parseISO(date));
  if (dow === 6) return " util-saturday";
  if (dow === 0) return " util-sunday";
  return "";
}

function matchesWorkPatternFilter(
  cell: UtilizationCell,
  metric: UtilizationMetric,
  workPattern: "전체" | WorkPattern | PerformanceShiftPattern,
): boolean {
  if (workPattern === "전체") return true;
  if (!cell.hasData) return true;
  if (metric === "performance") {
    return cell.performanceShiftPattern === workPattern;
  }
  return cell.workPattern === workPattern;
}

export function buildUtilizationMatrix(
  records: ProductionRecord[],
  filters: GlobalFilters,
  options: {
    equipmentType: "전체" | EquipmentType;
    workPattern: "전체" | WorkPattern | PerformanceShiftPattern;
    metric?: UtilizationMetric;
    targetSettings?: TargetMinutesSettings;
    targetShotTable?: TargetShotCountTable;
    /** 미지정 시 filters.startDate ~ endDate (조회기간) 사용 */
    startDate?: string;
    endDate?: string;
  },
): UtilizationMatrix {
  const metric = options.metric ?? "time";
  const settings = options.targetSettings ?? DEFAULT_TARGET_MINUTES;
  const shotTable = options.targetShotTable ?? DEFAULT_TARGET_SHOT_COUNTS;
  const startDate = options.startDate ?? filters.startDate;
  const endDate = options.endDate ?? filters.endDate;
  const rangeFilters: GlobalFilters = {
    ...filters,
    startDate,
    endDate,
    // 가동률 현황은 화면 내 설비유형(전체/PRESS/INJECTION)만 사용.
    // 생산 DATA 드릴다운으로 남은 equipmentIds 등이 히트맵을 오염시키지 않게 한다.
    equipmentIds: [],
    partIds: [],
    operatorIds: [],
    moldIds: [],
    shiftType: "전체",
    downtimeReason: "전체",
  };

  const filtered = filterRecords(records, rangeFilters);
  const dates =
    startDate && endDate && startDate <= endDate
      ? eachDayOfInterval({
          start: parseISO(startDate),
          end: parseISO(endDate),
        }).map((d) => toDateString(d))
      : [];

  const equipmentMap = new Map<string, UtilizationEquipmentCol>();
  const addEquipment = (r: ProductionRecord) => {
    const type = inferEquipmentType(r.equipmentName);
    if (options.equipmentType !== "전체" && type !== options.equipmentType) return;
    if (!equipmentMap.has(r.equipmentId)) {
      equipmentMap.set(r.equipmentId, {
        id: r.equipmentId,
        name: r.equipmentName,
        factory: r.factory,
        type,
      });
    }
  };

  for (const r of filtered) addEquipment(r);

  const equipment = [...equipmentMap.values()].sort((a, b) => {
    if (a.type !== b.type) return a.type === "INJECTION" ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });
  const injection = equipment.filter((e) => e.type === "INJECTION");
  const press = equipment.filter((e) => e.type === "PRESS");

  const cells = new Map<string, UtilizationCell>();

  for (const eq of equipment) {
    for (const date of dates) {
      const rows = filtered.filter(
        (r) => r.equipmentId === eq.id && r.workDate === date,
      );
      let cell = aggregateCell(
        date,
        eq.id,
        eq.name,
        eq.factory,
        eq.type,
        rows,
        settings,
        shotTable,
      );

      if (
        options.workPattern !== "전체" &&
        cell.hasData &&
        !matchesWorkPatternFilter(cell, metric, options.workPattern)
      ) {
        cell = emptyCell({
          date,
          equipmentId: eq.id,
          equipmentName: eq.name,
          factory: eq.factory,
          equipmentType: eq.type,
        });
      } else {
        cell = withMetricMissingTarget(cell, metric);
      }

      cells.set(cellKey(date, eq.id), cell);
    }
  }

  const equipmentTotals = new Map<string, UtilizationCell>();
  for (const eq of equipment) {
    const colCells = dates
      .map((d) => cells.get(cellKey(d, eq.id)))
      .filter((c): c is UtilizationCell => !!c);
    const total = sumCells(
      colCells,
      {
        date: startDate,
        equipmentId: eq.id,
        equipmentName: eq.name,
        factory: eq.factory,
        equipmentType: eq.type,
      },
      metric,
    );
    if (total) equipmentTotals.set(eq.id, total);
  }

  const allCells = [...cells.values()];
  const injectionTotal = sumCells(
    allCells.filter((c) => c.equipmentType === "INJECTION"),
    {
      date: startDate,
      equipmentId: "group-injection",
      equipmentName: "INJECTION",
      equipmentType: "INJECTION",
    },
    metric,
  );
  const pressTotal = sumCells(
    allCells.filter((c) => c.equipmentType === "PRESS"),
    {
      date: startDate,
      equipmentId: "group-press",
      equipmentName: "PRESS",
      equipmentType: "PRESS",
    },
    metric,
  );
  const grandTotal = sumCells(
    allCells,
    {
      date: startDate,
      equipmentId: "grand",
      equipmentName: "전체",
    },
    metric,
  );

  const familyGroups = buildFamilyGroups(
    equipment,
    equipmentTotals,
    startDate,
    metric,
  );

  return {
    dates,
    equipment,
    injection,
    press,
    cells,
    equipmentTotals,
    familyGroups,
    injectionTotal,
    pressTotal,
    grandTotal,
  };
}

type OverviewBuildOptions = {
  workPattern: "전체" | WorkPattern | PerformanceShiftPattern;
  metric?: UtilizationMetric;
  targetSettings?: TargetMinutesSettings;
  targetShotTable?: TargetShotCountTable;
  startDate?: string;
  endDate?: string;
};

function collectOverviewCellGroups(
  records: ProductionRecord[],
  filters: GlobalFilters,
  options: OverviewBuildOptions,
): {
  grommetCells: UtilizationCell[];
  sealCells: UtilizationCell[];
  injectionCells: UtilizationCell[];
  pressCells: UtilizationCell[];
  startDate: string;
  endDate: string;
} {
  const metric = options.metric ?? "time";
  const settings = options.targetSettings ?? DEFAULT_TARGET_MINUTES;
  const shotTable = options.targetShotTable ?? DEFAULT_TARGET_SHOT_COUNTS;
  const startDate = options.startDate ?? filters.startDate;
  const endDate = options.endDate ?? filters.endDate;
  const rangeFilters: GlobalFilters = {
    ...filters,
    startDate,
    endDate,
  };

  const collectCells = (
    productType: "전체" | ProductType,
    equipmentType: "전체" | EquipmentType,
  ): UtilizationCell[] => {
    const scopedFilters: GlobalFilters = {
      ...rangeFilters,
      productType,
      equipmentIds: [],
    };
    const filtered = filterRecords(records, scopedFilters);
    const byKey = new Map<string, ProductionRecord[]>();

    for (const r of filtered) {
      const type = inferEquipmentType(r.equipmentName);
      if (equipmentType !== "전체" && type !== equipmentType) continue;
      const key = `${r.workDate}__${r.equipmentId}`;
      const list = byKey.get(key);
      if (list) list.push(r);
      else byKey.set(key, [r]);
    }

    const cells: UtilizationCell[] = [];
    for (const rows of byKey.values()) {
      const sample = rows[0];
      if (!sample) continue;
      const equipmentTypeResolved = inferEquipmentType(sample.equipmentName);
      const cell = aggregateCell(
        sample.workDate,
        sample.equipmentId,
        sample.equipmentName,
        sample.factory,
        equipmentTypeResolved,
        rows,
        settings,
        shotTable,
      );
      if (
        options.workPattern !== "전체" &&
        cell.hasData &&
        !matchesWorkPatternFilter(cell, metric, options.workPattern)
      ) {
        continue;
      }
      if (cell.hasData) cells.push(cell);
    }
    return cells;
  };

  // 제품유형은 각각 집계한 뒤 합산 (혼합 셀에서 목표 작업판수가 null이 되는 문제 방지)
  return {
    grommetCells: collectCells("GROMMET", "전체"),
    sealCells: collectCells("SEAL", "전체"),
    injectionCells: collectCells(rangeFilters.productType, "INJECTION"),
    pressCells: collectCells(rangeFilters.productType, "PRESS"),
    startDate,
    endDate,
  };
}

function dailySeriesFromCells(
  cells: UtilizationCell[],
  startDate: string,
  endDate: string,
): UtilizationDailyPoint[] {
  const byDate = new Map<string, UtilizationCell[]>();
  for (const cell of cells) {
    const list = byDate.get(cell.date);
    if (list) list.push(cell);
    else byDate.set(cell.date, [cell]);
  }

  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  return days.map((day) => {
    const date = toDateString(day);
    const summary = summaryFromCells(byDate.get(date) ?? []);
    return {
      date,
      label: format(day, "M/d"),
      performancePercent: summary.performancePercent,
      timePercent: summary.timePercent,
      yieldPercent: summary.yieldPercent,
      oeePercent: summary.oeePercent,
      hasData: summary.hasData,
    };
  });
}

/**
 * 상단 종합 지표.
 * - 제품유형(GROMMET/SEAL): 제품유형 필터와 무관하게 각각 합계 집계 (강조만 필터 반영)
 * - 설비유형(INJECTION/PRESS): 제품유형·근무형태는 반영, 설비유형 필터는 무시 (카드 클릭으로 매트릭스 필터)
 * - 일별·설비별 % 단순 평균 금지. 분자·분모 합계 후 비율 계산.
 */
export function buildUtilizationOverview(
  records: ProductionRecord[],
  filters: GlobalFilters,
  options: OverviewBuildOptions,
): UtilizationOverview {
  const { grommetCells, sealCells, injectionCells, pressCells } =
    collectOverviewCellGroups(records, filters, options);

  return {
    allProducts: summaryFromCells([...grommetCells, ...sealCells]),
    grommet: summaryFromCells(grommetCells),
    seal: summaryFromCells(sealCells),
    allEquipment: summaryFromCells([...injectionCells, ...pressCells]),
    injection: summaryFromCells(injectionCells),
    press: summaryFromCells(pressCells),
  };
}

/** 조회월 일별 지표 추이 (세그먼트별, 합계 기준) */
export function buildUtilizationDailyTrends(
  records: ProductionRecord[],
  filters: GlobalFilters,
  options: OverviewBuildOptions,
): UtilizationDailyTrends {
  const {
    grommetCells,
    sealCells,
    injectionCells,
    pressCells,
    startDate,
    endDate,
  } = collectOverviewCellGroups(records, filters, options);

  return {
    allProducts: dailySeriesFromCells(
      [...grommetCells, ...sealCells],
      startDate,
      endDate,
    ),
    grommet: dailySeriesFromCells(grommetCells, startDate, endDate),
    seal: dailySeriesFromCells(sealCells, startDate, endDate),
    allEquipment: dailySeriesFromCells(
      [...injectionCells, ...pressCells],
      startDate,
      endDate,
    ),
    injection: dailySeriesFromCells(injectionCells, startDate, endDate),
    press: dailySeriesFromCells(pressCells, startDate, endDate),
  };
}

/** 종합 현황 + 일별 추이를 한 번 집계 */
export function buildUtilizationOverviewBundle(
  records: ProductionRecord[],
  filters: GlobalFilters,
  options: OverviewBuildOptions,
): { overview: UtilizationOverview; trends: UtilizationDailyTrends } {
  const {
    grommetCells,
    sealCells,
    injectionCells,
    pressCells,
    startDate,
    endDate,
  } = collectOverviewCellGroups(records, filters, options);

  return {
    overview: {
      allProducts: summaryFromCells([...grommetCells, ...sealCells]),
      grommet: summaryFromCells(grommetCells),
      seal: summaryFromCells(sealCells),
      allEquipment: summaryFromCells([...injectionCells, ...pressCells]),
      injection: summaryFromCells(injectionCells),
      press: summaryFromCells(pressCells),
    },
    trends: {
      allProducts: dailySeriesFromCells(
        [...grommetCells, ...sealCells],
        startDate,
        endDate,
      ),
      grommet: dailySeriesFromCells(grommetCells, startDate, endDate),
      seal: dailySeriesFromCells(sealCells, startDate, endDate),
      allEquipment: dailySeriesFromCells(
        [...injectionCells, ...pressCells],
        startDate,
        endDate,
      ),
      injection: dailySeriesFromCells(injectionCells, startDate, endDate),
      press: dailySeriesFromCells(pressCells, startDate, endDate),
    },
  };
}

export function sparklineValues(
  points: UtilizationDailyPoint[],
  key:
    | "performancePercent"
    | "timePercent"
    | "yieldPercent"
    | "oeePercent",
  maxPoints = 14,
): Array<number | null> {
  const sliced = points.slice(-maxPoints);
  return sliced.map((p) => p[key]);
}

export function getCell(
  matrix: UtilizationMatrix,
  date: string,
  equipmentId: string,
): UtilizationCell | undefined {
  return matrix.cells.get(cellKey(date, equipmentId));
}

export function loadTargetMinutes(): TargetMinutesSettings {
  if (typeof window === "undefined") return { ...DEFAULT_TARGET_MINUTES };
  try {
    const raw = localStorage.getItem("production-analytics-target-minutes");
    if (!raw) return { ...DEFAULT_TARGET_MINUTES };
    const parsed = JSON.parse(raw) as Partial<TargetMinutesSettings>;
    return {
      "주간+야간":
        Number(parsed["주간+야간"]) || DEFAULT_TARGET_MINUTES["주간+야간"],
      연장: Number(parsed["연장"]) || DEFAULT_TARGET_MINUTES["연장"],
      주간: Number(parsed["주간"]) || DEFAULT_TARGET_MINUTES["주간"],
    };
  } catch {
    return { ...DEFAULT_TARGET_MINUTES };
  }
}

export function saveTargetMinutes(settings: TargetMinutesSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    "production-analytics-target-minutes",
    JSON.stringify(settings),
  );
}

function cloneShotTable(table: TargetShotCountTable): TargetShotCountTable {
  return {
    GROMMET: {
      PRESS: { ...table.GROMMET.PRESS },
      INJECTION: { ...table.GROMMET.INJECTION },
    },
    SEAL: {
      PRESS: { ...table.SEAL.PRESS },
      INJECTION: { ...table.SEAL.INJECTION },
    },
  };
}

function parseShotValue(value: unknown, fallback: number | null): number | null {
  if (value === undefined) return fallback;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function loadTargetShotCounts(): TargetShotCountTable {
  const defaults = cloneShotTable(DEFAULT_TARGET_SHOT_COUNTS);
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem("production-analytics-target-shots-v2");
    if (!raw) {
      // 이전 키에 SEAL null이 저장돼 있어도 새 기본값(240/120)을 쓰도록 v2로 이전
      const legacy = localStorage.getItem("production-analytics-target-shots");
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy) as Partial<TargetShotCountTable>;
          const migrated = {
            GROMMET: {
              PRESS: {
                "주간+야간": parseShotValue(
                  parsed.GROMMET?.PRESS?.["주간+야간"],
                  defaults.GROMMET.PRESS["주간+야간"],
                ),
                "단일 교대": parseShotValue(
                  parsed.GROMMET?.PRESS?.["단일 교대"],
                  defaults.GROMMET.PRESS["단일 교대"],
                ),
              },
              INJECTION: {
                "주간+야간": parseShotValue(
                  parsed.GROMMET?.INJECTION?.["주간+야간"],
                  defaults.GROMMET.INJECTION["주간+야간"],
                ),
                "단일 교대": parseShotValue(
                  parsed.GROMMET?.INJECTION?.["단일 교대"],
                  defaults.GROMMET.INJECTION["단일 교대"],
                ),
              },
            },
            SEAL: {
              PRESS: {
                "주간+야간":
                  parseShotValue(parsed.SEAL?.PRESS?.["주간+야간"], null) ??
                  defaults.SEAL.PRESS["주간+야간"],
                "단일 교대":
                  parseShotValue(parsed.SEAL?.PRESS?.["단일 교대"], null) ??
                  defaults.SEAL.PRESS["단일 교대"],
              },
              INJECTION: { "주간+야간": null, "단일 교대": null },
            },
          };
          localStorage.setItem(
            "production-analytics-target-shots-v2",
            JSON.stringify(migrated),
          );
          return migrated;
        } catch {
          return defaults;
        }
      }
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<TargetShotCountTable>;
    return {
      GROMMET: {
        PRESS: {
          "주간+야간": parseShotValue(
            parsed.GROMMET?.PRESS?.["주간+야간"],
            defaults.GROMMET.PRESS["주간+야간"],
          ),
          "단일 교대": parseShotValue(
            parsed.GROMMET?.PRESS?.["단일 교대"],
            defaults.GROMMET.PRESS["단일 교대"],
          ),
        },
        INJECTION: {
          "주간+야간": parseShotValue(
            parsed.GROMMET?.INJECTION?.["주간+야간"],
            defaults.GROMMET.INJECTION["주간+야간"],
          ),
          "단일 교대": parseShotValue(
            parsed.GROMMET?.INJECTION?.["단일 교대"],
            defaults.GROMMET.INJECTION["단일 교대"],
          ),
        },
      },
      SEAL: {
        PRESS: {
          "주간+야간": parseShotValue(
            parsed.SEAL?.PRESS?.["주간+야간"],
            defaults.SEAL.PRESS["주간+야간"],
          ),
          "단일 교대": parseShotValue(
            parsed.SEAL?.PRESS?.["단일 교대"],
            defaults.SEAL.PRESS["단일 교대"],
          ),
        },
        INJECTION: { "주간+야간": null, "단일 교대": null },
      },
    };
  } catch {
    return defaults;
  }
}

export function saveTargetShotCounts(settings: TargetShotCountTable) {
  if (typeof window === "undefined") return;
  const toSave = cloneShotTable(settings);
  toSave.SEAL.INJECTION = { "주간+야간": null, "단일 교대": null };
  localStorage.setItem(
    "production-analytics-target-shots-v2",
    JSON.stringify(toSave),
  );
}

function cellExportValue(
  cell: UtilizationCell | undefined,
  metric: UtilizationMetric,
): string | number {
  const display = cellDisplay(cell, metric);
  if (display.kind === "empty") return "-";
  if (display.kind === "no-target") return "목표 미설정";
  return Number((display.rate ?? 0).toFixed(1));
}

export function exportUtilizationExcel(
  matrix: UtilizationMatrix,
  metric: UtilizationMetric = "time",
  fileName?: string,
) {
  const metricLabel = metric === "time" ? "시간가동률" : "성능가동률";
  const header1: (string | number)[] = ["일자"];
  const header2: (string | number)[] = [""];

  if (matrix.injection.length > 0) {
    header1.push("INJECTION");
    for (let i = 1; i < matrix.injection.length; i++) header1.push("");
  }
  if (matrix.press.length > 0) {
    header1.push("PRESS");
    for (let i = 1; i < matrix.press.length; i++) header1.push("");
  }

  for (const eq of matrix.equipment) {
    header2.push(eq.name);
  }

  const rows: (string | number)[][] = [header1, header2];

  for (const date of matrix.dates) {
    const row: (string | number)[] = [formatMonthLabel(date)];
    for (const eq of matrix.equipment) {
      row.push(cellExportValue(getCell(matrix, date, eq.id), metric));
    }
    rows.push(row);
  }

  const totalLabel =
    metric === "time" ? "설비별 시간가동률" : "설비별 성능가동률";
  const totalRow: (string | number)[] = [totalLabel];
  for (const eq of matrix.equipment) {
    totalRow.push(
      cellExportValue(matrix.equipmentTotals.get(eq.id), metric),
    );
  }
  rows.push(totalRow);

  if (matrix.injectionTotal) {
    const row: (string | number)[] = ["INJECTION"];
    for (const eq of matrix.equipment) {
      row.push(
        eq.type === "INJECTION"
          ? cellExportValue(matrix.injectionTotal, metric)
          : "",
      );
    }
    rows.push(row);
  }
  if (matrix.pressTotal) {
    const row: (string | number)[] = ["PRESS"];
    for (const eq of matrix.equipment) {
      row.push(
        eq.type === "PRESS" ? cellExportValue(matrix.pressTotal, metric) : "",
      );
    }
    rows.push(row);
  }
  if (matrix.grandTotal) {
    rows.push(["전체", cellExportValue(matrix.grandTotal, metric)]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, metricLabel);
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const stamp = matrix.dates[0]?.replace(/-/g, "") ?? "export";
  downloadArrayBuffer(
    buffer,
    fileName ?? `${metricLabel}_${stamp}.xlsx`,
  );
}
