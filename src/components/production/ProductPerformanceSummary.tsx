"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Columns3, Maximize2, X } from "lucide-react";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, SectionCard } from "@/components/ui/PageBits";
import { ProductTypeTabs } from "@/components/production/ProductTypeTabs";
import { downloadExcel } from "@/lib/excelParse";
import {
  formatNumber,
  formatUph,
  clsx,
} from "@/lib/format";
import { paginate, sortBy } from "@/lib/metrics";
import { withFromParam } from "@/lib/navigation";
import type { ProductPerformanceRow, ProductType } from "@/types";

const NO_OP_HINT = "유효 가동시간이 없어 해당 지표를 계산할 수 없습니다.";

export type ProductTab = "전체" | ProductType;

export const PERF_COLUMNS = [
  { key: "productType", label: "제품유형", sticky: true, defaultVisible: true },
  { key: "partNumber", label: "품번", sticky: true, defaultVisible: true },
  { key: "downtimeMinutes", label: "비가동시간(분)", sticky: false, defaultVisible: true },
  { key: "elapsedMinutes", label: "작업시간(분)", sticky: false, defaultVisible: true },
  { key: "operatingMinutes", label: "가동시간(분)", sticky: false, defaultVisible: true },
  { key: "shotCount", label: "총 SHOT", sticky: false, defaultVisible: true },
  {
    key: "avgShotByOperating",
    label: "가동시간 기준 평균 SHOT",
    sticky: false,
    defaultVisible: true,
  },
  {
    key: "avgShotByElapsed",
    label: "전체 작업시간 기준 평균 SHOT",
    sticky: false,
    defaultVisible: true,
  },
  { key: "workDays", label: "작업일수", sticky: false, defaultVisible: true },
  { key: "dailyAvgShots", label: "일 평균 판수", sticky: false, defaultVisible: true },
  {
    key: "productionQuantity",
    label: "생산수량(EA)",
    sticky: false,
    defaultVisible: true,
  },
  { key: "defectQuantity", label: "불량수량(EA)", sticky: false, defaultVisible: true },
  { key: "goodQuantity", label: "양품수량(EA)", sticky: false, defaultVisible: true },
  { key: "uph", label: "UPH", sticky: false, defaultVisible: true },
] as const;

export type PerfColumnKey = (typeof PERF_COLUMNS)[number]["key"];

const SORT_GETTERS: Record<
  string,
  (r: ProductPerformanceRow) => number | string | null
> = {
  productType: (r) => r.productType,
  partNumber: (r) => r.partNumber,
  downtimeMinutes: (r) => r.downtimeMinutes,
  elapsedMinutes: (r) => r.elapsedMinutes,
  operatingMinutes: (r) => r.operatingMinutes,
  shotCount: (r) => r.shotCount,
  avgShotByOperating: (r) => r.avgShotByOperating,
  avgShotByElapsed: (r) => r.avgShotByElapsed,
  workDays: (r) => r.workDays,
  dailyAvgShots: (r) => r.dailyAvgShots,
  productionQuantity: (r) => r.productionQuantity,
  defectQuantity: (r) => r.defectQuantity,
  goodQuantity: (r) => r.goodQuantity,
  uph: (r) => r.uph,
};

function dashMetric(
  value: number | null,
  formatter: (v: number) => string,
  unavailable = false,
): ReactNode {
  if (value == null || unavailable) {
    return (
      <span title={NO_OP_HINT} className="text-[var(--text-secondary)]">
        -
      </span>
    );
  }
  return formatter(value);
}

function FullscreenShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
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

interface ProductPerformanceSummaryProps {
  rows: ProductPerformanceRow[];
  productTab: ProductTab;
  onProductTab: (tab: ProductTab) => void;
  tabCounts?: Partial<Record<ProductTab, number>>;
  search: string;
  onSearch: (v: string) => void;
  sort: string;
  onSort: (v: string) => void;
  order: "asc" | "desc";
  onOrder: (v: "asc" | "desc") => void;
  page: number;
  onPage: (v: number) => void;
  pageSize: number;
  onPageSize: (v: number) => void;
  hiddenColumns: string[];
  onHiddenColumns: (keys: string[]) => void;
  onResetFilters?: () => void;
}

