"use client";

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
  const w = 120;
  const h = 28;
  const pad = 2;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 h-7 w-full max-w-[140px]"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
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
  const tone =
    compareValue == null
      ? "text-[var(--text-secondary)]"
      : compareValue === 0
        ? "text-[var(--text-secondary)]"
        : (compareValue > 0) === comparePositiveIsGood
          ? "text-[var(--success)]"
          : "text-[var(--error)]";

  const lineColor =
    sparklineColor ??
    (compareValue == null || compareValue === 0
      ? "var(--text-secondary)"
      : (compareValue > 0) === comparePositiveIsGood
        ? "var(--success)"
        : "var(--error)");

  return (
    <article className="card flex flex-col gap-1.5 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--text-secondary)]">
          {title}
        </p>
        {tooltip ? <InfoTooltip text={tooltip} /> : null}
      </div>
      <p
        className="text-2xl font-bold leading-none tracking-tight md:text-[26px]"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {compare ? (
        <p className={clsx("text-xs font-medium", tone)}>{compare}</p>
      ) : null}
      {hint ? (
        <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
      ) : null}
      {sparkline && sparkline.length >= 2 ? (
        <Sparkline values={sparkline} color={lineColor} />
      ) : null}
    </article>
  );
}

export function buildCompareLabel(
  kind: "percent" | "pp",
  value: number | null | undefined,
): string {
  if (kind === "pp") return `${formatChangePp(value)} 이전 기간 대비`;
  return `${formatChangePercent(value)} 이전 기간 대비`;
}
