import ExcelJS from "exceljs";
import { downloadArrayBuffer } from "@/lib/downloadBlob";
import type { Factory, ProductType, ProductionRecord } from "@/types";

/** 생산현황 엑셀 내보내기 양식 28컬럼 (순서 고정) */
export const PRODUCTION_STATUS_HEADERS = [
  "날짜",
  "설비 구분",
  "G.S 구분",
  "설비명",
  "품번",
  "제품유형",
  "C/V",
  "판수",
  "불량수량",
  "실적수량",
  "작업자",
  "주/야",
  "시작",
  "종료",
  "작업시간",
  "비가동 시간",
  "비가동 사유",
  "평균SHOT",
  "일일판수",
  "단가",
  "생산금액(원)",
  "GRADE",
  "1SHOT 중량",
  "총 사용량(g)",
  "원재료 비용(원)",
  "총 원재료 비용(원)",
  "비고(비가동 사유)",
  "공장구분",
] as const;

export type ProductionStatusHeader =
  (typeof PRODUCTION_STATUS_HEADERS)[number];

/** 원본 정보가 없어 항상 빈 칸으로 두는 컬럼 */
export const EMPTY_EXPORT_HEADERS = ["비고(비가동 사유)"] as const;

/**
 * 첨부 양식(TEST 생산현황)과 동일한 수식 컬럼.
 * `단가`·`투입량`·`원재료` 시트가 있는 통합 엑셀에 넣으면 계산된다.
 */
export const TEMPLATE_FORMULA_HEADERS = [
  "단가",
  "생산금액(원)",
  "GRADE",
  "1SHOT 중량",
  "총 사용량(g)",
  "원재료 비용(원)",
  "총 원재료 비용(원)",
] as const;

export type DataSourceKind = "정상" | "오류";

export function dataSourceKindOf(record: ProductionRecord): DataSourceKind {
  return record.isAnalysisEligible ? "정상" : "오류";
}

/** 내부 정규화: SEAL / GROMMET (엑셀 출력 전 단계) */
export function normalizeExportProductType(
  productType: ProductType | string,
): "SEAL" | "GROMMET" | "" {
  const v = String(productType ?? "")
    .trim()
    .toUpperCase();
  if (!v) return "";
  if (v === "S" || v === "SEAL" || v.includes("SEAL") || v.includes("씰")) {
    return "SEAL";
  }
  if (
    v === "G" ||
    v === "GROMMET" ||
    v.includes("GROMMET") ||
    v.includes("유압")
  ) {
    return "GROMMET";
  }
  return "";
}

/**
 * 엑셀 제품유형 컬럼: GROMMET→G, SEAL→S
 * (첨부 양식과 동일)
 */
export function exportProductType(
  productType: ProductType | string,
): string {
  const normalized = normalizeExportProductType(productType);
  if (normalized === "SEAL") return "S";
  if (normalized === "GROMMET") return "G";
  return String(productType ?? "").trim();
}

/** G.S 구분 컬럼 (제품유형 코드와 동일 규칙) */
export function exportGsCode(productType: ProductType | string): string {
  return exportProductType(productType);
}

/**
 * 설비 구분: 설비명이 IN으로 시작하면 `IN`, 그 외 PRESS.
 * 양식 수식(GRADE·1SHOT 중량)이 `$B="IN"` 기준으로 분기한다.
 */
export function exportEquipmentClass(equipmentName: string): string {
  const upper = String(equipmentName ?? "")
    .trim()
    .toUpperCase();
  if (upper.startsWith("IN")) return "IN";
  return "PRESS";
}

/** 첨부 양식과 동일한 단가~원재료 수식 (행번호는 엑셀 1-based) */
export function templateLookupFormula(
  header: (typeof TEMPLATE_FORMULA_HEADERS)[number],
  excelRow: number,
): string {
  const r = excelRow;
  switch (header) {
    case "단가":
      return `IF(L${r}="비가동",0,VLOOKUP(E${r},단가!$D$4:$G$1048576,4,0))`;
    case "생산금액(원)":
      return `IF(L${r}="비가동",0,T${r}*J${r})`;
    case "GRADE":
      return `IF($L${r}="비가동",0,IF($B${r}="IN",VLOOKUP($E${r},투입량!$M:$T,3,FALSE),VLOOKUP($E${r},투입량!$D:$I,3,FALSE)))`;
    case "1SHOT 중량":
      return `IF($L${r}="비가동",0,IF($B${r}="IN",VLOOKUP($E${r},투입량!$M:$T,6,FALSE),VLOOKUP($E${r},투입량!$D:$I,5,FALSE)))`;
    case "총 사용량(g)":
      return `IF(L${r}="비가동",0,(W${r}*1.1)*H${r})`;
    case "원재료 비용(원)":
      return `IF(V${r}=0,0,VLOOKUP(V${r},원재료!C:H,3,0)*0.001)`;
    case "총 원재료 비용(원)":
      return `Y${r}*X${r}`;
    default:
      return "";
  }
}

