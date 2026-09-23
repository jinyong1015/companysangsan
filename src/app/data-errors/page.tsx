"use client";

import { useMemo, useState } from "react";
import { EditProductionRecordModal } from "@/components/production-data/EditProductionRecordModal";
import {
  DataEditButton,
  DataEditToolbar,
  DataRowSelectEdit,
} from "@/components/ui/DataEditButton";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader } from "@/components/ui/PageBits";
import { useAdmin } from "@/context/AdminContext";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { useToast } from "@/context/ToastContext";
import { usePageState } from "@/hooks/usePageState";
import { ERROR_MESSAGES } from "@/types";
import { formatMinutes, formatQuantity } from "@/lib/format";
import { paginate, sortBy } from "@/lib/metrics";
import { downloadExcel } from "@/lib/excelParse";

export default function DataErrorsPage() {
  const { filters } = useFilters();
  const { records, isDemo } = useDataSource();
  const { isAdmin, openLogin } = useAdmin();
  const { pushToast } = useToast();
  const { state, patch } = usePageState("data-errors-v2", "date", "asc");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const errorRows = useMemo(() => {
    let list = records.filter((r) => !r.isAnalysisEligible);
    list = list.filter(
      (r) =>
        (filters.factory === "전체" || r.factory === filters.factory) &&
        (filters.productType === "전체" || r.productType === filters.productType) &&
        r.workDate >= filters.startDate &&
        r.workDate <= filters.endDate,
    );
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.equipmentName.toLowerCase().includes(q) ||
          r.partNumber.toLowerCase().includes(q) ||
          String(r.sourceRowNumber).includes(q),
      );
    }
    return sortBy(list, state.sort, state.order, {
      row: (r) => r.sourceRowNumber,
      date: (r) => r.workDate,
      production: (r) => r.productionQuantity,
    });
  }, [filters, state, records]);

  const paged = paginate(errorRows, state.page, state.pageSize);
  const preview = records.find((r) => r.id === previewId);
  const selected = selectedId
    ? (records.find((r) => r.id === selectedId) ?? null)
    : null;
  const editing = editingId
    ? (records.find((r) => r.id === editingId) ?? null)
    : null;

  // 수정으로 오류가 해소되면 목록에서 사라지므로 선택 정리
  const selectedStillError =
    selected && !selected.isAnalysisEligible ? selected : null;
  const effectiveSelectedId = selectedStillError?.id ?? null;

  const openEdit = () => {
    if (!isAdmin) {
      pushToast("오류 DATA 수정은 관리자 모드에서만 가능합니다.", "info");
      openLogin();
      return;
    }
    if (!effectiveSelectedId) {
      pushToast("수정할 행을 먼저 선택해 주세요.", "info");
      return;
    }
    setEditingId(effectiveSelectedId);
  };

  const tryOpenEditForRow = (id: string) => {
    setSelectedId(id);
    if (!isAdmin) {
      pushToast("오류 DATA 수정은 관리자 모드에서만 가능합니다.", "info");
      openLogin();
      return;
    }
    setEditingId(id);
  };

  return (
    <>
      <PageHeader title="오류 DATA" />

      <div className="card mb-4 border-[var(--warning)]/40 px-4 py-3 text-sm">
        {isAdmin ? (
          <>
            관리자 모드에서는 오류 행을 수정할 수 있습니다. 저장 시 재검증되며,
            정상·경고로 바뀌면 오류 DATA에서 제외되고 생산 DATA에 반영됩니다.
          </>
        ) : isDemo ? (
          "현재는 가데이터의 제외 행입니다. 엑셀을 업로드·활성화하면 실제 오류 목록으로 전환됩니다."
        ) : (
          <>
            이 화면의 행은 생산량과 불량수량을 포함한 모든 분석에서
            제외되었습니다.{" "}
            <strong className="font-medium text-[var(--text)]">
              오류 DATA 수정은 관리자 모드에서만 가능합니다.
            </strong>
          </>
        )}
      </div>

      <SearchSortBar
        search={state.search}
        onSearch={(search) => patch({ search })}
        searchPlaceholder="원본 행·설비·품번 검색"
        sort={state.sort}
        onSort={(sort) => patch({ sort })}
        order={state.order}
        onOrder={(order) => patch({ order })}
        pageSize={state.pageSize}
        onPageSize={(pageSize) => patch({ pageSize })}
        sortOptions={[
          { value: "date", label: "작업일자" },
          { value: "row", label: "원본 행" },
          { value: "production", label: "실적수량" },
        ]}
        excelLabel="오류 DATA Excel"
        resultTitle="오류 내역"
        onExcel={() =>
          downloadExcel(
            "오류DATA.xlsx",
            errorRows.map((r) => ({
              원본행: r.sourceRowNumber,
              오류사유: r.errorCodes.map((c) => ERROR_MESSAGES[c]).join(", "),
              작업일자: r.workDate,
              공장: r.factory,
              설비명: r.equipmentName,
              제품유형: r.productType,
              품번: r.partNumber,
              실적수량: r.productionQuantity,
              불량수량: r.defectQuantity,
              작업시간분: r.elapsedMinutes,
              비가동시간분: r.downtimeMinutes,
              계산가동시간분: r.operatingMinutes,
              비가동내역: r.downtimeReasonRaw ?? "",
            })),
          )
        }
      >
        {errorRows.length === 0 ? (
          <EmptyState
            title="제외된 데이터가 없습니다."
            description="현재 활성 DATA는 모두 분석 기준을 통과했습니다."
          />
        ) : (
          <>
            <DataEditToolbar
              selectionLabel={
                selectedStillError
                  ? [
                      selectedStillError.workDate,
                      selectedStillError.equipmentName,
                      selectedStillError.partNumber,
                      selectedStillError.errorCodes
                        .map((c) => ERROR_MESSAGES[c] ?? c)
                        .join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : null
              }
              emptyLabel="수정할 행을 클릭해 선택하세요. 더블클릭으로도 수정할 수 있습니다."
            >
              {selectedStillError ? (
                <span className="pd-status-badge pd-status-badge-error">제외</span>
              ) : null}
              <DataEditButton
                isAdmin={isAdmin}
                canEdit={Boolean(effectiveSelectedId)}
                onEdit={openEdit}
                onRequestLogin={() => {
                  pushToast(
                    "오류 DATA 수정은 관리자 모드에서만 가능합니다.",
                    "info",
                  );
                  openLogin();
                }}
                lockedTitle="오류 DATA 수정은 관리자 모드에서만 가능합니다."
                label="선택 행 수정"
                size="sm"
                tone="error"
              />
            </DataEditToolbar>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>작업</th>
                    <th>원본 행</th>
                    <th>오류 상태</th>
                    <th>오류 사유</th>
                    <th>작업일자</th>
                    <th>공장</th>
                    <th>설비명</th>
                    <th>제품유형</th>
                    <th>품번</th>
                    <th className="num">실적수량</th>
                    <th className="num">불량수량</th>
                    <th className="num">작업시간</th>
                    <th className="num">비가동시간</th>
                    <th className="num">계산 가동시간</th>
                    <th>원본 보기</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((r) => {
                    const codes = r.errorCodes;
                    const shown = codes.slice(0, 2);
                    const more = codes.length - shown.length;
                    return (
                      <tr
                        key={r.id}
                        className={`pd-row-selectable ${
                          isAdmin ? "pd-row-editable" : ""
                        } ${effectiveSelectedId === r.id ? "pd-row-selected" : ""}`}
                        onClick={() => setSelectedId(r.id)}
                        onDoubleClick={() => tryOpenEditForRow(r.id)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <DataRowSelectEdit
                            selected={effectiveSelectedId === r.id}
                            isAdmin={isAdmin}
                            tone="error"
                            onSelect={() => setSelectedId(r.id)}
                            onEdit={() => tryOpenEditForRow(r.id)}
                            onRequestLogin={() => {
                              pushToast(
                                "오류 DATA 수정은 관리자 모드에서만 가능합니다.",
                                "info",
                              );
                              openLogin();
                            }}
                            lockedTitle="오류 DATA 수정은 관리자 모드에서만 가능합니다."
                          />
                        </td>
                        <td>{r.sourceRowNumber}</td>
                        <td>
                          <span className="rounded-full bg-[color-mix(in_srgb,var(--error)_15%,transparent)] px-2 py-0.5 text-xs text-[var(--error)]">
                            제외
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {shown.map((c) => (
                              <span
                                key={c}
                                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs"
                                title={ERROR_MESSAGES[c]}
                              >
                                {ERROR_MESSAGES[c]}
                              </span>
                            ))}
                            {more > 0 ? (
                              <span className="text-xs text-[var(--text-secondary)]">
                                +{more}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>{r.workDate}</td>
                        <td>{r.factory}</td>
                        <td>{r.equipmentName}</td>
                        <td>{r.productType}</td>
                        <td>{r.partNumber}</td>
                        <td className="num">{formatQuantity(r.productionQuantity)}</td>
                        <td className="num">{formatQuantity(r.defectQuantity)}</td>
                        <td className="num">{formatMinutes(r.elapsedMinutes)}</td>
                        <td className="num">{formatMinutes(r.downtimeMinutes)}</td>
                        <td
                          className={`num ${r.operatingMinutes < 0 ? "text-[var(--error)]" : ""}`}
                        >
                          {formatMinutes(r.operatingMinutes)}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => setPreviewId(r.id)}
                          >
                            보기
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <NumberPagination
              page={paged.page}
              totalPages={paged.totalPages}
              total={paged.total}
              onPage={(page) => patch({ page })}
            />
          </>
        )}
      </SearchSortBar>

      {preview ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/40">
          <div className="h-full w-full max-w-[520px] overflow-auto bg-[var(--card)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">원본 행 {preview.sourceRowNumber}</h2>
              <div className="flex gap-2">
                {isAdmin ? (
                  <DataEditButton
                    isAdmin
                    canEdit
                    onEdit={() => {
                      setPreviewId(null);
                      tryOpenEditForRow(preview.id);
                    }}
                    lockedTitle="오류 DATA 수정은 관리자 모드에서만 가능합니다."
                    size="sm"
                    tone="error"
                  />
                ) : null}
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPreviewId(null)}
                >
                  닫기
                </button>
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              {Object.entries({
                공장: preview.factoryRaw,
                작업일자: preview.workDate,
                설비명: preview.equipmentName,
                제품유형: preview.productType,
                품번: preview.partNumber,
                실적수량: preview.productionQuantity,
                불량수량: preview.defectQuantity,
                작업시간: preview.elapsedMinutes,
                비가동시간: preview.downtimeMinutes,
                가동시간: preview.operatingMinutes,
                비가동내역: preview.downtimeReasonRaw,
                오류사유: preview.errorCodes
                  .map((c) => ERROR_MESSAGES[c] ?? c)
                  .join(", "),
              }).map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[120px_1fr] gap-2 border-b border-[var(--border)] py-2"
                >
                  <dt className="text-[var(--text-secondary)]">{k}</dt>
                  <dd>{String(v ?? "-")}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}

      {editing && isAdmin && !editing.isAnalysisEligible ? (
        <EditProductionRecordModal
          key={editing.id}
          record={editing}
          source="error"
          onClose={() => setEditingId(null)}
        />
      ) : null}
    </>
  );
}
