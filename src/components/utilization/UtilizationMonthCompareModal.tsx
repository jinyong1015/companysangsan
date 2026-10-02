"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO, subMonths } from "date-fns";
import { ArrowLeftRight, X } from "lucide-react";
import { UtilizationOverviewPanel } from "@/components/utilization/UtilizationOverviewPanel";
import { formatNumber } from "@/lib/format";
import type { EquipmentFamilyMttrMtbfSummaryTable } from "@/lib/downtimeDetail";
import {
  combineProductYieldPercent,
  computeOeePercent,
  loadManualYieldPercent,
  type EquipmentUtilizationByProduct,
  type UtilizationDailyTrends,
  type UtilizationOverview,
} from "@/lib/utilization";

export type CompareScope = "전체" | "GROMMET" | "SEAL";

export type UtilizationMonthCompareSnapshot = {
  yearMonth: string;
  monthLabel: string;
  overview: UtilizationOverview;
  trends: UtilizationDailyTrends;
  equipmentByProduct: EquipmentUtilizationByProduct;
  mttrMtbfSummary: EquipmentFamilyMttrMtbfSummaryTable;
};

type MonthKpiRow = {
  yearMonth: string;
  label: string;
  oee: number | null;
  performance: number | null;
  time: number | null;
  yieldRate: number | null;
  mttr: number | null;
  mtbf: number | null;
};

const COMPARE_TABS: Array<{
  value: CompareScope;
  label: string;
  tone: "all" | "grommet" | "seal";
}> = [
  { value: "전체", label: "전체", tone: "all" },
  { value: "GROMMET", label: "GROMMET", tone: "grommet" },
  { value: "SEAL", label: "SEAL", tone: "seal" },
];

function previousYearMonth(yearMonth: string): string {
  try {
    return format(subMonths(parseISO(`${yearMonth}-01`), 1), "yyyy-MM");
  } catch {
    return yearMonth;
  }
}

function yearMonthLabel(yearMonth: string): string {
  try {
    return format(parseISO(`${yearMonth}-01`), "yyyy년 M월");
  } catch {
    return yearMonth;
  }
}

function shortMonthLabel(yearMonth: string): string {
  try {
    return format(parseISO(`${yearMonth}-01`), "M월");
  } catch {
    return yearMonth;
  }
}

