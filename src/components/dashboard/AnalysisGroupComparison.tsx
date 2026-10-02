"use client";

import type { AnalysisGroupBundle, AnalysisGroupRow } from "@/lib/analysisGroups";
import {
  clsx,
  formatNumber,
  formatPercent,
  formatQuantity,
} from "@/lib/format";

type Props = {
  bundle: AnalysisGroupBundle;
  /** 상단 전역 조회기간 안내 (예: 2026.03.01 ~ 2026.03.31) */
  periodLabel?: string;
};

function ShareBar({
  groups,
  totalQty,
}: {
  groups: AnalysisGroupRow[];
  totalQty: number;
}) {
  return (
    <div className="agc-share">
      <div
        className="agc-share-track"
        role="img"
        aria-label="생산량 그룹 비중"
      >
        {groups.map((g) =>
          g.productionSharePercent > 0 ? (
            <div
              key={g.id}
              className="agc-share-seg"
              style={{
                width: `${g.productionSharePercent}%`,
                background: g.color,
              }}
              title={`${g.label} ${formatNumber(g.productionSharePercent, 1)}%`}
            />
          ) : null,
        )}
      </div>
      <div className="agc-share-meta">
        {groups.map((g) => (
          <div key={g.id} className="agc-share-item" data-tone={g.id}>
            <span className="agc-share-dot" aria-hidden />
            <span className="agc-share-name">{g.label}</span>
            <strong className="agc-share-pct">
              {formatNumber(g.productionSharePercent, 1)}%
            </strong>
          </div>
        ))}
        <div className="agc-share-total">
          <span>합계</span>
          <strong>{formatQuantity(totalQty)}</strong>
        </div>
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  hint,
  barPercent,
  barColor,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  barPercent?: number;
  barColor?: string;
  alert?: boolean;
}) {
  const width =
    barPercent != null ? Math.max(0, Math.min(100, barPercent)) : null;

  return (
    <div className={clsx("agc-metric", alert && "agc-metric--alert")}>
      <div className="agc-metric-top">
        <span className="agc-metric-label">{label}</span>
        {alert ? <span className="agc-metric-badge">불량률↑</span> : null}
      </div>
      <p className="agc-metric-value">{value}</p>
      {hint ? <p className="agc-metric-hint">{hint}</p> : null}
      {width != null && barColor ? (
        <div className="agc-metric-bar" aria-hidden>
          <span
            style={{
              width: `${width}%`,
              background: alert ? "var(--error)" : barColor,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function GroupCard({
  group,
  maxDefectRate,
  selected,
}: {
  group: AnalysisGroupRow;
  maxDefectRate: number;
  selected: boolean;
}) {
  const defectBar =
    maxDefectRate > 0
      ? ((group.kpi.defectRatePercent ?? 0) / maxDefectRate) * 100
      : 0;

  return (
    <article
      className="agc-card"
      data-tone={group.id}
      data-selected={selected || undefined}
    >
      <header className="agc-card-head">
        <div className="agc-card-title-row">
          <span className="agc-card-dot" aria-hidden />
          <h3 className="agc-card-title">{group.label}</h3>
        </div>
        <div className="agc-card-share">
          <span className="agc-card-share-label">생산 비중</span>
          <strong>{formatNumber(group.productionSharePercent, 1)}%</strong>
        </div>
      </header>

      <div className="agc-card-share-bar" aria-hidden>
        <span
          style={{
            width: `${Math.max(0, Math.min(100, group.productionSharePercent))}%`,
            background: group.color,
          }}
        />
      </div>

      <div className="agc-card-metrics">
        <MetricCell
          label="생산량"
          value={formatQuantity(group.kpi.productionQuantity)}
          barPercent={group.productionSharePercent}
          barColor={group.color}
        />
        <MetricCell
          label="불량률"
          value={formatPercent(group.kpi.defectRatePercent, 2)}
          barPercent={defectBar}
          barColor={group.color}
          alert={group.defectRateAboveTotal}
        />
        <MetricCell
          label="불량수량"
          value={formatQuantity(group.kpi.defectQuantity)}
        />
        <MetricCell
          label="가동률"
          value={formatPercent(group.kpi.utilizationRatePercent)}
          barPercent={group.kpi.utilizationRatePercent ?? 0}
          barColor={group.color}
        />
      </div>
    </article>
  );
}

export function AnalysisGroupComparison({ bundle, periodLabel }: Props) {
  const { total, groups, selectedLabel } = bundle;
  const maxDefectRate = Math.max(
    0,
    ...groups.map((g) => g.kpi.defectRatePercent ?? 0),
    total.defectRatePercent ?? 0,
  );
  const totalDefectBar =
    maxDefectRate > 0
      ? ((total.defectRatePercent ?? 0) / maxDefectRate) * 100
      : 0;

  return (
    <section className="agc mb-4">
      <header className="agc-head">
        <div>
          <h2 className="agc-title">
            분석 그룹 비교
            {periodLabel ? (
              <span className="agc-period"> ({periodLabel})</span>
            ) : null}
          </h2>
          <p className="agc-sub">오류 제외 유효 DATA · SEAL / GROMMET 비교</p>
        </div>
      </header>

      <ShareBar groups={groups} totalQty={total.productionQuantity} />

      <div className="agc-total">
        <div className="agc-total-label">
          <span className="agc-total-badge">전체</span>
          <span className="agc-total-caption">기간 합산 기준</span>
        </div>
        <div className="agc-total-metrics">
          <MetricCell
            label="생산량"
            value={formatQuantity(total.productionQuantity)}
            barPercent={100}
            barColor="var(--text-secondary)"
          />
          <MetricCell
            label="불량률"
            value={formatPercent(total.defectRatePercent, 2)}
            barPercent={totalDefectBar}
            barColor="var(--metric-defect)"
          />
          <MetricCell
            label="불량수량"
            value={formatQuantity(total.defectQuantity)}
          />
          <MetricCell
            label="가동률"
            value={formatPercent(total.utilizationRatePercent)}
            barPercent={total.utilizationRatePercent ?? 0}
            barColor="var(--metric-util)"
          />
        </div>
      </div>

      <div className="agc-grid">
        {groups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            maxDefectRate={maxDefectRate}
            selected={selectedLabel === g.label}
          />
        ))}
      </div>
    </section>
  );
}
