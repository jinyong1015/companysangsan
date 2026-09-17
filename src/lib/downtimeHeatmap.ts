import { eachDayOfInterval, format, parseISO } from "date-fns";
import { isDowntimeEvent } from "@/lib/downtimeDetail";
import type { ProductType, ProductionRecord } from "@/types";

export type DowntimeHeatmapMetric = "minutes" | "count" | "rate";
export type DowntimeHeatmapProductTab = "전체" | ProductType;
export type DowntimeHeatTone =
  | "empty"
  | "zero"
  | "low"
  | "mid"
  | "high"
  | "veryHigh";

export interface DowntimeHeatCell {
  equipmentId: string;
  equipmentName: string;
  workDate: string;
  /** 해당 설비·일자에 원본 작업행이 1건 이상 있는지 */
  hasData: boolean;
  downtimeMinutes: number;
  elapsedMinutes: number;
  eventCount: number;
  failureCount: number;
  downtimeRatePercent: number | null;
  topReasons: string[];
  productTypes: ProductType[];
}

/** 행·열 합계용 (합계 기준 비율, 단순 평균 아님) */
export interface DowntimeHeatTotal {
  hasData: boolean;
  downtimeMinutes: number;
  elapsedMinutes: number;
  eventCount: number;
  failureCount: number;
  downtimeRatePercent: number | null;
}

export interface DowntimeHeatRow {
  equipmentId: string;
  equipmentName: string;
  cells: DowntimeHeatCell[];
  /** 설비별(행) 합계 */
  rowTotal: DowntimeHeatTotal;
}

export interface DowntimeHeatScaleBreak {
  tone: Exclude<DowntimeHeatTone, "empty" | "zero">;
  min: number;
  max: number | null;
  label: string;
}

export interface DowntimeHeatmapSelection {
  workDate: string;
  equipmentId: string;
  equipmentName: string;
  productType: DowntimeHeatmapProductTab;
}

export interface DowntimeHeatmapBundle {
  dates: string[];
  rows: DowntimeHeatRow[];
  /** 일별(열) 합계 — dates와 동일 인덱스 */
  dayTotals: DowntimeHeatTotal[];
  /** 전체 합계 */
  grandTotal: DowntimeHeatTotal;
  breaks: DowntimeHeatScaleBreak[];
  metric: DowntimeHeatmapMetric;
}

function emptyTotal(): DowntimeHeatTotal {
  return {
    hasData: false,
    downtimeMinutes: 0,
    elapsedMinutes: 0,
    eventCount: 0,
    failureCount: 0,
    downtimeRatePercent: null,
  };
}

function accumulateTotal(
  acc: DowntimeHeatTotal,
  part: {
    hasData: boolean;
    downtimeMinutes: number;
    elapsedMinutes: number;
    eventCount: number;
    failureCount: number;
  },
): DowntimeHeatTotal {
  if (!part.hasData) return acc;
  const downtimeMinutes = acc.downtimeMinutes + part.downtimeMinutes;
  const elapsedMinutes = acc.elapsedMinutes + part.elapsedMinutes;
  return {
    hasData: true,
    downtimeMinutes,
    elapsedMinutes,
    eventCount: acc.eventCount + part.eventCount,
    failureCount: acc.failureCount + part.failureCount,
    downtimeRatePercent:
      elapsedMinutes > 0 ? (downtimeMinutes / elapsedMinutes) * 100 : null,
  };
}

function metricValue(cell: DowntimeHeatCell, metric: DowntimeHeatmapMetric): number | null {
  if (!cell.hasData) return null;
  if (metric === "minutes") return cell.downtimeMinutes;
  if (metric === "count") return cell.eventCount;
  return cell.downtimeRatePercent;
}

function formatBreakValue(metric: DowntimeHeatmapMetric, value: number): string {
  if (metric === "minutes") {
    return `${Math.round(value).toLocaleString("ko-KR")}분`;
  }
  if (metric === "count") {
    return `${Math.round(value).toLocaleString("ko-KR")}건`;
  }
  return `${value.toFixed(1)}%`;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const a = sorted[base]!;
  const b = sorted[Math.min(base + 1, sorted.length - 1)]!;
  return a + (b - a) * rest;
}

