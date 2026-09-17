"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Clock3, ListOrdered, Trophy } from "lucide-react";
import { ProductTypeTabs } from "@/components/production/ProductTypeTabs";
import type { ProductTab } from "@/components/production/ProductPerformanceSummary";
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

function rankTone(rank: number): "gold" | "silver" | "bronze" | "muted" {
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

type ChartRow = DowntimeTopPartRow & {
  rank: number;
  label: string;
};

function ReasonBadges({ reasons }: { reasons: DowntimeTopPartRow["reasons"] }) {
  if (reasons.length === 0) {
    return <span className="op-prod-top-share">-</span>;
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

function RankListView({
  rows,
  unit,
  onOpen,
}: {
  rows: ChartRow[];
  unit: DowntimeDurationUnit;
  onOpen: (id: string) => void;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hovered = rows.find((r) => r.id === hoverId) ?? null;

  return (
    <div className="op-prod-top-list" onMouseLeave={() => setHoverId(null)}>
      {rows.map((row) => (
        <div
          key={row.id}
          className="op-prod-top-item"
          data-top={row.rank <= 3 ? "true" : undefined}
          onMouseEnter={() => setHoverId(row.id)}
        >
          <button
            type="button"
            className="op-prod-top-row dt-top-op-row"
            data-rank={row.rank}
            onClick={() => onOpen(row.id)}
            title={`${row.partNumber} 상세 보기`}
          >
            <span className="op-prod-top-rank" data-tone={rankTone(row.rank)}>
              {row.rank}
            </span>
            <div className="op-prod-top-main">
              <div className="op-prod-top-row-head">
                <strong className="op-prod-top-name">{row.partNumber}</strong>
                <span className="op-prod-top-factory">{row.productType}</span>
              </div>
              <div className="op-prod-top-track" aria-hidden>
                <div
                  className="op-prod-top-fill"
                  style={{
                    width: `${Math.max(row.barPercent, 3)}%`,
                    background: barFill(row.rank),
                  }}
                />
              </div>
              <ReasonBadges reasons={row.reasons} />
            </div>
            <div className="op-prod-top-metrics">
              <span className="op-prod-top-qty num">
                <Clock3 size={13} aria-hidden />
                {formatDowntimeDuration(row.downtimeMinutes, unit)}
              </span>
              <span className="op-prod-top-share num">
                {formatPercent(row.shareOfTotalPercent, 1)}
              </span>
            </div>
          </button>

          {hovered?.id === row.id ? (
            <div className="op-prod-top-tooltip" role="tooltip">
              <p>
                <strong>{row.rank}위</strong> · {row.partNumber}
              </p>
              <p>제품유형: {row.productType}</p>
              <p>
                비가동시간: {formatDowntimeDuration(row.downtimeMinutes, unit)}
              </p>
              <p>전체 대비: {formatPercent(row.shareOfTotalPercent, 1)}</p>
              <p>비가동 발생: {row.eventCount}건</p>
              <p>
                주요 사유:{" "}
                {row.reasons.map((r) => r.reason).join(", ") || "-"}
              </p>
              <p>
                관련 설비:{" "}
                {row.equipmentNames.length > 0
                  ? row.equipmentNames.join(", ")
                  : "-"}
              </p>
              <p className="op-prod-top-tooltip-hint">클릭하여 상세 보기</p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function BarChartView({
  rows,
  unit,
  onOpen,
}: {
  rows: ChartRow[];
  unit: DowntimeDurationUnit;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="op-prod-top-chart op-prod-top-chart--labeled">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={rows}
          margin={{ top: 36, right: 16, left: 8, bottom: 56 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="partNumber"
            interval={0}
            height={58}
            tickMargin={10}
            tick={(props) => {
              const { x, y, payload, index } = props;
              const row = rows[index ?? 0];
              const name = String(payload?.value ?? "");
              const display =
                name.length > 10 ? `${name.slice(0, 10)}…` : name;
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={14}
                    textAnchor="middle"
                    className="op-prod-top-bar-name"
                  >
                    {display}
                  </text>
                  {row ? (
                    <text
                      x={0}
                      y={0}
                      dy={30}
                      textAnchor="middle"
                      className="op-prod-top-bar-rank"
                    >
                      {row.rank}위
                    </text>
                  ) : null}
                </g>
              );
            }}
          />
          <YAxis
            tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
            tickFormatter={(v) =>
              unit === "min"
                ? `${Math.round(Number(v)).toLocaleString("ko-KR")}`
                : `${(Number(v) / 60).toFixed(1)}`
            }
            width={72}
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
              const row = payload?.[0]?.payload as ChartRow | undefined;
              if (!row) return "";
              return `${row.rank}위 · ${row.partNumber} (${row.productType})`;
            }}
          />
          <Bar
            dataKey="downtimeMinutes"
            name="비가동시간"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
            cursor="pointer"
            onClick={(entry) => {
              const payload = entry as unknown as { id?: string };
              if (payload?.id) onOpen(payload.id);
            }}
          >
            {rows.map((d) => (
              <Cell key={d.id} fill={barFill(d.rank)} />
            ))}
            <LabelList
              dataKey="downtimeMinutes"
              position="top"
              offset={8}
              className="op-prod-top-bar-value"
              formatter={(value) =>
                formatDowntimeDuration(Number(value), unit)
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="op-prod-top-hint">
        막대 클릭 시 해당 품번 상세로 이동합니다.
      </p>
    </div>
  );
}

interface DowntimeTopPartsChartProps {
  records: ProductionRecord[];
  productTab: DowntimeTopPartsProductTab;
  onProductTabChange: (next: DowntimeTopPartsProductTab) => void;
  view: DowntimeTopPartsView;
  onViewChange: (next: DowntimeTopPartsView) => void;
  onOpenPart: (partId: string) => void;
}

export function DowntimeTopPartsChart({
  records,
  productTab,
  onProductTabChange,
  view,
  onViewChange,
  onOpenPart,
}: DowntimeTopPartsChartProps) {
  const unit: DowntimeDurationUnit = "min";

  const { chartRows, topSum, totalDowntimeMinutes, topShare, tabCounts } =
    useMemo(() => {
      const built = buildDowntimeTopParts(records, {
        productTab,
        limit: 10,
      });
      const sum = built.rows.reduce((s, r) => s + r.downtimeMinutes, 0);

      const counts: Partial<Record<ProductTab, number>> = {};
      for (const tab of ["전체", "GROMMET", "SEAL"] as const) {
        counts[tab] = buildDowntimeTopParts(records, {
          productTab: tab,
          limit: 10,
        }).rows.length;
      }

      return {
        chartRows: built.rows.map((r, idx) => ({
          ...r,
          rank: idx + 1,
          label: r.partNumber,
        })) as ChartRow[],
        topSum: sum,
        totalDowntimeMinutes: built.totalDowntimeMinutes,
        topShare: built.topShareOfTotalPercent,
        tabCounts: counts,
      };
    }, [records, productTab]);

  const titlePrefix = productTab === "전체" ? "전체" : productTab;
  const tone =
    productTab === "SEAL"
      ? "seal"
      : productTab === "GROMMET"
        ? "grommet"
        : "all";
  const chartView = view === "pareto" ? "bar" : view;

  return (
    <section className="op-prod-top mb-4" data-tone={tone}>
      <header className="op-prod-top-head">
        <div className="op-prod-top-head-main">
          <span className="op-prod-top-badge">
            <Trophy size={14} aria-hidden />
            {titlePrefix}
          </span>
          <div>
            <h2 className="op-prod-top-title">비가동시간 TOP 10 품번</h2>
            <p className="op-prod-top-sub">
              품번별 비가동시간 기준 상위 10개
            </p>
          </div>
        </div>
        <div className="op-prod-top-head-controls">
          <ProductTypeTabs
            value={productTab}
            onChange={onProductTabChange}
            counts={tabCounts}
            ariaLabel="비가동시간 TOP 제품유형"
            compact
            className="op-prod-top-tabs"
          />
          <div className="filter-pills" role="tablist" aria-label="보기 방식">
            <button
              type="button"
              className="filter-pill"
              role="tab"
              aria-selected={chartView === "rank"}
              data-active={chartView === "rank"}
              onClick={() => onViewChange("rank")}
            >
              <ListOrdered size={14} aria-hidden />
              가로 순위
            </button>
            <button
              type="button"
              className="filter-pill"
              role="tab"
              aria-selected={chartView === "bar"}
              data-active={chartView === "bar"}
              onClick={() => onViewChange("bar")}
            >
              <BarChart3 size={14} aria-hidden />
              막대 차트
            </button>
          </div>
        </div>
      </header>

      {chartRows.length === 0 ? (
        <p className="op-prod-top-empty">
          선택한 제품유형에 해당하는 비가동 품번 데이터가 없습니다.
        </p>
      ) : (
        <div className="op-prod-top-body">
          <div className="op-prod-top-summary">
            <div className="op-prod-top-stat">
              <span className="op-prod-top-stat-label">TOP 10 합계</span>
              <strong className="op-prod-top-stat-value">
                {formatDowntimeDuration(topSum, unit)}
              </strong>
            </div>
            <div className="op-prod-top-stat">
              <span className="op-prod-top-stat-label">전체 대비</span>
              <strong className="op-prod-top-stat-value">
                {formatPercent(topShare, 1)}
              </strong>
            </div>
            <div className="op-prod-top-stat">
              <span className="op-prod-top-stat-label">조회 범위 전체</span>
              <strong className="op-prod-top-stat-value">
                {formatDowntimeDuration(totalDowntimeMinutes, unit)}
              </strong>
            </div>
          </div>

          {chartView === "bar" ? (
            <BarChartView rows={chartRows} unit={unit} onOpen={onOpenPart} />
          ) : (
            <RankListView rows={chartRows} unit={unit} onOpen={onOpenPart} />
          )}
        </div>
      )}
    </section>
  );
}
