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
}: KpiCardProps) {
  const tone =
    compareValue == null
      ? "text-[var(--text-secondary)]"
      : compareValue === 0
        ? "text-[var(--text-secondary)]"
        : (compareValue > 0) === comparePositiveIsGood
          ? "text-[var(--success)]"
          : "text-[var(--error)]";

  return (
    <article className="card flex flex-col gap-1.5 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-secondary)]">{title}</p>
        {tooltip ? <InfoTooltip text={tooltip} /> : null}
      </div>
      <p
        className="text-xl font-semibold leading-none md:text-[22px]"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {compare ? <p className={clsx("text-xs font-medium", tone)}>{compare}</p> : null}
      {hint ? <p className="text-xs text-[var(--text-secondary)]">{hint}</p> : null}
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
