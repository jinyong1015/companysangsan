import {
  BASE_DOWNTIME_REASON_COLUMNS,
} from "@/lib/downtimeDetail";
import { normalizeEquipmentLabel } from "@/lib/ppt/buildMonthlyKpiPptSnapshot";
import type { MonthlyKpiPptSnapshot } from "@/lib/ppt/types";
import {
  formatPptDelta,
  formatPptFixed,
  formatPptInt,
  formatPptNullable,
  applyMonthlyTrendMonthMarker,
  applyMonthlyTrendMonthMarkers,
  clearEquipmentMetricRows,
  fillEquipmentSlots,
  formatPptPercent,
  alignProductRankHighlightBoxes,
  alignSideBySideChartFrames,
  fitEfficiencyChartBorders,
  clearChartDisplayUnits,
  hideChartPointValueLabels,
  hideChartValueLabels,
  listTextRuns,
  RANK_CHART_PLOT_HORIZONTAL,
  setChartAxisUnitToEa,
  setChartBarDirection,
  setChartBarGapWidth,
  setChartCategoryAxisStyle,
  setChartDataLabelPositionTop,
  setChartValueAxisMin,
  setChartValueAxisNiceScale,
  padValueAxisForLargeLabels,
  QTY_TREND_PLOT,
  setTextRuns,
  updateChartCaches,
  type ChartPlotLayout,
} from "@/lib/ppt/ooxml";
import type { ProductType } from "@/types";

/** PPT 표에 고정된 비가동 요인 순서 */
export const PPT_DOWNTIME_REASONS = [
  ...BASE_DOWNTIME_REASON_COLUMNS,
  "현장/설비청소",
  "작업휴식",
  "현장교육",
  "공정감사",
] as const;

function avg(
  values: Array<number | null | undefined>,
): number | null {
  const nums = values.filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (!nums.length) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

function delta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.round((b - a) * 10) / 10;
}

function reasonMinutes(
  snapshot: MonthlyKpiPptSnapshot,
  product: ProductType,
  reason: string,
  which: "current" | "previous",
): number {
  const table = snapshot.downtime[product][which];
  return table.summary.minutesByReason[reason] ?? 0;
}

function reasonCount(
  snapshot: MonthlyKpiPptSnapshot,
  product: ProductType,
  reason: string,
): number {
  return snapshot.downtime[product].current.summary.countByReason[reason] ?? 0;
}

/** 당월·전월 중 하나라도 실적이 있는 비가동 요인만 (순서 유지) */
export function activeDowntimeReasons(
  snapshot: MonthlyKpiPptSnapshot,
  product: ProductType,
): string[] {
  return PPT_DOWNTIME_REASONS.filter((reason) => {
    const curM = reasonMinutes(snapshot, product, reason, "current");
    const prevM = reasonMinutes(snapshot, product, reason, "previous");
    const curC = reasonCount(snapshot, product, reason);
    return curM > 0 || prevM > 0 || curC > 0;
  });
}

function isDowntimeValueRun(text: string): boolean {
  const t = text.trim();
  if (!t || t === "-") return true;
  return /^[\d,]+$/.test(t);
}

type DowntimeRowSlot = {
  rankIdx: number;
  labelIdxs: number[];
  minutesIdx: number;
  countIdx: number;
};

/** 합계 앞 순위 1~N 행 슬롯 (값 열이 있는 행만) */
function findDowntimeRowSlots(
  runs: string[],
  tableEnd: number,
): DowntimeRowSlot[] {
  const slots: DowntimeRowSlot[] = [];
  let expected = 1;
  for (let i = 0; i < tableEnd && expected <= 14; i += 1) {
    if (runs[i]!.trim() !== String(expected)) continue;
    const nextRank = String(expected + 1);
    let j = i + 1;
    while (j < tableEnd) {
      const t = runs[j]!.trim();
      if (t === nextRank || t === "합계") break;
      if (/^\d{1,2}$/.test(t) && Number(t) === expected + 1) break;
      j += 1;
    }
    const mid = [];
    for (let k = i + 1; k < j; k += 1) mid.push(k);
    if (
      mid.length >= 2 &&
      isDowntimeValueRun(runs[mid[mid.length - 1]!]!) &&
      isDowntimeValueRun(runs[mid[mid.length - 2]!]!)
    ) {
      slots.push({
        rankIdx: i,
        labelIdxs: mid.slice(0, -2),
        minutesIdx: mid[mid.length - 2]!,
        countIdx: mid[mid.length - 1]!,
      });
    }
    expected += 1;
  }
  return slots;
}

export function applySlide1(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  return setTextRuns(xml, {
    0: String(snapshot.year),
    2: String(snapshot.month),
  });
}

