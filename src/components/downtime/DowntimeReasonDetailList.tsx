"use client";

import { useMemo } from "react";
import { formatMinutes, formatNumber, formatPercent } from "@/lib/format";
import { buildDowntimeReasonDetail } from "@/lib/downtimeReasonDetail";
import { reasonBadgeColor } from "@/lib/downtimeTopParts";
import type { ProductionRecord } from "@/types";

interface DowntimeReasonDetailListProps {
  records: ProductionRecord[];
}

export function DowntimeReasonDetailList({
  records,
}: DowntimeReasonDetailListProps) {
  const rows = useMemo(() => buildDowntimeReasonDetail(records), [records]);

  if (rows.length === 0) {
    return (
      <p className="dt-reason-detail-empty">
        표시할 비가동 사유 상세가 없습니다.
      </p>
    );
  }

  return (
    <div className="dt-reason-detail">
      <ul className="dt-reason-detail-list">
        {rows.map((row) => {
          const color = reasonBadgeColor(row.reason);
          return (
            <li key={row.reason} className="dt-reason-detail-row">
              <div className="dt-reason-detail-head">
                <span
                  className="dt-reason-detail-name"
                  style={{
                    color,
                    borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
                    background: `color-mix(in srgb, ${color} 12%, transparent)`,
                  }}
                >
                  {row.reason}
                </span>
                <span className="dt-reason-detail-share num">
                  {formatPercent(row.sharePercent, 1)}
                </span>
              </div>
              <div className="dt-reason-detail-track" aria-hidden>
                <div
                  className="dt-reason-detail-fill"
                  style={{
                    width: `${Math.max(row.barPercent, 2)}%`,
                    background: color,
                  }}
                />
              </div>
              <div className="dt-reason-detail-metrics">
                <span className="num">
                  <strong>{formatMinutes(row.attributedMinutes)}</strong>
                </span>
                <span className="num">{formatNumber(row.eventCount)}건</span>
                <span className="num">
                  평균 {formatNumber(row.avgMinutes, 1)}분
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
