"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPercent } from "@/lib/format";
import {
  buildDowntimeTopParts,
  formatDowntimeDuration,
  reasonBadgeColor,
  type DowntimeDurationUnit,
  type DowntimeTopPartRow,
  type DowntimeTopPartsProductTab,
  type DowntimeTopPartsView,
} from "@/lib/downtimeTopParts";
import type { ProductionRecord } from "@/types";

const PRODUCT_TABS: DowntimeTopPartsProductTab[] = ["전체", "GROMMET", "SEAL"];

function rankBadgeTone(rank: number): "gold" | "silver" | "bronze" | "muted" {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "muted";
}

function barFill(rank: number): string {
  if (rank === 1) return "#c2410c";
  if (rank === 2) return "#ea580c";
  if (rank === 3) return "#f97316";
  return "#fdba74";
}

function colorMixSoft(hex: string): string {
  return `color-mix(in srgb, ${hex} 16%, transparent)`;
}

function colorMixBorder(hex: string): string {
  return `color-mix(in srgb, ${hex} 35%, transparent)`;
}

function ReasonBadges({ reasons }: { reasons: DowntimeTopPartRow["reasons"] }) {
  if (reasons.length === 0) {
    return <span className="dt-top-reason-empty">-</span>;
  }
  return (
    <div className="dt-top-reason-badges">
      {reasons.map((r) => (
        <span
          key={r.reason}
          className="dt-top-reason-badge"
          style={{
            background: colorMixSoft(reasonBadgeColor(r.reason)),
            color: reasonBadgeColor(r.reason),
            borderColor: colorMixBorder(reasonBadgeColor(r.reason)),
          }}
        >
          {r.reason}
        </span>
      ))}
    </div>
  );
}

function RankRow({
  row,
  rank,
  unit,
  onOpen,
}: {
  row: DowntimeTopPartRow;
  rank: number;
  unit: DowntimeDurationUnit;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="dt-top-rank-row"
      data-rank={rank}
      onClick={onOpen}
      title={`${row.partNumber} 품번 상세 보기`}
    >
      <span className="dt-top-rank-badge" data-tone={rankBadgeTone(rank)}>
        {rank}
      </span>
      <div className="dt-top-rank-main">
        <div className="dt-top-rank-head">
          <strong className="dt-top-rank-part">{row.partNumber}</strong>
          <span className="dt-top-rank-type">{row.productType}</span>
        </div>
        <div className="dt-top-rank-track" aria-hidden>
          <div
            className="dt-top-rank-fill"
            style={{
              width: `${Math.max(row.barPercent, 2)}%`,
              background: barFill(rank),
            }}
          />
        </div>
      </div>
      <div className="dt-top-rank-metrics">
        <span className="dt-top-rank-minutes num">
          {formatDowntimeDuration(row.downtimeMinutes, unit)}
        </span>
        <span className="dt-top-rank-share num">
          {formatPercent(row.shareOfTotalPercent, 1)}
        </span>
      </div>
      <ReasonBadges reasons={row.reasons} />
    </button>
  );
}

function RankTooltipContent({
  row,
  unit,
}: {
  row: DowntimeTopPartRow;
  unit: DowntimeDurationUnit;
}) {
  return (
    <div className="dt-top-tooltip" role="tooltip">
      <p>
        <strong>품번:</strong> {row.partNumber}
      </p>
      <p>
        <strong>제품유형:</strong> {row.productType}
      </p>
      <p>
        <strong>비가동시간:</strong>{" "}
        {formatDowntimeDuration(row.downtimeMinutes, unit)}
      </p>
      <p>
        <strong>전체 대비:</strong> {formatPercent(row.shareOfTotalPercent, 1)}
      </p>
      <p>
        <strong>비가동 발생:</strong> {row.eventCount}건
      </p>
      <p>
        <strong>주요 사유:</strong>{" "}
        {row.reasons.map((r) => r.reason).join(", ") || "-"}
      </p>
      <p>
        <strong>관련 설비:</strong>{" "}
        {row.equipmentNames.length > 0 ? row.equipmentNames.join(", ") : "-"}
      </p>
    </div>
  );
}

