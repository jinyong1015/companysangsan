import * as XLSX from "xlsx";
import type { ErrorCode, ProductionRecord, UploadBatch } from "@/types";
import {
  normalizeFactory,
  normalizeProductType,
  normalizeShift,
  parseShiftValue,
  slugId,
} from "@/lib/dimensions";

export type UploadSummary = {
  total: number;
  valid: number;
  warning: number;
  error: number;
  excluded: number;
};

export type ParseExcelResult = {
  records: ProductionRecord[];
  batch: UploadBatch;
  summary: UploadSummary;
  headerRowIndex: number;
  mappedColumns: string[];
};

const HEADER_ALIASES: Record<string, string[]> = {
  workDate: ["작업일자", "작업일", "일자", "날짜", "date"],
  factory: ["공장", "공장명", "사업장"],
  equipmentName: ["설비명", "설비", "호기", "machine"],
  productType: ["구분3", "제품유형", "제품구분", "유형", "product"],
  partNumber: ["품번", "품명코드", "part"],
  cavity: ["캐비티", "cavity", "캐비티수"],
  shotCount: ["작업판수", "판수", "shot", "샷수"],
  defectQuantity: ["불량수량", "불량", "defect"],
  productionQuantity: ["실적수량", "생산수량", "생산량", "실적"],
  operatorName: ["작업자", "작업자명", "성명", "operator"],
  // MES '구분' = 주간/야간 (제품유형은 구분3·제품유형 등)
  shiftType: ["구분", "주야", "근무구분", "교대", "주야구분", "주/야"],
  moldNumber: ["금형번호", "금형", "mold"],
  startedAt: ["시작시간", "시작", "start"],
  endedAt: ["종료시간", "종료", "end"],
  elapsedMinutes: ["작업시간(분)", "작업시간", "작업분", "elapsed"],
  downtimeMinutes: ["비가동시간(분)", "비가동시간", "비가동분", "downtime"],
  downtimeReasonRaw: ["비가동내역", "비가동사유", "reason"],
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/\(분\)/g, "")
    .trim()
    .toLowerCase();
}

function findHeaderRow(rows: unknown[][]): number {
  const keys = Object.values(HEADER_ALIASES).flat().map(normalizeHeader);
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 30);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    const cells = row.map(normalizeHeader);
    let score = 0;
    for (const cell of cells) {
      if (!cell) continue;
      if (keys.some((k) => cell.includes(k) || k.includes(cell))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  if (bestScore < 3) {
    throw new Error(
      "헤더를 찾을 수 없습니다. 작업일자·설비명·품번·실적수량 등이 포함된 성형작업일보인지 확인하세요.",
    );
  }
  return bestIdx;
}

function mapColumns(headerRow: unknown[]) {
  const map: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  const usedIndexes = new Set<number>();

  type Candidate = {
    field: keyof typeof HEADER_ALIASES;
    idx: number;
    score: number;
  };
  const candidates: Candidate[] = [];

  headerRow.forEach((cell, idx) => {
    const h = normalizeHeader(cell);
    if (!h) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      let best = 0;
      for (const alias of aliases) {
        const a = normalizeHeader(alias);
        if (!a) continue;
        if (h === a) best = Math.max(best, 100 + a.length);
        else if (h.includes(a)) best = Math.max(best, 50 + a.length);
        else if (a.includes(h) && h.length >= 2) best = Math.max(best, 20 + h.length);
      }
      if (best > 0) {
        candidates.push({
          field: field as keyof typeof HEADER_ALIASES,
          idx,
          score: best,
        });
      }
    }
  });

  // 더 구체적인(점수 높은) 매칭을 우선하고, 한 컬럼은 한 필드만 사용
  // 동점이면 shiftType을 productType보다 우선 (MES '구분' = 주/야)
  const fieldPriority = (field: keyof typeof HEADER_ALIASES) =>
    field === "shiftType" ? 0 : field === "productType" ? 2 : 1;
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      fieldPriority(a.field) - fieldPriority(b.field) ||
      a.idx - b.idx,
  );
  for (const c of candidates) {
    if (map[c.field] != null) continue;
    if (usedIndexes.has(c.idx)) continue;
    map[c.field] = c.idx;
    usedIndexes.add(c.idx);
  }

  if (map.workDate == null || map.equipmentName == null || map.productionQuantity == null) {
    throw new Error("필수 컬럼(작업일자, 설비명, 실적수량)을 찾지 못했습니다.");
  }
  return map;
}

