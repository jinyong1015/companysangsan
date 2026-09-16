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
  failureCount: number;
  downtimeReasons: string[];
  /** 시간가동률 = 유효 가동시간 ÷ 목표 가동시간 × 100 */
  timeUtilizationPercent: number | null;
  /** 성능가동률 = 작업판수 ÷ 목표 작업판수 × 100 */
  performanceUtilizationPercent: number | null;
  /** 기존 가동률 = 가동시간 ÷ 작업시간 × 100 */
  utilizationRatePercent: number | null;
  hasData: boolean;
  /** 데이터는 있으나 목표가 없어 비율을 계산할 수 없음 */
  missingTarget: boolean;
  recordIds: string[];
}

export interface UtilizationEquipmentCol {
  id: string;
  name: string;
  factory: string;
  type: EquipmentType;
}

export interface UtilizationMatrix {
  dates: string[];
  equipment: UtilizationEquipmentCol[];
  injection: UtilizationEquipmentCol[];
  press: UtilizationEquipmentCol[];
  cells: Map<string, UtilizationCell>;
  equipmentTotals: Map<string, UtilizationCell>;
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

/** 기존 가동률: 총 가동시간 ÷ 총 작업시간 × 100 */
export function computeUtilizationRatePercent(
  operatingMinutes: number,
  elapsedMinutes: number,
): number | null {
  if (elapsedMinutes <= 0) return null;
  return (operatingMinutes / elapsedMinutes) * 100;
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
    | "failureCount"
    | "downtimeReasons"
    | "timeUtilizationPercent"
    | "performanceUtilizationPercent"
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
    failureCount: 0,
    downtimeReasons: [],
    timeUtilizationPercent: null,
    performanceUtilizationPercent: null,
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
  const failureCount = valid.filter((r) => r.isFailureCandidate).length;
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
    failureCount,
    downtimeReasons: [...reasonSet],
    timeUtilizationPercent,
    performanceUtilizationPercent,
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
    failureCount,
    downtimeReasons: [...reasonSet],
    timeUtilizationPercent,
    performanceUtilizationPercent,
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

  if (filters.equipmentIds.length > 0) {
    for (const r of records) {
      if (!filters.equipmentIds.includes(r.equipmentId)) continue;
      addEquipment(r);
    }
  }

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

  return {
    dates,
    equipment,
    injection,
    press,
    cells,
    equipmentTotals,
    injectionTotal,
    pressTotal,
    grandTotal,
  };
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
