"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, PauseCircle } from "lucide-react";
import { ProductionQuantityDetailModal } from "@/components/production/ProductionQuantityDetailModal";
import { formatNumber, clsx } from "@/lib/format";
import {
  withFromParam,
  withPeriodParams,
  type DetailBackSource,
} from "@/lib/navigation";
import type { ProductPerformanceRow } from "@/types";
import type { ProductTab } from "@/components/production/ProductPerformanceSummary";

type RankKind = "elapsed" | "downtime";

type RankEntry = {
  id: string;
  partNumber: string;
  value: number;
  kind: RankKind;
  rank: number;
};

function topN(
  rows: ProductPerformanceRow[],
  getter: (r: ProductPerformanceRow) => number,
  kind: RankKind,
  n = 10,
): RankEntry[] {
  return [...rows]
    .filter((r) => getter(r) > 0)
    .sort((a, b) => getter(b) - getter(a))
    .slice(0, n)
    .map((r, idx) => ({
      id: r.id,
      partNumber: r.partNumber,
      value: getter(r),
      kind,
      rank: idx + 1,
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
  from?: DetailBackSource;
  startDate?: string;
  endDate?: string;
}

export function ProductShotTopWorst({
  rows,
  productTab,
  from = "home",
  startDate,
  endDate,
}: ProductShotTopWorstProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<RankEntry | null>(null);

  const titlePrefix = productTab === "전체" ? "전체" : productTab;
  const tone =
    productTab === "SEAL" ? "seal" : productTab === "GROMMET" ? "grommet" : "all";

  const summary = useMemo(() => {
    const elapsedMinutes = rows.reduce((s, r) => s + r.elapsedMinutes, 0);
    const operatingMinutes = rows.reduce((s, r) => s + r.operatingMinutes, 0);
    const shotCount = rows.reduce((s, r) => s + r.shotCount, 0);
    const workDays = rows.reduce((s, r) => s + r.workDays, 0);
    return {
      elapsedMinutes,
      operatingMinutes,
      shotCount,
      dailyAvgShots: workDays > 0 ? shotCount / workDays : null,
    };
  }, [rows]);

  const ranks = useMemo(() => {
    const elapsed = padRanks(
      topN(rows, (r) => r.elapsedMinutes, "elapsed"),
    );
    const downtime = padRanks(
      topN(rows, (r) => r.downtimeMinutes, "downtime"),
    );
    return { elapsed, downtime };
  }, [rows]);

  const hasAny = rows.some(
    (r) => r.elapsedMinutes > 0 || r.downtimeMinutes > 0,
  );

  const periodLabel =
    startDate && endDate ? `${startDate} ~ ${endDate}` : undefined;

  const openDetailPage = (entry: RankEntry) => {
    let href = `/parts/${entry.id}`;
    if (startDate && endDate) {
      href = withPeriodParams(href, startDate, endDate);
    }
    router.push(withFromParam(href, from));
  };

  const kindLabel =
    selected?.kind === "downtime" ? "비가동 시간 TOP 10" : "총 작업시간 TOP10";

  return (
    <section className="pps-top-worst mb-4" data-tone={tone}>
      <header className="pps-top-worst-head">
        <div className="pps-top-worst-head-main">
          <span className="pps-top-worst-badge">{titlePrefix}</span>
          <div>
            <h2 className="pps-top-worst-title">품번 TOP & WORST 10</h2>
            <p className="pps-top-worst-sub">
              총 작업시간 TOP10 · 비가동 시간 TOP 10
            </p>
          </div>
        </div>
        <div className="pps-top-worst-legend">
          <span>
            <Clock3 size={14} /> 총 작업시간 TOP10
          </span>
          <span>
            <PauseCircle size={14} /> 비가동 시간 TOP 10
          </span>
        </div>
      </header>

      <div className="pps-tw-summary-wrap">
        <table className="pps-tw-summary-table">
          <thead>
            <tr>
              <th>총 작업시간(min)</th>
              <th>가동시간(min)</th>
              <th>총 SHOT</th>
              <th>평균 SHOT(日)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="num">
                {formatNumber(Math.round(summary.elapsedMinutes))}
              </td>
              <td className="num">
                {formatNumber(Math.round(summary.operatingMinutes))}
              </td>
              <td className="num">
                {formatNumber(Math.round(summary.shotCount))}
              </td>
              <td className="num">
                {summary.dailyAvgShots == null
                  ? "-"
                  : formatNumber(Math.round(summary.dailyAvgShots))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

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
                    총 작업시간 TOP10
                  </span>
                </th>
                <th className="pps-tw-group pps-tw-group-down" colSpan={2}>
                  <span className="pps-tw-group-inner">
                    <PauseCircle size={14} />
                    비가동 시간 TOP 10
                  </span>
                </th>
              </tr>
              <tr>
                <th className="pps-tw-sub">품번</th>
                <th className="pps-tw-sub">분</th>
                <th className="pps-tw-sub">품번</th>
                <th className="pps-tw-sub">분</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => {
                const elapsed = ranks.elapsed[i] ?? null;
                const down = ranks.downtime[i] ?? null;
                return (
                  <tr key={i} className={clsx(i < 3 && "pps-tw-top-row")}>
                    <td className="pps-tw-no">
                      <span className={clsx("pps-tw-rank", i < 3 && `pps-tw-rank-${i + 1}`)}>
                        {i + 1}
                      </span>
                    </td>
                    <RankCells entry={elapsed} onSelect={setSelected} />
                    <RankCells entry={down} onSelect={setSelected} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <ProductionQuantityDetailModal
          title={`${selected.rank}위 · ${selected.partNumber}`}
          subtitle={`${titlePrefix} · ${kindLabel}`}
          fields={[
            { label: "순위", value: `${selected.rank}위` },
            { label: "품번", value: selected.partNumber },
            { label: "구분", value: kindLabel },
            {
              label: selected.kind === "downtime" ? "비가동시간" : "총 작업시간",
              value: `${formatNumber(Math.round(selected.value))} 분`,
            },
            ...(periodLabel
              ? [{ label: "조회기간", value: periodLabel }]
              : []),
          ]}
          primaryLabel="품번 상세내역으로 이동"
          onPrimary={() => openDetailPage(selected)}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}

function RankCells({
  entry,
  onSelect,
}: {
  entry: RankEntry | null;
  onSelect: (entry: RankEntry) => void;
}) {
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
      <td className="pps-tw-part">
        <button
          type="button"
          className="pps-tw-part-btn"
          title={`${entry.partNumber} 상세 보기`}
          onClick={() => onSelect(entry)}
        >
          {entry.partNumber}
        </button>
      </td>
      <td className="pps-tw-value">{formatNumber(Math.round(entry.value))}</td>
    </>
  );
}
