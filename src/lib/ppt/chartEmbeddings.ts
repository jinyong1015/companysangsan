import ExcelJS from "exceljs";
import type JSZip from "jszip";
import {
  activeDowntimeReasons,
  PPT_DOWNTIME_REASONS,
} from "@/lib/ppt/slideMaps";
import type { MonthlyKpiPptSnapshot } from "@/lib/ppt/types";
import type { ProductType } from "@/types";

async function loadWorkbook(
  zip: JSZip,
  embeddingPath: string,
): Promise<ExcelJS.Workbook | null> {
  const entry = zip.file(embeddingPath);
  if (!entry) return null;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await entry.async("arraybuffer"));
  return wb;
}

async function saveWorkbook(
  zip: JSZip,
  embeddingPath: string,
  wb: ExcelJS.Workbook,
): Promise<void> {
  const buf = await wb.xlsx.writeBuffer();
  zip.file(embeddingPath, buf);
}

/** chartN.xml.rels에서 임베딩 경로를 읽는다. */
export async function resolveChartEmbedding(
  zip: JSZip,
  chartFile: string,
): Promise<string | null> {
  const entry = zip.file(`ppt/charts/_rels/${chartFile}.rels`);
  if (!entry) return null;
  const xml = await entry.async("string");
  const m = xml.match(/Target="\.\.\/embeddings\/([^"]+)"/);
  if (!m) return null;
  return `ppt/embeddings/${m[1]}`;
}

/** 차트 수식에서 데이터 시작 행을 읽는다. 기본 2행. */
async function resolveTrendDataStartRow(
  zip: JSZip,
  chartFile: string,
): Promise<number> {
  const entry = zip.file(`ppt/charts/${chartFile}`);
  if (!entry) return 2;
  const xml = await entry.async("string");
  const m = xml.match(/<c:cat>[\s\S]*?<c:f>[^<]*\$[A-Z]+\$(\d+)/i);
  if (!m) return 2;
  const start = Number(m[1]);
  return Number.isFinite(start) && start >= 1 ? start : 2;
}

/** 월별 추이 차트 임베딩 (A=라벨, B=값) — 차트 수식 시작 행에 맞춤 */
export async function syncMonthlyTrendEmbedding(
  zip: JSZip,
  chartFile: string,
  labels: string[],
  values: number[],
  seriesName = "비가동 현황",
): Promise<void> {
  const path = await resolveChartEmbedding(zip, chartFile);
  if (!path) return;
  const wb = await loadWorkbook(zip, path);
  if (!wb) return;
  const sheet = wb.worksheets[0];
  if (!sheet) return;

  const startRow = await resolveTrendDataStartRow(zip, chartFile);
  sheet.getCell(1, 1).value = " ";
  sheet.getCell(1, 2).value = seriesName;
  // 시작 행 앞쪽(헤더 제외) 잔여 데이터 제거
  for (let r = 2; r < startRow; r += 1) {
    sheet.getCell(r, 1).value = null;
    sheet.getCell(r, 2).value = null;
  }
  const n = Math.max(labels.length, values.length);
  for (let i = 0; i < n; i += 1) {
    sheet.getCell(startRow + i, 1).value = labels[i] ?? "";
    const v = values[i];
    // 조회월 이후 NaN → 빈 칸 (선이 이어지지 않음)
    sheet.getCell(startRow + i, 2).value = Number.isFinite(v) ? v : null;
  }
  for (let r = startRow + n; r <= 30; r += 1) {
    sheet.getCell(r, 1).value = null;
    sheet.getCell(r, 2).value = null;
  }
  await saveWorkbook(zip, path, wb);
}

/**
 * 사유별 전월/당월 비교 차트 임베딩.
 * 템플릿은 F=전달, G=조회월 열을 참조하므로 해당 열을 덮어쓴다.
 */
export async function syncDowntimeCompareEmbedding(
  zip: JSZip,
  chartFile: string,
  snapshot: MonthlyKpiPptSnapshot,
  product: ProductType,
): Promise<void> {
  const path = await resolveChartEmbedding(zip, chartFile);
  if (!path) return;
  const wb = await loadWorkbook(zip, path);
  if (!wb) return;
  const sheet = wb.worksheets[0];
  if (!sheet) return;

  const prevLabel = snapshot.kpiPrev.label;
  const curLabel = snapshot.kpiCurrent.label;
  // col F=6, G=7
  sheet.getCell(1, 6).value = prevLabel;
  sheet.getCell(1, 7).value = curLabel;

  const reasons = activeDowntimeReasons(snapshot, product);
  const maxRows = Math.max(reasons.length, PPT_DOWNTIME_REASONS.length);
  for (let i = 0; i < maxRows; i += 1) {
    const row = i + 2;
    const reason = reasons[i];
    if (reason) {
      sheet.getCell(row, 1).value = reason;
      const prev =
        snapshot.downtime[product].previous.summary.minutesByReason[reason] ??
        0;
      const cur =
        snapshot.downtime[product].current.summary.minutesByReason[reason] ??
        0;
      sheet.getCell(row, 6).value = Math.round(prev);
      sheet.getCell(row, 7).value = Math.round(cur);
    } else {
      sheet.getCell(row, 1).value = null;
      sheet.getCell(row, 6).value = null;
      sheet.getCell(row, 7).value = null;
    }
  }
  await saveWorkbook(zip, path, wb);
}

/** 일별 생산 차트 임베딩 — A=일, B=생산금액(없음→0), C=생산수량 */
export async function syncDailyQtyEmbedding(
  zip: JSZip,
  chartFile: string,
  days: number[],
  quantities: number[],
): Promise<void> {
  const path = await resolveChartEmbedding(zip, chartFile);
  if (!path) return;
  const wb = await loadWorkbook(zip, path);
  if (!wb) return;
  const sheet = wb.worksheets[0];
  if (!sheet) return;

  sheet.getCell(1, 1).value = " ";
  sheet.getCell(1, 2).value = "생산금액";
  sheet.getCell(1, 3).value = "생산수량";
  for (let i = 0; i < 31; i += 1) {
    const row = i + 2;
    sheet.getCell(row, 1).value = days[i] ?? i + 1;
    sheet.getCell(row, 2).value = 0; // 금액 데이터 없음
    sheet.getCell(row, 3).value = quantities[i] ?? 0;
    // 예전 잘못 쓰이던 D열 잔여값 제거
    sheet.getCell(row, 4).value = null;
  }
  await saveWorkbook(zip, path, wb);
}

export async function syncRankEmbedding(
  zip: JSZip,
  chartFile: string,
  rows: Array<{ name: string; value: number }>,
): Promise<void> {
  const path = await resolveChartEmbedding(zip, chartFile);
  if (!path) return;
  const wb = await loadWorkbook(zip, path);
  if (!wb) return;
  const sheet = wb.worksheets[0];
  if (!sheet) return;

  for (let i = 0; i < 10; i += 1) {
    const row = i + 2;
    const item = rows[i];
    sheet.getCell(row, 1).value = item?.name ?? "";
    sheet.getCell(row, 2).value = item?.value ?? 0;
  }
  await saveWorkbook(zip, path, wb);
}
