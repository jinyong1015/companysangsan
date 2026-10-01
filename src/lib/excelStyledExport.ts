import ExcelJS from "exceljs";
import { downloadArrayBuffer } from "@/lib/excelParse";

const HEADER_FILL = "1E3A5F";
const HEADER_FONT = "FFFFFF";
const TITLE_FONT = "0F172A";
const ZEBRA_FILL = "F8FAFC";
const BORDER_COLOR = "CBD5E1";
const ACCENT = "3B82F6";

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

/**
 * 생산 DATA / 오류 DATA 등 목록형 엑셀을 보기 좋게 내려받습니다.
 * - 제목·생성시각 메타
 * - 진한 헤더 + 자동 필터 + 틀 고정
 * - 줄무늬 행 · 테두리 · 열 너비 자동
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

  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  const colCount = columns.length;
  const lastCol = colCount;

  // 1행: 제목
  ws.mergeCells(1, 1, 1, lastCol);
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

  // 2행: 부제 / 생성 시각
  ws.mergeCells(2, 1, 2, lastCol);
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
    `건수 ${rows.length.toLocaleString("ko-KR")}건`,
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

  // 악센트 라인 (제목 아래 느낌)
  for (let c = 1; c <= lastCol; c += 1) {
    const cell = ws.getCell(2, c);
    cell.border = {
      ...cell.border,
      bottom: { style: "medium", color: { argb: `FF${ACCENT}` } },
    };
  }

  // 3행: 헤더
  const headerRow = ws.getRow(3);
  headerRow.height = 22;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
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
  });

  // 데이터 행
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

  // 열 너비
  columns.forEach((col, idx) => {
    const values = rows.map((r) => r[col.key]);
    ws.getColumn(idx + 1).width =
      col.width ?? estimateWidth(col.header, values);
  });

  // 자동 필터 (헤더 행)
  if (rows.length > 0) {
    ws.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3 + rows.length, column: lastCol },
    };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer as ArrayBufferLike);
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const safeName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  downloadArrayBuffer(ab, safeName);
}
