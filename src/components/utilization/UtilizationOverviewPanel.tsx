"use client";

import { formatPercent } from "@/lib/format";
import {
  sparklineValues,
  type UtilizationDailyPoint,
  type UtilizationDailyTrends,
  type UtilizationMetricSummary,
  type UtilizationOverview,
} from "@/lib/utilization";

type MetricKey =
  | "performancePercent"
  | "timePercent"
  | "yieldPercent"
  | "oeePercent";

type MetricDef = {
  key: MetricKey;
  label: string;
  color: string;
};

const FULL_METRICS: MetricDef[] = [
  {
    key: "performancePercent",
    label: "성능가동률",
    color: "var(--metric-production)",
  },
  {
    key: "timePercent",
    label: "시간가동률",
    color: "var(--metric-util)",
  },
  {
    key: "yieldPercent",
    label: "양품률",
    color: "var(--metric-mtbf)",
  },
  {
    key: "oeePercent",
    label: "종합설비효율",
    color: "var(--metric-uph)",
  },
];

const RATE_METRICS = FULL_METRICS.filter(
  (m) => m.key === "performancePercent" || m.key === "timePercent",
);

function formatSummaryPercent(value: number | null | undefined): string {
  return formatPercent(value, 1);
}

/** 게이지 스케일 0~100%. 현재값 위치에 마커. 100% 초과는 끝에 고정. */
function toGaugePct(value: number | null): number | null {
  if (value == null) return null;
  return Math.min(100, Math.max(0, value));
}

function MiniSparkline({
  values,
  color,
}: {
  values: Array<number | null>;
  color: string;
}) {
  const numeric = values.filter((v): v is number => v != null);
  if (numeric.length < 2) {
    return <span className="util-spark util-spark--empty" aria-hidden />;
  }
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const span = Math.max(max - min, 1);
  const w = 56;
  const h = 18;
  const pts = values
    .map((v, i) => {
      if (v == null) return null;
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      className="util-spark"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}

function HorizontalGauge({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  const markerPct = toGaugePct(value);

  return (
    <div className="util-gauge" data-empty={value == null}>
      <div className="util-gauge-head">
        <span className="util-gauge-label">{label}</span>
        <strong className="util-gauge-value num">
          {formatSummaryPercent(value)}
        </strong>
      </div>
      <div className="util-gauge-track" aria-hidden>
        <div
          className="util-gauge-fill"
          style={{
            width: `${markerPct ?? 0}%`,
            background: color,
          }}
        />
        {markerPct != null ? (
          <span
            className="util-gauge-marker"
            style={{ left: `${markerPct}%` }}
            title={`현재 ${formatSummaryPercent(value)}`}
          />
        ) : null}
      </div>
      <div className="util-gauge-meta">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function MetricStatCard({
  label,
  value,
  spark,
  color,
}: {
  label: string;
  value: number | null;
  spark: Array<number | null>;
  color: string;
}) {
  return (
    <div className="util-overview-metric util-overview-metric--rich">
      <div className="util-overview-metric-top">
        <span className="util-overview-metric-label">{label}</span>
        <MiniSparkline values={spark} color={color} />
      </div>
      <strong className="util-overview-metric-value num">
        {formatSummaryPercent(value)}
      </strong>
    </div>
  );
}

function ProductOverviewCard({
  title,
  summary,
  daily,
  emphasized,
  muted,
  metrics: metricKeys = "full",
}: {
  title: string;
  summary: UtilizationMetricSummary;
  daily: UtilizationDailyPoint[];
  emphasized?: boolean;
  muted?: boolean;
  metrics?: "full" | "rates";
}) {
  const metrics = metricKeys === "rates" ? RATE_METRICS : FULL_METRICS;

  return (
    <section
      className="util-overview-product"
      data-emphasized={emphasized ?? false}
      data-muted={muted ?? false}
      data-metrics={metricKeys}
      aria-label={title}
    >
      <header className="util-overview-product-head">
        <h3>{title}</h3>
        {!summary.hasData ? (
          <span className="util-overview-empty-hint">데이터 없음</span>
        ) : null}
      </header>
      <div className="util-overview-metric-grid">
        {metrics.map((m) => (
          <MetricStatCard
            key={m.key}
            label={m.label}
            value={summary[m.key]}
            spark={sparklineValues(daily, m.key)}
            color={m.color}
          />
        ))}
      </div>
    </section>
  );
}

function GaugeBlock({
  title,
  summary,
  metrics,
}: {
  title: string;
  summary: UtilizationMetricSummary;
  metrics: MetricDef[];
}) {
  return (
    <div className="util-gauge-block">
      <h3 className="util-gauge-block-title">{title}</h3>
      <div className="util-gauge-grid">
        {metrics.map((m) => (
          <HorizontalGauge
            key={m.key}
            label={m.label}
            value={summary[m.key]}
            color={m.color}
          />
        ))}
      </div>
    </div>
  );
}

export function UtilizationOverviewPanel({
  monthLabel,
  overview,
  trends,
  grommetEmphasized,
  sealEmphasized,
  injectionEmphasized,
  pressEmphasized,
}: {
  monthLabel: string;
  overview: UtilizationOverview;
  trends: UtilizationDailyTrends;
  grommetEmphasized: boolean;
  sealEmphasized: boolean;
  injectionEmphasized: boolean;
  pressEmphasized: boolean;
}) {
  return (
    <section className="util-overview mb-4" aria-label="종합 가동률 요약">
      <p className="util-overview-month-label">{monthLabel} 종합 현황</p>

      <div className="util-viz-card">
        <h2 className="util-overview-section-title">전체 종합 현황</h2>
        <div className="util-gauge-split">
          <GaugeBlock
            title="GROMMET + SEAL 기준"
            summary={overview.allProducts}
            metrics={FULL_METRICS}
          />
          <GaugeBlock
            title="INJECTION + PRESS 기준"
            summary={overview.allEquipment}
            metrics={RATE_METRICS}
          />
        </div>
      </div>

      <div className="util-overview-products-block">
        <h2 className="util-overview-section-title">제품유형별 종합 현황</h2>
        <div className="util-overview-products">
          <ProductOverviewCard
            title="GROMMET 현황"
            summary={overview.grommet}
            daily={trends.grommet}
            emphasized={grommetEmphasized}
            muted={!grommetEmphasized}
          />
          <ProductOverviewCard
            title="SEAL 현황"
            summary={overview.seal}
            daily={trends.seal}
            emphasized={sealEmphasized}
            muted={!sealEmphasized}
          />
        </div>
      </div>

      <div className="util-overview-equipment-block">
        <h2 className="util-overview-section-title">설비유형별 종합 현황</h2>
        <div className="util-overview-products">
          <ProductOverviewCard
            title="INJECTION 현황"
            summary={overview.injection}
            daily={trends.injection}
            emphasized={injectionEmphasized}
            muted={!injectionEmphasized}
            metrics="rates"
          />
          <ProductOverviewCard
            title="PRESS 현황"
            summary={overview.press}
            daily={trends.press}
            emphasized={pressEmphasized}
            muted={!pressEmphasized}
            metrics="rates"
          />
        </div>
      </div>
    </section>
  );
}
