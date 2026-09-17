import { isDowntimeEvent } from "@/lib/downtimeDetail";
import type { ProductionRecord } from "@/types";

export type DowntimeReasonDetailRow = {
  reason: string;
  /** 해당 사유가 포함된 비가동시간 합계(복합사유 시 전액 귀속) */
  attributedMinutes: number;
  eventCount: number;
  avgMinutes: number;
  /** 전체 사유별 귀속시간 합 대비 비중 */
  sharePercent: number;
  barPercent: number;
};

/**
 * 비가동 사유별 상세 요약.
 * 복합사유라도 포함된 사유마다 해당 건의 비가동시간을 전액 귀속한다.
 */
export function buildDowntimeReasonDetail(
  records: ProductionRecord[],
): DowntimeReasonDetailRow[] {
  const events = records.filter(isDowntimeEvent);
  const map = new Map<string, { minutes: number; count: number }>();

  for (const r of events) {
    const tokens = [...new Set(r.reasonTokens.filter(Boolean))];
    for (const reason of tokens) {
      const cur = map.get(reason) ?? { minutes: 0, count: 0 };
      cur.minutes += r.downtimeMinutes;
      cur.count += 1;
      map.set(reason, cur);
    }
  }

  const rows = [...map.entries()]
    .map(([reason, v]) => ({
      reason,
      attributedMinutes: v.minutes,
      eventCount: v.count,
      avgMinutes: v.count > 0 ? v.minutes / v.count : 0,
    }))
    .sort(
      (a, b) =>
        b.attributedMinutes - a.attributedMinutes ||
        a.reason.localeCompare(b.reason, "ko"),
    );

  const total = rows.reduce((s, r) => s + r.attributedMinutes, 0);
  const max = rows[0]?.attributedMinutes ?? 0;

  return rows.map((r) => ({
    ...r,
    sharePercent: total > 0 ? (r.attributedMinutes / total) * 100 : 0,
    barPercent: max > 0 ? (r.attributedMinutes / max) * 100 : 0,
  }));
}