/** 공장구분 엑셀 출력값 (본사·1공장 → 1공장) */
export function exportFactoryLabel(
  factory: Factory | string,
  factoryRaw?: string,
): string {
  const raw = String(factoryRaw ?? factory ?? "").trim();
  if (raw.includes("구지") || raw.includes("제2") || raw.includes("2공장")) {
    return "2공장";
  }
  if (factory === "2공장") return "2공장";
  return "1공장";
}

export function dailyShotKey(
  workDate: string,
  equipmentName: string,
  partNumber: string,
): string {
  return `${workDate}\u0001${equipmentName}\u0001${partNumber}`;
}

/**
 * 일일판수: 동일 작업일자·설비명·품번의 판수 합.
 * 판수가 없는(0) 행은 합산에서 제외한다.
 */
export function buildDailyShotMap(
  records: ProductionRecord[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!r.shotCount || r.shotCount <= 0) continue;
    const key = dailyShotKey(r.workDate, r.equipmentName, r.partNumber);
    map.set(key, (map.get(key) ?? 0) + r.shotCount);
  }
  return map;
}

function parseIsoDateParts(
  iso: string,
): { y: number; m: number; d: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function parseTimeParts(
  iso: string | null,
): { h: number; m: number } | null {
  if (!iso) return null;
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return { h: Number(match[1]), m: Number(match[2]) };
}

/** Excel 날짜 시리얼용 로컬 Date (타임존 왜곡 최소화) */
export function toExcelDateValue(workDate: string): Date | null {
  const parts = parseIsoDateParts(workDate);
  if (!parts) return null;
  return new Date(parts.y, parts.m - 1, parts.d, 0, 0, 0, 0);
}

/**
 * Excel 시간 시리얼(0~1). Date 객체는 타임존에 따라 시각이 어긋날 수 있어
 * 분모 시리얼로 출력한다.
 */
export function toExcelTimeValue(iso: string | null): number | null {
  const parts = parseTimeParts(iso);
  if (!parts) return null;
  return (parts.h * 60 + parts.m) / (24 * 60);
}

export type ProductionStatusExportRow = {
  record: ProductionRecord;
  dailyShot: number | null;
  values: unknown[];
};

/**
 * 품번이 숫자만이면 Excel 숫자로, 문자 혼합이면 텍스트로 출력.
 * (앞뒤 공백 제거 후 판별)
 */
export function exportPartNumberValue(
  partNumber: string,
): number | string {
  const raw = String(partNumber ?? "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : raw;
  }
  return raw;
}

export function buildProductionStatusExportRows(
  records: ProductionRecord[],
): ProductionStatusExportRow[] {
  const dailyMap = buildDailyShotMap(records);
  return records.map((r) => {
    const key = dailyShotKey(r.workDate, r.equipmentName, r.partNumber);
    const daily = dailyMap.get(key);
    const product = exportProductType(r.productType);
    const values: unknown[] = [
      toExcelDateValue(r.workDate),
      exportEquipmentClass(r.equipmentName),
      exportGsCode(r.productType),
      r.equipmentName,
      exportPartNumberValue(r.partNumber),
      product,
      r.cavity,
      r.shotCount,
      r.defectQuantity,
      r.productionQuantity,
      r.operatorName,
      r.shiftType,
      toExcelTimeValue(r.startedAt),
      toExcelTimeValue(r.endedAt),
      r.elapsedMinutes,
      r.downtimeMinutes,
      r.downtimeReasonRaw ?? "",
      r.averageShot,
      daily ?? null,
      null, // 단가
      null, // 생산금액(원)
      null, // GRADE
      null, // 1SHOT 중량
      null, // 총 사용량(g)
      null, // 원재료 비용(원)
      null, // 총 원재료 비용(원)
      null, // 비고(비가동 사유)
      exportFactoryLabel(r.factory, r.factoryRaw),
    ];
    return { record: r, dailyShot: daily ?? null, values };
  });
}

/** 양식과 동일한 제목 예: `2026년 10월 생산이력` */
export function formatTitlePeriod(records: ProductionRecord[]): string {
  if (records.length === 0) return "생산이력";
  let min = records[0]!.workDate;
  let max = records[0]!.workDate;
  for (const r of records) {
    if (r.workDate < min) min = r.workDate;
    if (r.workDate > max) max = r.workDate;
  }
  const a = parseIsoDateParts(min);
  const b = parseIsoDateParts(max);
  if (!a || !b) return "생산이력";
  if (a.y === b.y && a.m === b.m) {
    return `${a.y}년 ${a.m}월 생산이력`;
  }
  if (a.y === b.y) {
    return `${a.y}년 ${a.m}월~${b.m}월 생산이력`;
  }
  return `${a.y}년 ${a.m}월~${b.y}년 ${b.m}월 생산이력`;
}

/** 첨부 양식(생산현황 엑셀 내보내기 양식) 스타일 */
const DATE_FMT = 'mm"월" dd"일"';
const TIME_FMT = "h:mm;@";
const FONT_NAME = "맑은 고딕";
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};
/** 첨부 양식 Office 테마 기준 색 */
const TITLE_FILL = "FFDEEBF7"; // accent5(#5B9BD5) + tint 0.8
const HEADER_BLUE = "FF0070C0";
const HEADER_GOLD = "FFFFC000"; // theme7 = accent4
const HEADER_GREEN = "FF70AD47"; // theme9 = accent6
const HEADER_RED = "FFFF0000";
/** 데이터 셀 — 양식 theme tint 0.8 */
const FILL_LIGHT_BLUE = "FFDEEBF7"; // accent5 tint0.8 (G.S / 제품유형 G)
const FILL_LIGHT_GREEN = "FFE2EEDA"; // accent6 tint0.8 (제품유형 S / 비가동)
const FILL_LIGHT_GOLD = "FFFFF2CC"; // accent4 tint0.8 (평균SHOT / 일일판수)
const FONT_WHITE = "FFFFFFFF";
const FONT_BLACK = "FF000000";