export function applySlide2(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  xml = clearEquipmentMetricRows(xml);
  const prev = snapshot.kpiPrev;
  const cur = snapshot.kpiCurrent;
  const dOee = delta(prev.oee, cur.oee);
  const dPerf = delta(prev.performance, cur.performance);
  const dTime = delta(prev.time, cur.time);
  const dYield = delta(prev.yieldRate, cur.yieldRate);
  const dMttr = delta(prev.mttr, cur.mttr);
  const dMtbf = delta(prev.mtbf, cur.mtbf);

  let next = setTextRuns(xml, {
    17: String(prev.monthNum),
    19: formatPptNullable(prev.oee),
    20: formatPptNullable(prev.performance),
    21: formatPptNullable(prev.time),
    22: formatPptNullable(prev.yieldRate),
    23: formatPptNullable(prev.mttr),
    24: formatPptNullable(prev.mtbf),
    25: String(cur.monthNum),
    27: formatPptNullable(cur.oee),
    28: formatPptNullable(cur.performance),
    29: formatPptNullable(cur.time),
    30: formatPptNullable(cur.yieldRate),
    31: formatPptNullable(cur.mttr),
    32: formatPptNullable(cur.mtbf),
    34: dOee == null ? "-" : formatPptDelta(dOee),
    35: dPerf == null ? "-" : formatPptDelta(dPerf),
    36: dTime == null ? "-" : formatPptDelta(dTime),
    37: dYield == null ? "-" : formatPptDelta(dYield),
    38: dMttr == null ? "-" : formatPptDelta(dMttr),
    39: dMtbf == null ? "-" : formatPptDelta(dMtbf),
  });

  // 화면 순서 유지, PPT 표기는 GP-01 / PG-05 형태
  const press = snapshot.equipmentByProduct.grommet.press.map((r) => ({
    label: normalizeEquipmentLabel(r.equipmentName),
    values: [
      formatPptPercent(r.performancePercent),
      formatPptPercent(r.timePercent),
    ] as [string, string],
  }));
  const injection = snapshot.equipmentByProduct.grommet.injection.map((r) => ({
    label: normalizeEquipmentLabel(r.equipmentName),
    values: [
      formatPptPercent(r.performancePercent),
      formatPptPercent(r.timePercent),
    ] as [string, string],
  }));
  next = fillEquipmentSlots(next, press, { fromHint: "press" });
  next = fillEquipmentSlots(next, injection, { fromHint: "injection" });

  // 평균 행: Press / Injection 구간 각각의 "평균" 런을 순서대로 갱신
  const pressAvgP = avg(
    snapshot.equipmentByProduct.grommet.press.map((r) => r.performancePercent),
  );
  const pressAvgT = avg(
    snapshot.equipmentByProduct.grommet.press.map((r) => r.timePercent),
  );
  const injAvgP = avg(
    snapshot.equipmentByProduct.grommet.injection.map(
      (r) => r.performancePercent,
    ),
  );
  const injAvgT = avg(
    snapshot.equipmentByProduct.grommet.injection.map((r) => r.timePercent),
  );
  const runs = listTextRuns(next);
  const avgIdx = runs
    .map((t, i) => (t.trim() === "평균" ? i : -1))
    .filter((i) => i >= 0);
  const avgUpdates = new Map<number, string>();
  if (avgIdx[0] != null) {
    avgUpdates.set(avgIdx[0] + 1, formatPptPercent(pressAvgP));
    avgUpdates.set(avgIdx[0] + 2, formatPptPercent(pressAvgT));
  }
  if (avgIdx[1] != null) {
    avgUpdates.set(avgIdx[1] + 1, formatPptPercent(injAvgP));
    avgUpdates.set(avgIdx[1] + 2, formatPptPercent(injAvgT));
  }
  return setTextRuns(next, avgUpdates);
}

export function applySlide3(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  xml = clearEquipmentMetricRows(xml);
  const pressRows = snapshot.mttrMtbfSummary.grommet.press.map((r) => ({
    label: normalizeEquipmentLabel(r.label),
    values: [
      formatPptNullable(r.mttrMinutes),
      formatPptNullable(r.referenceMtbfHours),
    ] as [string, string],
  }));
  const injRows = snapshot.mttrMtbfSummary.grommet.injection.map((r) => ({
    label: normalizeEquipmentLabel(r.label),
    values: [
      formatPptNullable(r.mttrMinutes),
      formatPptNullable(r.referenceMtbfHours),
    ] as [string, string],
  }));
  let next = fillEquipmentSlots(xml, pressRows, { fromHint: "press" });
  next = fillEquipmentSlots(next, injRows, { fromHint: "injection" });
  const src = [
    ...snapshot.mttrMtbfSummary.grommet.press,
    ...snapshot.mttrMtbfSummary.grommet.injection,
  ];
  const aMttr = avg(src.map((r) => r.mttrMinutes));
  const aMtbf = avg(src.map((r) => r.referenceMtbfHours));
  const runs = listTextRuns(next);
  const avgIdx = runs
    .map((t, i) => (t.trim() === "평균" ? i : -1))
    .filter((i) => i >= 0);
  const updates = new Map<number, string>();
  if (avgIdx[0] != null) {
    const pressOnly = snapshot.mttrMtbfSummary.grommet.press;
    updates.set(
      avgIdx[0] + 1,
      formatPptNullable(avg(pressOnly.map((r) => r.mttrMinutes))),
    );
    updates.set(
      avgIdx[0] + 2,
      formatPptNullable(avg(pressOnly.map((r) => r.referenceMtbfHours))),
    );
  }
  if (avgIdx[1] != null) {
    const injOnly = snapshot.mttrMtbfSummary.grommet.injection;
    updates.set(
      avgIdx[1] + 1,
      formatPptNullable(avg(injOnly.map((r) => r.mttrMinutes))),
    );
    updates.set(
      avgIdx[1] + 2,
      formatPptNullable(avg(injOnly.map((r) => r.referenceMtbfHours))),
    );
  }
  // 하단 조회월 MTTR/MTBF 요약
  const cur = snapshot.kpiCurrentGrommet;
  for (let i = 0; i < runs.length - 1; i += 1) {
    if (/^\d{1,2}$/.test(runs[i]!.trim()) && runs[i + 1]!.trim() === "월") {
      const maybeKpi = runs[i + 2]?.trim() ?? "";
      if (/^[\d.+-]+$/.test(maybeKpi.replace(/,/g, ""))) {
        updates.set(i, String(cur.monthNum));
        updates.set(i + 2, formatPptNullable(cur.mttr ?? aMttr));
        if (runs[i + 3] != null) {
          updates.set(i + 3, formatPptNullable(cur.mtbf ?? aMtbf));
        }
      }
    }
  }
  return setTextRuns(next, updates);
}

