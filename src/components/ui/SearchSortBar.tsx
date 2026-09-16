"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
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
}: SearchSortBarProps) {
  const { pushToast } = useToast();
  const [local, setLocal] = useState(search);

  useEffect(() => setLocal(search), [search]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (local !== search) onSearch(local);
    }, 300);
    return () => window.clearTimeout(t);
  }, [local, search, onSearch]);

  return (
    <div className="card mb-4 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-sm md:max-w-md"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          aria-label="정렬"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          onClick={() => onOrder(order === "asc" ? "desc" : "asc")}
        >
          {order === "asc" ? "오름차순" : "내림차순"} ↕
        </button>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          aria-label="페이지 크기"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}개
            </option>
          ))}
        </select>
        {onExcel ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              try {
                onExcel();
                pushToast("Excel 파일 생성을 시작했습니다.", "success");
              } catch {
                pushToast("Excel 다운로드에 실패했습니다.", "error");
              }
            }}
          >
            <Download size={16} />
            {excelLabel}
          </button>
        ) : null}
      </div>
    </div>
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
      <p className="text-sm text-[var(--text-secondary)]">전체 {total.toLocaleString("ko-KR")}건</p>
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
  const sorted = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) out.push("…");
    out.push(sorted[i]!);
  }
  return out;
}
