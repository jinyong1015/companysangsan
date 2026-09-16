import type {
  EquipmentRow,
  GlobalFilters,
  MoldRow,
  OperatorRow,
  PartRow,
  ProductionRecord,
} from "@/types";
import { computeKpi, filterRecords } from "@/lib/metrics";

export function aggregateEquipment(
  records: ProductionRecord[],
  filters: GlobalFilters,
): EquipmentRow[] {
  const filtered = filterRecords(records, filters);
  const map = new Map<string, ProductionRecord[]>();
  for (const r of filtered) {
    const list = map.get(r.equipmentId) ?? [];
    list.push(r);
    map.set(r.equipmentId, list);
  }
  return [...map.entries()].map(([id, rows]) => {
    const first = rows[0]!;
    const g = rows
      .filter((r) => r.productType === "GROMMET")
      .reduce((s, r) => s + r.productionQuantity, 0);
    const s = rows
      .filter((r) => r.productType === "SEAL")
      .reduce((s2, r) => s2 + r.productionQuantity, 0);
    const total = g + s || 1;
    return {
      id,
      name: first.equipmentName,
      factory: first.factory,
      productMix: {
        grommetPercent: (g / total) * 100,
        sealPercent: (s / total) * 100,
      },
      partCount: new Set(rows.map((r) => r.partId)).size,
      kpi: computeKpi(rows),
    };
  });
}

export function aggregateParts(
  records: ProductionRecord[],
  filters: GlobalFilters,
): PartRow[] {
  const filtered = filterRecords(records, filters);
  const map = new Map<string, ProductionRecord[]>();
  for (const r of filtered) {
    const list = map.get(r.partId) ?? [];
    list.push(r);
    map.set(r.partId, list);
  }
  return [...map.entries()].map(([id, rows]) => {
    const first = rows[0]!;
    return {
      id,
      partNumber: first.partNumber,
      productType: first.productType,
      factories: [...new Set(rows.map((r) => r.factory))],
      equipmentCount: new Set(rows.map((r) => r.equipmentId)).size,
      moldCount: new Set(rows.map((r) => r.moldId)).size,
      kpi: computeKpi(rows),
    };
  });
}

export function aggregateOperators(
  records: ProductionRecord[],
  filters: GlobalFilters,
): OperatorRow[] {
  const filtered = filterRecords(records, filters);
  const map = new Map<string, ProductionRecord[]>();
  for (const r of filtered) {
    const list = map.get(r.operatorId) ?? [];
    list.push(r);
    map.set(r.operatorId, list);
  }
  return [...map.entries()].map(([id, rows]) => {
    const first = rows[0]!;
    const day = rows.filter((r) => r.shiftType === "주간").length;
    const night = rows.filter((r) => r.shiftType === "야간").length;
    const total = day + night || 1;
    return {
      id,
      name: first.operatorName,
      factory: first.factory,
      shiftMix: `주간 ${Math.round((day / total) * 100)}% · 야간 ${Math.round((night / total) * 100)}%`,
      partCount: new Set(rows.map((r) => r.partId)).size,
      equipmentCount: new Set(rows.map((r) => r.equipmentId)).size,
      kpi: computeKpi(rows),
    };
  });
}

export function aggregateMolds(
  records: ProductionRecord[],
  filters: GlobalFilters,
): MoldRow[] {
  const filtered = filterRecords(records, filters);
  const map = new Map<string, ProductionRecord[]>();
  for (const r of filtered) {
    const list = map.get(r.moldId) ?? [];
    list.push(r);
    map.set(r.moldId, list);
  }
  return [...map.entries()].map(([id, rows]) => {
    const first = rows[0]!;
    const partCounts = new Map<string, number>();
    for (const r of rows) {
      partCounts.set(r.partNumber, (partCounts.get(r.partNumber) ?? 0) + r.productionQuantity);
    }
    const representativePart =
      [...partCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? first.partNumber;
    return {
      id,
      moldNumber: first.moldNumber,
      representativePart,
      productType: first.productType,
      equipmentCount: new Set(rows.map((r) => r.equipmentId)).size,
      workCount: rows.length,
      shotCount: rows.reduce((s, r) => s + r.shotCount, 0),
      kpi: computeKpi(rows),
    };
  });
}
