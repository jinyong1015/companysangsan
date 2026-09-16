"use client";

import { useMemo, useState } from "react";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader, ResponsiveGrid, SectionCard } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { usePageState } from "@/hooks/usePageState";
import { ERROR_MESSAGES, type ErrorCode } from "@/types";
import { formatMinutes, formatNumber, formatQuantity } from "@/lib/format";
import { paginate, sortBy } from "@/lib/metrics";
import { downloadExcel } from "@/lib/excelParse";

export default function DataErrorsPage() {
  const { filters } = useFilters();
  const { records, batch, isDemo } = useDataSource();
  const { state, patch } = usePageState("data-errors", "row", "asc");
  const [codeFilter, setCodeFilter] = useState<ErrorCode | "전체">("전체");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const errorRows = useMemo(() => {
    let list = records.filter((r) => !r.isAnalysisEligible);
    list = list.filter(
      (r) =>
        (filters.factory === "전체" || r.factory === filters.factory) &&
        (filters.productType === "전체" || r.productType === filters.productType) &&
        r.workDate >= filters.startDate &&
        r.workDate <= filters.endDate,
    );
    if (codeFilter !== "전체") {
      list = list.filter((r) => r.errorCodes.includes(codeFilter));
    }
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
  }, [filters, state, codeFilter, records]);

  const codeSummary = useMemo(() => {
    const map = new Map<ErrorCode, number>();
    for (const r of records.filter((x) => !x.isAnalysisEligible)) {
      for (const code of r.errorCodes) {
        map.set(code, (map.get(code) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [records]);

  const paged = paginate(errorRows, state.page, state.pageSize);
  const preview = records.find((r) => r.id === previewId);

  return (
    <>
      <PageHeader
        title="데이터 오류"
        description={
          isDemo
            ? "가데이터 기준 제외 행 미리보기 · 엑셀 업로드 후 실제 오류를 확인하세요"
            : "전체 제외 행과 제외 사유 조회"
        }
      />
      <SectionCard className="mb-4">
        <p className="text-sm">
          파일명 <strong>{batch.originalFileName}</strong>
          {!isDemo && (
            <>
              {" "}
              · 업로드 {batch.uploadedAt.slice(0, 16).replace("T", " ")}
            </>
          )}
        </p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          전체 {formatNumber(batch.sourceRowCount)}건 · 정상{" "}
          {formatNumber(batch.validRowCount)}건 · 제외{" "}
          {formatNumber(batch.excludedRowCount)}건
          {isDemo ? " (가데이터)" : ""}
        </p>
      </SectionCard>

      <div className="card mb-4 border-[var(--warning)]/40 px-4 py-3 text-sm">
        {isDemo
          ? "현재는 가데이터의 제외 행입니다. 엑셀을 업로드·활성화하면 실제 오류 목록으로 전환됩니다."
          : "이 화면의 행은 생산량과 불량수량을 포함한 모든 분석에서 제외되었습니다. 원본을 수정한 뒤 새 파일을 업로드하세요."}
      </div>

      <ResponsiveGrid variant="dense" className="mb-4">
        {codeSummary.map(([code, count]) => (
          <button
            key={code}
            type="button"
            className="card p-3 text-left"
            data-active={codeFilter === code}
            onClick={() => setCodeFilter(codeFilter === code ? "전체" : code)}
          >
            <p className="text-xs text-[var(--text-secondary)]">{ERROR_MESSAGES[code]}</p>
            <p className="mt-1 text-xl font-bold">{formatNumber(count)}</p>
          </button>
        ))}
      </ResponsiveGrid>
      <p className="mb-4 text-xs text-[var(--text-secondary)]">
        한 행에 오류가 여러 개일 수 있어 사유별 건수 합계와 제외 행 수가 다를 수 있습니다.
      </p>
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
          { value: "row", label: "원본 행" },
          { value: "date", label: "작업일자" },
          { value: "production", label: "실적수량" },
        ]}
        excelLabel="오류 DATA Excel"
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
      />

      {errorRows.length === 0 ? (
        <EmptyState
          title="제외된 데이터가 없습니다."
          description="현재 활성 DATA는 모두 분석 기준을 통과했습니다."
        />
      ) : (
        <SectionCard>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
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
                    <tr key={r.id}>
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
                            <span className="text-xs text-[var(--text-secondary)]">+{more}</span>
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
                      <td>
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
        </SectionCard>
      )}

      {preview ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/40">
          <div className="h-full w-full max-w-[520px] overflow-auto bg-[var(--card)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">원본 행 {preview.sourceRowNumber}</h2>
              <button type="button" className="btn" onClick={() => setPreviewId(null)}>
                닫기
              </button>
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
                오류코드: preview.errorCodes.join(", "),
              }).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[120px_1fr] gap-2 border-b border-[var(--border)] py-2">
                  <dt className="text-[var(--text-secondary)]">{k}</dt>
                  <dd>{String(v ?? "-")}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </>
  );
}