/**
 * 헤더로 구분(주/야)을 못 찾았거나, 매핑된 열에 주간/야간 값이 거의 없으면
 * 데이터 셀에 주간·야간이 들어 있는 열을 자동으로 인식한다.
 */
function resolveShiftTypeColumn(
  rows: unknown[][],
  headerRowIndex: number,
  colMap: Partial<Record<keyof typeof HEADER_ALIASES, number>>,
): void {
  const sampleEnd = Math.min(rows.length, headerRowIndex + 1 + 120);
  const usedByOther = new Set(
    Object.entries(colMap)
      .filter(([field]) => field !== "shiftType")
      .map(([, idx]) => idx)
      .filter((idx): idx is number => idx != null),
  );

  const scoreColumn = (idx: number) => {
    let hits = 0;
    let nonEmpty = 0;
    let dayHits = 0;
    let nightHits = 0;
    for (let r = headerRowIndex + 1; r < sampleEnd; r++) {
      const raw = cell(rows[r] ?? [], idx);
      if (!raw) continue;
      nonEmpty += 1;
      const parsed = parseShiftValue(raw);
      if (parsed == null) continue;
      hits += 1;
      if (parsed === "주간") dayHits += 1;
      else nightHits += 1;
    }
    if (nonEmpty < 2 || hits < 2) return 0;
    const ratio = hits / nonEmpty;
    if (ratio < 0.5) return 0;
    // 주간·야간이 둘 다 있으면 교대 열일 가능성↑
    const both = dayHits > 0 && nightHits > 0 ? 20 : 0;
    return hits + ratio * 40 + both;
  };

  const mapped = colMap.shiftType;
  if (mapped != null && scoreColumn(mapped) > 0) {
    return;
  }

  let bestIdx: number | null = null;
  let bestScore = 0;
  const width = Math.max(
    0,
    ...rows.slice(headerRowIndex, sampleEnd).map((row) => (row ?? []).length),
  );

  for (let idx = 0; idx < width; idx++) {
    if (usedByOther.has(idx)) continue;
    const score = scoreColumn(idx);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  if (bestIdx != null && bestScore > 0) {
    colMap.shiftType = bestIdx;
  }
}

function cell(row: unknown[], idx: number | undefined) {
  if (idx == null) return "";
  const v = row[idx];
  if (v == null) return "";
  return String(v).trim();
}

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  if (/^#n\/?a$/i.test(raw) || raw === "-" || raw === "NULL") return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function excelDateToIso(raw: string): string | null {
  if (!raw) return null;
  if (/^#n\/?a$/i.test(raw)) return null;
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum > 20000 && asNum < 80000) {
    const parsed = XLSX.SSF.parse_date_code(asNum);
    if (parsed) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, "0");
      const d = String(parsed.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const cleaned = raw.replace(/\./g, "-").replace(/\//g, "-");
  const m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function excelTimeToIso(date: string | null, raw: string): string | null {
  if (!raw) return null;
  if (/^#n\/?a$/i.test(raw)) return null;

  const asNum = Number(raw);
  if (Number.isFinite(asNum)) {
    // Excel 시간만(0~1) 또는 날짜+시간 시리얼(예: 46266.315)
    if (asNum >= 0 && asNum < 1) {
      if (!date) return null;
      const totalMinutes = Math.round(asNum * 24 * 60);
      const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
      const mm = String(totalMinutes % 60).padStart(2, "0");
      return `${date}T${hh}:${mm}:00+09:00`;
    }
    if (asNum >= 1) {
      const parsed = XLSX.SSF.parse_date_code(asNum);
      if (parsed) {
        const y = parsed.y;
        const mo = String(parsed.m).padStart(2, "0");
        const d = String(parsed.d).padStart(2, "0");
        const hh = String(parsed.H).padStart(2, "0");
        const mm = String(parsed.M).padStart(2, "0");
        const ss = String(Math.floor(parsed.S || 0)).padStart(2, "0");
        return `${y}-${mo}-${d}T${hh}:${mm}:${ss}+09:00`;
      }
    }
  }

  if (!date) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const ss = (m[3] ?? "00").padStart(2, "0");
    return `${date}T${m[1]!.padStart(2, "0")}:${m[2]}:${ss}+09:00`;
  }
  return null;
}

function tokenize(raw: string | null) {
  if (!raw) return [];
  return raw
    .split(/[,/|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 복합사유 포함: reasonTokens에 설비이상이 있으면 고장후보·MTTR 동일 판정 */
export function normalizeReasonFlags(
  record: ProductionRecord,
): ProductionRecord {
  const hasEquipmentFailure = record.reasonTokens.includes("설비이상");
  const isFailureCandidate =
    record.isAnalysisEligible && hasEquipmentFailure;
  return {
    ...record,
    isFailureCandidate,
    isMttrEligible: isFailureCandidate,
  };
}

export function normalizeReasonFlagsAll(
  records: ProductionRecord[],
): ProductionRecord[] {
  return records.map(normalizeReasonFlags);
}

function hasNa(row: unknown[]) {
  return row.some((c) => /^#n\/?a$/i.test(String(c ?? "").trim()));
}

export async function parseProductionExcel(
  file: File,
): Promise<ParseExcelResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("시트를 찾을 수 없습니다.");
  const sheet = workbook.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (rows.length < 2) throw new Error("데이터가 비어 있습니다.");

  const headerRowIndex = findHeaderRow(rows);
  const colMap = mapColumns(rows[headerRowIndex] ?? []);
  resolveShiftTypeColumn(rows, headerRowIndex, colMap);
  const batchId = `batch-${Date.now()}`;
  const records: ProductionRecord[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => String(c ?? "").trim() === "")) continue;

    const sourceRowNumber = i + 1;
    const errorCodes: ErrorCode[] = [];
    const warningCodes: string[] = [];

    if (hasNa(row)) errorCodes.push("NA_PLACEHOLDER");

    const workDateRaw = cell(row, colMap.workDate);
    const workDate = excelDateToIso(workDateRaw);
    if (!workDate) errorCodes.push("INVALID_DATE");

    const factoryRaw = cell(row, colMap.factory) || "본사";
    const factory = normalizeFactory(factoryRaw);

    const equipmentName = cell(row, colMap.equipmentName);
    if (!equipmentName) errorCodes.push("REQUIRED_VALUE_MISSING");

    const productRaw = cell(row, colMap.productType);
    const productType = normalizeProductType(productRaw);
    if (!productType) errorCodes.push("INVALID_PRODUCT_TYPE");

    const partNumber = cell(row, colMap.partNumber) || "-";
    const operatorName = cell(row, colMap.operatorName) || "-";
    const moldNumber = cell(row, colMap.moldNumber) || "-";
    // 주간/야간 값이 있으면 그 기준으로 구분 인식, 없으면 기본 주간
    const shiftRaw = cell(row, colMap.shiftType);
    const shiftType = normalizeShift(shiftRaw);

    const productionQuantity = parseNumber(cell(row, colMap.productionQuantity));
    const defectQuantity = parseNumber(cell(row, colMap.defectQuantity)) ?? 0;
    const cavity = parseNumber(cell(row, colMap.cavity)) ?? 0;
    const shotCount = parseNumber(cell(row, colMap.shotCount)) ?? 0;
    const elapsedMinutes = parseNumber(cell(row, colMap.elapsedMinutes));
    const downtimeMinutes = parseNumber(cell(row, colMap.downtimeMinutes)) ?? 0;

    if (productionQuantity == null) errorCodes.push("INVALID_NUMBER");
    if (elapsedMinutes == null) errorCodes.push("INVALID_NUMBER");
    if (productionQuantity != null && productionQuantity < 0) errorCodes.push("NEGATIVE_VALUE");
    if (defectQuantity < 0 || downtimeMinutes < 0) errorCodes.push("NEGATIVE_VALUE");
    if (elapsedMinutes != null && elapsedMinutes < 0) errorCodes.push("NEGATIVE_VALUE");

    if (productionQuantity === 0) errorCodes.push("PRODUCTION_ZERO");
    if (elapsedMinutes === 0) errorCodes.push("WORK_TIME_ZERO");

    const operating =
      elapsedMinutes != null ? elapsedMinutes - downtimeMinutes : null;
    if (elapsedMinutes != null && downtimeMinutes > elapsedMinutes) {
      errorCodes.push("DOWNTIME_GT_WORK_TIME");
    }
    if (operating != null && operating <= 0) {
      errorCodes.push("OPERATING_TIME_NON_POSITIVE");
    }

    const downtimeReasonRaw = cell(row, colMap.downtimeReasonRaw) || null;
    const reasonTokens = tokenize(downtimeReasonRaw);
    const hasEquipmentFailure = reasonTokens.includes("설비이상");

    if (downtimeMinutes > 0 && !downtimeReasonRaw) {
      warningCodes.push("DOWNTIME_REASON_MISSING");
    }
    if (defectQuantity > 0 && (productionQuantity ?? 0) > 0) {
      const rate = defectQuantity / (productionQuantity ?? 1);
      if (rate >= 0.05) warningCodes.push("HIGH_DEFECT_RATE");
    }

    const uniqueErrors = [...new Set(errorCodes)];
    const isAnalysisEligible = uniqueErrors.length === 0;
    // 복합사유라도 설비이상이 포함되면 고장후보·MTTR 대상
    const isFailureCandidate = isAnalysisEligible && hasEquipmentFailure;
    const isMttrEligible = isFailureCandidate;

    const resolvedProduct = productType ?? "GROMMET";
    const resolvedDate = workDate ?? "1970-01-01";

    records.push({
      id: `${batchId}-r${sourceRowNumber}`,
      batchId,
      sourceRowNumber,
      factoryRaw,
      factory,
      workDate: resolvedDate,
      equipmentId: slugId("eq", equipmentName || "unknown"),
      equipmentName: equipmentName || "-",
      productType: resolvedProduct,
      partId: slugId("pt", partNumber),
      partNumber,
      cavity: cavity || 0,
      shotCount: shotCount || 0,
      defectQuantity: defectQuantity || 0,
      productionQuantity: productionQuantity ?? 0,
      operatorId: slugId("op", operatorName),
      operatorName,
      shiftType,
      moldId: slugId("md", moldNumber),
      moldNumber,
      startedAt: excelTimeToIso(resolvedDate, cell(row, colMap.startedAt)),
      endedAt: excelTimeToIso(resolvedDate, cell(row, colMap.endedAt)),
      elapsedMinutes: elapsedMinutes ?? 0,
      downtimeMinutes: downtimeMinutes || 0,
      operatingMinutes: Math.max(0, (elapsedMinutes ?? 0) - (downtimeMinutes || 0)),
      downtimeReasonRaw,
      reasonTokens,
      isFailureCandidate,
      isMttrEligible,
      averageShot:
        shotCount > 0 && cavity > 0 ? productionQuantity != null ? productionQuantity / shotCount : null : null,
      isAnalysisEligible,
      errorCodes: uniqueErrors,
      warningCodes,
    });
  }

  if (records.length === 0) {
    throw new Error("유효한 데이터 행이 없습니다.");
  }

  const valid = records.filter((r) => r.isAnalysisEligible).length;
  const warning = records.filter(
    (r) => r.isAnalysisEligible && r.warningCodes.length > 0,
  ).length;
  const error = records.filter((r) => !r.isAnalysisEligible).length;
  const now = new Date().toISOString();

  const batch: UploadBatch = {
    id: batchId,
    originalFileName: file.name,
    status: "active",
    sourceRowCount: records.length,
    validRowCount: valid,
    excludedRowCount: error,
    warningRowCount: warning,
    uploadedAt: now,
    activatedAt: now,
  };

  return {
    records,
    batch,
    summary: {
      total: records.length,
      valid,
      warning,
      error,
      excluded: error,
    },
    headerRowIndex,
    mappedColumns: Object.keys(colMap),
  };
}

export function buildSampleWorkbookBuffer(seedRecords: ProductionRecord[]) {
  const headers = [
    "작업일자",
    "공장",
    "설비명",
    "제품유형",
    "품번",
    "캐비티",
    "작업판수",
    "불량수량",
    "실적수량",
    "작업자",
    "구분",
    "금형번호",
    "시작",
    "종료",
    "작업시간",
    "비가동시간",
    "비가동내역",
  ];

  const sample = seedRecords.slice(0, 20).map((r) => [
    r.workDate,
    r.factory,
    r.equipmentName,
    r.productType,
    r.partNumber,
    r.cavity,
    r.shotCount,
    r.defectQuantity,
    r.productionQuantity,
    r.operatorName,
    r.shiftType,
    r.moldNumber,
    r.startedAt?.slice(11, 16) ?? "",
    r.endedAt?.slice(11, 16) ?? "",
    r.elapsedMinutes,
    r.downtimeMinutes,
    r.downtimeReasonRaw ?? "",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "성형작업일보");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export function downloadArrayBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** JSON 행 배열을 xlsx로 내려받습니다. */
export function downloadExcel(
  fileName: string,
  rows: Record<string, unknown>[],
  sheetName = "분석",
) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
  const safeName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  downloadArrayBuffer(buffer, safeName);
}