function averageNullable(
  values: Array<number | null | undefined>,
): number | null {
  const nums = values.filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (!nums.length) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

function round1(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function snapshotToRow(
  snapshot: UtilizationMonthCompareSnapshot,
  scope: CompareScope,
): MonthKpiRow {
  const gKey = `${snapshot.monthLabel}::GROMMET`;
  const sKey = `${snapshot.monthLabel}::SEAL`;
  const gYield =
    loadManualYieldPercent(gKey) ?? snapshot.overview.grommet.yieldPercent;
  const sYield =
    loadManualYieldPercent(sKey) ?? snapshot.overview.seal.yieldPercent;

  let performance: number | null;
  let time: number | null;
  let yieldPercent: number | null;
  let oee: number | null;

  if (scope === "GROMMET") {
    performance = snapshot.overview.grommet.performancePercent;
    time = snapshot.overview.grommet.timePercent;
    yieldPercent = gYield;
    oee = computeOeePercent(time, performance, yieldPercent);
  } else if (scope === "SEAL") {
    performance = snapshot.overview.seal.performancePercent;
    time = snapshot.overview.seal.timePercent;
    yieldPercent = sYield;
    oee = computeOeePercent(time, performance, yieldPercent);
  } else {
    performance = snapshot.overview.allProducts.performancePercent;
    time = snapshot.overview.allProducts.timePercent;
    yieldPercent = combineProductYieldPercent(
      snapshot.overview.grommet.productionQuantity,
      gYield,
      snapshot.overview.seal.productionQuantity,
      sYield,
    );
    oee = computeOeePercent(time, performance, yieldPercent);
  }

  const summary = snapshot.mttrMtbfSummary;
  const mttrRows = !summary
    ? []
    : scope === "GROMMET"
      ? [...summary.grommet.press, ...summary.grommet.injection]
      : scope === "SEAL"
        ? [...summary.seal.press, ...summary.seal.injection]
        : [
            ...summary.grommet.press,
            ...summary.grommet.injection,
            ...summary.seal.press,
            ...summary.seal.injection,
          ];

  return {
    yearMonth: snapshot.yearMonth,
    label: shortMonthLabel(snapshot.yearMonth),
    oee: round1(oee),
    performance: round1(performance),
    time: round1(time),
    yieldRate: round1(yieldPercent),
    mttr: round1(averageNullable(mttrRows.map((r) => r.mttrMinutes))),
    mtbf: round1(averageNullable(mttrRows.map((r) => r.referenceMtbfHours))),
  };
}

function delta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return round1(b - a);
}

function formatCell(value: number | null): string {
  if (value == null) return "-";
  return formatNumber(value, 1);
}

function formatDelta(value: number | null): string {
  if (value == null) return "-";
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1)}`;
}

export function UtilizationMonthCompareModal({
  open,
  onClose,
  initialLeftMonth,
  buildSnapshot,
}: {
  open: boolean;
  onClose: () => void;
  initialLeftMonth: string;
  buildSnapshot: (yearMonth: string) => UtilizationMonthCompareSnapshot;
}) {
  const [baseMonth, setBaseMonth] = useState(() =>
    previousYearMonth(initialLeftMonth),
  );
  const [compareMonth, setCompareMonth] = useState(initialLeftMonth);
  const [scopeTab, setScopeTab] = useState<CompareScope>("전체");
  const [yieldRevision, setYieldRevision] = useState(0);

  useEffect(() => {
    if (!open) return;
    setBaseMonth(previousYearMonth(initialLeftMonth));
    setCompareMonth(initialLeftMonth);
    setScopeTab("전체");
    setYieldRevision(0);
  }, [open, initialLeftMonth]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 설비 상세 등 중첩 풀스크린이 열려 있으면 비교 모달은 유지
      if (document.querySelector(".dt-fullscreen-backdrop")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const baseSnap = useMemo(
    () => (open ? buildSnapshot(baseMonth) : null),
    [baseMonth, buildSnapshot, open],
  );
  const compareSnap = useMemo(
    () => (open ? buildSnapshot(compareMonth) : null),
    [buildSnapshot, compareMonth, open],
  );

  const rows = useMemo(() => {
    if (!baseSnap || !compareSnap) return null;
    void yieldRevision;
    const base = snapshotToRow(baseSnap, scopeTab);
    const compare = snapshotToRow(compareSnap, scopeTab);
    return {
      base,
      compare,
      change: {
        oee: delta(base.oee, compare.oee),
        performance: delta(base.performance, compare.performance),
        time: delta(base.time, compare.time),
        yieldRate: delta(base.yieldRate, compare.yieldRate),
        mttr: delta(base.mttr, compare.mttr),
        mtbf: delta(base.mtbf, compare.mtbf),
      },
    };
  }, [baseSnap, compareSnap, scopeTab, yieldRevision]);

  if (!open || !baseSnap || !compareSnap || !rows) return null;

  const swapMonths = () => {
    setBaseMonth(compareMonth);
    setCompareMonth(baseMonth);
  };

  const scopeTone =
    COMPARE_TABS.find((tab) => tab.value === scopeTab)?.tone ?? "all";

  return (
    <div
      className="util-month-compare-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="util-month-compare-modal"
        role="dialog"
        aria-modal="true"
        aria-label="월별 비교"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="util-month-compare-head">
          <div>
            <h2 className="util-month-compare-title">월별 비교</h2>
            <p className="util-month-compare-sub">
              조회월 두 개를 선택해 종합 현황과 변동 내역을 비교합니다.
            </p>
          </div>
          <button
            type="button"
            className="util-month-compare-close"
            aria-label="닫기"
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="util-month-compare-controls">
          <label className="util-month-compare-field">
            <span>기준월</span>
            <input
              type="month"
              className="query-filter-input"
              value={baseMonth}
              onChange={(e) => {
                if (e.target.value) setBaseMonth(e.target.value);
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost util-month-compare-swap"
            onClick={swapMonths}
            title="월 위치 바꾸기"
          >
            <ArrowLeftRight size={16} aria-hidden />
            위치 바꾸기
          </button>
          <label className="util-month-compare-field">
            <span>비교월</span>
            <input
              type="month"
              className="query-filter-input"
              value={compareMonth}
              onChange={(e) => {
                if (e.target.value) setCompareMonth(e.target.value);
              }}
            />
          </label>
          <div
            className="dt-product-tabs util-month-compare-scope-tabs"
            role="tablist"
            aria-label="월별 비교 제품 범위"
          >
            {COMPARE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={scopeTab === tab.value}
                className="dt-product-tab"
                data-tone={tab.tone}
                data-active={scopeTab === tab.value}
                onClick={() => setScopeTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {baseMonth === compareMonth ? (
          <p className="util-month-compare-warn">
            같은 월을 선택했습니다. 서로 다른 월을 선택하면 차이가 더 잘
            보입니다.
          </p>
        ) : null}

        <section
          className="util-month-compare-summary"
          aria-label={`설비 가동률_${scopeTab}`}
        >
          <div className="util-month-compare-summary-head">
            <h3 className="util-month-compare-summary-title">
              설비 가동률_{scopeTab}
            </h3>
          </div>
          <div
            className="util-month-compare-table-wrap"
            data-tone={scopeTone}
          >
            <table className="util-month-compare-table">
              <thead>
                <tr>
                  <th>관리지표</th>
                  <th>설비종합효율(%)</th>
                  <th>성능가동률(%)</th>
                  <th>시간가동률(%)</th>
                  <th>양품률(%)</th>
                  <th className="util-month-compare-th-mttr">
                    MTTR
                    <br />
                    설비복구시간(min)
                  </th>
                  <th className="util-month-compare-th-mtbf">
                    MTBF
                    <br />
                    고장간격시간(Hr)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{rows.base.label}</th>
                  <td>{formatCell(rows.base.oee)}</td>
                  <td>{formatCell(rows.base.performance)}</td>
                  <td>{formatCell(rows.base.time)}</td>
                  <td>{formatCell(rows.base.yieldRate)}</td>
                  <td>{formatCell(rows.base.mttr)}</td>
                  <td>{formatCell(rows.base.mtbf)}</td>
                </tr>
                <tr>
                  <th scope="row">{rows.compare.label}</th>
                  <td>{formatCell(rows.compare.oee)}</td>
                  <td>{formatCell(rows.compare.performance)}</td>
                  <td>{formatCell(rows.compare.time)}</td>
                  <td>{formatCell(rows.compare.yieldRate)}</td>
                  <td>{formatCell(rows.compare.mttr)}</td>
                  <td>{formatCell(rows.compare.mtbf)}</td>
                </tr>
                <tr className="util-month-compare-delta-row">
                  <th scope="row">변동 내역</th>
                  <td data-tone="rate">{formatDelta(rows.change.oee)}</td>
                  <td data-tone="rate">
                    {formatDelta(rows.change.performance)}
                  </td>
                  <td data-tone="rate">{formatDelta(rows.change.time)}</td>
                  <td data-tone="rate">
                    {formatDelta(rows.change.yieldRate)}
                  </td>
                  <td data-tone="reli">{formatDelta(rows.change.mttr)}</td>
                  <td data-tone="reli">{formatDelta(rows.change.mtbf)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div className="util-month-compare-grid">
          <div className="util-month-compare-col" data-side="a">
            <p className="util-month-compare-col-label">
              기준월 · {yearMonthLabel(baseMonth)}
            </p>
            <UtilizationOverviewPanel
              monthLabel={baseSnap.monthLabel}
              overview={baseSnap.overview}
              trends={baseSnap.trends}
              equipmentByProduct={baseSnap.equipmentByProduct}
              mttrMtbfSummary={baseSnap.mttrMtbfSummary}
              grommetEmphasized
              sealEmphasized
              showEquipmentBlock={false}
              embedded
              showScopeTabs={false}
              productScope={scopeTab}
              onYieldChange={() => setYieldRevision((n) => n + 1)}
            />
          </div>
          <div className="util-month-compare-col" data-side="b">
            <p className="util-month-compare-col-label">
              비교월 · {yearMonthLabel(compareMonth)}
            </p>
            <UtilizationOverviewPanel
              monthLabel={compareSnap.monthLabel}
              overview={compareSnap.overview}
              trends={compareSnap.trends}
              equipmentByProduct={compareSnap.equipmentByProduct}
              mttrMtbfSummary={compareSnap.mttrMtbfSummary}
              grommetEmphasized
              sealEmphasized
              showEquipmentBlock={false}
              embedded
              showScopeTabs={false}
              productScope={scopeTab}
              onYieldChange={() => setYieldRevision((n) => n + 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
