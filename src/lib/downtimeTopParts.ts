import { downtimeReasonShares } from "@/lib/metrics";
import { isDowntimeEvent } from "@/lib/downtimeDetail";
import type { ProductType, ProductionRecord, ReasonShare } from "@/types";

export type DowntimeTopPartsProductTab = "전체" | ProductType;
export type DowntimeDurationUnit = "min" | "hour";
export type DowntimeTopPartsView = "rank" | "bar" | "pareto";

export type DowntimeTopPartRow = {
  id: string;
  partNumber: string;
  productType: ProductType;
  downtimeMinutes: number;
  eventCount: number;
  /** 조회조건 전체 비가동시간 대비 구성비 */
  shareOfTotalPercent: number;
  /** TOP N 최대값 대비 막대 비율 */
  barPercent: number;
  reasons: ReasonShare[];
  equipmentNames: string[];
};

const REASON_BADGE_COLORS: Record<string, string> = {
  고무이상: "#8B5CF6",
  근태변경: "#3B82F6",
  금형교체: "#F59E0B",
  금형세척: "#64748B",
  설비이상: "#E11D48",
  제품이상: "#14B8A6",
  기타: "#F97316",
};

/** 비가동 사유 도넛·상세·뱃지 공통 색상 */
export function reasonBadgeColor(reason: string): string {
  return REASON_BADGE_COLORS[reason] ?? REASON_BADGE_COLORS["기타"]!;
}

/** 분 ↔ 시간 표시. 시간은 `10시간 14분` 형식. */
export function formatDowntimeDuration(
  minutes: number,
  unit: DowntimeDurationUnit,
): string {
  const rounded = Math.round(minutes);
  if (unit === "min") {
    return `${rounded.toLocaleString("ko-KR")}분`;
  }
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h <= 0) return `${m.toLocaleString("ko-KR")}분`;
  if (m === 0) return `${h.toLocaleString("ko-KR")}시간`;
  return `${h.toLocaleString("ko-KR")}시간 ${m.toLocaleString("ko-KR")}분`;
}

function filterByProductTab(
  records: ProductionRecord[],
  productTab: DowntimeTopPartsProductTab,
): ProductionRecord[] {
  if (productTab === "전체") return records;
  return records.filter((r) => r.productType === productTab);
}

/**
 * 비가동시간 TOP N 품번.
 * - 막대 길이: TOP N 최대 비가동시간 대비
 * - 구성비: 선택 조회조건의 전체 품번 비가동시간 대비
 * - 막대 절대값: 행 비가동시간 합(복합 사유 중복 합산 없음)
 * - 사유 배지: 귀속시간 기준 상위 사유(최대 3개)
 */
export function buildDowntimeTopParts(
  records: ProductionRecord[],
  options: {
    productTab?: DowntimeTopPartsProductTab;
    limit?: number;
  } = {},
): {
  rows: DowntimeTopPartRow[];
  totalDowntimeMinutes: number;
  topShareOfTotalPercent: number;
} {
  const productTab = options.productTab ?? "전체";
  const limit = options.limit ?? 10;
  const scoped = filterByProductTab(records, productTab);
  const events = scoped.filter(isDowntimeEvent);

  const totalDowntimeMinutes = events.reduce(
    (s, r) => s + r.downtimeMinutes,
    0,
  );

  const byPart = new Map<string, ProductionRecord[]>();
  for (const r of events) {
    const list = byPart.get(r.partId) ?? [];
    list.push(r);
    byPart.set(r.partId, list);
  }

  const ranked = [...byPart.entries()]
    .map(([id, partRows]) => {
      const first = partRows[0]!;
      const downtimeMinutes = partRows.reduce(
        (s, r) => s + r.downtimeMinutes,
        0,
      );
      const reasons = downtimeReasonShares(partRows);
      const equipmentNames = [
        ...new Set(partRows.map((r) => r.equipmentName).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, "ko"));

      return {
        id,
        partNumber: first.partNumber,
        productType: first.productType,
        downtimeMinutes,
        eventCount: partRows.length,
        shareOfTotalPercent:
          totalDowntimeMinutes > 0
            ? (downtimeMinutes / totalDowntimeMinutes) * 100
            : 0,
        reasons,
        equipmentNames,
      };
    })
    .sort((a, b) => b.downtimeMinutes - a.downtimeMinutes);

  const top = ranked.slice(0, limit);
  const maxMinutes = Math.max(...top.map((r) => r.downtimeMinutes), 1);

  const rows: DowntimeTopPartRow[] = top.map((r) => ({
    ...r,
    barPercent: (r.downtimeMinutes / maxMinutes) * 100,
    reasons: r.reasons.slice(0, 3),
  }));

  const topShareOfTotalPercent = rows.reduce(
    (s, r) => s + r.shareOfTotalPercent,
    0,
  );

  return { rows, totalDowntimeMinutes, topShareOfTotalPercent };
}
