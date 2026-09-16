"use client";

import { useMemo, useState } from "react";
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
                className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs"
                value={filters.startDate}
                onChange={(e) => setFilters({ startDate: e.target.value })}
              />
              <span className="text-xs text-[var(--text-secondary)]">~</span>
              <input
                type="date"
                className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs"
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
  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())),
    [options, q],
  );

  return (
    <div className="relative">
      <p className="mb-1 text-xs text-[var(--text-secondary)]">{label}</p>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-[10px] border border-[var(--border)] px-3 py-2 text-left text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {values.length === 0
            ? `전체 ${label}`
            : `${values.length}개 선택`}
        </span>
        <span>⌄</span>
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-2 shadow-lg">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="검색"
            className="mb-2 w-full rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <div className="max-h-48 overflow-auto">
            {filtered.map((opt) => {
              const checked = values.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                >
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
            })}
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
  const [collapsed, setCollapsed] = useState(false);

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

  return (
    <section className="card mb-4 p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">상세 조회조건</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              resetDetail();
              pushToast("조회조건을 초기화했습니다.", "info");
            }}
          >
            초기화
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "펼치기 ∨" : "접기 ∧"}
          </button>
        </div>
      </div>
      {!collapsed ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <div>
              <p className="mb-1 text-xs text-[var(--text-secondary)]">구분</p>
              <PillGroup
                options={["전체", "주간", "야간"] as Array<"전체" | ShiftType>}
                value={filters.shiftType}
                onChange={(shiftType) => setFilters({ shiftType })}
              />
            </div>
          ) : null}
          {showDowntimeReason ? (
            <div className="md:col-span-2 xl:col-span-4">
              <p className="mb-1 text-xs text-[var(--text-secondary)]">비가동 사유</p>
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
      ) : null}
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-[var(--text-secondary)]">적용 중:</span>
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs"
              onClick={c.clear}
            >
              {c.label} ×
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
