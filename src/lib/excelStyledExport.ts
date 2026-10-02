import ExcelJS from "exceljs";
import { downloadArrayBuffer } from "@/lib/downloadBlob";

const HEADER_FILL = "1E3A5F";
const HEADER_FONT = "FFFFFF";
const TITLE_FONT = "0F172A";
const ZEBRA_FILL = "F8FAFC";
const BORDER_COLOR = "CBD5E1";
const ACCENT = "3B82F6";
const SUMMARY_FILL = "EEF2FF";

export type StyledExcelColumn = {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
  numFmt?: string;
};

function estimateWidth(header: string, values: unknown[]): number {
  const headerLen = [...header].length;
  let max = headerLen;
  for (const v of values.slice(0, 200)) {
    const len = [...String(v ?? "")].length;
    if (len > max) max = len;
  }
  return Math.min(42, Math.max(10, max + 2));
}

function cellBorder(): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: `FF${BORDER_COLOR}` },
  };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function applyHeaderCell(cell: ExcelJS.Cell) {
  cell.font = {
    name: "맑은 고딕",
    size: 10,
    bold: true,
    color: { argb: `FF${HEADER_FONT}` },
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${HEADER_FILL}` },
  };
  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  cell.border = cellBorder();
}

function writeMetaRows(
  ws: ExcelJS.Worksheet,
  lastCol: number,
  title: string,
  subtitle: string | undefined,
  rowCount: number,
) {
  ws.mergeCells(1, 1, 1, Math.max(lastCol, 1));
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
    name: "맑은 고딕",
    size: 16,
    bold: true,
    color: { argb: `FF${TITLE_FONT}` },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, Math.max(lastCol, 1));
  const metaCell = ws.getCell(2, 1);
  const stamped = new Date().toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  metaCell.value = [
    subtitle,
    `건수 ${rowCount.toLocaleString("ko-KR")}건`,
    `생성 ${stamped}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  metaCell.font = {
    name: "맑은 고딕",
    size: 10,
    color: { argb: "FF64748B" },
  };
  metaCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(2).height = 20;

  for (let c = 1; c <= Math.max(lastCol, 1); c += 1) {
    const cell = ws.getCell(2, c);
    cell.border = {
      ...cell.border,
      bottom: { style: "medium", color: { argb: `FF${ACCENT}` } },
    };
  }
}

async function writeWorkbook(
  wb: ExcelJS.Workbook,
  fileName: string,
): Promise<void> {
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

export function inferColumnsFromRows(
  rows: Record<string, unknown>[],
): StyledExcelColumn[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]!);
  return keys.map((key) => {
    const sample = rows.find(
      (r) => r[key] != null && r[key] !== "" && typeof r[key] === "number",
    );
    const isNum = sample != null;
    return {
      key,
      header: key,
      align: isNum ? "right" : "left",
      numFmt: isNum ? "#,##0.##" : undefined,
    };
  });
}

/**
 * 목록형 엑셀을 보기 좋게 내려받습니다.
 * 제목·메타 · 헤더 · 필터 · 틀고정 · 줄무늬 · 테두리
 */
