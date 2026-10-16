"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  LoaderCircle,
} from "lucide-react";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState } from "@/components/ui/PageBits";
import { useDataSource } from "@/context/DataSourceContext";
import { useFilters } from "@/context/FilterContext";
import { useToast } from "@/context/ToastContext";
import { usePageState } from "@/hooks/usePageState";
import { formatMinutes, formatNumber, formatQuantity } from "@/lib/format";
import { filterRecords, paginate, sortBy } from "@/lib/metrics";
import {
  dataSourceKindOf,
  downloadProductionStatusExcel,
  type DataSourceKind,
} from "@/lib/productionStatusExport";
import { ERROR_MESSAGES, type ProductionRecord } from "@/types";

type KindFilter = "전체" | DataSourceKind;

export function IntegratedDataPanel() {
  const { filters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const { pushToast } = useToast();
  const { state, patch } = usePageState("integrated-status-v1", "date", "asc");
  const [kindFilter, setKindFilter] = useState<KindFilter>("전체");
  const [exporting, setExporting] = useState(false);

  const kindExtra = state.extra?.kindFilter;
  // 구 저장값 "생산" → "정상"
  const activeKind: KindFilter =
    kindExtra === "오류" || kindExtra === "정상" || kindExtra === "전체"
      ? kindExtra
      : kindExtra === "생산"
        ? "정상"
        : kindFilter;

  const setActiveKind = (next: KindFilter) => {
    setKindFilter(next);
    patch({ extra: { ...state.extra, kindFilter: next } });
  };

  const filtered = useMemo(() => {
    let list = filterRecords(records, filters, { includeErrors: true });
    if (activeKind === "정상") {
      list = list.filter((r) => r.isAnalysisEligible);
    } else if (activeKind === "오류") {
      list = list.filter((r) => !r.isAnalysisEligible);
    }
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.equipmentName.toLowerCase().includes(q) ||
          r.partNumber.toLowerCase().includes(q) ||
          r.operatorName.toLowerCase().includes(q) ||
          r.moldNumber.toLowerCase().includes(q) ||
          (r.downtimeReasonRaw ?? "").toLowerCase().includes(q) ||
          dataSourceKindOf(r).includes(q),
      );
    }
    return sortBy(list, state.sort, state.order, {
      date: (r) => r.workDate,
      production: (r) => r.productionQuantity,
      downtime: (r) => r.downtimeMinutes,
      equipment: (r) => r.equipmentName,
      kind: (r) => (r.isAnalysisEligible ? 0 : 1),
    });
  }, [activeKind, filters, records, state]);

  const paged = paginate(filtered, state.page, state.pageSize);

  const counts = useMemo(() => {
    const inPeriod = filterRecords(records, filters, { includeErrors: true });
    return {
      total: inPeriod.length,
      production: inPeriod.filter((r) => r.isAnalysisEligible).length,
      error: inPeriod.filter((r) => !r.isAnalysisEligible).length,
    };
  }, [filters, records]);

  const exportAll = async () => {
    if (exporting) return;
    if (records.length === 0) {
      pushToast("다운로드할 데이터가 없습니다.", "info");
      return;
    }
    setExporting(true);
    try {
      await downloadProductionStatusExcel({
        records,
        fileName: "생산현황_전체데이터.xlsx",
      });
      pushToast("전체 데이터 엑셀 다운로드를 시작했습니다.", "success");
    } catch {
      pushToast("엑셀 다운로드에 실패했습니다.", "error");
    } finally {
      setExporting(false);
    }
  };

  const headerActions = (
    <>
      <div className="integrated-kind-bar">
        <span className="integrated-kind-bar__label">데이터 유형</span>
        <div
          className="integrated-kind-bar__group"
          role="radiogroup"
          aria-label="데이터 유형"
        >
          {(
            [
              {
                label: "전체" as const,
                count: counts.total,
                tone: "all" as const,
                Icon: Layers,
              },
              {
                label: "정상" as const,
                count: counts.production,
                tone: "ok" as const,
                Icon: CheckCircle2,
              },
              {
                label: "오류" as const,
                count: counts.error,
                tone: "error" as const,
                Icon: AlertTriangle,
              },
            ] as const
          ).map(({ label, count, tone, Icon }) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={activeKind === label}
              className="integrated-kind-btn"
              data-tone={tone}
              data-active={activeKind === label}
              onClick={() => setActiveKind(label)}
            >
              <span className="integrated-kind-btn__icon" aria-hidden>
                <Icon size={15} strokeWidth={2.25} />
              </span>
              <span className="integrated-kind-btn__text">{label}</span>
              <span className="integrated-kind-btn__count">
                {formatNumber(count)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="integrated-excel-btn"
        disabled={exporting}
        aria-busy={exporting}
        onClick={() => {
          void exportAll();
        }}
      >
        <span className="integrated-excel-btn__icon" aria-hidden>
          {exporting ? (
            <LoaderCircle size={16} className="ppt-export-spin" />
          ) : (
            <FileSpreadsheet size={16} strokeWidth={2.25} />
          )}
        </span>
        <span className="integrated-excel-btn__copy">
          <span className="integrated-excel-btn__label">
            {exporting ? "엑셀 생성 중" : "전체 데이터 엑셀 다운로드"}
          </span>
          <span className="integrated-excel-btn__hint">
            {exporting
              ? "잠시만 기다려 주세요"
              : `생산현황 양식 · ${formatNumber(records.length)}건`}
          </span>
        </span>
      </button>
    </>
  );

  return (
    <>
      <div className="card mb-4 px-4 py-3 text-sm text-[var(--text-secondary)]">
        생산 DATA와 오류 DATA를 한 화면에서 조회하고, 생산현황 양식으로
        엑셀을 내려받습니다. 성형작업일보 엑셀은{" "}
        <Link href="/manage" className="text-[var(--accent)] underline">
          데이터 업로드
        </Link>
        메뉴에서 올리면 됩니다.
      </div>

      <SearchSortBar
        search={state.search}
        onSearch={(search) => patch({ search })}
        searchPlaceholder="설비명·품번·작업자·금형·비가동·유형 검색"
        sort={state.sort}
        onSort={(sort) => patch({ sort })}
        order={state.order}
        onOrder={(order) => patch({ order })}
        pageSize={state.pageSize}
        onPageSize={(pageSize) => patch({ pageSize })}
        sortOptions={[
          { value: "date", label: "작업일자" },
          { value: "kind", label: "데이터 유형" },
          { value: "production", label: "실적수량" },
          { value: "downtime", label: "비가동시간" },
          { value: "equipment", label: "설비명" },
        ]}
        resultTitle="통합 조회 결과"
        headerActions={headerActions}
      >
        {filtered.length === 0 ? (
          <EmptyState
            title="검색 결과가 없습니다."
            description="조회기간·공장·설비·품번 등 상단 조건을 변경해 주세요."
            actionLabel="조회조건 초기화"
            onAction={resetGlobal}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>작업일자</th>
                    <th>공장</th>
                    <th>설비명</th>
                    <th>제품유형</th>
                    <th>품번</th>
                    <th>C/V</th>
                    <th>판수</th>
                    <th>불량</th>
                    <th>실적</th>
                    <th>작업자</th>
                    <th>주/야</th>
                    <th>작업시간</th>
                    <th>비가동</th>
                    <th>비가동 사유</th>
                    <th>오류/경고</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((r) => (
                    <IntegratedRow key={r.id} record={r} />
                  ))}
                </tbody>
              </table>
            </div>
            <NumberPagination
              page={paged.page}
              totalPages={paged.totalPages}
              total={filtered.length}
              onPage={(page) => patch({ page })}
            />
          </>
        )}
      </SearchSortBar>
    </>
  );
}

function IntegratedRow({ record: r }: { record: ProductionRecord }) {
  const kind = dataSourceKindOf(r);
  const issues = r.isAnalysisEligible
    ? r.warningCodes.join(", ")
    : r.errorCodes.map((c) => ERROR_MESSAGES[c] ?? c).join(", ");

  return (
    <tr>
      <td>
        <span
          className={`pd-status-badge ${
            kind === "정상" ? "pd-status-badge-ok" : "pd-status-badge-error"
          }`}
        >
          {kind}
        </span>
      </td>
      <td>{r.workDate}</td>
      <td>{r.factory}</td>
      <td>{r.equipmentName}</td>
      <td>{r.productType}</td>
      <td>{r.partNumber}</td>
      <td className="text-right">{formatNumber(r.cavity)}</td>
      <td className="text-right">{formatNumber(r.shotCount)}</td>
      <td className="text-right">{formatQuantity(r.defectQuantity)}</td>
      <td className="text-right">{formatQuantity(r.productionQuantity)}</td>
      <td>{r.operatorName}</td>
      <td>{r.shiftType}</td>
      <td className="text-right">{formatMinutes(r.elapsedMinutes)}</td>
      <td className="text-right">{formatMinutes(r.downtimeMinutes)}</td>
      <td className="max-w-[12rem] truncate" title={r.downtimeReasonRaw ?? ""}>
        {r.downtimeReasonRaw ?? "-"}
      </td>
      <td
        className="max-w-[14rem] truncate text-xs text-[var(--text-secondary)]"
        title={issues}
      >
        {issues || "-"}
      </td>
    </tr>
  );
}
