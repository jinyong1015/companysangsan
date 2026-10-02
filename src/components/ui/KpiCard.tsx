"use client";

import type { CSSProperties } from "react";
import { InfoTooltip } from "@/components/ui/PageBits";
import { clsx, formatChangePercent, formatChangePp } from "@/lib/format";

interface KpiCardProps {
  title: string;
  value: string;
  hint?: string;
  compare?: string | null;
  comparePositiveIsGood?: boolean;
  compareValue?: number | null;
  tooltip?: string;
  accent?: string;
  /** 하단 미니 추이 (기간 bucket 값) */
  sparkline?: number[];
  sparklineColor?: string;
}

function Sparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const w = 160;
  const h = 36;
  const padX = 1;
  const padY = 3;
  const pts = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * (w - padX * 2);
    const y = h - padY - ((v - min) / span) * (h - padY * 2);
    return { x, y };
  });
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = [
    `${pts[0].x.toFixed(1)},${h}`,
    ...pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${pts[pts.length - 1].x.toFixed(1)},${h}`,
  ].join(" ");
  const gradId = `kpi-spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="kpi-card-spark"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradId})`} points={area} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />
    </svg>
  );
}

export function KpiCard({
  title,
  value,
  hint,
  compare,
  comparePositiveIsGood = true,
  compareValue,
  tooltip,
  accent,
  sparkline,
  sparklineColor,
}: KpiCardProps) {
  const hasCompare = compareValue != null && !Number.isNaN(compareValue);
  const isFlat = hasCompare && compareValue === 0;
  const isGood =
    hasCompare && !isFlat
      ? (compareValue > 0) === comparePositiveIsGood
      : null;

  const compareTone =
    isGood == null ? "neutral" : isGood ? "good" : "bad";

  const lineColor =
    sparklineColor ??
    accent ??
    (isGood == null
      ? "var(--text-secondary)"
      : isGood
        ? "var(--success)"
        : "var(--error)");

  return (
    <article
      className={clsx(
        "card kpi-card",
        accent && "kpi-card--accent",
        sparkline && sparkline.length >= 2 && "kpi-card--spark",
      )}
      style={
        accent
          ? ({ ["--kpi-accent" as string]: accent } as CSSProperties)
          : undefined
      }
    >
      <div className="kpi-card-top">
        <div className="kpi-card-label-row">
          <p className="kpi-card-label">{title}</p>
          {tooltip ? <InfoTooltip text={tooltip} /> : null}
        </div>
        {compare ? (
          <span
            className="kpi-card-compare"
            data-tone={compareTone}
            title="이전 기간 대비"
          >
            {compare}
          </span>
        ) : null}
      </div>

      <p
        className="kpi-card-value"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>

      {hint ? <p className="kpi-card-hint">{hint}</p> : null}

      <div className="kpi-card-footer">
        {sparkline && sparkline.length >= 2 ? (
          <Sparkline values={sparkline} color={lineColor} />
        ) : (
          <span className="kpi-card-footer-spacer" aria-hidden />
        )}
      </div>
    </article>
  );
}

export function buildCompareLabel(
  kind: "percent" | "pp",
  value: number | null | undefined,
): string {
  if (value == null || Number.isNaN(value)) return "비교 없음";
  if (kind === "pp") return formatChangePp(value);
  return formatChangePercent(value);
}