export function applySlide4(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  xml = clearEquipmentMetricRows(xml);
  const press = snapshot.equipmentByProduct.seal.press.map((r) => ({
    label: normalizeEquipmentLabel(r.equipmentName),
    values: [
      formatPptPercent(r.performancePercent),
      formatPptPercent(r.timePercent),
    ] as [string, string],
  }));
  let next = fillEquipmentSlots(xml, press);
  const aP = avg(
    snapshot.equipmentByProduct.seal.press.map((r) => r.performancePercent),
  );
  const aT = avg(
    snapshot.equipmentByProduct.seal.press.map((r) => r.timePercent),
  );
  const runs = listTextRuns(next);
  const avgAt = runs.findIndex((t) => t.trim() === "평균");
  const updates = new Map<number, string>();
  if (avgAt >= 0) {
    updates.set(avgAt + 1, formatPptPercent(aP));
    updates.set(avgAt + 2, formatPptPercent(aT));
  }

  // 하단 SEAL 관리지표 전월/당월 비교표
  const prev = snapshot.kpiPrevSeal;
  const cur = snapshot.kpiCurrentSeal;
  const dOee = delta(prev.oee, cur.oee);
  const dPerf = delta(prev.performance, cur.performance);
  const dTime = delta(prev.time, cur.time);
  const dYield = delta(prev.yieldRate, cur.yieldRate);
  const dMttr = delta(prev.mttr, cur.mttr);
  const dMtbf = delta(prev.mtbf, cur.mtbf);
  updates.set(80, String(prev.monthNum));
  updates.set(82, formatPptNullable(prev.oee));
  updates.set(83, formatPptNullable(prev.performance));
  updates.set(84, formatPptNullable(prev.time));
  updates.set(85, formatPptNullable(prev.yieldRate));
  updates.set(86, formatPptNullable(prev.mttr));
  updates.set(87, formatPptNullable(prev.mtbf));
  updates.set(88, String(cur.monthNum));
  updates.set(90, formatPptNullable(cur.oee));
  updates.set(91, formatPptNullable(cur.performance));
  updates.set(92, formatPptNullable(cur.time));
  updates.set(93, formatPptNullable(cur.yieldRate));
  updates.set(94, formatPptNullable(cur.mttr));
  updates.set(95, formatPptNullable(cur.mtbf));
  updates.set(97, dOee == null ? "-" : formatPptDelta(dOee));
  updates.set(98, dPerf == null ? "-" : formatPptDelta(dPerf));
  updates.set(99, dTime == null ? "-" : formatPptDelta(dTime));
  updates.set(100, dYield == null ? "-" : formatPptDelta(dYield));
  updates.set(101, dMttr == null ? "-" : formatPptDelta(dMttr));
  updates.set(102, dMtbf == null ? "-" : formatPptDelta(dMtbf));

  return setTextRuns(next, updates);
}

export function applySlide5(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  xml = clearEquipmentMetricRows(xml);
  const rows = snapshot.mttrMtbfSummary.seal.press.map((r) => ({
    label: normalizeEquipmentLabel(r.label),
    values: [
      formatPptNullable(r.mttrMinutes),
      formatPptNullable(r.referenceMtbfHours),
    ] as [string, string],
  }));
  let next = fillEquipmentSlots(xml, rows);
  const aMttr = avg(
    snapshot.mttrMtbfSummary.seal.press.map((r) => r.mttrMinutes),
  );
  const aMtbf = avg(
    snapshot.mttrMtbfSummary.seal.press.map((r) => r.referenceMtbfHours),
  );
  const runs = listTextRuns(next);
  const avgAt = runs.findIndex((t) => t.trim() === "평균");
  const updates = new Map<number, string>();
  if (avgAt >= 0) {
    updates.set(avgAt + 1, formatPptNullable(aMttr));
    updates.set(avgAt + 2, formatPptNullable(aMtbf));
  }
  const cur = snapshot.kpiCurrentSeal;
  for (let i = 0; i < runs.length - 1; i += 1) {
    if (/^\d{1,2}$/.test(runs[i]!.trim()) && runs[i + 1]!.trim() === "월") {
      const maybeKpi = runs[i + 2]?.trim() ?? "";
      if (/^[\d.+-]+$/.test(maybeKpi.replace(/,/g, ""))) {
        updates.set(i, String(cur.monthNum));
        updates.set(i + 2, formatPptNullable(cur.mttr));
        if (runs[i + 3] != null) {
          updates.set(i + 3, formatPptNullable(cur.mtbf));
        }
      }
    }
  }
  return setTextRuns(next, updates);
}

function applyDowntimeOccurrenceTable(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
  product: ProductType,
): string {
  const updates = new Map<number, string>();
  const runs = listTextRuns(xml);
  const active = activeDowntimeReasons(snapshot, product);

  const totalAt = runs.findIndex((t) => t.trim() === "합계");
  const tableEnd = totalAt >= 0 ? totalAt : runs.length;
  const slots = findDowntimeRowSlots(runs, tableEnd);

  for (let s = 0; s < slots.length; s += 1) {
    const slot = slots[s]!;
    const reason = active[s];
    if (reason) {
      updates.set(slot.rankIdx, String(s + 1));
      if (slot.labelIdxs.length > 0) {
        updates.set(slot.labelIdxs[0]!, reason);
        for (let k = 1; k < slot.labelIdxs.length; k += 1) {
          updates.set(slot.labelIdxs[k]!, "");
        }
      }
      updates.set(
        slot.minutesIdx,
        `${formatPptInt(reasonMinutes(snapshot, product, reason, "current"))} `,
      );
      updates.set(
        slot.countIdx,
        `${formatPptInt(reasonCount(snapshot, product, reason))} `,
      );
    } else {
      updates.set(slot.rankIdx, "");
      for (const li of slot.labelIdxs) updates.set(li, "");
      updates.set(slot.minutesIdx, "");
      updates.set(slot.countIdx, "");
    }
  }

  if (totalAt >= 0) {
    const totalMin =
      snapshot.downtime[product].current.summary.totalMinutes;
    const totalCnt = snapshot.downtime[product].current.summary.totalCount;
    updates.set(totalAt + 1, `${formatPptInt(totalMin)} `);
    updates.set(totalAt + 2, `${formatPptInt(totalCnt)} `);
  }

  // 하이라이트 문구: 최다 시간·최다 횟수 (실적 있는 요인만)
  let topMinReason = "";
  let topMin = 0;
  let topCntReason = "";
  let topCnt = 0;
  for (const reason of active) {
    const m = reasonMinutes(snapshot, product, reason, "current");
    const c = reasonCount(snapshot, product, reason);
    if (m > topMin) {
      topMin = m;
      topMinReason = reason;
    }
    if (c > topCnt) {
      topCnt = c;
      topCntReason = reason;
    }
  }

  let highlightN = 0;
  for (let i = tableEnd; i < runs.length; i += 1) {
    if (runs[i] !== "‘" || runs[i + 2] !== "’") continue;
    if (highlightN === 0 && topMinReason) {
      updates.set(i + 1, topMinReason);
      updates.set(i + 4, `${formatPptInt(topMin)}min `);
    } else if (highlightN === 1 && topCntReason) {
      updates.set(i + 1, topCntReason);
      if (runs[i + 4] === "회") {
        updates.set(i + 3, String(topCnt));
      } else if (runs[i + 5] === "회") {
        updates.set(i + 4, String(topCnt));
      } else {
        updates.set(i + 4, String(topCnt));
      }
    }
    highlightN += 1;
  }

  return setTextRuns(xml, updates);
}