export function ProductPerformanceSummary({
  rows,
  productTab,
  onProductTab,
  tabCounts,
  search,
  onSearch,
  sort,
  onSort,
  order,
  onOrder,
  page,
  onPage,
  pageSize,
  onPageSize,
  hiddenColumns,
  onHiddenColumns,
  onResetFilters,
}: ProductPerformanceSummaryProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [colMenuOpen, setColMenuOpen] = useState(false);

  useEffect(() => {
    if (!colMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest(".pps-col-menu-root")) return;
      setColMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [colMenuOpen]);

  const visibleKeys = useMemo(() => {
    const hidden = new Set(hiddenColumns);
    return PERF_COLUMNS.filter((c) => !hidden.has(c.key)).map((c) => c.key);
  }, [hiddenColumns]);

  const filteredSorted = useMemo(() => {
    let list = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.partNumber.toLowerCase().includes(q));
    }
    return sortBy(list, sort, order, SORT_GETTERS);
  }, [rows, search, sort, order]);

  const paged = paginate(filteredSorted, page, pageSize);

  const toggleColumn = (key: PerfColumnKey) => {
    const col = PERF_COLUMNS.find((c) => c.key === key);
    if (!col || col.sticky) return;
    if (hiddenColumns.includes(key)) {
      onHiddenColumns(hiddenColumns.filter((k) => k !== key));
    } else {
      onHiddenColumns([...hiddenColumns, key]);
    }
  };

  const exportExcel = () => {
    downloadExcel(
      "제품별_생산_종합_실적.xlsx",
      filteredSorted.map((r, i) => ({
        NO: i + 1,
        제품유형: r.productType,
        품번: r.partNumber,
        "비가동시간(분)": r.downtimeMinutes,
        "작업시간(분)": r.elapsedMinutes,
        "가동시간(분)": r.operatingMinutes,
        "총 SHOT": r.shotCount,
        "가동시간 기준 평균 SHOT": r.avgShotByOperating,
        "전체 작업시간 기준 평균 SHOT": r.avgShotByElapsed,
        작업일수: r.workDays,
        "일 평균 판수":
          r.dailyAvgShots == null ? null : Math.round(r.dailyAvgShots),
        "생산수량(EA)": r.productionQuantity,
        "불량수량(EA)": r.defectQuantity,
        "양품수량(EA)": r.goodQuantity,
        UPH: r.uph,
      })),
    );
  };

  const tableBody = (
    <div className="table-wrap pps-table-wrap">
      <table className="data-table pps-table">
        <thead>
          <tr>
            <th className="num">NO</th>
            {PERF_COLUMNS.filter((c) => visibleKeys.includes(c.key)).map((c) => (
              <th
                key={c.key}
                className={clsx(
                  c.key !== "productType" && c.key !== "partNumber" && "num",
                  c.sticky && "pps-sticky-col",
                  c.key === "productType" && "pps-sticky-1",
                  c.key === "partNumber" && "pps-sticky-2",
                  sort === c.key && "pps-sorted",
                )}
              >
                <button
                  type="button"
                  className="pps-sort-btn"
                  onClick={() => {
                    if (sort === c.key) onOrder(order === "asc" ? "desc" : "asc");
                    else {
                      onSort(c.key);
                      onOrder("desc");
                    }
                  }}
                >
                  {c.label}
                  {sort === c.key ? (order === "asc" ? " ↑" : " ↓") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.items.map((r, idx) => {
            const no = (paged.page - 1) * pageSize + idx + 1;
            const noOperating = r.operatingMinutes <= 0;
            return (
              <tr key={r.id}>
                <td className="num">{no}</td>
                {visibleKeys.includes("productType") ? (
                  <td className="pps-sticky-col pps-sticky-1">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                      style={{
                        background:
                          r.productType === "GROMMET"
                            ? "var(--grommet)"
                            : "var(--seal)",
                      }}
                    >
                      {r.productType}
                    </span>
                  </td>
                ) : null}
                {visibleKeys.includes("partNumber") ? (
                  <td className="pps-sticky-col pps-sticky-2">
                    <Link
                      href={withFromParam(`/parts/${r.id}`, "production")}
                      className="linkish"
                    >
                      {r.partNumber}
                    </Link>
                  </td>
                ) : null}
                {visibleKeys.includes("downtimeMinutes") ? (
                  <td className="num">{formatNumber(r.downtimeMinutes)}</td>
                ) : null}
                {visibleKeys.includes("elapsedMinutes") ? (
                  <td className="num">{formatNumber(r.elapsedMinutes)}</td>
                ) : null}
                {visibleKeys.includes("operatingMinutes") ? (
                  <td className="num">{formatNumber(r.operatingMinutes)}</td>
                ) : null}
                {visibleKeys.includes("shotCount") ? (
                  <td className="num">{formatNumber(r.shotCount)}</td>
                ) : null}
                {visibleKeys.includes("avgShotByOperating") ? (
                  <td className="num">
                    {dashMetric(
                      r.avgShotByOperating,
                      (v) => formatNumber(v, 1),
                      noOperating,
                    )}
                  </td>
                ) : null}
                {visibleKeys.includes("avgShotByElapsed") ? (
                  <td className="num">
                    {dashMetric(r.avgShotByElapsed, (v) => formatNumber(v, 2))}
                  </td>
                ) : null}
                {visibleKeys.includes("workDays") ? (
                  <td className="num">{formatNumber(r.workDays)}</td>
                ) : null}
                {visibleKeys.includes("dailyAvgShots") ? (
                  <td className="num">
                    {dashMetric(r.dailyAvgShots, (v) =>
                      formatNumber(Math.round(v)),
                    )}
                  </td>
                ) : null}
                {visibleKeys.includes("productionQuantity") ? (
                  <td className="num">{formatNumber(r.productionQuantity)}</td>
                ) : null}
                {visibleKeys.includes("defectQuantity") ? (
                  <td className="num">{formatNumber(r.defectQuantity)}</td>
                ) : null}
                {visibleKeys.includes("goodQuantity") ? (
                  <td className="num">{formatNumber(r.goodQuantity)}</td>
                ) : null}
                {visibleKeys.includes("uph") ? (
                  <td className="num">
                    {dashMetric(r.uph, (v) => formatUph(v), noOperating)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <SectionCard title="제품별 생산 종합 실적" className="mb-4">
      <ProductTypeTabs
        value={productTab}
        onChange={onProductTab}
        counts={tabCounts}
        ariaLabel="제품별 생산 종합 실적 제품유형"
        className="mb-3"
        compact
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative pps-col-menu-root">
          <button
            type="button"
            className="btn"
            onClick={() => setColMenuOpen((v) => !v)}
            aria-expanded={colMenuOpen}
          >
            <Columns3 size={16} />
            컬럼 표시
          </button>
          {colMenuOpen ? (
            <div className="pps-col-menu">
              {PERF_COLUMNS.map((c) => (
                <label key={c.key} className="pps-col-item">
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.includes(c.key)}
                    disabled={c.sticky}
                    onChange={() => toggleColumn(c.key)}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" className="btn" onClick={() => setFullscreen(true)}>
          <Maximize2 size={16} />
          전체화면 보기
        </button>
      </div>

      <SearchSortBar
        search={search}
        onSearch={onSearch}
        searchPlaceholder="품번 검색"
        sort={sort}
        onSort={onSort}
        order={order}
        onOrder={onOrder}
        pageSize={pageSize}
        onPageSize={onPageSize}
        sortOptions={[
          { value: "productionQuantity", label: "생산수량" },
          { value: "shotCount", label: "총 SHOT" },
          { value: "uph", label: "UPH" },
          { value: "operatingMinutes", label: "가동시간" },
          { value: "downtimeMinutes", label: "비가동시간" },
          { value: "dailyAvgShots", label: "일 평균 판수" },
          { value: "partNumber", label: "품번" },
          { value: "productType", label: "제품유형" },
        ]}
        onExcel={exportExcel}
        embedded
        resultTitle="제품별 생산 종합 실적"
      >
        {filteredSorted.length === 0 ? (
          <EmptyState
            title="선택한 조회조건에 해당하는 제품별 생산실적이 없습니다."
            description="조회기간·공장·설비·제품유형 조건을 변경해 보세요."
            actionLabel={onResetFilters ? "조회조건 초기화" : undefined}
            onAction={onResetFilters}
          />
        ) : (
          <>
            {tableBody}
            <NumberPagination
              page={paged.page}
              totalPages={paged.totalPages}
              total={paged.total}
              onPage={onPage}
            />
          </>
        )}
      </SearchSortBar>

      <FullscreenShell
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        title="제품별 생산 종합 실적"
      >
        {filteredSorted.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">표시할 데이터가 없습니다.</p>
        ) : (
          <>
            {tableBody}
            <NumberPagination
              page={paged.page}
              totalPages={paged.totalPages}
              total={paged.total}
              onPage={onPage}
            />
          </>
        )}
      </FullscreenShell>
    </SectionCard>
  );
}