/** 양의 값 분포로 low/mid/high/veryHigh 구간을 자동 산정 */
export function buildDowntimeHeatBreaks(
  values: number[],
  metric: DowntimeHeatmapMetric,
): DowntimeHeatScaleBreak[] {
  const positive = [...values].filter((v) => v > 0).sort((a, b) => a - b);
  if (positive.length === 0) {
    return [
      { tone: "low", min: 0, max: 0, label: formatBreakValue(metric, 0) },
      { tone: "mid", min: 0, max: 0, label: formatBreakValue(metric, 0) },
      { tone: "high", min: 0, max: 0, label: formatBreakValue(metric, 0) },
      { tone: "veryHigh", min: 0, max: null, label: `${formatBreakValue(metric, 0)}+` },
    ];
  }

  let q1 = quantile(positive, 0.25);
  let q2 = quantile(positive, 0.5);
  let q3 = quantile(positive, 0.75);
  const max = positive[positive.length - 1]!;

  // 값이 거의 같으면 균등 분할로 폴백
  if (q1 === q3) {
    const step = max / 4;
    q1 = step;
    q2 = step * 2;
    q3 = step * 3;
  } else {
    if (q2 <= q1) q2 = q1;
    if (q3 <= q2) q3 = q2;
  }

  return [
    {
      tone: "low",
      min: 0,
      max: q1,
      label: `0초과 ~ ${formatBreakValue(metric, q1)}`,
    },
    {
      tone: "mid",
      min: q1,
      max: q2,
      label: `${formatBreakValue(metric, q1)}초과 ~ ${formatBreakValue(metric, q2)}`,
    },
    {
      tone: "high",
      min: q2,
      max: q3,
      label: `${formatBreakValue(metric, q2)}초과 ~ ${formatBreakValue(metric, q3)}`,
    },
    {
      tone: "veryHigh",
      min: q3,
      max: null,
      label: `${formatBreakValue(metric, q3)}초과`,
    },
  ];
}

export function downtimeHeatTone(
  cell: DowntimeHeatCell,
  metric: DowntimeHeatmapMetric,
  breaks: DowntimeHeatScaleBreak[],
): DowntimeHeatTone {
  if (!cell.hasData) return "empty";
  const value = metricValue(cell, metric);
  if (value == null) return "empty";
  if (value <= 0) return "zero";

  const low = breaks.find((b) => b.tone === "low");
  const mid = breaks.find((b) => b.tone === "mid");
  const high = breaks.find((b) => b.tone === "high");

  if (low && value <= (low.max ?? Infinity)) return "low";
  if (mid && value <= (mid.max ?? Infinity)) return "mid";
  if (high && value <= (high.max ?? Infinity)) return "high";
  return "veryHigh";
}

export function formatDowntimeHeatDisplay(
  cell: DowntimeHeatCell,
  metric: DowntimeHeatmapMetric,
): string {
  if (!cell.hasData) return "-";
  if (metric === "minutes") {
    return `${Math.round(cell.downtimeMinutes).toLocaleString("ko-KR")}`;
  }
  if (metric === "count") {
    return `${cell.eventCount}`;
  }
  if (cell.downtimeRatePercent == null) return "-";
  return `${cell.downtimeRatePercent.toFixed(1)}%`;
}

export function formatDowntimeHeatTotalDisplay(
  total: DowntimeHeatTotal,
  metric: DowntimeHeatmapMetric,
): string {
  if (!total.hasData) return "-";
  if (metric === "minutes") {
    return `${Math.round(total.downtimeMinutes).toLocaleString("ko-KR")}`;
  }
  if (metric === "count") {
    return `${total.eventCount}`;
  }
  if (total.downtimeRatePercent == null) return "-";
  return `${total.downtimeRatePercent.toFixed(1)}%`;
}

