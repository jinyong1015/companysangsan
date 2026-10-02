"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { formatPercent } from "@/lib/format";
import { EquipmentFamilyMttrMtbfSummaryTableView } from "@/components/downtime/DowntimeDetailTables";
import {
  averageEquipmentUtilization,
  combineProductYieldPercent,
  computeOeePercent,
  loadManualYieldPercent,
  saveManualYieldPercent,
  sparklineValues,
  type EquipmentUtilizationByProduct,
  type EquipmentUtilizationGroup,
  type EquipmentUtilizationRow,
  type UtilizationDailyPoint,
  type UtilizationDailyTrends,
  type UtilizationMetricSummary,
  type UtilizationOverview,
} from "@/lib/utilization";
import type { EquipmentFamilyMttrMtbfSummaryTable } from "@/lib/downtimeDetail";

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
    label: "설비종합효율",
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
  editable,
  isManual,
  onCommit,
  onReset,
}: {
  label: string;
  value: number | null;
  color: string;
  editable?: boolean;
  isManual?: boolean;
  onCommit?: (next: number) => void;
  onReset?: () => void;
}) {
  const markerPct = toGaugePct(value);
  const [draft, setDraft] = useState(
    value == null ? "" : value.toFixed(1),
  );

  useEffect(() => {
    setDraft(value == null ? "" : value.toFixed(1));
  }, [value]);

  const commitDraft = () => {
    if (!onCommit) return;
    const parsed = Number(draft.replace(/,/g, ""));
    if (!Number.isFinite(parsed)) {
      setDraft(value == null ? "" : value.toFixed(1));
      return;
    }
    const clamped = Math.min(100, Math.max(0, Math.round(parsed * 10) / 10));
    setDraft(clamped.toFixed(1));
    onCommit(clamped);
  };

  return (
    <div
      className="util-gauge"
      data-empty={value == null}
      data-editable={editable ? "true" : "false"}
      data-manual={isManual ? "true" : "false"}
    >
      <div className="util-gauge-head">
        <span className="util-gauge-label">
          {label}
          {editable ? (
            <span className="util-gauge-edit-hint">
              {isManual ? "수기" : "수정 가능"}
            </span>
          ) : null}
        </span>
        {editable ? (
          <div className="util-gauge-edit">
            <input
              type="number"
              className="util-gauge-input num"
              inputMode="decimal"
              step="0.1"
              min={0}
              max={100}
              value={draft}
              aria-label={`${label} 수기 입력`}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
            />
            <span className="util-gauge-input-suffix">%</span>
            {isManual && onReset ? (
              <button
                type="button"
                className="util-gauge-reset"
                onClick={onReset}
              >
                자동
              </button>
            ) : null}
          </div>
        ) : (
          <strong className="util-gauge-value num">
            {formatSummaryPercent(value)}
          </strong>
        )}
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
  editable,
  isManual,
  onCommit,
  onReset,
}: {
  label: string;
  value: number | null;
  spark: Array<number | null>;
  color: string;
  editable?: boolean;
  isManual?: boolean;
  onCommit?: (next: number) => void;
  onReset?: () => void;
}) {
  const [draft, setDraft] = useState(
    value == null ? "" : value.toFixed(1),
  );

  useEffect(() => {
    setDraft(value == null ? "" : value.toFixed(1));
  }, [value]);

  const commitDraft = () => {
    if (!onCommit) return;
    const parsed = Number(draft.replace(/,/g, ""));
    if (!Number.isFinite(parsed)) {
      setDraft(value == null ? "" : value.toFixed(1));
      return;
    }
    const clamped = Math.min(100, Math.max(0, Math.round(parsed * 10) / 10));
    setDraft(clamped.toFixed(1));
    onCommit(clamped);
  };

  return (
    <div
      className="util-overview-metric util-overview-metric--rich"
      data-editable={editable ? "true" : "false"}
      data-manual={isManual ? "true" : "false"}
    >
      <div className="util-overview-metric-top">
        <span className="util-overview-metric-label">
          {label}
          {editable && isManual ? (
            <span className="util-gauge-edit-hint">수기</span>
          ) : null}
        </span>
        <MiniSparkline values={spark} color={color} />
      </div>
      {editable ? (
        <div className="util-gauge-edit">
          <input
            type="number"
            className="util-gauge-input util-overview-metric-input num"
            inputMode="decimal"
            step="0.1"
            min={0}
            max={100}
            value={draft}
            aria-label={`${label} 수기 입력`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
          />
          <span className="util-gauge-input-suffix">%</span>
          {isManual && onReset ? (
            <button
              type="button"
              className="util-gauge-reset"
              onClick={onReset}
            >
              자동
            </button>
          ) : null}
        </div>
      ) : (
        <strong className="util-overview-metric-value num">
          {formatSummaryPercent(value)}
        </strong>
      )}
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
  editableYield = false,
  manualYield = null,
  onYieldCommit,
  onYieldReset,
  onDetail,
  tone,
}: {
  title: string;
  summary: UtilizationMetricSummary;
  daily: UtilizationDailyPoint[];
  emphasized?: boolean;
  muted?: boolean;
  metrics?: "full" | "rates";
  editableYield?: boolean;
  manualYield?: number | null;
  onYieldCommit?: (next: number) => void;
  onYieldReset?: () => void;
  onDetail?: () => void;
  tone?: "grommet" | "seal";
}) {
  const metrics = metricKeys === "rates" ? RATE_METRICS : FULL_METRICS;
  const yieldPercent = manualYield ?? summary.yieldPercent;
  const oeePercent = computeOeePercent(
    summary.timePercent,
    summary.performancePercent,
    yieldPercent,
  );
  const display: UtilizationMetricSummary = {
    ...summary,
    yieldPercent,
    oeePercent,
  };

  return (
    <section
      className="util-overview-product"
      data-emphasized={emphasized ?? false}
      data-muted={muted ?? false}
      data-metrics={metricKeys}
      data-tone={tone}
      aria-label={title}
    >
      <header className="util-overview-product-head">
        <h3>
          {tone ? (
            <span className="util-overview-product-dot" aria-hidden />
          ) : null}
          {title}
        </h3>
        <div className="util-overview-product-head-actions">
          {!summary.hasData ? (
            <span className="util-overview-empty-hint">데이터 없음</span>
          ) : null}
          {onDetail ? (
            <button
              type="button"
              className="util-overview-product-detail"
              onClick={onDetail}
            >
              상세
            </button>
          ) : null}
        </div>
      </header>
      <div className="util-overview-metric-grid">
        {metrics.map((m) => (
          <MetricStatCard
            key={m.key}
            label={m.label}
            value={display[m.key]}
            spark={sparklineValues(daily, m.key)}
            color={m.color}
            editable={editableYield && m.key === "yieldPercent"}
            isManual={
              editableYield && m.key === "yieldPercent" && manualYield != null
            }
            onCommit={
              editableYield && m.key === "yieldPercent" && onYieldCommit
                ? onYieldCommit
                : undefined
            }
            onReset={
              editableYield && m.key === "yieldPercent" && onYieldReset
                ? onYieldReset
                : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}

function EquipmentDetailShell({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dt-fullscreen-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dt-fullscreen-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold md:text-lg">{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <X size={16} />
            <span>닫기</span>
          </button>
        </div>
        {children}
      </div>
    </div>
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

function EquipmentRateTable({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: EquipmentUtilizationRow[];
  tone: "press" | "injection";
}) {
  const avg = averageEquipmentUtilization(rows);

  return (
    <div className="util-eq-rate-table-wrap" data-tone={tone}>
      <table className="util-eq-rate-table">
        <thead>
          <tr>
            <th colSpan={3}>
              {title}
              <span className="util-eq-rate-title-count">{rows.length}대</span>
            </th>
          </tr>
          <tr>
            <th>공정</th>
            <th className="num">성능가동률(%)</th>
            <th className="num">시간가동률(%)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="util-eq-rate-empty">
                데이터 없음
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.equipmentId}>
                <td>{r.equipmentName}</td>
                <td className="num">
                  {formatSummaryPercent(r.performancePercent)}
                </td>
                <td className="num">{formatSummaryPercent(r.timePercent)}</td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 ? (
          <tfoot>
            <tr>
              <th scope="row">평균</th>
              <td className="num">
                {formatSummaryPercent(avg.performancePercent)}
              </td>
              <td className="num">{formatSummaryPercent(avg.timePercent)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function EquipmentByProductBlock({
  equipmentByProduct,
}: {
  equipmentByProduct: EquipmentUtilizationByProduct;
}) {
  const [tab, setTab] = useState<"GROMMET" | "SEAL">("GROMMET");
  const group: EquipmentUtilizationGroup =
    tab === "GROMMET" ? equipmentByProduct.grommet : equipmentByProduct.seal;
  const hasPress = group.press.length > 0;
  const hasInjection = group.injection.length > 0;
  const empty = !hasPress && !hasInjection;
  const grommetCount =
    equipmentByProduct.grommet.press.length +
    equipmentByProduct.grommet.injection.length;
  const sealCount =
    equipmentByProduct.seal.press.length +
    equipmentByProduct.seal.injection.length;

  return (
    <div className="util-eq-by-product">
      <div className="util-eq-by-product-head">
        <h2 className="util-overview-section-title">설비별 가동률</h2>
        <div
          className="util-eq-product-tabs"
          role="tablist"
          aria-label="GROMMET/SEAL 설비 가동률"
        >
          {(
            [
              {
                value: "GROMMET" as const,
                label: "GROMMET",
                count: grommetCount,
              },
              { value: "SEAL" as const, label: "SEAL", count: sealCount },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={tab === opt.value}
              className="util-eq-product-tab"
              data-active={tab === opt.value}
              data-tone={opt.value === "GROMMET" ? "grommet" : "seal"}
              onClick={() => setTab(opt.value)}
            >
              {opt.label}
              <span className="util-eq-product-tab-count">{opt.count}</span>
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <p className="util-eq-by-product-empty">
          조회월에 {tab} 설비 가동 데이터가 없습니다.
        </p>
      ) : (
        <div
          className="util-eq-rate-grid"
          data-single={!hasPress || !hasInjection}
        >
          {hasPress ? (
            <EquipmentRateTable
              title="Press 설비"
              rows={group.press}
              tone="press"
            />
          ) : null}
          {hasInjection ? (
            <EquipmentRateTable
              title="Injection 설비"
              rows={group.injection}
              tone="injection"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

export function UtilizationOverviewPanel({
  monthLabel,
  overview,
  trends,
  grommetEmphasized,
  sealEmphasized,
  equipmentByProduct,
  mttrMtbfSummary,
  variant = "full",
  showEquipmentBlock = true,
}: {
  monthLabel: string;
  overview: UtilizationOverview;
  trends: UtilizationDailyTrends;
  grommetEmphasized: boolean;
  sealEmphasized: boolean;
  equipmentByProduct?: EquipmentUtilizationByProduct;
  /** 호기 평균 MTTR·MTBF 요약 (GROMMET/SEAL 전체 평균 포함) */
  mttrMtbfSummary?: EquipmentFamilyMttrMtbfSummaryTable;
  /** full: 전체+제품+설비 / overall: 전체 종합 현황만 */
  variant?: "full" | "overall";
  /** false면 설비별 가동률은 현황 상세 버튼으로만 연다 (대시보드) */
  showEquipmentBlock?: boolean;
}) {
  const grommetYieldKey = `${monthLabel}::GROMMET`;
  const sealYieldKey = `${monthLabel}::SEAL`;
  const [grommetManualYield, setGrommetManualYield] = useState<number | null>(
    null,
  );
  const [sealManualYield, setSealManualYield] = useState<number | null>(null);
  const [equipmentDetail, setEquipmentDetail] = useState<
    "GROMMET" | "SEAL" | null
  >(null);

  useEffect(() => {
    setGrommetManualYield(loadManualYieldPercent(grommetYieldKey));
    setSealManualYield(loadManualYieldPercent(sealYieldKey));
  }, [grommetYieldKey, sealYieldKey]);

  const grommetYield =
    grommetManualYield ?? overview.grommet.yieldPercent;
  const sealYield = sealManualYield ?? overview.seal.yieldPercent;
  const overallYield = combineProductYieldPercent(
    overview.grommet.productionQuantity,
    grommetYield,
    overview.seal.productionQuantity,
    sealYield,
  );
  const overallSummary: UtilizationMetricSummary = {
    ...overview.allProducts,
    yieldPercent: overallYield,
    oeePercent: computeOeePercent(
      overview.allProducts.timePercent,
      overview.allProducts.performancePercent,
      overallYield,
    ),
  };

  const detailGroup: EquipmentUtilizationGroup | null =
    equipmentByProduct == null || equipmentDetail == null
      ? null
      : equipmentDetail === "GROMMET"
        ? equipmentByProduct.grommet
        : equipmentByProduct.seal;
  const detailHasPress = (detailGroup?.press.length ?? 0) > 0;
  const detailHasInjection = (detailGroup?.injection.length ?? 0) > 0;

  return (
    <section className="util-overview mb-4" aria-label="종합 가동률 요약">
      <p className="util-overview-month-label">{monthLabel} 종합 현황</p>

      <div className="util-viz-card">
        <h2 className="util-overview-section-title">전체 종합 현황</h2>
        <div className="util-gauge-split" data-single="true">
          <GaugeBlock
            title="전체(GROMMET + SEAL)"
            summary={overallSummary}
            metrics={FULL_METRICS}
          />
        </div>

        {variant === "full" ? (
          <div className="util-overview-products-block util-overview-products-block--in-card">
            <h2 className="util-overview-section-title">
              GROMMET / SEAL 현황
            </h2>
            <div className="util-overview-products">
              <ProductOverviewCard
                title="GROMMET 현황"
                tone="grommet"
                summary={overview.grommet}
                daily={trends.grommet}
                emphasized={grommetEmphasized}
                muted={!grommetEmphasized}
                editableYield
                manualYield={grommetManualYield}
                onYieldCommit={(next) => {
                  setGrommetManualYield(next);
                  saveManualYieldPercent(grommetYieldKey, next);
                }}
                onYieldReset={() => {
                  setGrommetManualYield(null);
                  saveManualYieldPercent(grommetYieldKey, null);
                }}
                onDetail={
                  equipmentByProduct
                    ? () => setEquipmentDetail("GROMMET")
                    : undefined
                }
              />
              <ProductOverviewCard
                title="SEAL 현황"
                tone="seal"
                summary={overview.seal}
                daily={trends.seal}
                emphasized={sealEmphasized}
                muted={!sealEmphasized}
                editableYield
                manualYield={sealManualYield}
                onYieldCommit={(next) => {
                  setSealManualYield(next);
                  saveManualYieldPercent(sealYieldKey, next);
                }}
                onYieldReset={() => {
                  setSealManualYield(null);
                  saveManualYieldPercent(sealYieldKey, null);
                }}
                onDetail={
                  equipmentByProduct
                    ? () => setEquipmentDetail("SEAL")
                    : undefined
                }
              />
            </div>
          </div>
        ) : null}

        {variant === "full" && mttrMtbfSummary ? (
          <div className="util-overview-mttr-block">
            <EquipmentFamilyMttrMtbfSummaryTableView
              table={mttrMtbfSummary}
              variant="overall"
            />
          </div>
        ) : null}

        {variant === "full" && equipmentByProduct && showEquipmentBlock ? (
          <EquipmentByProductBlock equipmentByProduct={equipmentByProduct} />
        ) : null}
      </div>

      <EquipmentDetailShell
        title={`${equipmentDetail ?? "GROMMET"} 설비별 가동률`}
        open={equipmentDetail != null && detailGroup != null}
        onClose={() => setEquipmentDetail(null)}
      >
        <div className="util-eq-detail-body">
          {!detailHasPress && !detailHasInjection ? (
            <p className="util-eq-by-product-empty">
              조회월에 {equipmentDetail} 설비 가동 데이터가 없습니다.
            </p>
          ) : (
            <div
              className="util-eq-rate-grid"
              data-single={!detailHasPress || !detailHasInjection}
            >
              {detailHasPress && detailGroup ? (
                <EquipmentRateTable
                  title="Press 설비"
                  rows={detailGroup.press}
                  tone="press"
                />
              ) : null}
              {detailHasInjection && detailGroup ? (
                <EquipmentRateTable
                  title="Injection 설비"
                  rows={detailGroup.injection}
                  tone="injection"
                />
              ) : null}
            </div>
          )}
        </div>
      </EquipmentDetailShell>
    </section>
  );
}