function ParetoChart({
  rows,
  unit,
  onOpen,
}: {
  rows: DowntimeTopPartRow[];
  unit: DowntimeDurationUnit;
  onOpen: (id: string) => void;
}) {
  const data = rows.map((r, idx) => ({
    ...r,
    label: r.partNumber,
    rank: idx + 1,
  }));

  return (
    <div className="dt-top-pareto">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 8, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            interval={0}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            tickFormatter={(v) =>
              unit === "min"
                ? `${Math.round(Number(v))}`
                : `${(Number(v) / 60).toFixed(1)}`
            }
          />
          <Tooltip
            contentStyle={{
              background: "var(--elevated)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
            formatter={(value) => [
              formatDowntimeDuration(Number(value), unit),
              "비가동시간",
            ]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as DowntimeTopPartRow | undefined;
              if (!row) return "";
              return `${row.partNumber} (${row.productType})`;
            }}
          />
          <Legend />
          <Bar
            dataKey="downtimeMinutes"
            name="비가동시간"
            radius={[4, 4, 0, 0]}
            maxBarSize={42}
            cursor="pointer"
            onClick={(entry) => {
              const payload = entry as unknown as { id?: string };
              if (payload?.id) onOpen(payload.id);
            }}
          >
            {data.map((d) => (
              <Cell key={d.id} fill={barFill(d.rank)} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
      <p className="dt-top-pareto-hint">
        막대 클릭 시 해당 품번 상세 페이지로 이동합니다.
      </p>
    </div>
  );
}

export function DowntimeTopPartsChart({
  records,
  productTab,
  onProductTabChange,
  view,
  onViewChange,
  onOpenPart,
}: {
  records: ProductionRecord[];
  productTab: DowntimeTopPartsProductTab;
  onProductTabChange: (next: DowntimeTopPartsProductTab) => void;
  view: DowntimeTopPartsView;
  onViewChange: (next: DowntimeTopPartsView) => void;
  onOpenPart: (partId: string) => void;
}) {
  const unit: DowntimeDurationUnit = "min";
  const [hoverId, setHoverId] = useState<string | null>(null);

  const { rows, totalDowntimeMinutes, topShareOfTotalPercent } = useMemo(
    () => buildDowntimeTopParts(records, { productTab, limit: 10 }),
    [records, productTab],
  );

  const hovered = rows.find((r) => r.id === hoverId) ?? null;
  const topSum = rows.reduce((s, r) => s + r.downtimeMinutes, 0);

  return (
    <div className="dt-top-parts">
      <div className="dt-top-parts-toolbar">
        <div className="dt-product-tabs" role="tablist" aria-label="제품유형">
          {PRODUCT_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              className="dt-product-tab"
              aria-selected={productTab === tab}
              data-active={productTab === tab}
              onClick={() => onProductTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="dt-top-parts-controls">
          <div className="filter-pills" role="tablist" aria-label="보기 방식">
            <button
              type="button"
              className="filter-pill"
              data-active={view === "rank"}
              aria-selected={view === "rank"}
              onClick={() => onViewChange("rank")}
            >
              순위 차트
            </button>
            <button
              type="button"
              className="filter-pill"
              data-active={view === "pareto"}
              aria-selected={view === "pareto"}
              onClick={() => onViewChange("pareto")}
            >
              막대 차트
            </button>
          </div>
        </div>
      </div>

      <p className="dt-top-parts-summary">
        TOP 10 합계 {formatDowntimeDuration(topSum, unit)}
        {" · "}
        전체 대비 {formatPercent(topShareOfTotalPercent, 1)}
        {" · "}
        조회 범위 전체 {formatDowntimeDuration(totalDowntimeMinutes, unit)}
      </p>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
          표시할 비가동 품번이 없습니다.
        </p>
      ) : view === "pareto" ? (
        <ParetoChart rows={rows} unit={unit} onOpen={onOpenPart} />
      ) : (
        <div
          className="dt-top-rank-list"
          onMouseLeave={() => setHoverId(null)}
        >
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="dt-top-rank-item"
              onMouseEnter={() => setHoverId(row.id)}
            >
              <RankRow
                row={row}
                rank={idx + 1}
                unit={unit}
                onOpen={() => onOpenPart(row.id)}
              />
              {hovered?.id === row.id ? (
                <RankTooltipContent row={row} unit={unit} />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