function markerFromSeries(
  values: number[],
  valueDigits = 1,
  /** 조회월 인덱스 (연간 축일 때 length-1이 아님) */
  highlightIndex?: number,
  fontSz?: number,
  plot?: ChartPlotLayout,
): {
  categoryIndex: number;
  categoryCount: number;
  value: number;
  values: number[];
  increased: boolean;
  valueDigits: number;
  fontSz?: number;
  plot?: ChartPlotLayout;
} | null {
  if (!values.length) return null;
  const lastFinite = values.reduce(
    (acc, v, i) => (Number.isFinite(v) ? i : acc),
    -1,
  );
  if (lastFinite < 0) return null;
  const idx = Math.min(
    Math.max(0, highlightIndex ?? lastFinite),
    values.length - 1,
  );
  const cur = Number.isFinite(values[idx]) ? (values[idx] as number) : 0;
  let prev = cur;
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (Number.isFinite(values[i])) {
      prev = values[i] as number;
      break;
    }
  }
  return {
    categoryIndex: idx,
    categoryCount: values.length,
    value: cur,
    values,
    increased: cur > prev,
    valueDigits,
    fontSz,
    plot,
  };
}

function applyMonthlyDowntimeTrendSlide(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
  product: ProductType,
): string {
  const trend = snapshot.monthlyTrends[product];
  const marker = markerFromSeries(
    trend.downtimeMinutes.map((v) =>
      Number.isFinite(v) ? Math.round(v) : Number.NaN,
    ),
    0,
    trend.queryMonthIndex,
  );
  return marker ? applyMonthlyTrendMonthMarker(xml, marker) : xml;
}

function applyProductionTrendMarkers(
  xml: string,
  gValues: number[],
  sValues: number[],
  valueDigits = 1,
  highlightIndex?: number,
  fontSz?: number,
  plot?: ChartPlotLayout,
): string {
  const markers = [
    markerFromSeries(gValues, valueDigits, highlightIndex, fontSz, plot),
    markerFromSeries(sValues, valueDigits, highlightIndex, fontSz, plot),
  ].filter((m): m is NonNullable<typeof m> => !!m);
  return markers.length ? applyMonthlyTrendMonthMarkers(xml, markers) : xml;
}

export function applySlide13(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  // 실수량(EA) 그대로 — 연간 축, 마커는 조회월 (생산량만 10.5pt)
  const hi = snapshot.productionTrends.GROMMET.queryMonthIndex;
  const g = snapshot.productionTrends.GROMMET.productionQuantity.map((v) =>
    Number.isFinite(v) ? Math.round(v) : Number.NaN,
  );
  const s = snapshot.productionTrends.SEAL.productionQuantity.map((v) =>
    Number.isFinite(v) ? Math.round(v) : Number.NaN,
  );
  let next = applyProductionTrendMarkers(
    xml,
    g,
    s,
    0,
    hi,
    1050,
    QTY_TREND_PLOT,
  );
  // 템플릿 "단위 (천)" → 실제 수량 단위
  const runs = listTextRuns(next);
  const updates = new Map<number, string>();
  for (let i = 0; i < runs.length; i += 1) {
    const t = (runs[i] ?? "").trim();
    if (t === "단위 (천)" || t === "단위(천)" || t.includes("단위 (천)")) {
      updates.set(i, t.replace("단위 (천)", "단위 (EA)").replace("단위(천)", "단위 (EA)"));
    }
  }
  if (updates.size) next = setTextRuns(next, updates);
  return next;
}

export function applySlide14(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  const hi = snapshot.productionTrends.GROMMET.queryMonthIndex;
  return applyProductionTrendMarkers(
    xml,
    snapshot.productionTrends.GROMMET.partKindCount,
    snapshot.productionTrends.SEAL.partKindCount,
    0,
    hi,
  );
}

export function applySlide15(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  const hi = snapshot.productionTrends.GROMMET.queryMonthIndex;
  return applyProductionTrendMarkers(
    xml,
    snapshot.productionTrends.GROMMET.avgShot,
    snapshot.productionTrends.SEAL.avgShot,
    1,
    hi,
  );
}

export function applySlide6(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  return applyMonthlyDowntimeTrendSlide(xml, snapshot, "GROMMET");
}

export function applySlide7(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  return applyDowntimeOccurrenceTable(xml, snapshot, "GROMMET");
}

export function applySlide8(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  return applyMonthlyDowntimeTrendSlide(xml, snapshot, "SEAL");
}

export function applySlide9(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  return applyDowntimeOccurrenceTable(xml, snapshot, "SEAL");
}

export function applySlide10(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  const prev = snapshot.productionSummary.GROMMET.previous;
  const cur = snapshot.productionSummary.GROMMET.current;
  const dParts = cur.partKindCount - prev.partKindCount;
  const dQty = cur.productionQuantity - prev.productionQuantity;
  const dShot = Math.round((cur.avgShot - prev.avgShot) * 10) / 10;

  // 컬럼: 월 | 품목수량 | 생산금액 | 생산수량 | 월평균SHOT
  // 생산금액은 데이터 없음 → "-"
  return setTextRuns(xml, {
    16: String(prev.monthNum),
    18: formatPptInt(prev.partKindCount),
    19: "-",
    20: formatPptInt(prev.productionQuantity),
    21: formatPptFixed(prev.avgShot, 1),
    22: String(cur.monthNum),
    24: formatPptInt(cur.partKindCount),
    25: "-",
    26: formatPptInt(cur.productionQuantity),
    27: formatPptFixed(cur.avgShot, 1),
    29: formatPptDelta(dParts, 0),
    30: "-",
    31: formatPptDelta(dQty, 0),
    32: formatPptDelta(dShot, 1),
    35: String(cur.monthNum),
  });
}

