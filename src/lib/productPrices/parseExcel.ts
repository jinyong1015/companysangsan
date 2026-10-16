import * as XLSX from "xlsx";
import type { ParsedPriceRow, PricePreviewRow } from "@/lib/productPrices/types";

const PART_ALIASES = ["품번", "품 번", "part", "partnumber", "part_number"];
const PRICE_ALIASES = [
  "data 단가",
  "data단가",
  "ｄata 단가",
  "단가(data)",
  "단가",
];

function normHeader(v: unknown): string {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findHeaderRow(rows: unknown[][]): {
  headerRowIndex: number;
  partCol: number;
  priceCol: number;
} | null {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const row = rows[r] ?? [];
    let partCol = -1;
    let priceCol = -1;
    for (let c = 0; c < row.length; c++) {
      const h = normHeader(row[c]);
      if (!h) continue;
      // 품번: 정확 일치만 (제품유형 등 오매칭 방지)
      if (partCol < 0 && PART_ALIASES.some((a) => h === a)) {
        partCol = c;
      }
      if (
        priceCol < 0 &&
        (h === "data 단가" ||
          h === "data단가" ||
          (h.includes("data") && h.includes("단가")))
      ) {
        priceCol = c;
      }
    }
    // DATA 단가 우선, 없으면 일반 단가(정단가/가단가 제외)
    if (partCol >= 0 && priceCol < 0) {
      for (let c = 0; c < row.length; c++) {
        const h = normHeader(row[c]);
        if (
          h === "단가" ||
          (PRICE_ALIASES.includes(h) && !h.includes("정") && !h.includes("가단가"))
        ) {
          priceCol = c;
          break;
        }
      }
    }
    if (partCol >= 0 && priceCol >= 0) {
      return { headerRowIndex: r, partCol, priceCol };
    }
  }
  return null;
}

/** DB numeric(18,4) 와 동일한 비교용 반올림 */
export function roundPrice(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function pricesEqual(a: number, b: number): boolean {
  return roundPrice(a) === roundPrice(b);
}

function parsePriceNumber(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return roundPrice(raw);
  }
  const text = String(raw).trim().replace(/,/g, "");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? roundPrice(n) : null;
}

/** 품번: 앞뒤 공백만 제거 (하이픈·중간 공백 유지) */
export function normalizePartNumber(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function parseProductPriceExcel(buffer: ArrayBuffer): {
  rows: ParsedPriceRow[];
  errors: Array<{ excelRow: number; partNumber: string; reason: string }>;
  headerRowIndex: number;
} {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("엑셀 시트를 찾을 수 없습니다.");
  }
  const ws = wb.Sheets[sheetName]!;
  const matrix = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  const header = findHeaderRow(matrix);
  if (!header) {
    throw new Error(
      "헤더에서 '품번'과 'DATA 단가'(또는 data단가) 컬럼을 찾지 못했습니다.",
    );
  }

  const rows: ParsedPriceRow[] = [];
  const errors: Array<{ excelRow: number; partNumber: string; reason: string }> =
    [];

  for (let r = header.headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const excelRow = r + 1; // 1-based
    const partNumber = normalizePartNumber(row[header.partCol]);
    const priceRaw = row[header.priceCol];
    const allEmpty =
      !partNumber &&
      (priceRaw == null || String(priceRaw).trim() === "");
    if (allEmpty) continue;

    if (!partNumber) {
      errors.push({
        excelRow,
        partNumber: "",
        reason: "품번이 비어 있습니다.",
      });
      continue;
    }
    const unitPrice = parsePriceNumber(priceRaw);
    if (unitPrice == null) {
      errors.push({
        excelRow,
        partNumber,
        reason: "DATA 단가가 숫자가 아닙니다.",
      });
      continue;
    }
    // DATA 단가 0은 미등록으로 보고 DB에 넣지 않음
    if (unitPrice === 0) continue;
    if (unitPrice < 0) {
      errors.push({
        excelRow,
        partNumber,
        reason: "단가는 0보다 커야 합니다.",
      });
      continue;
    }
    rows.push({ excelRow, partNumber, unitPrice });
  }

  return { rows, errors, headerRowIndex: header.headerRowIndex };
}

/**
 * 파일 내 동일 품번 상충 단가 검증.
 * 동일 단가면 마지막 행만 유지, 상이하면 오류.
 */
export function resolveInFileDuplicates(rows: ParsedPriceRow[]): {
  unique: ParsedPriceRow[];
  conflicts: Array<{
    partNumber: string;
    excelRows: number[];
    prices: number[];
  }>;
} {
  const map = new Map<string, ParsedPriceRow[]>();
  for (const row of rows) {
    const list = map.get(row.partNumber) ?? [];
    list.push(row);
    map.set(row.partNumber, list);
  }
  const unique: ParsedPriceRow[] = [];
  const conflicts: Array<{
    partNumber: string;
    excelRows: number[];
    prices: number[];
  }> = [];

  for (const [partNumber, list] of map) {
    const prices: number[] = [];
    for (const item of list) {
      if (!prices.some((p) => pricesEqual(p, item.unitPrice))) {
        prices.push(item.unitPrice);
      }
    }
    if (prices.length > 1) {
      conflicts.push({
        partNumber,
        excelRows: list.map((x) => x.excelRow),
        prices,
      });
      continue;
    }
    unique.push(list[list.length - 1]!);
  }
  return { unique, conflicts };
}

export function buildPricePreview(
  unique: ParsedPriceRow[],
  existingByPart: Map<string, number>,
  parseErrors: Array<{ excelRow: number; partNumber: string; reason: string }>,
  conflicts: Array<{
    partNumber: string;
    excelRows: number[];
    prices: number[];
  }>,
): PricePreviewRow[] {
  const preview: PricePreviewRow[] = [];

  for (const err of parseErrors) {
    preview.push({
      excelRow: err.excelRow,
      partNumber: err.partNumber || "-",
      existingPrice: null,
      uploadPrice: null,
      action: "error",
      errorReason: err.reason,
    });
  }
  for (const c of conflicts) {
    preview.push({
      excelRow: c.excelRows[0] ?? 0,
      partNumber: c.partNumber,
      existingPrice: existingByPart.get(c.partNumber) ?? null,
      uploadPrice: null,
      action: "error",
      errorReason: `동일 품번에 서로 다른 단가(${c.prices.join(", ")}) — 행 ${c.excelRows.join(", ")}`,
    });
  }
  for (const row of unique) {
    const existing = existingByPart.get(row.partNumber);
    if (existing == null) {
      preview.push({
        excelRow: row.excelRow,
        partNumber: row.partNumber,
        existingPrice: null,
        uploadPrice: row.unitPrice,
        action: "insert",
      });
    } else if (!pricesEqual(existing, row.unitPrice)) {
      preview.push({
        excelRow: row.excelRow,
        partNumber: row.partNumber,
        existingPrice: existing,
        uploadPrice: row.unitPrice,
        action: "update",
      });
    } else {
      preview.push({
        excelRow: row.excelRow,
        partNumber: row.partNumber,
        existingPrice: existing,
        uploadPrice: row.unitPrice,
        action: "unchanged",
      });
    }
  }

  return preview.sort((a, b) => {
    const rank = { error: 0, insert: 1, update: 2, unchanged: 3 } as const;
    const d = rank[a.action] - rank[b.action];
    if (d !== 0) return d;
    return a.excelRow - b.excelRow;
  });
}
