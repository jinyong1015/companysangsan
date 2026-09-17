"use client";

import { useMemo } from "react";
import { Clock3, Gauge, PauseCircle } from "lucide-react";
import { formatNumber, clsx } from "@/lib/format";
import type { ProductPerformanceRow } from "@/types";
import type { ProductTab } from "@/components/production/ProductPerformanceSummary";

type RankEntry = {
  id: string;
  partNumber: string;
  value: number;
};

function topN(
  rows: ProductPerformanceRow[],
  getter: (r: ProductPerformanceRow) => number,
  n = 10,
): RankEntry[] {
  return [...rows]
    .filter((r) => getter(r) > 0)
    .sort((a, b) => getter(b) - getter(a))
    .slice(0, n)
    .map((r) => ({
      id: r.id,
      partNumber: r.partNumber,
      value: getter(r),
    }));
}

function padRanks(entries: RankEntry[], n = 10): Array<RankEntry | null> {
  const out: Array<RankEntry | null> = [...entries];
  while (out.length < n) out.push(null);
  return out;
}

interface ProductShotTopWorstProps {
  rows: ProductPerformanceRow[];
  productTab: ProductTab;
}

export function ProductShotTopWorst({ rows, productTab }: ProductShotTopWorstProps) {
  const titlePrefix = productTab === "전체" ? "전체" : productTab;
  const tone =
    productTab === "SEAL" ? "seal" : productTab === "GROMMET" ? "grommet" : "all";

  const ranks = useMemo(() => {
    const elapsed = padRanks(topN(rows, (r) => r.elapsedMinutes));
    const shots = padRanks(topN(rows, (r) => r.shotCount));
    const downtime = padRanks(topN(rows, (r) => r.downtimeMinutes));
    return { elapsed, shots, downtime };
  }, [rows]);

  const hasAny = rows.some(
    (r) => r.elapsedMinutes > 0 || r.shotCount > 0 || r.downtimeMinutes > 0,
  );

  return (
    <section className="pps-top-worst mb-4" data-tone={tone}>
      <header className="pps-top-worst-head">
        <div className="pps-top-worst-head-main">
          <span className="pps-top-worst-badge">{titlePrefix}</span>
          <div>
            <h2 className="pps-top-worst-title">품번 TOP & WORST 10</h2>
            <p className="pps-top-worst-sub">
              총 작업시간 · 총 SHOT · 비가동시간 기준 상위 10개 품번
            </p>
          </div>
        </div>
        <div className="pps-top-worst-legend">
          <span>
            <Clock3 size={14} /> 작업시간
          </span>
          <span>
            <Gauge size={14} /> SHOT
          </span>
          <span>
            <PauseCircle size={14} /> 비가동
          </span>
        </div>
      </header>

      {!hasAny ? (
        <div className="pps-top-worst-empty">
          선택한 제품유형에 해당하는 TOP 데이터가 없습니다.
        </div>
      ) : (
        <div className="table-wrap pps-top-worst-wrap">
          <table className="pps-top-worst-table">
            <thead>
              <tr>
                <th className="pps-tw-no" rowSpan={2}>
                  NO
                </th>
                <th className="pps-tw-group pps-tw-group-elapsed" colSpan={2}>
                  <span className="pps-tw-group-inner">
                    <Clock3 size={14} />
                    총 작업시간
                  </span>
                </th>
                <th className="pps-tw-group pps-tw-group-shot" colSpan={2}>
                  <span className="pps-tw-group-inner">
                    <Gauge size={14} />
                    총 SHOT
                  </span>
                </th>
                <th className="pps-tw-group pps-tw-group-down" colSpan={2}>
                  <span className="pps-tw-group-inner">
                    <PauseCircle size={14} />
                    비가동 TOP
                  </span>
                </th>
              </tr>
              <tr>
                <th className="pps-tw-sub">품번</th>
                <th className="pps-tw-sub">분</th>
                <th className="pps-tw-sub">품번</th>
                <th className="pps-tw-sub">SHOT</th>
                <th className="pps-tw-sub">품번</th>
                <th className="pps-tw-sub">분</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => {
                const elapsed = ranks.elapsed[i] ?? null;
                const shot = ranks.shots[i] ?? null;
                const down = ranks.downtime[i] ?? null;
                return (
                  <tr key={i} className={clsx(i < 3 && "pps-tw-top-row")}>
                    <td className="pps-tw-no">
                      <span className={clsx("pps-tw-rank", i < 3 && `pps-tw-rank-${i + 1}`)}>
                        {i + 1}
                      </span>
                    </td>
                    <RankCells entry={elapsed} />
                    <RankCells entry={shot} />
                    <RankCells entry={down} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RankCells({ entry }: { entry: RankEntry | null }) {
  if (!entry) {
    return (
      <>
        <td className="pps-tw-part pps-tw-empty">-</td>
        <td className="pps-tw-value pps-tw-empty">-</td>
      </>
    );
  }

  return (
    <>
      <td className="pps-tw-part">{entry.partNumber}</td>
      <td className="pps-tw-value">{formatNumber(Math.round(entry.value))}</td>
    </>
  );
}
