import type { Factory, ProductionRecord, ProductType, ShiftType } from "@/types";

export type FilterOption = {
  id: string;
  label: string;
  factory?: Factory;
  productType?: ProductType;
};

export function buildFilterOptions(records: ProductionRecord[]) {
  const equipment = new Map<string, FilterOption>();
  const parts = new Map<string, FilterOption>();
  const operators = new Map<string, FilterOption>();
  const molds = new Map<string, FilterOption>();

  for (const r of records) {
    if (!equipment.has(r.equipmentId)) {
      equipment.set(r.equipmentId, {
        id: r.equipmentId,
        label: r.equipmentName,
        factory: r.factory,
      });
    }
    if (!parts.has(r.partId)) {
      parts.set(r.partId, {
        id: r.partId,
        label: r.partNumber,
        productType: r.productType,
      });
    }
    if (!operators.has(r.operatorId)) {
      operators.set(r.operatorId, { id: r.operatorId, label: r.operatorName });
    }
    if (!molds.has(r.moldId)) {
      molds.set(r.moldId, { id: r.moldId, label: r.moldNumber });
    }
  }

  return {
    equipment: [...equipment.values()].sort((a, b) => a.label.localeCompare(b.label, "ko")),
    parts: [...parts.values()].sort((a, b) => a.label.localeCompare(b.label, "ko")),
    operators: [...operators.values()].sort((a, b) => a.label.localeCompare(b.label, "ko")),
    molds: [...molds.values()].sort((a, b) => a.label.localeCompare(b.label, "ko")),
  };
}

export function resolveEquipment(
  id: string,
  records: ProductionRecord[],
  fallback?: { id: string; name: string; factory: Factory } | null,
) {
  if (fallback) return fallback;
  const r = records.find((x) => x.equipmentId === id);
  if (!r) return null;
  return { id: r.equipmentId, name: r.equipmentName, factory: r.factory };
}

export function resolvePart(
  id: string,
  records: ProductionRecord[],
  fallback?: { id: string; partNumber: string; productType: ProductType } | null,
) {
  if (fallback) return fallback;
  const r = records.find((x) => x.partId === id);
  if (!r) return null;
  return { id: r.partId, partNumber: r.partNumber, productType: r.productType };
}

export function resolveOperator(
  id: string,
  records: ProductionRecord[],
  fallback?: { id: string; name: string } | null,
) {
  if (fallback) return fallback;
  const r = records.find((x) => x.operatorId === id);
  if (!r) return null;
  return { id: r.operatorId, name: r.operatorName };
}

export function resolveMold(
  id: string,
  records: ProductionRecord[],
  fallback?: { id: string; moldNumber: string } | null,
) {
  if (fallback) return fallback;
  const r = records.find((x) => x.moldId === id);
  if (!r) return null;
  return { id: r.moldId, moldNumber: r.moldNumber };
}

export function dateRangeFromRecords(records: ProductionRecord[]) {
  const dates = records.map((r) => r.workDate).filter(Boolean).sort();
  if (dates.length === 0) return null;
  return { startDate: dates[0]!, endDate: dates[dates.length - 1]! };
}

export function slugId(prefix: string, value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣_-]/gi, "")
    .slice(0, 48);
  return `${prefix}-${slug || "unknown"}`;
}

export function normalizeFactory(raw: string): Factory {
  const v = raw.trim();
  if (v.includes("2") || v.includes("구지") || v.includes("제2")) return "2공장";
  return "본사";
}

export function normalizeProductType(raw: string): ProductType | null {
  const v = raw.trim().toUpperCase();
  if (v.includes("GROMMET") || v.includes("그로멧") || v.includes("그로밋")) return "GROMMET";
  if (v.includes("SEAL") || v.includes("씰") || v.includes("실")) return "SEAL";
  return null;
}

export function normalizeShift(raw: string): ShiftType {
  const v = raw.trim();
  if (v.includes("야")) return "야간";
  return "주간";
}
