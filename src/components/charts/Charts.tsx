"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReasonShare, TrendPoint } from "@/types";
import { formatMinutes, formatNumber, formatPercent, formatQuantity, formatUph } from "@/lib/format";
import { useState } from "react";

const REASON_COLORS = [
  "#F59E0B",
  "#E11D48",
  "#64748B",
  "#3B82F6",
  "#8B5CF6",
  "#14B8A6",
  "#F97316",
];

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
  onSelect,
}: {
  data: ReasonShare[];
  onSelect?: (reason: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr] md:items-center">
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
              onClick={(_, idx) => {
                const item = data[idx];
                if (item && onSelect) onSelect(item.reason);
              }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.reason}
                  fill={REASON_COLORS[index % REASON_COLORS.length]}
                  cursor={onSelect ? "pointer" : "default"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _n, item) => [
                formatMinutes(Number(value)),
                String((item as { payload?: ReasonShare }).payload?.reason ?? ""),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.reason} className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex items-center gap-2 text-left"
              onClick={() => onSelect?.(d.reason)}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: REASON_COLORS[i % REASON_COLORS.length] }}
              />
              {d.reason}
            </button>
            <span className="text-[var(--text-secondary)]">
              {formatMinutes(d.downtimeMinutes)} · {formatPercent(d.sharePercent)}
            </span>
          </li>
        ))}
      </ul>
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