const DATA_FILL_GOLD_COLS = new Set<ProductionStatusHeader>([
  "평균SHOT",
  "일일판수",
]);
const DATA_FILL_GREEN_COLS = new Set<ProductionStatusHeader>([
  "비가동 시간",
]);

const HEADER_GOLD_COLS = new Set<ProductionStatusHeader>([
  "품번",
  "C/V",
  "판수",
  "불량수량",
  "실적수량",
  "작업자",
  "평균SHOT",
  "일일판수",
]);
const HEADER_GREEN_COLS = new Set<ProductionStatusHeader>([
  "비가동 시간",
  "비가동 사유",
]);

function headerFillOf(header: ProductionStatusHeader): string {
  if (header === "공장구분") return HEADER_RED;
  if (HEADER_GOLD_COLS.has(header)) return HEADER_GOLD;
  if (HEADER_GREEN_COLS.has(header)) return HEADER_GREEN;
  return HEADER_BLUE;
}

function headerFontColorOf(header: ProductionStatusHeader): string {
  // 양식: 금색 헤더는 검정 글자, 파랑/초록/빨강 헤더는 흰 글자
  if (HEADER_GOLD_COLS.has(header)) return FONT_BLACK;
  return FONT_WHITE;
}

function applyDataCellFill(
  cell: ExcelJS.Cell,
  header: ProductionStatusHeader,
  value: unknown,
) {
  if (header === "G.S 구분" || header === "제품유형") {
    // G→연파랑, S→연초록 + 굵게
    const code = String(value ?? "").trim().toUpperCase();
    const fill =
      code === "S" ? FILL_LIGHT_GREEN : FILL_LIGHT_BLUE;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fill },
    };
    cell.font = {
      name: FONT_NAME,
      size: 11,
      bold: true,
      color: { argb: FONT_BLACK },
    };
    return;
  }
  if (DATA_FILL_GOLD_COLS.has(header)) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: FILL_LIGHT_GOLD },
    };
    return;
  }
  if (DATA_FILL_GREEN_COLS.has(header)) {
    // 비가동 시간 0(또는 비어 있음)은 배경색·굵기 없음
    const n =
      typeof value === "number"
        ? value
        : Number(String(value ?? "").replace(/,/g, ""));
    if (!Number.isFinite(n) || n === 0) return;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: FILL_LIGHT_GREEN },
    };
    cell.font = {
      name: FONT_NAME,
      size: 11,
      bold: true,
      color: { argb: FONT_BLACK },
    };
  }
}