export function applySlide11(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  const prev = snapshot.productionSummary.SEAL.previous;
  const cur = snapshot.productionSummary.SEAL.current;
  const dParts = cur.partKindCount - prev.partKindCount;
  const dQty = cur.productionQuantity - prev.productionQuantity;
  const dShot = Math.round((cur.avgShot - prev.avgShot) * 10) / 10;

  // slide11: 제목 월=6, 표 월=23/29 · 생산금액(26,32,37)은 "-"
  return setTextRuns(xml, {
    6: String(cur.monthNum),
    23: String(prev.monthNum),
    25: formatPptInt(prev.partKindCount),
    26: "-",
    27: formatPptInt(prev.productionQuantity),
    28: formatPptFixed(prev.avgShot, 1),
    29: String(cur.monthNum),
    31: formatPptInt(cur.partKindCount),
    32: "-",
    33: formatPptInt(cur.productionQuantity),
    34: formatPptFixed(cur.avgShot, 1),
    36: formatPptDelta(dParts, 0),
    37: "-",
    38: formatPptDelta(dQty, 0),
    39: formatPptDelta(dShot, 1),
  });
}

function applyQtyTopTable(
  xml: string,
  rows: Array<{ name: string; value: number; sharePercent: number }>,
  /** 표가 두 개인 슬라이드에서 수량 표 시작 힌트 */
  startHint: string,
): string {
  const runs = listTextRuns(xml);
  const hintAt = runs.findIndex((t) => t.includes(startHint));
  const updates = new Map<number, string>();

  // "NO" 헤더 다음부터 1..n 순위 행을 찾음
  let cursor = hintAt >= 0 ? hintAt : 0;
  const noAt = runs.findIndex(
    (t, i) => i >= cursor && t.trim() === "NO",
  );
  if (noAt < 0) return xml;

  // 헤더: NO, 품번, 생산수량, 비중 — 데이터는 그 다음부터
  let idx = noAt + 4;
  for (let rank = 0; rank < 10; rank += 1) {
    const row = rows[rank];
    if (!row) break;
    // 예상: rankNum, name, value, share%
    if (runs[idx] === String(rank + 1) || /^\d+$/.test(runs[idx] ?? "")) {
      updates.set(idx, String(rank + 1));
      updates.set(idx + 1, row.name);
      updates.set(idx + 2, formatPptInt(row.value));
      updates.set(idx + 3, `${Math.round(row.sharePercent)}%`);
      idx += 4;
    } else {
      break;
    }
  }
  return setTextRuns(xml, updates);
}

function looksLikeRankValue(text: string): boolean {
  const t = text.trim();
  if (t === "-") return true;
  // 천단위 콤마 숫자(작업시간/수량) — 숫자-only 품번(685390)과 구분
  if (/^\d{1,3}(,\d{3})+$/.test(t)) return true;
  // 작은 정수 값(비가동분 등). 6자리 이상 순숫자는 품번으로 간주
  if (/^\d{1,5}$/.test(t)) return true;
  return false;
}

/** 순위 표 행 채우기 — 행의 마지막 숫자 토큰을 값으로, 앞을 품번으로 */
function fillRankTableRows(
  runs: string[],
  startAt: number,
  endAt: number,
  rows: Array<{ name: string; value: number; sharePercent?: number }>,
  updates: Map<number, string>,
  maxRows: number,
  options?: { valueAsDash?: boolean; withShare?: boolean },
): void {
  const valueAsDash = options?.valueAsDash ?? false;
  const withShare = options?.withShare ?? false;
  let row = 0;
  for (let i = startAt; i < endAt && row < maxRows; i += 1) {
    if (runs[i] !== String(row + 1)) continue;
    const item = rows[row];
    const name = valueAsDash || !item ? "-" : item.name;
    const valueText = valueAsDash || !item ? "-" : formatPptInt(item.value);

    let rowEnd = Math.min(endAt, i + 12);
    for (let j = i + 1; j < endAt && j <= i + 12; j += 1) {
      if (runs[j] === String(row + 2)) {
        rowEnd = j;
        break;
      }
    }

    // 행 끝에서부터 값 후보 탐색 (숫자 품번이 값으로 오인되지 않게)
    let valueIdx = -1;
    for (let j = rowEnd - 1; j > i; j -= 1) {
      const t = (runs[j] ?? "").trim();
      if (/^\d+%$/.test(t)) continue; // 비중은 값이 아님
      if (looksLikeRankValue(runs[j] ?? "")) {
        valueIdx = j;
        break;
      }
    }
    if (valueIdx < 0) {
      row += 1;
      continue;
    }

    let named = false;
    for (let j = i + 1; j < valueIdx; j += 1) {
      const t = (runs[j] ?? "").trim();
      if (!named && t.length > 0) {
        updates.set(j, name);
        named = true;
      } else {
        updates.set(j, "");
      }
    }
    if (!named) updates.set(i + 1, name);
    updates.set(valueIdx, valueText);

    if (withShare) {
      const shareText =
        valueAsDash || item?.sharePercent == null
          ? "-"
          : `${Math.round(item.sharePercent)}%`;
      for (let k = valueIdx + 1; k < rowEnd && k <= valueIdx + 3; k += 1) {
        const t = (runs[k] ?? "").trim();
        if (/^\d+%$/.test(t) || t === "-") {
          updates.set(k, shareText);
          break;
        }
      }
    }

    i = valueIdx;
    row += 1;
  }
}

/** 생산수량/생산금액 표 시작 인덱스 (헤더 NO 근처) */
function findProductTableStart(
  runs: string[],
  kind: "생산수량" | "생산금액",
): number {
  return runs.findIndex(
    (t, i) =>
      t.includes(kind) &&
      runs.slice(i, i + 8).some((x) => x.trim() === "NO"),
  );
}

