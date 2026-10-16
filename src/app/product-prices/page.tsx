"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CircleDollarSign,
  FileSpreadsheet,
  LoaderCircle,
  Lock,
  PackagePlus,
  RefreshCw,
  Upload,
} from "lucide-react";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader } from "@/components/ui/PageBits";
import { useAdmin } from "@/context/AdminContext";
import { useToast } from "@/context/ToastContext";
import { formatNumber } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  PricePreviewRow,
  ProductPriceRow,
  ProductPriceUploadSummary,
} from "@/lib/productPrices/types";

type ListResponse = {
  ok: boolean;
  message?: string;
  items?: ProductPriceRow[];
  total?: number;
  lastUpload?: ProductPriceUploadSummary | null;
};

const ACTION_LABEL: Record<PricePreviewRow["action"], string> = {
  insert: "신규 등록",
  update: "단가 변경",
  unchanged: "변경 없음",
  error: "오류",
};

type PreviewFilter = "all" | PricePreviewRow["action"];

const PREVIEW_FILTERS: Array<{
  key: PreviewFilter;
  label: string;
  tone: string;
  countKey: "total" | PricePreviewRow["action"];
}> = [
  { key: "all", label: "전체", tone: "slate", countKey: "total" },
  { key: "insert", label: "신규", tone: "green", countKey: "insert" },
  { key: "update", label: "변경", tone: "blue", countKey: "update" },
  { key: "unchanged", label: "유지", tone: "slate", countKey: "unchanged" },
  { key: "error", label: "오류", tone: "rose", countKey: "error" },
];

