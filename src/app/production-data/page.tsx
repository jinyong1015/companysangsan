"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DetailFilterCard } from "@/components/filters/FilterCards";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";

import { usePageState } from "@/hooks/usePageState";
import { formatMinutes, formatNumber, formatQuantity } from "@/lib/format";
import { filterRecords, paginate, sortBy } from "@/lib/metrics";

export default function ProductionDataPage() {
  const { filters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const { state, patch } = usePageState("production-data", "date", "desc");

  const rows = useMemo(() => {
    let list = filterRecords(records, filters);
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
  }, [filters, state, records]);

  const paged = paginate(rows, state.page, state.pageSize);

  return (
    <>
      <PageHeader title="생산 DATA" description="정상 원본·정제값 조회" />
      <DetailFilterCard showMolds />
      <div className="card mb-4 px-4 py-3 text-sm text-[var(--text-secondary)]">
        분석 대상 정상 DATA만 표시합니다. 제외 행은 데이터 오류 메뉴에서 확인할 수 있습니다.
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
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
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
                  <tr key={r.id}>
                    <td>{r.workDate}</td>
                    <td>{r.factory}</td>
                    <td>
                      <Link href={`/equipment/${r.equipmentId}`} className="linkish">
                        {r.equipmentName}
                      </Link>
                    </td>
                    <td>{r.productType}</td>
                    <td>
                      <Link href={`/parts/${r.partId}`} className="linkish">
                        {r.partNumber}
                      </Link>
                    </td>
                    <td className="num">{r.cavity}</td>
                    <td className="num">{formatNumber(r.shotCount)}</td>
                    <td className="num">{formatQuantity(r.defectQuantity)}</td>
                    <td className="num">{formatQuantity(r.productionQuantity)}</td>
                    <td>
                      <Link href={`/operators/${r.operatorId}`} className="linkish">
                        {r.operatorName}
                      </Link>
                    </td>
                    <td>{r.shiftType}</td>
                    <td>
                      <Link href={`/molds/${r.moldId}`} className="linkish">
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
    </>
  );
}
