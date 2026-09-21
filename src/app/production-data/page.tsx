"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { History, Pencil } from "lucide-react";
import { DetailFilterCard } from "@/components/filters/FilterCards";
import { ChangeHistoryModal } from "@/components/admin/ChangeHistoryModal";
import { EditProductionRecordModal } from "@/components/production-data/EditProductionRecordModal";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui/PageBits";
import { useAdmin } from "@/context/AdminContext";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { useToast } from "@/context/ToastContext";

import { usePageState } from "@/hooks/usePageState";
import { formatMinutes, formatNumber, formatQuantity } from "@/lib/format";
import { filterRecords, paginate, sortBy } from "@/lib/metrics";
import { withFromParam } from "@/lib/navigation";
import { downloadExcel } from "@/lib/excelParse";

export default function ProductionDataPage() {
  const searchParams = useSearchParams();
  const periodStart = searchParams.get("startDate");
  const periodEnd = searchParams.get("endDate");
  const equipmentParam = searchParams.get("equipment");
  const { filters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const { isAdmin, openLogin } = useAdmin();
  const { pushToast } = useToast();
  const { state, patch } = usePageState("production-data", "date", "desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const rows = useMemo(() => {
    let list = filterRecords(records, {
      ...filters,
      ...(periodStart && periodEnd
        ? {
            datePreset: "custom" as const,
            startDate: periodStart,
            endDate: periodEnd,
          }
        : null),
      ...(equipmentParam ? { equipmentIds: [equipmentParam] } : null),
    });
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.equipmentName.toLowerCase().includes(q) ||
          r.partNumber.toLowerCase().includes(q) ||
          r.operatorName.toLowerCase().includes(q) ||
          r.moldNumber.toLowerCase().includes(q) ||
          (r.downtimeReasonRaw ?? "").toLowerCase().includes(q),
      );
    }
    return sortBy(list, state.sort, state.order, {
      date: (r) => r.workDate,
      production: (r) => r.productionQuantity,
      downtime: (r) => r.downtimeMinutes,
      equipment: (r) => r.equipmentName,
    });
  }, [equipmentParam, filters, periodEnd, periodStart, records, state]);

  const paged = paginate(rows, state.page, state.pageSize);
  const selected = selectedId
    ? (records.find((r) => r.id === selectedId) ?? null)
    : null;
  const editing = editingId
    ? (records.find((r) => r.id === editingId) ?? null)
    : null;

  const openEdit = () => {
    if (!isAdmin) {
      pushToast("생산 DATA 수정은 관리자 모드에서만 가능합니다.", "info");
      openLogin();
      return;
    }
    if (!selectedId) {
      pushToast("수정할 행을 먼저 선택해 주세요.", "info");
      return;
    }
    setEditingId(selectedId);
  };

  const tryOpenEditForRow = (id: string) => {
    setSelectedId(id);
    if (!isAdmin) {
      pushToast("생산 DATA 수정은 관리자 모드에서만 가능합니다.", "info");
      openLogin();
      return;
    }
    setEditingId(id);
  };

  return (
    <>
      <PageHeader
        title="생산 DATA"
        description={
          isAdmin
            ? "정상 원본·정제값 조회 · 관리자 모드에서 행 수정 가능"
            : "정상 원본·정제값 조회 · 수정은 관리자 모드에서만 가능"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <button
                type="button"
                className="btn"
                onClick={() => setHistoryOpen(true)}
              >
                <History size={16} />
                <span>변경 이력</span>
              </button>
            ) : null}
            {isAdmin ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedId}
                onClick={openEdit}
              >
                <Pencil size={16} />
                <span>수정</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled
                title="생산 DATA 수정은 관리자 모드에서만 가능합니다."
              >
                <Pencil size={16} />
                <span>수정</span>
              </button>
            )}
          </div>
        }
      />
      <DetailFilterCard showMolds />
      <div className="card mb-4 px-4 py-3 text-sm text-[var(--text-secondary)]">
        {isAdmin ? (
          <>
            분석 대상 정상 DATA만 표시합니다. 수정 가능한 행은 배경색으로
            구분됩니다. 저장 즉시 재검증·재집계되어 전체 메뉴에 반영됩니다.
          </>
        ) : (
          <>
            분석 대상 정상 DATA만 표시합니다. 제외 행은 오류 DATA 메뉴에서
            확인할 수 있습니다.{" "}
            <strong className="font-medium text-[var(--text)]">
              생산 DATA 수정은 관리자 모드에서만 가능합니다.
            </strong>
          </>
        )}
      </div>
      <SearchSortBar
        search={state.search}
        onSearch={(search) => patch({ search })}
        searchPlaceholder="설비명·품번·작업자·금형·비가동내역 검색"
        sort={state.sort}
        onSort={(sort) => patch({ sort })}
        order={state.order}
        onOrder={(order) => patch({ order })}
        pageSize={state.pageSize}
        onPageSize={(pageSize) => patch({ pageSize })}
        sortOptions={[
          { value: "date", label: "작업일자" },
          { value: "production", label: "실적수량" },
          { value: "downtime", label: "비가동시간" },
          { value: "equipment", label: "설비명" },
        ]}
        onExcel={() =>
          downloadExcel(
            "생산DATA.xlsx",
            rows.map((r) => ({
              작업일자: r.workDate,
              공장: r.factory,
              설비명: r.equipmentName,
              제품유형: r.productType,
              품번: r.partNumber,
              Cavity: r.cavity,
              작업판수: r.shotCount,
              불량수량: r.defectQuantity,
              실적수량: r.productionQuantity,
              작업자: r.operatorName,
              구분: r.shiftType,
              금형번호: r.moldNumber,
              시작시간: r.startedAt?.slice(11, 16) ?? "",
              종료시간: r.endedAt?.slice(11, 16) ?? "",
              작업시간분: r.elapsedMinutes,
              비가동시간분: r.downtimeMinutes,
              가동시간분: r.operatingMinutes,
              비가동내역: r.downtimeReasonRaw ?? "",
              평균샷: r.averageShot,
            })),
          )
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="검색 결과가 없습니다."
          description="검색어나 상세 조건을 변경해 주세요."
          actionLabel="조회조건 초기화"
          onAction={resetGlobal}
        />
      ) : (
        <SectionCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--text-secondary)]">
            <p>
              {selected
                ? `선택: ${selected.workDate} · ${selected.equipmentName} · ${selected.partNumber}`
                : isAdmin
                  ? "수정할 행을 클릭해 선택하세요."
                  : "조회 전용입니다. 행을 선택해 상세 링크를 사용할 수 있습니다."}
            </p>
            {isAdmin ? (
              <button
                type="button"
                className="btn"
                disabled={!selectedId}
                onClick={openEdit}
              >
                <Pencil size={14} />
                선택 행 수정
              </button>
            ) : null}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>선택</th>
                  <th>작업일자</th>
                  <th>공장</th>
                  <th>설비명</th>
                  <th>제품유형</th>
                  <th>품번</th>
                  <th className="num">Cavity</th>
                  <th className="num">작업판수</th>
                  <th className="num">불량수량</th>
                  <th className="num">실적수량</th>
                  <th>작업자</th>
                  <th>구분</th>
                  <th>금형번호</th>
                  <th>시작시간</th>
                  <th>종료시간</th>
                  <th className="num">작업시간</th>
                  <th className="num">비가동시간</th>
                  <th className="num">가동시간</th>
                  <th>비가동내역</th>
                  <th className="num">평균샷</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((r) => (
                  <tr
                    key={r.id}
                    className={`pd-row-selectable ${
                      isAdmin ? "pd-row-editable" : ""
                    } ${selectedId === r.id ? "pd-row-selected" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                    onDoubleClick={() => tryOpenEditForRow(r.id)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="radio"
                        name="pd-row"
                        checked={selectedId === r.id}
                        onChange={() => setSelectedId(r.id)}
                        aria-label={`${r.workDate} ${r.equipmentName} 선택`}
                      />
                    </td>
                    <td>{r.workDate}</td>
                    <td>{r.factory}</td>
                    <td>
                      <Link
                        href={withFromParam(
                          `/equipment/${r.equipmentId}`,
                          "production-data",
                        )}
                        className="linkish"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.equipmentName}
                      </Link>
                    </td>
                    <td>{r.productType}</td>
                    <td>
                      <Link
                        href={withFromParam(`/parts/${r.partId}`, "production-data")}
                        className="linkish"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.partNumber}
                      </Link>
                    </td>
                    <td className="num">{r.cavity}</td>
                    <td className="num">{formatNumber(r.shotCount)}</td>
                    <td className="num">{formatQuantity(r.defectQuantity)}</td>
                    <td className="num">{formatQuantity(r.productionQuantity)}</td>
                    <td>
                      <Link
                        href={withFromParam(
                          `/operators/${r.operatorId}`,
                          "production-data",
                        )}
                        className="linkish"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.operatorName}
                      </Link>
                    </td>
                    <td>{r.shiftType}</td>
                    <td>
                      <Link
                        href={withFromParam(`/molds/${r.moldId}`, "production-data")}
                        className="linkish"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.moldNumber}
                      </Link>
                    </td>
                    <td>{r.startedAt?.slice(11, 16) ?? "-"}</td>
                    <td>{r.endedAt?.slice(11, 16) ?? "-"}</td>
                    <td className="num">{formatMinutes(r.elapsedMinutes)}</td>
                    <td className="num">{formatMinutes(r.downtimeMinutes)}</td>
                    <td className="num">{formatMinutes(r.operatingMinutes)}</td>
                    <td>{r.downtimeReasonRaw ?? "-"}</td>
                    <td className="num">
                      {r.averageShot == null ? "-" : formatNumber(r.averageShot, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NumberPagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            onPage={(page) => patch({ page })}
          />
        </SectionCard>
      )}

      {editing && isAdmin ? (
        <EditProductionRecordModal
          key={editing.id}
          record={editing}
          onClose={() => setEditingId(null)}
        />
      ) : null}

      {historyOpen && isAdmin ? (
        <ChangeHistoryModal onClose={() => setHistoryOpen(false)} />
      ) : null}
    </>
  );
}
