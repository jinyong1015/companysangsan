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
  const target = resolveRouteParamId(id);
  if (!target) return null;
  const r = records.find(
    (x) => resolveRouteParamId(x.operatorId) === target,
  );
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

/** 동적 라우트 param → 비교용 ID (배열/인코딩/유니코드 정규화 처리) */
export function resolveRouteParamId(
  raw: string | string[] | undefined | null,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || value === "") return "";
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  return decoded.normalize("NFC");
}

function stableShortHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * 라우트·필터용 ID.
 * ASCII면 가독성 있는 slug, 한글 등 비ASCII는 URL 깨짐을 피하기 위해 해시 사용.
 */
export function slugId(prefix: string, value: string) {
  const normalized = value.trim().normalize("NFC");
  const ascii = normalized
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/gi, "")
    .slice(0, 48);
  if (ascii.length > 0) {
    return `${prefix}-${ascii}`;
  }
  return `${prefix}-${stableShortHash(normalized || "unknown")}`;
}

export function normalizeFactory(raw: string): Factory {
  const v = raw.trim();
  if (v.includes("2") || v.includes("구지") || v.includes("제2")) return "2공장";
  return "본사";
}

export function normalizeProductType(raw: string): ProductType | null {
  const v = raw.trim().toUpperCase();
  if (!v) return null;

  // MES 구분 코드: G = GROMMET, S = SEAL
  if (v === "G") return "GROMMET";
  if (v === "S") return "SEAL";

  if (
    v.includes("GROMMET") ||
    v.includes("그로멧") ||
    v.includes("그로밋") ||
    v.includes("유압")
  ) {
    return "GROMMET";
  }
  if (v.includes("SEAL") || v.includes("씰") || v.includes("실")) return "SEAL";
  return null;
}

/** 셀 값이 주간/야간인지 판별. 불명확하면 null */
export function parseShiftValue(raw: string): ShiftType | null {
  const v = raw.trim();
  if (!v) return null;

  const upper = v.toUpperCase();
  const compact = v.replace(/\s+/g, "");

  // 야간
  if (
    upper === "N" ||
    upper === "NIGHT" ||
    upper === "2" ||
    compact === "야" ||
    compact === "야간" ||
    compact.includes("야간") ||
    (/야/.test(compact) && !/주/.test(compact))
  ) {
    return "야간";
  }

  // 주간
  if (
    upper === "D" ||
    upper === "DAY" ||
    upper === "1" ||
    compact === "주" ||
    compact === "주간" ||
    compact.includes("주간") ||
    (/주/.test(compact) && !/야/.test(compact))
  ) {
    return "주간";
  }

  return null;
}

/** 주간/야간 라벨이 입력된 셀인지 (컬럼 자동 인식용) */
export function isShiftLabel(raw: string): boolean {
  return parseShiftValue(raw) != null;
}

export function normalizeShift(raw: string): ShiftType {
  return parseShiftValue(raw) ?? "주간";
}