function formatPrice(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString("ko-KR", {
    maximumFractionDigits: 4,
  });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function ProductPricesPage() {
  const { ready, isAdmin, openLogin } = useAdmin();
  const { pushToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [items, setItems] = useState<ProductPriceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [lastUpload, setLastUpload] = useState<ProductPriceUploadSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<PricePreviewRow[]>([]);
  const [upsertRows, setUpsertRows] = useState<
    Array<{ part_number: string; unit_price: number }>
  >([]);
  const [fileName, setFileName] = useState("");
  const [previewSummary, setPreviewSummary] = useState({
    total: 0,
    insert: 0,
    update: 0,
    unchanged: 0,
    error: 0,
  });
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("all");

  const configured = isSupabaseConfigured();

  const loadList = useCallback(async () => {
    if (!configured || !isAdmin) {
      setItems([]);
      setTotal(0);
      setLastUpload(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: search,
        sort,
        order,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/product-prices?${params}`, {
        credentials: "include",
      });
      const data = (await res.json()) as ListResponse;
      if (!data.ok) {
        pushToast(data.message ?? "목록 조회에 실패했습니다.", "error");
        return;
      }
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setLastUpload(data.lastUpload ?? null);
    } catch {
      pushToast("목록 조회에 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [configured, isAdmin, search, sort, order, page, pageSize, pushToast]);

  useEffect(() => {
    if (!ready) return;
    void loadList();
  }, [ready, loadList]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const requestUpload = () => {
    if (!configured || !isAdmin) return;
    fileRef.current?.click();
  };

  const onPickFile = async (file: File | null) => {
    if (!file || !isAdmin) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/product-prices/preview", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json();
      if (!data.ok) {
        pushToast(data.message ?? "미리보기에 실패했습니다.", "error");
        return;
      }
      setFileName(data.fileName ?? file.name);
      setPreviewRows(data.preview ?? []);
      setUpsertRows(data.upsertRows ?? []);
      setPreviewSummary(
        data.summary ?? {
          total: 0,
          insert: 0,
          update: 0,
          unchanged: 0,
          error: 0,
        },
      );
      setPreviewFilter("all");
      setPreviewOpen(true);
    } catch {
      pushToast("미리보기에 실패했습니다.", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onConfirmUpload = async () => {
    if (!upsertRows.length) {
      pushToast(
        "DB에 반영할 신규·단가 변경 건이 없습니다. (미리보기는 저장되지 않습니다)",
        "info",
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/product-prices/upload", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          rows: upsertRows,
          summary: previewSummary,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        pushToast(data.message ?? "업로드에 실패했습니다.", "error");
        return;
      }
      pushToast(
        `업로드 완료 — 신규 ${formatNumber(data.result?.inserted ?? 0)} · 변경 ${formatNumber(data.result?.updated ?? 0)} · 유지 ${formatNumber(data.result?.unchanged ?? 0)}`,
        "success",
      );
      setPreviewOpen(false);
      setPage(1);
      await loadList();
    } catch {
      pushToast("업로드에 실패했습니다.", "error");
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(
    () => [
      {
        key: "total",
        label: "전체 등록 품번",
        value: formatNumber(total),
        hint: "DATA 단가 > 0",
        Icon: CircleDollarSign,
        tone: "blue",
      },
      {
        key: "insert",
        label: "이번 업로드 신규",
        value: formatNumber(lastUpload?.inserted_count ?? 0),
        hint: lastUpload?.file_name ?? "업로드 이력 없음",
        Icon: PackagePlus,
        tone: "green",
      },
      {
        key: "update",
        label: "단가 변경",
        value: formatNumber(lastUpload?.updated_count ?? 0),
        hint: "최근 업로드 기준",
        Icon: RefreshCw,
        tone: "amber",
      },
      {
        key: "last",
        label: "마지막 업로드",
        value: formatDateTime(lastUpload?.uploaded_at),
        hint: lastUpload?.file_name ?? "—",
        Icon: CalendarClock,
        tone: "slate",
      },
    ],
    [total, lastUpload],
  );

  const filteredPreviewRows = useMemo(() => {
    if (previewFilter === "all") return previewRows;
    return previewRows.filter((row) => row.action === previewFilter);
  }, [previewRows, previewFilter]);

  const visiblePreviewRows = filteredPreviewRows.slice(0, 300);

  if (!ready) {
    return (
      <div className="price-page">
        <PageHeader title="제품 단가 관리" />
        <div className="price-loading">
          <LoaderCircle size={18} className="ppt-export-spin" />
          확인 중…
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="price-page">
        <PageHeader title="제품 단가 관리" />
        <div className="price-lock-panel">
          <span className="price-lock-icon" aria-hidden>
            <Lock size={22} />
          </span>
          <h2 className="price-lock-title">관리자 전용 메뉴</h2>
          <p className="price-lock-desc">
            제품 단가 조회와 엑셀 업로드는 관리자 모드에서만 이용할 수 있습니다.
          </p>
          <button
            type="button"
            className="price-upload-btn price-upload-btn-solid"
            onClick={() => {
              openLogin();
              pushToast("관리자 로그인 후 이용해 주세요.", "info");
            }}
          >
            <Lock size={15} />
            관리자 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="price-page">
      <PageHeader title="제품 단가 관리" />

      {!configured ? (
        <div className="price-alert mb-4">
          Supabase 환경변수가 없습니다.{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,{" "}
          <code>PRODUCT_PRICES_RPC_SECRET</code> 를 설정한 뒤 서버를 재시작해
          주세요.
        </div>
      ) : null}

      <section className="price-upload-panel mb-4">
        <div className="price-upload-copy">
          <p className="price-upload-kicker">Excel Sync</p>
          <h2 className="price-upload-title">제품 단가 엑셀 업로드</h2>
          <div className="price-upload-desc">
            <p>
              엑셀의 <strong>품번</strong> · <strong>DATA 단가</strong>를
              반영합니다.
            </p>
            <p>
              파일 선택·미리보기 단계에서는 DB에 저장되지 않으며,{" "}
              <strong>업로드 실행</strong>을 눌렀을 때만 신규·단가 변경이
              반영됩니다.
            </p>
            <p>
              동일 품번은 최신 단가로 갱신되고, 엑셀에 없는 기존 품번은
              삭제되지 않습니다.
            </p>
            <p>DATA 단가 0은 등록하지 않습니다.</p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="sr-only"
          onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          className={`price-dropzone${dragging ? " is-dragging" : ""}`}
          disabled={busy || !configured}
          onClick={requestUpload}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0] ?? null;
            void onPickFile(file);
          }}
        >
          <span className="price-dropzone-icon" aria-hidden>
            {busy ? (
              <LoaderCircle size={22} className="ppt-export-spin" />
            ) : (
              <FileSpreadsheet size={22} />
            )}
          </span>
          <span className="price-dropzone-title">
            {busy ? "파일 분석 중…" : "파일을 끌어다 놓거나 클릭해서 선택"}
          </span>
          <span className="price-dropzone-hint">
            품번 · DATA 단가 컬럼이 있는 엑셀만 지원합니다
          </span>
          <span className="price-upload-btn">
            <Upload size={15} />
            엑셀 업로드
          </span>
        </button>
      </section>

      <div className="price-stat-grid mb-4">
        {stats.map((s) => (
          <div key={s.key} className="price-stat-card" data-tone={s.tone}>
            <div className="price-stat-top">
              <p className="price-stat-label">{s.label}</p>
              <span className="price-stat-icon" aria-hidden>
                <s.Icon size={16} />
              </span>
            </div>
            <p className="price-stat-value">{s.value}</p>
            <p className="price-stat-hint" title={s.hint}>
              {s.hint}
            </p>
          </div>
        ))}
      </div>

      <SearchSortBar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="품번 검색"
        sort={sort}
        onSort={(v) => {
          setSort(v);
          setPage(1);
        }}
        order={order}
        onOrder={(v) => setOrder(v)}
        pageSize={pageSize}
        onPageSize={(v) => {
          setPageSize(v);
          setPage(1);
        }}
        sortOptions={[
          { value: "updated_at", label: "최종 수정일" },
          { value: "created_at", label: "최초 등록일" },
          { value: "unit_price", label: "단가" },
          { value: "part_number", label: "품번" },
        ]}
        resultTitle="제품 단가 목록"
      >
        {loading ? (
          <div className="price-loading">
            <LoaderCircle size={18} className="ppt-export-spin" />
            불러오는 중…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="등록된 단가가 없습니다."
            description="엑셀을 업로드하면 품번별 DATA 단가가 저장됩니다."
          />
        ) : (
          <>
            <div className="table-wrap price-table-wrap">
              <table className="data-table price-table">
                <thead>
                  <tr>
                    <th className="num">번호</th>
                    <th>품번</th>
                    <th className="num">DATA 단가</th>
                    <th>최초 등록일</th>
                    <th>최종 수정일</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="num price-row-no">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td>
                        <span className="price-part">{row.part_number}</span>
                      </td>
                      <td className="num">
                        <span className="price-amount">
                          {formatPrice(Number(row.unit_price))}
                        </span>
                      </td>
                      <td className="price-date">
                        {formatDateShort(row.created_at)}
                      </td>
                      <td className="price-date">
                        {formatDateShort(row.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <NumberPagination
              page={page}
              totalPages={totalPages}
              total={total}
              onPage={setPage}
            />
          </>
        )}
      </SearchSortBar>

      {previewOpen ? (
        <div
          className="util-modal-backdrop"
          role="presentation"
          onClick={() => !busy && setPreviewOpen(false)}
        >
          <div
            className="util-modal price-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="업로드 미리보기"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="price-preview-head">
              <div>
                <p className="price-upload-kicker">Preview</p>
                <h3 className="price-preview-title">업로드 미리보기</h3>
                <p className="price-preview-file">
                  <FileSpreadsheet size={14} />
                  {fileName}
                </p>
              </div>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setPreviewOpen(false)}
              >
                닫기
              </button>
            </div>

            <div
              className="price-preview-summary"
              role="tablist"
              aria-label="처리 유형 필터"
            >
              {PREVIEW_FILTERS.map((f) => {
                const count = previewSummary[f.countKey] ?? 0;
                const active = previewFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className="price-preview-filter"
                    data-tone={f.tone}
                    data-active={active ? "true" : "false"}
                    onClick={() => setPreviewFilter(f.key)}
                  >
                    {f.label} {formatNumber(count)}
                  </button>
                );
              })}
            </div>

            <div className="table-wrap price-preview-table">
              <table className="data-table price-table">
                <thead>
                  <tr>
                    <th className="num">엑셀 행</th>
                    <th>품번</th>
                    <th className="num">기존 단가</th>
                    <th className="num">업로드 단가</th>
                    <th>처리</th>
                    <th>사유</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePreviewRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="price-preview-empty">
                        선택한 처리 유형에 해당하는 행이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    visiblePreviewRows.map((r, i) => (
                      <tr key={`${r.excelRow}-${r.partNumber}-${i}`}>
                        <td className="num">{r.excelRow || "-"}</td>
                        <td>
                          <span className="price-part">{r.partNumber}</span>
                        </td>
                        <td className="num">{formatPrice(r.existingPrice)}</td>
                        <td className="num">{formatPrice(r.uploadPrice)}</td>
                        <td>
                          <span
                            className="price-action-pill"
                            data-action={r.action}
                          >
                            {ACTION_LABEL[r.action]}
                          </span>
                        </td>
                        <td className="price-error-reason">
                          {r.errorReason ?? "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredPreviewRows.length > 300 ? (
              <p className="price-preview-note">
                현재 필터 결과 중 상위 300행만 표시합니다. (필터{" "}
                {formatNumber(filteredPreviewRows.length)}건 / 업로드 대상{" "}
                {formatNumber(upsertRows.length)}건)
              </p>
            ) : previewFilter !== "all" ? (
              <p className="price-preview-note">
                {PREVIEW_FILTERS.find((f) => f.key === previewFilter)?.label}{" "}
                {formatNumber(filteredPreviewRows.length)}건 표시 중
              </p>
            ) : null}

            <div className="price-preview-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setPreviewOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="price-upload-btn price-upload-btn-solid"
                disabled={busy || upsertRows.length === 0}
                onClick={() => void onConfirmUpload()}
                title={
                  upsertRows.length === 0
                    ? "반영할 신규·변경 건이 없습니다"
                    : `신규·변경 ${upsertRows.length}건을 DB에 반영`
                }
              >
                {busy ? (
                  <>
                    <LoaderCircle size={15} className="ppt-export-spin" />
                    업로드 중…
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    업로드 실행
                    {upsertRows.length > 0
                      ? ` (${formatNumber(upsertRows.length)})`
                      : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
