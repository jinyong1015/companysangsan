import type { ErrorCode, ProductionRecord } from "@/types";
import {
  isDowntimeShiftLabel,
  normalizeFactory,
  normalizeProductType,
  normalizeShift,
  slugId,
} from "@/lib/dimensions";
import { applyWorkDowntimeMismatchRules } from "@/lib/workDowntimeRules";
import {
  normalizeReasonFlags,
  type UploadSummary,
} from "@/lib/excelParse";

/** 수정 폼에서 넘어오는 편집 가능한 필드 */
export type ProductionRecordDraft = {
  factory: string;
  workDate: string;
  equipmentName: string;
  productType: string;
  partNumber: string;
  cavity: number;
  shotCount: number;
  defectQuantity: number;
  productionQuantity: number;
  operatorName: string;
  shiftType: string;
  moldNumber: string;
  /** HH:mm 또는 전체 ISO */
  startedAt: string | null;
  endedAt: string | null;
  elapsedMinutes: number;
  downtimeMinutes: number;
  downtimeReasonRaw: string | null;
  /** null이면 자동 계산 */
  averageShot: number | null;
};

function tokenize(raw: string | null) {
  if (!raw) return [];
  return raw
    .split(/[,/|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `HH:mm` 또는 `HH:mm:ss` → ISO(+09:00). 이미 ISO면 그대로 정규화. */
export function combineDateAndTime(
  workDate: string,
  timeRaw: string | null | undefined,
): string | null {
  if (!timeRaw?.trim() || !workDate) return null;
  const raw = timeRaw.trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw;

  const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = m[1]!.padStart(2, "0");
  const mm = m[2]!;
  const ss = (m[3] ?? "00").padStart(2, "0");
  return `${workDate}T${hh}:${mm}:${ss}+09:00`;
}

function parseInstantMs(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * 시작·종료 시각 차이(분). 종료가 시작보다 이르면 자정 넘김(+1일)으로 처리.
 */
export function elapsedMinutesFromRange(
  startedAt: string | null,
  endedAt: string | null,
): number | null {
  if (!startedAt || !endedAt) return null;
  const startMs = parseInstantMs(startedAt);
  let endMs = parseInstantMs(endedAt);
  if (startMs == null || endMs == null) return null;
  if (endMs < startMs) {
    endMs += 24 * 60 * 60 * 1000;
  }
  return Math.round((endMs - startMs) / 60_000);
}

export function timeHmFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}

export function summarizeRecords(records: ProductionRecord[]): UploadSummary {
  const valid = records.filter((r) => r.isAnalysisEligible).length;
  const warning = records.filter(
    (r) => r.isAnalysisEligible && r.warningCodes.length > 0,
  ).length;
  const error = records.filter((r) => !r.isAnalysisEligible).length;
  return {
    total: records.length,
    valid,
    warning,
    error,
    excluded: error,
  };
}

/**
 * 수정 draft → 업로드와 동일 규칙으로 재검증·파생값 재계산한 ProductionRecord.
 * id / batchId / sourceRowNumber는 유지.
 */
export function revalidateRecord(
  identity: Pick<ProductionRecord, "id" | "batchId" | "sourceRowNumber">,
  draft: ProductionRecordDraft,
): ProductionRecord {
  const errorCodes: ErrorCode[] = [];
  const warningCodes: string[] = [];

  const workDate = draft.workDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    errorCodes.push("INVALID_DATE");
  }

  const factoryRaw = draft.factory.trim() || "본사";
  const factory = normalizeFactory(factoryRaw);

  const equipmentName = draft.equipmentName.trim();
  if (!equipmentName) errorCodes.push("REQUIRED_VALUE_MISSING");

  const productType = normalizeProductType(draft.productType);
  if (!productType) errorCodes.push("INVALID_PRODUCT_TYPE");

  const partNumber = draft.partNumber.trim() || "-";
  const operatorName = draft.operatorName.trim() || "-";
  const moldNumber = draft.moldNumber.trim() || "-";
  if (isDowntimeShiftLabel(draft.shiftType)) {
    errorCodes.push("INVALID_SHIFT");
  }
  const shiftType = normalizeShift(draft.shiftType);

  const productionQuantity = Number(draft.productionQuantity);
  const defectQuantity = Number(draft.defectQuantity);
  const cavity = Number(draft.cavity);
  const shotCount = Number(draft.shotCount);
  const elapsedMinutes = Number(draft.elapsedMinutes);
  const downtimeMinutes = Number(draft.downtimeMinutes);

  const finiteOrNull = (n: number) => (Number.isFinite(n) ? n : null);

  const prod = finiteOrNull(productionQuantity);
  const defect = finiteOrNull(defectQuantity) ?? 0;
  const cav = finiteOrNull(cavity) ?? 0;
  const shots = finiteOrNull(shotCount) ?? 0;
  const elapsed = finiteOrNull(elapsedMinutes);
  const downtime = finiteOrNull(downtimeMinutes) ?? 0;

  if (prod == null) errorCodes.push("INVALID_NUMBER");
  if (elapsed == null) errorCodes.push("INVALID_NUMBER");
  if (prod != null && prod < 0) errorCodes.push("NEGATIVE_VALUE");
  if (defect < 0 || downtime < 0) errorCodes.push("NEGATIVE_VALUE");
  if (elapsed != null && elapsed < 0) errorCodes.push("NEGATIVE_VALUE");

  if (prod === 0) errorCodes.push("PRODUCTION_ZERO");

  applyWorkDowntimeMismatchRules(errorCodes, warningCodes, {
    elapsedMinutes: elapsed,
    downtimeMinutes: downtime,
    workDate: /^\d{4}-\d{2}-\d{2}$/.test(workDate) ? workDate : null,
    shiftType,
  });

  const downtimeReasonRaw = draft.downtimeReasonRaw?.trim() || null;
  const reasonTokens = tokenize(downtimeReasonRaw);

  if (downtime > 0 && !downtimeReasonRaw) {
    errorCodes.push("DOWNTIME_REASON_MISSING");
  }
  if (defect > 0 && (prod ?? 0) > 0) {
    const rate = defect / (prod ?? 1);
    if (rate >= 0.05) warningCodes.push("HIGH_DEFECT_RATE");
  }

  let startedAt = combineDateAndTime(workDate, draft.startedAt);
  let endedAt = combineDateAndTime(workDate, draft.endedAt);
  if (startedAt && endedAt) {
    const startMs = parseInstantMs(startedAt);
    const endMs = parseInstantMs(endedAt);
    if (startMs != null && endMs != null && endMs < startMs) {
      const nextDate = addCalendarDays(workDate, 1);
      const timePart = endedAt.includes("T") ? endedAt.slice(endedAt.indexOf("T") + 1) : "00:00:00+09:00";
      endedAt = `${nextDate}T${timePart}`;
    }
  }

  let averageShot: number | null = null;
  if (draft.averageShot != null && Number.isFinite(draft.averageShot)) {
    averageShot = draft.averageShot;
  } else if (shots > 0 && prod != null) {
    averageShot = prod / shots;
  }

  const uniqueErrors = [...new Set(errorCodes)];
  const isAnalysisEligible = uniqueErrors.length === 0;
  const resolvedProduct = productType ?? "GROMMET";
  const resolvedDate = /^\d{4}-\d{2}-\d{2}$/.test(workDate)
    ? workDate
    : "1970-01-01";

  const record: ProductionRecord = {
    id: identity.id,
    batchId: identity.batchId,
    sourceRowNumber: identity.sourceRowNumber,
    factoryRaw,
    factory,
    workDate: resolvedDate,
    equipmentId: slugId("eq", equipmentName || "unknown"),
    equipmentName: equipmentName || "-",
    productType: resolvedProduct,
    partId: slugId("pt", partNumber),
    partNumber,
    cavity: cav,
    shotCount: shots,
    defectQuantity: defect,
    productionQuantity: prod ?? 0,
    operatorId: slugId("op", operatorName),
    operatorName,
    shiftType,
    moldId: slugId("md", moldNumber),
    moldNumber,
    startedAt,
    endedAt,
    elapsedMinutes: elapsed ?? 0,
    downtimeMinutes: downtime,
    operatingMinutes: Math.max(0, (elapsed ?? 0) - downtime),
    downtimeReasonRaw,
    reasonTokens,
    isFailureCandidate: false,
    isMttrEligible: false,
    averageShot,
    isAnalysisEligible,
    errorCodes: uniqueErrors,
    warningCodes,
  };

  return normalizeReasonFlags(record);
}
