import type {
  EquipmentRow,
  GlobalFilters,
  MoldRow,
  OperatorRow,
  PartRow,
  ProductPerformanceRow,
  ProductionRecord,
} from "@/types";
import {
  EQUIPMENT_MASTER,
  equipmentIdFromName,
  getEquipmentMasterById,
  getEquipmentMasterByName,
} from "@/data/equipmentMaster";
import { computeKpi, filterRecords } from "@/lib/metrics";

/**
 * 설비 마스터를 기준으로 목록을 구성한다.
 * 조회기간·실적이 없어도 마스터 설비는 모두 보이며, KPI는 필터에 맞는 실적만 반영한다.
 */
export function aggregateEquipment(
  records: ProductionRecord[],
  filters: GlobalFilters,
): EquipmentRow[] {
  // 제품유형은 마스터 G/S로 걸러야 하므로 실적 productType 필터는 제외
  const filtered = filterRecords(records, {
    ...filters,
    productType: "전체",
  });
  const byId = new Map<string, ProductionRecord[]>();
  const byName = new Map<string, ProductionRecord[]>();
  for (const r of filtered) {
    const idList = byId.get(r.equipmentId) ?? [];
    idList.push(r);
    byId.set(r.equipmentId, idList);
    const key = r.equipmentName.trim().toUpperCase();
    const nameList = byName.get(key) ?? [];
    nameList.push(r);
    byName.set(key, nameList);
  }

  const rows: EquipmentRow[] = [];
  const seen = new Set<string>();

  for (const master of EQUIPMENT_MASTER) {
    if (filters.factory !== "전체" && master.factory !== filters.factory) {
      continue;
    }
    if (
      filters.productType !== "전체" &&
      master.productType !== filters.productType
    ) {
      continue;
    }
    const id = equipmentIdFromName(master.name);
    if (
      filters.equipmentIds.length > 0 &&
      !filters.equipmentIds.includes(id)
    ) {
      continue;
    }
    const eqRows =
      byId.get(id) ?? byName.get(master.name.trim().toUpperCase()) ?? [];
    seen.add(id);
    rows.push({
      id,
      name: master.name,
      factory: master.factory,
      platenSize: master.platenSize,
      capacityTon: master.capacityTon,
      productType: master.productType,
      partCount: new Set(eqRows.map((r) => r.partId)).size,
      kpi: computeKpi(eqRows),
    });
  }

  // 마스터에 없는 실적 설비도 목록에 유지
  for (const [id, eqRows] of byId) {
    if (seen.has(id)) continue;
    const first = eqRows[0]!;
    const master =
      getEquipmentMasterByName(first.equipmentName) ??
      getEquipmentMasterById(id);
    if (
      filters.productType !== "전체" &&
      (master?.productType ?? first.productType) !== filters.productType
    ) {
      continue;
    }
    rows.push({
      id,
      name: first.equipmentName,
      factory: master?.factory ?? first.factory,
      platenSize: master?.platenSize ?? null,
      capacityTon: master?.capacityTon ?? null,
      productType: master?.productType ?? null,
      partCount: new Set(eqRows.map((r) => r.partId)).size,
      kpi: computeKpi(eqRows),
    });
  }

  return rows;
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

/**
 * PROD-01 제품별 생산 종합 실적.
 * filterRecords가 정상 데이터만 넘기므로 추가 제외 없이 품번 집계한다.
 * UPH = 작업판수(SHOT) ÷ 가동시간(hr) = 시간당 판수.
 */
export function aggregateProductPerformance(
  records: ProductionRecord[],
  filters: GlobalFilters,
): ProductPerformanceRow[] {
  const filtered = filterRecords(records, filters);
  const map = new Map<string, ProductionRecord[]>();
  for (const r of filtered) {
    if (!r.partId || !r.partNumber || !r.productType) continue;
    const list = map.get(r.partId) ?? [];
    list.push(r);
    map.set(r.partId, list);
  }

  return [...map.entries()].map(([id, rows]) => {
    const first = rows[0]!;
    const downtimeMinutes = rows.reduce((s, r) => s + r.downtimeMinutes, 0);
    const elapsedMinutes = rows.reduce((s, r) => s + r.elapsedMinutes, 0);
    const operatingMinutes = rows.reduce((s, r) => s + r.operatingMinutes, 0);
    const shotCount = rows.reduce((s, r) => s + r.shotCount, 0);
    const productionQuantity = rows.reduce((s, r) => s + r.productionQuantity, 0);
    const defectQuantity = rows.reduce((s, r) => s + r.defectQuantity, 0);
    const workDays = new Set(rows.map((r) => r.workDate)).size;

    const operatingHours = operatingMinutes / 60;
    const elapsedHours = elapsedMinutes / 60;

    return {
      id,
      partNumber: first.partNumber,
      productType: first.productType,
      downtimeMinutes,
      elapsedMinutes,
      operatingMinutes,
      shotCount,
      avgShotByOperating:
        operatingHours > 0 ? shotCount / operatingHours : null,
      avgShotByElapsed: elapsedHours > 0 ? shotCount / elapsedHours : null,
      workDays,
      dailyAvgShots: workDays > 0 ? shotCount / workDays : null,
      productionQuantity,
      defectQuantity,
      goodQuantity: productionQuantity - defectQuantity,
      uph: operatingHours > 0 ? shotCount / operatingHours : null,
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
    const factories = [...new Set(rows.map((r) => r.factory))];
    return {
      id,
      name: first.operatorName,
      factory: factories[0] ?? first.factory,
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