function applyExportCell(
  cell: ExcelJS.Cell,
  header: ProductionStatusHeader,
  value: unknown,
  excelRow: number,
) {
  cell.font = { name: FONT_NAME, size: 11, color: { argb: "FF000000" } };
  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: false,
  };
  cell.border = THIN_BORDER;

  // 첨부 양식과 동일한 조회 수식 (단가/투입량/원재료 시트 필요)
  if (
    (TEMPLATE_FORMULA_HEADERS as readonly string[]).includes(header)
  ) {
    applyDataCellFill(cell, header, value);
    const formula = templateLookupFormula(
      header as (typeof TEMPLATE_FORMULA_HEADERS)[number],
      excelRow,
    );
    cell.value = { formula };
    if (
      header === "단가" ||
      header === "생산금액(원)" ||
      header === "원재료 비용(원)" ||
      header === "총 원재료 비용(원)" ||
      header === "총 사용량(g)" ||
      header === "1SHOT 중량"
    ) {
      cell.numFmt = "#,##0.##";
    }
    return;
  }

  if (
    (EMPTY_EXPORT_HEADERS as readonly string[]).includes(header) ||
    value === null ||
    value === undefined ||
    value === ""
  ) {
    applyDataCellFill(cell, header, value);
    cell.value = null;
    return;
  }

  applyDataCellFill(cell, header, value);

  if (header === "날짜" && value instanceof Date) {
    cell.value = value;
    cell.numFmt = DATE_FMT;
    return;
  }
  if (
    (header === "시작" || header === "종료") &&
    typeof value === "number"
  ) {
    cell.value = value;
    cell.numFmt = TIME_FMT;
    return;
  }
  if (typeof value === "number") {
    cell.value = value;
    if (header === "품번") {
      cell.numFmt = "0";
    } else if (header === "평균SHOT") {
      cell.numFmt = "0.0";
    } else if (
      header === "실적수량" ||
      header === "불량수량" ||
      header === "판수" ||
      header === "일일판수" ||
      header === "C/V" ||
      header === "작업시간" ||
      header === "비가동 시간"
    ) {
      cell.numFmt = "#,##0";
    }
    return;
  }
  cell.value = String(value);
}

export async function downloadProductionStatusExcel(options: {
  records: ProductionRecord[];
  fileName?: string;
  title?: string;
}): Promise<void> {
  const { records } = options;
  const exportRows = buildProductionStatusExportRows(records);
  const title = options.title ?? formatTitlePeriod(records);
  const fileName =
    options.fileName ??
    `생산현황_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const colCount = PRODUCTION_STATUS_HEADERS.length;

  const wb = new ExcelJS.Workbook();
  wb.creator = "생산분석";
  wb.created = new Date();

  const ws = wb.addWorksheet("생산현황", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: true }],
  });

  // 1행: 제목 — 양식처럼 연보라 배경 + 가운데 정렬
  ws.mergeCells(1, 1, 1, colCount);
  const titleRow = ws.getRow(1);
  titleRow.height = 37.5;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = titleRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: TITLE_FILL },
    };
    cell.border = THIN_BORDER;
  }
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
    name: FONT_NAME,
    size: 22,
    bold: true,
    color: { argb: "FF000000" },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  // 2행: 헤더 — 파랑/보라/청록/빨강 (첨부 양식 색 구분)
  const headerRow = ws.getRow(2);
  headerRow.height = 22;
  PRODUCTION_STATUS_HEADERS.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    cell.font = {
      name: FONT_NAME,
      size: header === "공장구분" ? 12 : 11,
      bold: true,
      color: { argb: headerFontColorOf(header) },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: headerFillOf(header) },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      // 설비 구분·G.S 구분·제품유형 등 헤더가 한 줄로 보이도록
      wrapText: false,
      shrinkToFit: false,
    };
    cell.border = THIN_BORDER;
  });

  exportRows.forEach((row, rowIdx) => {
    const excelRowNum = 3 + rowIdx;
    const excelRow = ws.getRow(excelRowNum);
    excelRow.height = 19.5;
    PRODUCTION_STATUS_HEADERS.forEach((header, colIdx) => {
      applyExportCell(
        excelRow.getCell(colIdx + 1),
        header,
        row.values[colIdx],
        excelRowNum,
      );
    });
  });

  // 열 너비 — 설비 구분 / G.S 구분 / 제품유형은 헤더가 한 줄에 들어가게 확보
  const widths = [
    13, 12, 11, 10.5, 25, 11, 11.5, 11.5, 13, 12, 17, 11, 11.5, 11.5, 13.5,
    17.5, 18, 14, 14, 11, 18, 20.5, 15, 15, 17, 20, 28, 17.5,
  ];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  if (exportRows.length > 0) {
    ws.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2 + exportRows.length, column: colCount },
    };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer as ArrayBufferLike);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const safeName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  downloadArrayBuffer(copy.buffer, safeName);
}

/** 업로드 파일 내 중복 키 (작업일자+설비+품번+주야) */
export function duplicateKeyOf(r: ProductionRecord): string {
  return `${r.workDate}\u0001${r.equipmentName}\u0001${r.partNumber}\u0001${r.shiftType}`;
}

export function findDuplicateKeys(
  records: ProductionRecord[],
): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const r of records) {
    const key = duplicateKeyOf(r);
    if (seen.has(key)) dupes.add(key);
    else seen.add(key);
  }
  return dupes;
}