export async function downloadStyledTableExcel(options: {
  fileName: string;
  sheetName?: string;
  title: string;
  subtitle?: string;
  columns: StyledExcelColumn[];
  rows: Record<string, unknown>[];
}): Promise<void> {
  const {
    fileName,
    sheetName = "DATA",
    title,
    subtitle,
    columns,
    rows,
  } = options;

  const wb = new ExcelJS.Workbook();
  wb.creator = "생산분석";
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  const lastCol = Math.max(columns.length, 1);
  writeMetaRows(ws, lastCol, title, subtitle, rows.length);

  const headerRow = ws.getRow(3);
  headerRow.height = 22;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    applyHeaderCell(cell);
  });

  rows.forEach((row, rowIdx) => {
    const excelRow = ws.getRow(4 + rowIdx);
    excelRow.height = 18;
    const zebra = rowIdx % 2 === 1;
    columns.forEach((col, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1);
      const raw = row[col.key];
      cell.value =
        raw === null || raw === undefined || raw === ""
          ? "-"
          : (raw as ExcelJS.CellValue);
      cell.font = { name: "맑은 고딕", size: 10, color: { argb: "FF1E293B" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: col.align ?? "left",
      };
      if (col.numFmt && typeof raw === "number") {
        cell.numFmt = col.numFmt;
      }
      if (zebra) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${ZEBRA_FILL}` },
        };
      }
      cell.border = cellBorder();
    });
  });

  columns.forEach((col, idx) => {
    const values = rows.map((r) => r[col.key]);
    ws.getColumn(idx + 1).width =
      col.width ?? estimateWidth(col.header, values);
  });

  if (rows.length > 0 && columns.length > 0) {
    ws.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3 + rows.length, column: lastCol },
    };
  }

  await writeWorkbook(wb, fileName);
}

/**
 * 기존 downloadExcel 호환 — 행 객체 배열을 스타일 적용해 내려받습니다.
 */
export async function downloadExcel(
  fileName: string,
  rows: Record<string, unknown>[],
  sheetName = "분석",
): Promise<void> {
  const title = fileName.replace(/\.xlsx$/i, "").replace(/_/g, " ");
  await downloadStyledTableExcel({
    fileName,
    sheetName,
    title,
    columns: inferColumnsFromRows(rows),
    rows,
  });
}

/**
 * AOA(헤더 포함 2차원 배열) 매트릭스형 엑셀을 스타일 적용해 내려받습니다.
 * 첫 행이 헤더, 이후는 데이터. summaryRowKeywords가 포함된 행은 강조합니다.
 */
export async function downloadStyledAoaExcel(options: {
  fileName: string;
  sheetName?: string;
  title: string;
  subtitle?: string;
  aoa: (string | number | null | undefined)[][];
  summaryRowKeywords?: string[];
}): Promise<void> {
  const {
    fileName,
    sheetName = "분석",
    title,
    subtitle,
    aoa,
    summaryRowKeywords = ["합계", "순위", "전체", "평균", "소계"],
  } = options;

  if (aoa.length === 0) {
    await downloadStyledTableExcel({
      fileName,
      sheetName,
      title,
      subtitle,
      columns: [],
      rows: [],
    });
    return;
  }

  const header = (aoa[0] ?? []).map((h) => String(h ?? ""));
  const dataRows = aoa.slice(1);
  const lastCol = Math.max(header.length, 1);

  const wb = new ExcelJS.Workbook();
  wb.creator = "생산분석";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  writeMetaRows(ws, lastCol, title, subtitle, dataRows.length);

  const headerRow = ws.getRow(3);
  headerRow.height = 22;
  header.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    applyHeaderCell(cell);
  });

  dataRows.forEach((row, rowIdx) => {
    const excelRow = ws.getRow(4 + rowIdx);
    excelRow.height = 18;
    const first = String(row[0] ?? "");
    const isSummary = summaryRowKeywords.some((k) => first.includes(k));
    const zebra = !isSummary && rowIdx % 2 === 1;

    for (let c = 0; c < lastCol; c += 1) {
      const cell = excelRow.getCell(c + 1);
      const raw = row[c];
      cell.value =
        raw === null || raw === undefined || raw === ""
          ? c === 0 && isSummary
            ? first
            : raw === ""
              ? ""
              : "-"
          : raw;
      cell.font = {
        name: "맑은 고딕",
        size: 10,
        bold: isSummary,
        color: { argb: "FF1E293B" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: typeof raw === "number" ? "right" : c === 0 ? "left" : "center",
      };
      if (typeof raw === "number") cell.numFmt = "#,##0.##";
      if (isSummary) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${SUMMARY_FILL}` },
        };
      } else if (zebra) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${ZEBRA_FILL}` },
        };
      }
      cell.border = cellBorder();
    }
  });

  header.forEach((h, idx) => {
    const values = dataRows.map((r) => r[idx]);
    ws.getColumn(idx + 1).width = estimateWidth(h, values);
  });

  if (dataRows.length > 0) {
    ws.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3 + dataRows.length, column: lastCol },
    };
  }

  await writeWorkbook(wb, fileName);
}
