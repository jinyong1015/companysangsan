"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReasonShare, TrendPoint } from "@/types";
import { formatMinutes, formatNumber, formatPercent, formatQuantity, formatUph } from "@/lib/format";
import { reasonBadgeColor } from "@/lib/downtimeTopParts";
import { useState, type CSSProperties, type ReactNode } from "react";

export function ProductionUtilizationTrend({
  data,
  height = 360,
  showTableToggle = true,
}: {
  data: TrendPoint[];
  height?: number;
  /** false면 차트만 표시 (표로 보기 숨김) */
  showTableToggle?: boolean;
}) {
  const [showTable, setShowTable] = useState(false);
  const tableVisible = showTableToggle && showTable;
  return (
    <div>
      {showTableToggle ? (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "차트로 보기" : "표로 보기"}
          </button>
        </div>
      ) : null}
      {tableVisible ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>기간</th>
                <th className="num">생산량</th>
                <th className="num">가동률</th>
                <th className="num">UPH</th>
                <th className="num">유효 DATA</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.period}>
                  <td>{d.label}</td>
                  <td className="num">{formatQuantity(d.productionQuantity)}</td>
                  <td className="num">{formatPercent(d.utilizationRatePercent)}</td>
                  <td className="num">{formatUph(d.uph)}</td>
                  <td className="num">{formatNumber(d.validRows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
              <YAxis
                yAxisId="left"
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                tickFormatter={(v) => formatNumber(v)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
                formatter={(value, name) => {
                  if (name === "생산량") return [formatQuantity(Number(value)), name];
                  if (name === "가동률") return [formatPercent(Number(value)), name];
                  return [String(value), String(name)];
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="productionQuantity"
                name="생산량"
                fill="var(--metric-production)"
                radius={[6, 6, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="utilizationRatePercent"
                name="가동률"
                stroke="var(--metric-util)"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function DowntimeReasonDonut({
  data,
}: {
  data: ReasonShare[];
}) {
  if (!data.length) {
    return (
      <p className="flex min-h-[200px] items-center justify-center text-sm text-muted">
        표시할 비가동 사유가 없습니다.
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="downtimeMinutes"
            nameKey="reason"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell
                key={entry.reason}
                fill={reasonBadgeColor(entry.reason)}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _n, item) => [
              `${formatMinutes(Number(value))} · ${formatPercent(
                (item as { payload?: ReasonShare }).payload?.sharePercent ?? 0,
              )}`,
              String((item as { payload?: ReasonShare }).payload?.reason ?? ""),
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HorizontalRankBars({
  rows,
  valueKey,
  valueFormatter,
  onClick,
}: {
  rows: Array<{ id: string; name: string; value: number; secondary?: string }>;
  valueKey?: string;
  valueFormatter: (v: number) => string;
  onClick?: (id: string) => void;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3" aria-label={valueKey}>
      {rows.map((row, idx) => (
        <button
          key={row.id}
          type="button"
          className="rank-bar-btn"
          onClick={() => onClick?.(row.id)}
        >
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span>
              <span className="mr-2 text-[var(--text-secondary)]">{idx + 1}</span>
              <span className="linkish">{row.name}</span>
            </span>
            <span className="text-[var(--text-secondary)]">
              {valueFormatter(row.value)}
              {row.secondary ? ` · ${row.secondary}` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_70%,transparent)]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}

export function SimpleBarChart({
  data,
  dataKey,
  name,
  color = "var(--metric-production)",
}: {
  data: Array<Record<string, string | number | null>>;
  dataKey: string;
  name: string;
  color?: string;
}) {
  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
          <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: "var(--elevated)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type PeriodChartRow = {
  label: string;
  qty: number;
  uph: number;
};

function periodChartAxisWidth(values: number[]) {
  const max = Math.max(0, ...values, 0);
  return Math.max(
    48,
    Math.min(88, String(max.toLocaleString("ko-KR")).length * 8 + 14),
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`;
  return value.toLocaleString("ko-KR");
}

const periodTooltipStyle = {
  border: "1px solid color-mix(in srgb, var(--border) 90%, #dbe3ee)",
  borderRadius: 14,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
  fontSize: 12,
  backgroundColor: "color-mix(in srgb, var(--elevated) 96%, transparent)",
} as const;

function PeriodChartShell({
  children,
  stats,
  legend,
  empty,
}: {
  children: ReactNode;
  stats?: Array<{ label: string; value: string }>;
  legend?: ReactNode;
  empty?: boolean;
}) {
  if (empty) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-line bg-canvas/50 px-4 text-sm text-muted">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line/70 bg-surface px-3 pb-3 pt-3">
      {stats?.length ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {stats.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-baseline gap-1.5 rounded-lg border border-line/80 bg-canvas/60 px-2.5 py-1"
            >
              <span className="text-[10px] font-medium tracking-wide text-muted uppercase">
                {s.label}
              </span>
              <span className="num text-xs font-semibold text-ink">{s.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      {children}
      {legend ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] font-medium text-muted">
          {legend}
        </div>
      ) : null}
    </div>
  );
}

export function PeriodQtyBarChart({
  data,
  showValueLabels = true,
  height = 240,
  periodLabel = "기간",
  metricLabel = "작업량",
}: {
  data: PeriodChartRow[];
  showValueLabels?: boolean;
  height?: number;
  periodLabel?: string;
  metricLabel?: string;
}) {
  const axisWidth = periodChartAxisWidth(data.map((d) => d.qty));
  const total = data.reduce((s, d) => s + d.qty, 0);
  const avg = data.length ? Math.round(total / data.length) : 0;

  return (
    <PeriodChartShell
      empty={!data.length}
      stats={[
        { label: "합계", value: formatNumber(total) },
        { label: "평균", value: formatNumber(avg) },
      ]}
      legend={
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-300" />
          {metricLabel}
        </span>
      }
    >
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: showValueLabels ? 28 : 12, right: 20, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              stroke="color-mix(in srgb, var(--border) 85%, #e5eaf1)"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={18}
              padding={{ left: 28, right: 20 }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
              width={axisWidth}
              tickFormatter={(v) => formatCompact(Number(v))}
            />
            <Tooltip
              contentStyle={periodTooltipStyle}
              cursor={{ fill: "rgba(59, 130, 246, 0.06)" }}
              formatter={(value) => [
                Number(value).toLocaleString("ko-KR"),
                metricLabel,
              ]}
              labelFormatter={(label) => `${periodLabel} ${label}`}
            />
            <Bar
              dataKey="qty"
              name={metricLabel}
              fill="#93c5fd"
              radius={[7, 7, 2, 2]}
              maxBarSize={30}
            >
              {showValueLabels ? (
                <LabelList
                  dataKey="qty"
                  position="top"
                  offset={6}
                  fill="var(--text)"
                  fontSize={10}
                  fontWeight={600}
                  formatter={(v) => {
                    const n = Number(v);
                    return n > 0 ? formatCompact(n) : "";
                  }}
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </PeriodChartShell>
  );
}

export function PeriodUphLineChart({
  data,
  showValueLabels = true,
  height = 240,
  periodLabel = "기간",
}: {
  data: PeriodChartRow[];
  showValueLabels?: boolean;
  height?: number;
  periodLabel?: string;
}) {
  const axisWidth = periodChartAxisWidth(data.map((d) => d.uph));
  const values = data.map((d) => d.uph).filter((v) => v > 0);
  const avg = values.length
    ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
    : 0;
  const peak = values.length ? Math.max(...values) : 0;

  return (
    <PeriodChartShell
      empty={!data.length}
      stats={[
        { label: "평균", value: formatNumber(avg) },
        { label: "최고", value: formatNumber(peak) },
      ]}
      legend={
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-blue-500" />
          UPH
        </span>
      }
    >
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: showValueLabels ? 28 : 12, right: 24, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              stroke="color-mix(in srgb, var(--border) 85%, #e5eaf1)"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={18}
              padding={{ left: 36, right: 28 }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
              width={Math.max(axisWidth, 52)}
              tickFormatter={(v) => formatCompact(Number(v))}
            />
            <Tooltip
              contentStyle={periodTooltipStyle}
              cursor={{ stroke: "rgba(59, 130, 246, 0.25)", strokeWidth: 1 }}
              formatter={(value) => [Number(value).toLocaleString("ko-KR"), "UPH"]}
              labelFormatter={(label) => `${periodLabel} ${label}`}
            />
            <Line
              type="monotone"
              dataKey="uph"
              name="UPH"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: "#fff", stroke: "#3b82f6", strokeWidth: 2 }}
              activeDot={{
                r: 5,
                fill: "#fff",
                stroke: "#3b82f6",
                strokeWidth: 2.5,
              }}
            >
              {showValueLabels ? (
                <LabelList
                  dataKey="uph"
                  position="top"
                  offset={8}
                  fill="#1d4ed8"
                  fontSize={10}
                  fontWeight={600}
                  formatter={(v) => {
                    const n = Number(v);
                    return n > 0 ? formatCompact(n) : "";
                  }}
                />
              ) : null}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </PeriodChartShell>
  );
}

export function PeriodQtyLineChart({
  data,
  showValueLabels = true,
  height = 280,
  periodLabel = "월",
  metricLabel = "생산량",
  formatValue,
  stats,
  stroke = "var(--metric-production)",
}: {
  data: PeriodChartRow[];
  showValueLabels?: boolean;
  height?: number;
  periodLabel?: string;
  metricLabel?: string;
  formatValue?: (v: number) => string;
  stats?: Array<{ label: string; value: string }>;
  stroke?: string;
}) {
  const format = formatValue ?? ((v: number) => formatQuantity(v));
  const axisWidth = periodChartAxisWidth(data.map((d) => d.qty));
  const total = data.reduce((s, d) => s + d.qty, 0);
  const avg = data.length ? total / data.length : 0;
  const peak = data.length ? Math.max(...data.map((d) => d.qty)) : 0;
  const resolvedStats =
    stats ??
    [
      { label: "합계", value: format(total) },
      { label: "월평균", value: format(avg) },
      { label: "최고", value: format(peak) },
    ];

  return (
    <PeriodChartShell
      empty={!data.length}
      stats={resolvedStats}
      legend={
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 rounded-full"
            style={{ background: stroke }}
          />
          {metricLabel}
        </span>
      }
    >
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: showValueLabels ? 28 : 12, right: 24, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              stroke="color-mix(in srgb, var(--border) 85%, #e5eaf1)"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={18}
              padding={{ left: 36, right: 28 }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
              width={Math.max(axisWidth, 52)}
              tickFormatter={(v) => formatCompact(Number(v))}
            />
            <Tooltip
              contentStyle={periodTooltipStyle}
              cursor={{
                stroke: `color-mix(in srgb, ${stroke} 35%, transparent)`,
                strokeWidth: 1,
              }}
              formatter={(value) => [format(Number(value)), metricLabel]}
              labelFormatter={(label) => `${periodLabel} ${label}`}
            />
            <Line
              type="monotone"
              dataKey="qty"
              name={metricLabel}
              stroke={stroke}
              strokeWidth={2.5}
              dot={{
                r: 3,
                fill: "#fff",
                stroke,
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
                fill: "#fff",
                stroke,
                strokeWidth: 2.5,
              }}
            >
              {showValueLabels ? (
                <LabelList
                  dataKey="qty"
                  position="top"
                  offset={8}
                  fill={stroke}
                  fontSize={10}
                  fontWeight={600}
                  formatter={(v) => {
                    const n = Number(v);
                    return n > 0 ? formatCompact(n) : "";
                  }}
                />
              ) : null}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </PeriodChartShell>
  );
}

const PRODUCT_TREND_SERIES = [
  { key: "GROMMET" as const, color: "var(--grommet)" },
  { key: "SEAL" as const, color: "var(--seal)" },
];

export type ProductTrendPoint = {
  label: string;
  GROMMET: number;
  SEAL: number;
};

function ProductTrendPanel({
  title,
  color,
  data,
  height,
  periodLabel,
  metricLabel,
  formatValue,
}: {
  title: "GROMMET" | "SEAL";
  color: string;
  data: Array<{ label: string; value: number }>;
  height: number;
  periodLabel: string;
  metricLabel: string;
  formatValue: (v: number) => string;
}) {
  const values = data.map((d) => d.value);
  const axisWidth = periodChartAxisWidth(values);
  const lastIdx = data.length - 1;
  const prev = lastIdx > 0 ? data[lastIdx - 1]!.value : null;
  const last = lastIdx >= 0 ? data[lastIdx]!.value : null;
  const delta =
    prev != null && last != null && prev !== 0
      ? ((last - prev) / prev) * 100
      : prev != null && last != null
        ? last - prev
        : null;
  const trend: "up" | "down" | "flat" | null =
    delta == null
      ? null
      : Math.abs(delta) < 0.05
        ? "flat"
        : delta > 0
          ? "up"
          : "down";
  // 포인트가 많으면 간격 두고 표시 (가독성)
  const labelStep = data.length > 20 ? 2 : 1;

  if (!data.length) {
    return (
      <div className="product-trend-panel">
        <div
          className="product-trend-panel-head"
          style={{ "--panel-accent": color } as CSSProperties}
        >
          <h3>{title}</h3>
        </div>
        <div className="flex h-[220px] items-center justify-center text-sm text-muted">
          표시할 데이터가 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="product-trend-panel">
      <div
        className="product-trend-panel-head"
        style={{ "--panel-accent": color } as CSSProperties}
      >
        <h3>{title}</h3>
      </div>
      <div className="product-trend-panel-body">
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{ top: 40, right: 28, left: 8, bottom: 8 }}
            >
              <CartesianGrid
                stroke="color-mix(in srgb, var(--border) 85%, #e5eaf1)"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={14}
                padding={{ left: 24, right: 24 }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                axisLine={false}
                tickLine={false}
                width={Math.max(axisWidth, 48)}
                tickFormatter={(v) => formatCompact(Number(v))}
              />
              <Tooltip
                contentStyle={periodTooltipStyle}
                cursor={{ stroke: color, strokeOpacity: 0.25, strokeWidth: 1 }}
                formatter={(value) => [formatValue(Number(value)), metricLabel]}
                labelFormatter={(label) => `${periodLabel} ${label}`}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={title}
                stroke={color}
                strokeWidth={2.5}
                isAnimationActive={false}
                dot={{
                  r: 3.5,
                  fill: "#fff",
                  stroke: color,
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: "#fff",
                  stroke: color,
                  strokeWidth: 2.5,
                }}
              >
                <LabelList
                  dataKey="value"
                  content={(props) => {
                    const raw = props as {
                      x?: number | string;
                      y?: number | string;
                      value?: number | string;
                      index?: number;
                    };
                    const x = Number(raw.x);
                    const y = Number(raw.y);
                    const index = raw.index;
                    const n = Number(raw.value);
                    if (
                      !Number.isFinite(x) ||
                      !Number.isFinite(y) ||
                      !Number.isFinite(n) ||
                      typeof index !== "number"
                    ) {
                      return null;
                    }
                    if (n <= 0) return null;

                    const isLast = index === lastIdx;
                    // 마지막은 항상, 나머지는 step 간격으로 표시
                    if (!isLast && index % labelStep !== 0) return null;

                    const text = formatCompact(n);

                    if (!isLast) {
                      return (
                        <text
                          x={x}
                          y={y - 10}
                          textAnchor="middle"
                          fill="var(--text-secondary)"
                          fontSize={10}
                          fontWeight={600}
                        >
                          {text}
                        </text>
                      );
                    }

                    const boxW = Math.max(
                      52,
                      text.length * 7 + (trend && trend !== "flat" ? 18 : 10),
                    );
                    const boxH = 22;
                    const boxX = x - boxW / 2;
                    const boxY = y - 36;
                    const trendColor =
                      trend === "up"
                        ? "var(--error)"
                        : trend === "down"
                          ? "var(--accent)"
                          : "var(--text-secondary)";

                    return (
                      <g>
                        <circle
                          cx={x}
                          cy={y}
                          r={5}
                          fill="#fff"
                          stroke={color}
                          strokeWidth={2.5}
                        />
                        <rect
                          x={boxX}
                          y={boxY}
                          width={boxW}
                          height={boxH}
                          rx={4}
                          fill="var(--elevated)"
                          stroke={trendColor}
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                        />
                        <text
                          x={x - (trend && trend !== "flat" ? 6 : 0)}
                          y={boxY + 15}
                          textAnchor="middle"
                          fill="var(--text)"
                          fontSize={11}
                          fontWeight={700}
                        >
                          {text}
                        </text>
                        {trend === "up" ? (
                          <polygon
                            points={`${boxX + boxW - 12},${boxY + 14} ${boxX + boxW - 6},${boxY + 14} ${boxX + boxW - 9},${boxY + 8}`}
                            fill="var(--error)"
                          />
                        ) : null}
                        {trend === "down" ? (
                          <polygon
                            points={`${boxX + boxW - 12},${boxY + 8} ${boxX + boxW - 6},${boxY + 8} ${boxX + boxW - 9},${boxY + 14}`}
                            fill="var(--accent)"
                          />
                        ) : null}
                      </g>
                    );
                  }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** GROMMET / SEAL 분리 패널 생산변동 추이 */
export function PeriodProductSplitTrendCharts({
  data,
  height = 260,
  periodLabel = "월",
  metricLabel = "생산량",
  formatValue,
}: {
  data: ProductTrendPoint[];
  height?: number;
  periodLabel?: string;
  metricLabel?: string;
  formatValue?: (v: number) => string;
}) {
  const format = formatValue ?? ((v: number) => formatQuantity(v));

  if (!data.length) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-line bg-canvas/50 px-4 text-sm text-muted">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="product-trend-split">
      {PRODUCT_TREND_SERIES.map((s) => (
        <ProductTrendPanel
          key={s.key}
          title={s.key}
          color={s.color}
          data={data.map((d) => ({ label: d.label, value: d[s.key] }))}
          height={height}
          periodLabel={periodLabel}
          metricLabel={metricLabel}
          formatValue={format}
        />
      ))}
    </div>
  );
}
