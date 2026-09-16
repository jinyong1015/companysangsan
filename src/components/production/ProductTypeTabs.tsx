"use client";

import type { ProductTab } from "@/components/production/ProductPerformanceSummary";

const TABS: Array<{
  value: ProductTab;
  label: string;
  hint: string;
  tone: "all" | "grommet" | "seal";
}> = [
  { value: "전체", label: "전체", hint: "GROMMET + SEAL", tone: "all" },
  { value: "GROMMET", label: "GROMMET", hint: "그로밋", tone: "grommet" },
  { value: "SEAL", label: "SEAL", hint: "씰", tone: "seal" },
];

interface ProductTypeTabsProps {
  value: ProductTab;
  onChange: (tab: ProductTab) => void;
  counts?: Partial<Record<ProductTab, number>>;
  ariaLabel?: string;
  className?: string;
  compact?: boolean;
}

export function ProductTypeTabs({
  value,
  onChange,
  counts,
  ariaLabel = "제품유형",
  className,
  compact = false,
}: ProductTypeTabsProps) {
  return (
    <div
      className={["pps-type-tabs", compact ? "pps-type-tabs-compact" : "", className ?? "mb-4"]
        .filter(Boolean)
        .join(" ")}
      role="tablist"
      aria-label={ariaLabel}
    >
      {TABS.map((tab) => {
        const active = value === tab.value;
        const count = counts?.[tab.value];
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            className="pps-type-tab"
            data-tone={tab.tone}
            data-active={active}
            data-compact={compact}
            onClick={() => onChange(tab.value)}
          >
            <span className="pps-type-tab-dot" aria-hidden />
            <span className="pps-type-tab-text">
              <span className="pps-type-tab-label">{tab.label}</span>
              {!compact ? (
                <span className="pps-type-tab-hint">{tab.hint}</span>
              ) : null}
            </span>
            {typeof count === "number" ? (
              <span className="pps-type-tab-count">{count.toLocaleString("ko-KR")}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
