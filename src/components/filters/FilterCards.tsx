"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useDataSource } from "@/context/DataSourceContext";
import { useFilters } from "@/context/FilterContext";
import { useToast } from "@/context/ToastContext";
import type { DatePreset, Factory, ProductType, ShiftType } from "@/types";

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

/** 메뉴별·상세 조회조건 공통 카드 셸 */
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
    // 좁은 화면에서는 공간 확보를 위해 상세 조건을 기본 접힘
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

function MultiSelect({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())),
    [options, q],
  );

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.id, o.label]));
    return values.map((id) => map.get(id)).filter(Boolean) as string[];
  }, [options, values]);

  const triggerText =
    values.length === 0
      ? `전체 ${label}`
      : values.length === 1
        ? selectedLabels[0] ?? `1개 선택`
        : values.length <= 2
          ? selectedLabels.join(", ")
          : `${selectedLabels[0]} 외 ${values.length - 1}개`;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <div className="query-filter-field query-filter-ms" ref={rootRef}>
      <p className="query-filter-label">{label}</p>
      <button
        type="button"
        className="query-filter-ms-trigger"
        data-open={open}
        data-active={values.length > 0}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="query-filter-ms-value"
          data-muted={values.length === 0}
        >
          {triggerText}
        </span>
        <ChevronDown size={16} className="query-filter-ms-chevron" aria-hidden />
      </button>
      {open ? (
        <div className="query-filter-ms-panel" id={listId} role="listbox">
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`${label} 검색`}
            className="query-filter-ms-search"
            aria-label={`${label} 검색`}
          />
          <div className="query-filter-ms-toolbar">
            <span>
              {values.length > 0
                ? `${values.length}개 선택`
                : `${filtered.length}개 항목`}
            </span>
            <div className="flex gap-2">
              {filtered.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const ids = new Set(values);
                    filtered.forEach((o) => ids.add(o.id));
                    onChange([...ids]);
                  }}
                >
                  모두 선택
                </button>
              ) : null}
              {values.length > 0 ? (
                <button type="button" onClick={() => onChange([])}>
                  선택 해제
                </button>
              ) : null}
            </div>
          </div>
          <div className="query-filter-ms-list">
            {filtered.length === 0 ? (
              <p className="query-filter-ms-empty">검색 결과가 없습니다.</p>
            ) : (
              filtered.map((opt) => {
                const checked = values.includes(opt.id);
                return (
                  <label key={opt.id} className="query-filter-ms-option">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange(
                          checked
                            ? values.filter((v) => v !== opt.id)
                            : [...values, opt.id],
                        )
                      }
                    />
                    {opt.label}
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DetailFilterCard({
  showEquipment = true,
  showParts = true,
  showOperators = true,
  showMolds = false,
  showShift = true,
  showDowntimeReason = false,
}: {
  showEquipment?: boolean;
  showParts?: boolean;
  showOperators?: boolean;
  showMolds?: boolean;
  showShift?: boolean;
  showDowntimeReason?: boolean;
}) {
  const { filters, setFilters, resetDetail } = useFilters();
  const { filterOptions } = useDataSource();
  const { pushToast } = useToast();

  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  filters.equipmentIds.forEach((id) => {
    const opt = filterOptions.equipment.find((e) => e.id === id);
    if (opt)
      chips.push({
        key: `eq-${id}`,
        label: `설비 ${opt.label}`,
        clear: () =>
          setFilters({ equipmentIds: filters.equipmentIds.filter((x) => x !== id) }),
      });
  });
  filters.partIds.forEach((id) => {
    const opt = filterOptions.parts.find((e) => e.id === id);
    if (opt)
      chips.push({
        key: `pt-${id}`,
        label: `품번 ${opt.label}`,
        clear: () => setFilters({ partIds: filters.partIds.filter((x) => x !== id) }),
      });
  });
  filters.operatorIds.forEach((id) => {
    const opt = filterOptions.operators.find((e) => e.id === id);
    if (opt)
      chips.push({
        key: `op-${id}`,
        label: `작업자 ${opt.label}`,
        clear: () =>
          setFilters({ operatorIds: filters.operatorIds.filter((x) => x !== id) }),
      });
  });
  filters.moldIds.forEach((id) => {
    const opt = filterOptions.molds.find((e) => e.id === id);
    if (opt)
      chips.push({
        key: `md-${id}`,
        label: `금형 ${opt.label}`,
        clear: () => setFilters({ moldIds: filters.moldIds.filter((x) => x !== id) }),
      });
  });
  if (filters.shiftType !== "전체") {
    chips.push({
      key: "shift",
      label: filters.shiftType,
      clear: () => setFilters({ shiftType: "전체" }),
    });
  }
  if (filters.downtimeReason !== "전체") {
    chips.push({
      key: "reason",
      label: filters.downtimeReason,
      clear: () => setFilters({ downtimeReason: "전체" }),
    });
  }

  const summary = chips.map((c) => c.label);

  return (
    <QueryFilterShell
      title="상세 조회조건"
      activeCount={chips.length}
      collapsible
      onReset={() => {
        resetDetail();
        pushToast("조회조건을 초기화했습니다.", "info");
      }}
      summary={summary}
    >
      <div className="query-filter-grid">
        {showEquipment ? (
          <MultiSelect
            label="설비"
            options={filterOptions.equipment}
            values={filters.equipmentIds}
            onChange={(equipmentIds) => setFilters({ equipmentIds })}
          />
        ) : null}
        {showParts ? (
          <MultiSelect
            label="품번"
            options={filterOptions.parts}
            values={filters.partIds}
            onChange={(partIds) => setFilters({ partIds })}
          />
        ) : null}
        {showOperators ? (
          <MultiSelect
            label="작업자"
            options={filterOptions.operators}
            values={filters.operatorIds}
            onChange={(operatorIds) => setFilters({ operatorIds })}
          />
        ) : null}
        {showMolds ? (
          <MultiSelect
            label="금형번호"
            options={filterOptions.molds}
            values={filters.moldIds}
            onChange={(moldIds) => setFilters({ moldIds })}
          />
        ) : null}
        {showShift ? (
          <div className="query-filter-field">
            <p className="query-filter-label">구분</p>
            <PillGroup
              options={["전체", "주간", "야간"] as Array<"전체" | ShiftType>}
              value={filters.shiftType}
              onChange={(shiftType) => setFilters({ shiftType })}
            />
          </div>
        ) : null}
        {showDowntimeReason ? (
          <div className="query-filter-field" style={{ gridColumn: "1 / -1" }}>
            <p className="query-filter-label">비가동 사유</p>
            <PillGroup
              options={[
                "전체",
                "금형교체",
                "설비이상",
                "근태변경",
                "금형세척",
                "고무이상",
                "제품이상",
                "복합 사유",
              ]}
              value={filters.downtimeReason}
              onChange={(downtimeReason) =>
                setFilters({
                  downtimeReason: downtimeReason as typeof filters.downtimeReason,
                })
              }
            />
          </div>
        ) : null}
      </div>
      {chips.length > 0 ? (
        <div className="query-filter-chips">
          <span className="query-filter-chips-label">적용 중</span>
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="query-filter-chip"
              onClick={c.clear}
              aria-label={`${c.label} 제거`}
            >
              <span className="truncate">{c.label}</span>
              <span className="query-filter-chip-x" aria-hidden>
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </QueryFilterShell>
  );
}