function productTableEnd(
  runs: string[],
  startAt: number,
  otherTableAt: number,
): number {
  let endAt = runs.length;
  if (otherTableAt > startAt) endAt = Math.min(endAt, otherTableAt);
  // 콜아웃(EA / 금액 괄호) 전까지만
  for (let i = startAt + 1; i < endAt; i += 1) {
    const t = runs[i] ?? "";
    if (/\([\d,]+ EA\)/.test(t)) {
      endAt = i;
      break;
    }
    if (
      /\([\d,]+/.test(t) &&
      runs.slice(i, i + 4).some((x) => x.includes("원"))
    ) {
      endAt = i;
      break;
    }
  }
  return endAt;
}

/**
 * GROMMET/SEAL 제품별 실적 — 표 순서(금액↔수량)가 달라도 동일 로직.
 * 수량 표·콜아웃 갱신, 금액 표·콜아웃은 "-" (데이터 없음).
 */
function applyProductQtySlide(
  xml: string,
  rows: Array<{ name: string; value: number; sharePercent: number }>,
): string {
  const runs = listTextRuns(xml);
  const updates = new Map<number, string>();
  const qtyAt = findProductTableStart(runs, "생산수량");
  const amountAt = findProductTableStart(runs, "생산금액");

  if (qtyAt >= 0) {
    const endAt = productTableEnd(runs, qtyAt, amountAt);
    fillRankTableRows(runs, qtyAt, endAt, rows, updates, 10, {
      withShare: true,
    });
  }

  if (amountAt >= 0) {
    const endAt = productTableEnd(runs, amountAt, qtyAt);
    const placeholders = Array.from({ length: 10 }, () => ({
      name: "-",
      value: 0,
      sharePercent: 0,
    }));
    fillRankTableRows(runs, amountAt, endAt, placeholders, updates, 10, {
      valueAsDash: true,
      withShare: true,
    });
    // 남은 비중%도 "-"
    for (let i = amountAt; i < endAt; i += 1) {
      if (/^\d+%$/.test((runs[i] ?? "").trim())) updates.set(i, "-");
    }
  }

  const top = rows[0];

  // 수량 콜아웃: "품번 (N EA)"
  for (let i = 0; i < runs.length; i += 1) {
    if (!/\([\d,]+ EA\)/.test(runs[i] ?? "")) continue;
    if (top) {
      updates.set(i, `${top.name} (${formatPptInt(top.value)} EA)`);
      for (let j = i + 1; j < Math.min(i + 6, runs.length); j += 1) {
        if (/^\d+%$/.test((runs[j] ?? "").trim())) {
          updates.set(j, `${Math.round(top.sharePercent)}%`);
          break;
        }
      }
    }
    break;
  }

  // 금액 콜아웃: "품번 (금액" + "원" + ")" + "%" → 깨지지 않게 "-"
  const amtHint = runs.findIndex(
    (t) => t.includes("생산금액 비중") || t.includes("가장 많은 생산금액"),
  );
  if (amtHint >= 0) {
    for (let i = amtHint; i >= Math.max(0, amtHint - 12); i -= 1) {
      const t = runs[i] ?? "";
      const nearWon = runs.slice(i, Math.min(i + 4, amtHint + 1)).some((x) =>
        x.includes("원"),
      );
      if (!nearWon && !/\([\d,]/.test(t)) continue;
      if (!/\d/.test(t) && !t.includes("(")) continue;

      // "- (-)이 전체대비 -로 …" 형태로 문장이 깨지지 않게
      updates.set(i, "- (-");
      for (let j = i + 1; j < amtHint; j += 1) {
        const tj = (runs[j] ?? "").trim();
        if (tj === "원") updates.set(j, "");
        else if (tj === ")") updates.set(j, ")");
        else if (tj === "(") updates.set(j, "");
        else if (/^\d+%$/.test(tj)) updates.set(j, "-");
        else if (/^[\d,]+/.test(tj) || /\([\d,]/.test(tj)) updates.set(j, "");
      }
      break;
    }
    for (let j = Math.max(0, amtHint - 5); j < amtHint; j += 1) {
      if (/^\d+%$/.test((runs[j] ?? "").trim())) updates.set(j, "-");
    }
  }

  // 1위 빨간 점선 박스 — GROMMET 템플릿 위치를 SEAL처럼 첫 막대에 맞춤
  return alignProductRankHighlightBoxes(setTextRuns(xml, updates), 10);
}

export function applySlide16(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  // GROMMET — SEAL(slide17)과 동일 유형
  return applyProductQtySlide(xml, snapshot.partQtyTop.GROMMET);
}

export function applySlide17(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  // SEAL
  return applyProductQtySlide(xml, snapshot.partQtyTop.SEAL);
}

export function applyOperatorSlide(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
  product: ProductType,
): string {
  const rows = snapshot.operatorQtyTop[product];
  const top = rows[0];
  let next = xml;
  const runs0 = listTextRuns(next);
  const updates0 = new Map<number, string>();

  // 수량 콜아웃
  if (top) {
    for (let i = 0; i < runs0.length; i += 1) {
      if (runs0[i]!.includes("작업자가") && runs0.slice(i, i + 8).some((t) => t.includes("수량"))) {
        if (runs0[i]!.includes("작업자가")) {
          updates0.set(i, `${top.name} 작업자가`);
        } else if (i > 0) {
          updates0.set(i - 1, top.name);
        }
        break;
      }
    }
    for (let i = 0; i < runs0.length; i += 1) {
      if (/\([\d,]+ EA\)/.test(runs0[i]!)) {
        updates0.set(i, `(${formatPptInt(top.value)} EA)`);
        break;
      }
    }
  }

  // 금액 콜아웃 → "-"
  for (let i = 0; i < runs0.length; i += 1) {
    const window = runs0.slice(i, i + 10).join("");
    if (!window.includes("금액")) continue;
    if (runs0[i]!.includes("작업자가") || (i + 1 < runs0.length && runs0[i + 1]!.includes("작업자가"))) {
      if (runs0[i]!.includes("작업자가")) updates0.set(i, "- 작업자가");
      else updates0.set(i, "-");
    }
    if (/[\d,]{3,}/.test(runs0[i]!) && window.includes("원")) {
      updates0.set(i, "-");
    }
  }
  next = setTextRuns(next, updates0);

  const runs = listTextRuns(next);
  const updates = new Map<number, string>();

  // 생산금액 표 → "-"
  const amountAt = runs.findIndex(
    (t, i) =>
      t.includes("생산금액") &&
      runs.slice(i, i + 6).some((x) => x.trim() === "NO"),
  );
  const qtyAt = runs.findIndex(
    (t, i) =>
      t.includes("생산수량") &&
      runs.slice(i, i + 6).some((x) => x.trim() === "NO"),
  );
  if (amountAt >= 0) {
    const endAt = qtyAt > amountAt ? qtyAt : runs.length;
    const placeholders = Array.from({ length: 10 }, () => ({
      name: "-",
      value: 0,
    }));
    fillRankTableRows(runs, amountAt, endAt, placeholders, updates, 10, {
      valueAsDash: true,
    });
  }

  // 생산수량 표
  if (qtyAt >= 0) {
    fillRankTableRows(runs, qtyAt, runs.length, rows, updates, 10);
  }

  return alignProductRankHighlightBoxes(setTextRuns(next, updates), 10);
}

export function applySlide18(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  return applyOperatorSlide(xml, snapshot, "GROMMET");
}

export function applySlide19(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  return applyOperatorSlide(xml, snapshot, "SEAL");
}

export function applyEfficiencySlide(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
  product: ProductType,
): string {
  const eff = snapshot.efficiency[product];
  const runs = listTextRuns(xml);
  const updates = new Map<number, string>();

  // 요약 숫자 4개: 총작업, 가동, 총SHOT, 평균SHOT(日) — 템플릿에서 연속 큰 숫자 런
  const summaryIdx = runs.findIndex(
    (t, i) =>
      /^\d{1,3}(,\d{3})+$/.test(t.trim()) &&
      i + 3 < runs.length &&
      /^\d/.test(runs[i + 1] ?? ""),
  );
  if (summaryIdx >= 0) {
    updates.set(summaryIdx, formatPptInt(eff.elapsedMinutes));
    updates.set(summaryIdx + 1, formatPptInt(eff.operatingMinutes));
    updates.set(summaryIdx + 2, formatPptInt(eff.shotCount));
    updates.set(summaryIdx + 3, formatPptInt(eff.dailyAvgShots));
  }

  // TOP5 표만 매칭 ("총 작업시간" 요약 라벨·앞 행 값과 구분)
  const findTop5Start = (kind: "비가동" | "작업시간"): number => {
    for (let i = 0; i < runs.length; i += 1) {
      const label = runs[i] ?? "";
      const near = runs.slice(i, i + 4).join("");
      if (!near.includes("TOP")) continue;
      if (kind === "비가동" && label.includes("비가동")) return i;
      if (
        kind === "작업시간" &&
        label.includes("작업시간") &&
        !label.includes("총")
      ) {
        return i;
      }
    }
    return -1;
  };

  const downtimeAt = findTop5Start("비가동");
  const workAt = findTop5Start("작업시간");
  if (downtimeAt >= 0) {
    const end = workAt > downtimeAt ? workAt : runs.length;
    fillRankTableRows(
      runs,
      downtimeAt,
      end,
      eff.downtimeTop.map((r) => ({
        ...r,
        value: Math.round(r.value),
      })),
      updates,
      5,
    );
  }
  if (workAt >= 0) {
    fillRankTableRows(
      runs,
      workAt,
      runs.length,
      eff.workTimeTop.map((r) => ({
        ...r,
        value: Math.round(r.value),
      })),
      updates,
      5,
    );
  }

  // 좌·우 차트 프레임 높이 맞춤 → 테두리를 차트(+라벨) 안으로 감싸기
  let next = alignSideBySideChartFrames(setTextRuns(xml, updates));
  return fitEfficiencyChartBorders(next);
}

export function applySlide22(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  return applyEfficiencySlide(xml, snapshot, "GROMMET");
}

export function applySlide23(
  xml: string,
  snapshot: MonthlyKpiPptSnapshot,
): string {
  return applyEfficiencySlide(xml, snapshot, "SEAL");
}

export function applyDowntimeCompareChart(
  chartXml: string,
  snapshot: MonthlyKpiPptSnapshot,
  product: ProductType,
): string {
  const cats = activeDowntimeReasons(snapshot, product);
  const prevValues = cats.map((r) =>
    Math.round(reasonMinutes(snapshot, product, r, "previous")),
  );
  const curValues = cats.map((r) =>
    Math.round(reasonMinutes(snapshot, product, r, "current")),
  );
  return updateChartCaches(chartXml, {
    categories: cats,
    series: [
      { name: snapshot.kpiPrev.label, values: prevValues },
      { name: snapshot.kpiCurrent.label, values: curValues },
    ],
  });
}

export function applyMonthlyTrendChart(
  chartXml: string,
  labels: string[],
  values: number[],
  seriesName?: string,
  options?: {
    hideValueLabels?: boolean;
    /** 조회월 포인트 라벨만 숨김 — 점선 박스와 중복 방지 */
    hideLastPointLabel?: boolean;
    /** 조회월 직전 월 라벨도 숨김 — 마커 박스와 겹침 방지 */
    hidePrevPointLabel?: boolean;
    /** 숨길 포인트 인덱스 (연간 축일 때 조회월). 기본=마지막 유한값 */
    highlightIndex?: number;
    /** 데이터 라벨을 점 위에 표시 */
    labelOnTop?: boolean;
    /** thousands 표시단위 제거 (값은 이미 천 단위) */
    clearDisplayUnits?: boolean;
    /** 값 축 최소값 고정 (잘림 방지) */
    axisMin?: number;
    /** 표시 단위 나눗셈 (생산량 천 단위=1000) */
    divideBy?: number;
    /** 소수 자리 — 캐시 값 반올림 */
    valueDigits?: number;
    /** 0 값 라벨 숨김 (비가동 0분·생산 0 등) */
    hideZeroValueLabels?: boolean;
    /** 값 축 max·majorUnit을 데이터에 맞게 */
    niceScale?: boolean;
    /** 축 제목 단위 (천) → (EA) */
    unitToEa?: boolean;
    /** 큰 EA 눈금과 단위 라벨 겹침 방지 */
    padLargeAxisLabels?: boolean;
  },
): string {
  const divideBy = options?.divideBy ?? 1;
  const digits = options?.valueDigits ?? 1;
  const factor = 10 ** Math.max(0, digits);
  const scaled = values.map((v) => {
    if (!Number.isFinite(v)) return Number.NaN;
    const x = v / divideBy;
    if (digits <= 0) return Math.round(x);
    return Math.round(x * factor) / factor;
  });
  let xml = updateChartCaches(chartXml, {
    categories: labels,
    series: [
      {
        name: seriesName,
        values: scaled,
      },
    ],
  });
  const numFmt = digits <= 0 ? "#,##0" : `#,##0.${"0".repeat(digits)}`;
  xml = xml.replace(
    /(<c:dLbls>[\s\S]*?<c:numFmt formatCode=")[^"]*(")/,
    `$1${numFmt}$2`,
  );
  // 값 축 format만 (카테고리는 문자열)
  xml = xml.replace(
    /(<c:val>[\s\S]*?<c:numCache>\s*<c:formatCode>)[^<]*(<\/c:formatCode>)/g,
    `$1${numFmt}$2`,
  );
  // 월 라벨이 데이터 점 중심에 오도록
  xml = xml.replace(
    /(<c:valAx>[\s\S]*?<c:crossBetween )val="[^"]*"/,
    `$1val="midCat"`,
  );
  if (options?.clearDisplayUnits) {
    xml = clearChartDisplayUnits(xml);
  }
  if (options?.unitToEa) {
    xml = setChartAxisUnitToEa(xml);
  }
  if (options?.padLargeAxisLabels) {
    xml = padValueAxisForLargeLabels(xml);
  }
  if (options?.niceScale) {
    const dataMax = Math.max(
      0,
      ...scaled.filter((v) => Number.isFinite(v)),
    );
    xml = setChartValueAxisNiceScale(xml, dataMax > 0 ? dataMax : 1);
  } else if (options?.axisMin != null) {
    xml = setChartValueAxisMin(xml, options.axisMin);
  }
  if (options?.labelOnTop !== false) {
    xml = setChartDataLabelPositionTop(xml);
  }
  if (options?.hideValueLabels) {
    xml = hideChartValueLabels(xml);
  } else {
    const hideIdxs: number[] = [];
    const lastFinite = scaled.reduce(
      (acc, v, i) => (Number.isFinite(v) ? i : acc),
      -1,
    );
    const hi = Math.min(
      Math.max(0, options?.highlightIndex ?? lastFinite),
      Math.max(0, scaled.length - 1),
    );
    if (options?.hideLastPointLabel !== false && Number.isFinite(scaled[hi])) {
      hideIdxs.push(hi);
    }
    // 조회월 마커와 직전 월 라벨이 겹치지 않도록
    if (options?.hidePrevPointLabel && hi > 0 && Number.isFinite(scaled[hi - 1])) {
      hideIdxs.push(hi - 1);
    }
    if (options?.hideZeroValueLabels !== false) {
      for (let i = 0; i < scaled.length; i += 1) {
        if (scaled[i] === 0) hideIdxs.push(i);
      }
    }
    if (hideIdxs.length) {
      xml = hideChartPointValueLabels(xml, hideIdxs);
    }
  }
  return xml;
}

export function applyDailyQtyChart(
  chartXml: string,
  days: number[],
  quantities: number[],
): string {
  // 시리즈0=생산금액(데이터 없음 → 0), 시리즈1=생산수량
  const zeros = days.map(() => 0);
  return updateChartCaches(chartXml, {
    categories: days.map(String),
    series: [
      { name: "생산금액", values: zeros },
      { name: "생산수량", values: quantities },
    ],
  });
}

export function applyRankChart(
  chartXml: string,
  rows: Array<{ name: string; value: number }>,
  options?: {
    maxPoints?: number;
    blank?: boolean;
    /** 카테고리 축 라벨 (false면 유지). 기본=세로막대 대각선 */
    categoryAxisStyle?:
      | {
          rot?: number;
          sz?: number;
          plot?: ChartPlotLayout | false;
        }
      | false;
    /** bar=가로 막대, col=세로 막대 */
    barDirection?: "bar" | "col";
    /** 막대 간격(%). 클수록 얇아져 품번이 안 건너뜀 */
    gapWidth?: number;
  },
): string {
  const maxPoints = options?.maxPoints ?? Math.max(rows.length, 1);
  const horizontal = options?.barDirection === "bar";
  const cats: string[] = [];
  const values: number[] = [];
  if (options?.blank) {
    for (let i = 0; i < maxPoints; i += 1) {
      cats.push("-");
      values.push(0);
    }
  } else {
    for (let i = 0; i < maxPoints; i += 1) {
      const row = rows[i];
      cats.push(row?.name ?? "");
      values.push(row ? Math.round(row.value) : 0);
    }
  }
  // 가로 막대는 시리즈 첫 항목이 아래에 오므로 TOP1이 위에 보이도록 역순
  if (horizontal) {
    cats.reverse();
    values.reverse();
  }
  let xml = updateChartCaches(chartXml, {
    categories: cats,
    series: [{ values }],
  });
  if (options?.barDirection) {
    xml = setChartBarDirection(xml, options.barDirection);
  }
  if (options?.gapWidth != null) {
    xml = setChartBarGapWidth(xml, options.gapWidth);
  }
  xml = clearChartDisplayUnits(xml);
  // 정수 표시
  xml = xml.replace(
    /(<c:val>[\s\S]*?<c:numCache>\s*<c:formatCode>)[^<]*(<\/c:formatCode>)/g,
    "$1#,##0$2",
  );
  const dataMax = Math.max(0, ...values);
  if (options?.blank || dataMax <= 0) {
    xml = setChartValueAxisNiceScale(xml, 1);
  } else {
    xml = setChartValueAxisNiceScale(xml, dataMax);
  }
  if (options?.categoryAxisStyle !== false) {
    const style =
      options?.categoryAxisStyle ??
      (horizontal
        ? { rot: 0, sz: 900, plot: RANK_CHART_PLOT_HORIZONTAL }
        : undefined);
    xml = setChartCategoryAxisStyle(xml, style);
  }
  return xml;
}
