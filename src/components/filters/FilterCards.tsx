"use client";

import {
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useFilters } from "@/context/FilterContext";
import type { DatePreset, Factory, ProductType } from "@/types";

const FACTORY_OPTIONS: Array<"전체" | Factory> = ["전체", "본사", "2공장"];
const PRODUCT_OPTIONS: Array<"전체" | ProductType> = ["전체", "GROMMET", "SEAL"];
const DATE_OPTIONS: Array<{ key: DatePreset; label: string }> = [
  { key: "today", label: "오늘" },
  { key: "last7", label: "최근 7일" },
  { key: "thisMonth", label: "이번 달" },
  { key: "lastMonth", label: "지난 달" },
  { key: "thisYear", label: "올해" },
  { key: "custom", label: "사용자 지정" },
];

function PillGroup<T extends string>({
  options,
  value,
  onChange,
  labels,
  nowrap = false,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<string, string>;
  nowrap?: boolean;
}) {
  return (
    <div
      className={nowrap ? "filter-pills filter-pills-nowrap" : "filter-pills"}
      role="radiogroup"
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          className="filter-pill"
          data-active={value === opt}
          onClick={() => onChange(opt)}
        >
          {labels?.[opt] ?? opt}
        </button>
      ))}
    </div>
  );
}

function CompactFilterCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`filter-card ${className}`}>
      <p className="filter-card-label">{title}</p>
      {children}
    </section>
  );
}

export function GlobalFilterSection({
  hidePeriod = false,
}: {
  /** 조회월 전용 화면(가동률·비가동)에서는 기간 프리셋을 숨긴다 */
  hidePeriod?: boolean;
}) {
  const { filters, setFilters } = useFilters();
  const dateError =
    filters.startDate && filters.endDate && filters.endDate < filters.startDate;
  const showCustomDates = filters.datePreset === "custom" || dateError;

  return (
    <div className="filter-bar mb-4">
      <CompactFilterCard title="공장">
        <PillGroup
          options={FACTORY_OPTIONS}
          value={filters.factory}
          onChange={(factory) => setFilters({ factory })}
        />
      </CompactFilterCard>
      <CompactFilterCard title="제품유형">
        <PillGroup
          options={PRODUCT_OPTIONS}
          value={filters.productType}
          onChange={(productType) => setFilters({ productType })}
        />
      </CompactFilterCard>
      {!hidePeriod ? (
        <CompactFilterCard title="조회기간" className="filter-card-period">
          <PillGroup
            options={DATE_OPTIONS.map((d) => d.key)}
            value={filters.datePreset}
            onChange={(datePreset) => setFilters({ datePreset })}
            labels={Object.fromEntries(DATE_OPTIONS.map((d) => [d.key, d.label]))}
            nowrap
          />
          {showCustomDates ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="date"
                className="filter-date-input rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs"
                value={filters.startDate}
                onChange={(e) => setFilters({ startDate: e.target.value })}
              />
              <span className="text-xs text-[var(--text-secondary)]">~</span>
              <input
                type="date"
                className="filter-date-input rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs"
                value={filters.endDate}
                onChange={(e) => setFilters({ endDate: e.target.value })}
              />
              {dateError ? (
                <p className="w-full text-xs text-[var(--error)]">
                  종료일은 시작일보다 빠를 수 없습니다.
                </p>
              ) : null}
            </div>
          ) : null}
        </CompactFilterCard>
      ) : null}
    </div>
  );
}

/** 메뉴별 조회조건 공통 카드 셸 */
export function QueryFilterShell({
  title,
  activeCount = 0,
  collapsible = false,
  defaultCollapsed = false,
  onReset,
  summary,
  children,
}: {
  title: string;
  activeCount?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onReset?: () => void;
  /** 접힌 상태에서 보이는 요약 칩 */
  summary?: string[];
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const bodyId = useId();

  useEffect(() => {
    if (!collapsible || defaultCollapsed) return;
    // 좁은 화면에서는 공간 확보를 위해 조회조건을 기본 접힘
    if (window.matchMedia("(max-width: 767px)").matches) {
      setCollapsed(true);
    }
  }, [collapsible, defaultCollapsed]);

  return (
    <section className="query-filter">
      <div className="query-filter-header">
        <div className="query-filter-title-row">
          <h2 className="query-filter-title">{title}</h2>
          {activeCount > 0 ? (
            <span className="query-filter-badge" aria-label={`적용 중 ${activeCount}개`}>
              {activeCount}
            </span>
          ) : null}
        </div>
        <div className="query-filter-actions">
          {onReset ? (
            <button
              type="button"
              className="query-filter-action"
              data-tone="reset"
              onClick={onReset}
            >
              <RotateCcw size={14} aria-hidden />
              초기화
            </button>
          ) : null}
          {collapsible ? (
            <button
              type="button"
              className="query-filter-action"
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? "펼치기" : "접기"}
              <ChevronDown
                size={15}
                aria-hidden
                style={{
                  transform: collapsed ? undefined : "rotate(180deg)",
                  transition: "transform 160ms ease",
                }}
              />
            </button>
          ) : null}
        </div>
      </div>

      {collapsible && collapsed && summary && summary.length > 0 ? (
        <div className="query-filter-summary" aria-live="polite">
          {summary.map((s) => (
            <span key={s} className="query-filter-summary-chip">
              {s}
            </span>
          ))}
        </div>
      ) : null}

      <div
        id={bodyId}
        className="query-filter-body"
        data-collapsed={collapsible && collapsed ? "true" : "false"}
      >
        {children}
      </div>
    </section>
  );
}
