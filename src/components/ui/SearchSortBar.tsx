"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  ChevronDown,
  Download,
  Search,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";

interface SearchSortBarProps {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
  sort: string;
  onSort: (v: string) => void;
  order: "asc" | "desc";
  onOrder: (v: "asc" | "desc") => void;
  pageSize: number;
  onPageSize: (v: number) => void;
  sortOptions: Array<{ value: string; label: string }>;
  excelLabel?: string;
  onExcel?: () => void;
  title?: string;
  /** children이 있으면 조회조건+내역을 한 카드로 연결 */
  resultTitle?: string;
  children?: ReactNode;
  /** 이미 카드 안에 있을 때 외곽 카드 스타일 생략 */
  embedded?: boolean;
  extra?: ReactNode;
  id?: string;
}

export function SearchSortBar({
  search,
  onSearch,
  searchPlaceholder,
  sort,
  onSort,
  order,
  onOrder,
  pageSize,
  onPageSize,
  sortOptions,
  excelLabel = "Excel 다운로드",
  onExcel,
  title = "조회조건",
  resultTitle = "조회 내역",
  children,
  embedded = false,
  extra,
  id,
}: SearchSortBarProps) {
  const { pushToast } = useToast();
  const [local, setLocal] = useState(search);
  const linked = children != null;
  const asc = order === "asc";

  useEffect(() => setLocal(search), [search]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (local !== search) onSearch(local);
    }, 300);
    return () => window.clearTimeout(t);
  }, [local, search, onSearch]);

  const sortControls = (
    <>
      <label className="query-filter-inline">
        <span className="query-filter-inline-label">정렬</span>
        <span className="query-filter-select-wrap">
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            className="query-filter-input query-filter-select"
            aria-label="정렬 기준"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="query-filter-select-chevron" aria-hidden />
        </span>
      </label>
      <button
        type="button"
        className="query-filter-sort-btn"
        onClick={() => onOrder(asc ? "desc" : "asc")}
        aria-label={asc ? "오름차순으로 전환" : "내림차순으로 전환"}
        title={asc ? "클릭하여 내림차순" : "클릭하여 오름차순"}
      >
        {asc ? (
          <ArrowUpWideNarrow size={15} aria-hidden />
        ) : (
          <ArrowDownWideNarrow size={15} aria-hidden />
        )}
        <span>{asc ? "오름차순" : "내림차순"}</span>
      </button>
      <label className="query-filter-inline">
        <span className="query-filter-inline-label">표시</span>
        <span className="query-filter-select-wrap">
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="query-filter-input query-filter-select query-filter-select-sm"
            aria-label="페이지당 표시 개수"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="query-filter-select-chevron" aria-hidden />
        </span>
      </label>
    </>
  );

  const toolbar = (
    <div className="query-filter-toolbar-row">
      <label className="query-filter-search-wrap">
        <span className="sr-only">검색</span>
        <Search size={16} className="query-filter-search-icon" aria-hidden />
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder={searchPlaceholder}
          className="query-filter-input query-filter-search-input"
          aria-label="검색"
        />
      </label>
      <div className="query-filter-toolbar-controls">{sortControls}</div>
    </div>
  );

  const excelBtn = onExcel ? (
    <button
      type="button"
      className="query-filter-action"
      onClick={() => {
        try {
          onExcel();
          pushToast("Excel 파일 생성을 시작했습니다.", "success");
        } catch {
          pushToast("Excel 다운로드에 실패했습니다.", "error");
        }
      }}
    >
      <Download size={14} aria-hidden />
      {excelLabel}
    </button>
  ) : null;

  const resultPanel = linked ? (
    <div className="query-result-panel">
      <div className="query-result-panel-head">
        <h3 className="query-result-panel-title">{resultTitle}</h3>
      </div>
      <div className="query-result-panel-body">{children}</div>
    </div>
  ) : null;

  if (embedded) {
    return (
      <div
        id={id}
        className={`query-filter-embedded${linked ? " query-result-shell" : ""}`}
      >
        <div className="query-filter-header query-filter-header-embedded">
          <div className="query-filter-title-row">
            <h3 className="query-filter-title">{title}</h3>
            {extra ? <div className="query-filter-extra">{extra}</div> : null}
          </div>
          <div className="query-filter-actions">{excelBtn}</div>
        </div>
        <div className="query-filter-body">{toolbar}</div>
        {resultPanel}
      </div>
    );
  }

  return (
    <section
      id={id}
      className={`query-filter query-filter-toolbar${linked ? " query-result-shell" : ""}`}
    >
      <div className="query-filter-header">
        <div className="query-filter-title-row">
          <h2 className="query-filter-title">{title}</h2>
          {extra ? <div className="query-filter-extra">{extra}</div> : null}
        </div>
        <div className="query-filter-actions">{excelBtn}</div>
      </div>
      <div className="query-filter-body">{toolbar}</div>
      {resultPanel}
    </section>
  );
}

export function NumberPagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = buildPageList(page, totalPages);
  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <p className="text-sm text-[var(--text-secondary)]">
        전체 {total.toLocaleString("ko-KR")}건
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {pages.map((p, idx) =>
          p === "…" ? (
            <span key={`e-${idx}`} className="px-2 text-[var(--text-secondary)]">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className="pill min-w-10"
              data-active={p === page}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function buildPageList(page: number, totalPages: number): Array<number | "…"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const set = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...set]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) out.push("…");
    out.push(sorted[i]!);
  }
  return out;
}