function topReasonsFrom(records: ProductionRecord[], limit = 3): string[] {
  const map = new Map<string, number>();
  for (const r of records) {
    for (const token of r.reasonTokens) {
      if (!token) continue;
      map.set(token, (map.get(token) ?? 0) + r.downtimeMinutes);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, limit)
    .map(([reason]) => reason);
}

export function buildDowntimeEquipmentHeatmap(
  records: ProductionRecord[],
  options: {
    startDate: string;
    endDate: string;
    productTab?: DowntimeHeatmapProductTab;
    metric?: DowntimeHeatmapMetric;
  },
): DowntimeHeatmapBundle {
  const productTab = options.productTab ?? "전체";
  const metric = options.metric ?? "minutes";

  const scoped =
    productTab === "전체"
      ? records
      : records.filter((r) => r.productType === productTab);

  const dates = eachDayOfInterval({
    start: parseISO(options.startDate),
    end: parseISO(options.endDate),
  }).map((d) => format(d, "yyyy-MM-dd"));

  const equipmentMap = new Map<string, { id: string; name: string }>();
  for (const r of scoped) {
    if (!equipmentMap.has(r.equipmentId)) {
      equipmentMap.set(r.equipmentId, {
        id: r.equipmentId,
        name: r.equipmentName,
      });
    }
  }

  const equipments = [...equipmentMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ko"),
  );

  const byKey = new Map<string, ProductionRecord[]>();
  for (const r of scoped) {
    const key = `${r.equipmentId}__${r.workDate}`;
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }

  const rows: DowntimeHeatRow[] = equipments.map((eq) => {
    const cells = dates.map((workDate) => {
      const list = byKey.get(`${eq.id}__${workDate}`) ?? [];
      if (list.length === 0) {
        return {
          equipmentId: eq.id,
          equipmentName: eq.name,
          workDate,
          hasData: false,
          downtimeMinutes: 0,
          elapsedMinutes: 0,
          eventCount: 0,
          failureCount: 0,
          downtimeRatePercent: null,
          topReasons: [],
          productTypes: [],
        } satisfies DowntimeHeatCell;
      }

      const events = list.filter(isDowntimeEvent);
      const downtimeMinutes = list.reduce((s, r) => s + r.downtimeMinutes, 0);
      const elapsedMinutes = list.reduce((s, r) => s + r.elapsedMinutes, 0);
      const failureCount = events.filter((r) =>
        r.reasonTokens.includes("설비이상"),
      ).length;
      const productTypes = [
        ...new Set(list.map((r) => r.productType)),
      ] as ProductType[];

      return {
        equipmentId: eq.id,
        equipmentName: eq.name,
        workDate,
        hasData: true,
        downtimeMinutes,
        elapsedMinutes,
        eventCount: events.length,
        failureCount,
        downtimeRatePercent:
          elapsedMinutes > 0 ? (downtimeMinutes / elapsedMinutes) * 100 : null,
        topReasons: topReasonsFrom(events),
        productTypes,
      } satisfies DowntimeHeatCell;
    });

    const rowTotal = cells.reduce(
      (acc, cell) => accumulateTotal(acc, cell),
      emptyTotal(),
    );

    return {
      equipmentId: eq.id,
      equipmentName: eq.name,
      cells,
      rowTotal,
    };
  });

  const dayTotals = dates.map((_, dateIndex) =>
    rows.reduce(
      (acc, row) => accumulateTotal(acc, row.cells[dateIndex]!),
      emptyTotal(),
    ),
  );

  const grandTotal = rows.reduce(
    (acc, row) => accumulateTotal(acc, row.rowTotal),
    emptyTotal(),
  );

  const valuePool: number[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      const v = metricValue(cell, metric);
      if (v != null && cell.hasData) valuePool.push(v);
    }
  }

  return {
    dates,
    rows,
    dayTotals,
    grandTotal,
    breaks: buildDowntimeHeatBreaks(valuePool, metric),
    metric,
  };
}
