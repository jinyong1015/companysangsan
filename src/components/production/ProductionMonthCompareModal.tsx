"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO, subMonths } from "date-fns";
import { ArrowLeftRight, X } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { buildMonthlyDashboardTrends, filterRecords } from "@/lib/metrics";
import { monthDateRange } from "@/lib/utilization";
import type { GlobalFilters, ProductionRecord, ProductType } from "@/types";

type CompareScope = "전체" | ProductType;

type ProductionMonthRow = {
  yearMonth: string;
  label: string;
  partKindCount: number;
  productionQuantity: number;
  avgShot: number;
  dailyAvgShots: number;
};

const SCOPE_TABS: Array<{
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

function shortMonthLabel(yearMonth: string): string {
  try {
    return format(parseISO(`${yearMonth}-01`), "M월");
  } catch {
    return yearMonth;
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function delta(a: number, b: number): number {
  return round1(b - a);
}

function formatDelta(value: number, digits: number): string {
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, digits)}`;
}

function deltaSign(value: number): "up" | "down" | "flat" {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

function summarizeMonth(
  records: ProductionRecord[],
  filters: GlobalFilters,
  yearMonth: string,
  scope: CompareScope,
): ProductionMonthRow {
  const range = monthDateRange(yearMonth);
  const list = filterRecords(records, {
    ...filters,
    productType: scope === "전체" ? "전체" : scope,
    datePreset: "custom",
    startDate: range.startDate,
    endDate: range.endDate,
  });
  const point = buildMonthlyDashboardTrends(
    list,
    range.startDate,
    range.endDate,
    "month",
  )[0];
  return {
    yearMonth,
    label: shortMonthLabel(yearMonth),
    partKindCount: point?.partKindCount ?? 0,
    productionQuantity: point?.productionQuantity ?? 0,
    avgShot: point?.avgShot ?? 0,
    dailyAvgShots: point?.dailyAvgShots ?? 0,
  };
}

export function ProductionMonthCompareModal({
  open,
  onClose,
  initialMonth,
  records,
  filters,
}: {
  open: boolean;
  onClose: () => void;
  initialMonth: string;
  records: ProductionRecord[];
  filters: GlobalFilters;
}) {
  const [baseMonth, setBaseMonth] = useState(() =>
    previousYearMonth(initialMonth),
  );
  const [compareMonth, setCompareMonth] = useState(initialMonth);
  const [scopeTab, setScopeTab] = useState<CompareScope>("전체");

  useEffect(() => {
    if (!open) return;
    setBaseMonth(previousYearMonth(initialMonth));
    setCompareMonth(initialMonth);
    setScopeTab("전체");
  }, [open, initialMonth]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const rows = useMemo(() => {
    if (!open) return null;
    const base = summarizeMonth(records, filters, baseMonth, scopeTab);
    const compare = summarizeMonth(records, filters, compareMonth, scopeTab);
    return {
      base,
      compare,
      change: {
        partKindCount: delta(base.partKindCount, compare.partKindCount),
        productionQuantity: delta(
          base.productionQuantity,
          compare.productionQuantity,
        ),
        avgShot: delta(base.avgShot, compare.avgShot),
        dailyAvgShots: delta(base.dailyAvgShots, compare.dailyAvgShots),
      },
    };
  }, [baseMonth, compareMonth, filters, open, records, scopeTab]);

  if (!open || !rows) return null;

  const swapMonths = () => {
    setBaseMonth(compareMonth);
    setCompareMonth(baseMonth);
  };

  const scopeTone =
    SCOPE_TABS.find((tab) => tab.value === scopeTab)?.tone ?? "all";

  return (
    <div
      className="pvt-month-compare-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="pvt-month-compare-modal"
        role="dialog"
        aria-modal="true"
        aria-label="생산변동 월별 비교"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pvt-month-compare-head">
          <div>
            <h2 className="pvt-month-compare-title">월별 비교</h2>
            <p className="pvt-month-compare-sub">
              두 달을 선택해 품목·생산수량·평균 SHOT 변동을 비교합니다.
            </p>
          </div>
          <button
            type="button"
            className="pvt-month-compare-close"
            aria-label="닫기"
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="pvt-month-compare-controls">
          <label className="pvt-month-compare-field">
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
            className="btn btn-ghost pvt-month-compare-swap"
            onClick={swapMonths}
            title="월 위치 바꾸기"
          >
            <ArrowLeftRight size={16} aria-hidden />
            위치 바꾸기
          </button>
          <label className="pvt-month-compare-field">
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
            className="dt-product-tabs pvt-month-compare-scope-tabs"
            role="tablist"
            aria-label="생산변동 월별 비교 범위"
          >
            {SCOPE_TABS.map((tab) => (
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
          <p className="pvt-month-compare-warn">
            같은 월을 선택했습니다. 서로 다른 월을 선택하면 차이가 더 잘
            보입니다.
          </p>
        ) : null}

        <div
          className="pvt-month-compare-table-wrap"
          data-tone={scopeTone}
        >
          <table className="pvt-month-compare-table">
            <thead>
              <tr>
                <th>DATA 수집일</th>
                <th>품목수량</th>
                <th>생산수량(EA)</th>
                <th>평균 SHOT(hr)</th>
                <th>평균 SHOT(日)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{rows.base.label}</th>
                <td>{formatNumber(rows.base.partKindCount, 0)}</td>
                <td>{formatNumber(rows.base.productionQuantity, 0)}</td>
                <td>{formatNumber(rows.base.avgShot, 1)}</td>
                <td>{formatNumber(rows.base.dailyAvgShots, 0)}</td>
              </tr>
              <tr>
                <th scope="row">{rows.compare.label}</th>
                <td>{formatNumber(rows.compare.partKindCount, 0)}</td>
                <td>{formatNumber(rows.compare.productionQuantity, 0)}</td>
                <td>{formatNumber(rows.compare.avgShot, 1)}</td>
                <td>{formatNumber(rows.compare.dailyAvgShots, 0)}</td>
              </tr>
              <tr className="pvt-month-compare-delta-row">
                <th scope="row">변동 내역</th>
                <td data-sign={deltaSign(rows.change.partKindCount)}>
                  {formatDelta(rows.change.partKindCount, 0)}
                </td>
                <td data-sign={deltaSign(rows.change.productionQuantity)}>
                  {formatDelta(rows.change.productionQuantity, 0)}
                </td>
                <td data-sign={deltaSign(rows.change.avgShot)}>
                  {formatDelta(rows.change.avgShot, 1)}
                </td>
                <td data-sign={deltaSign(rows.change.dailyAvgShots)}>
                  {formatDelta(rows.change.dailyAvgShots, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
