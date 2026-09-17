"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DetailFilterCard } from "@/components/filters/FilterCards";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";

import { usePageState } from "@/hooks/usePageState";
import { aggregateEquipment } from "@/lib/aggregates";
import {
  formatHours,
  formatMinutes,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatUph,
} from "@/lib/format";
import { paginate, sortBy } from "@/lib/metrics";
import { withFromParam } from "@/lib/navigation";
import { downloadExcel } from "@/lib/excelParse";

export default function EquipmentListPage() {
  const { filters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const { state, patch } = usePageState("equipment", "utilization", "asc");

  const rows = useMemo(() => {
    let list = aggregateEquipment(records, filters);
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.factory.includes(q),
      );
    }
    return sortBy(list, state.sort, state.order, {
      production: (e) => e.kpi.productionQuantity,
      utilization: (e) => e.kpi.utilizationRatePercent,
      downtime: (e) => e.kpi.downtimeMinutes,
      failure: (e) => e.kpi.failureCount,
      mttr: (e) => e.kpi.mttrMinutes,
      mtbf: (e) => e.kpi.referenceMtbfHours,
      uph: (e) => e.kpi.uph,
      defect: (e) => e.kpi.defectQuantity,
    });
  }, [filters, state.search, state.sort, state.order, records]);

  const paged = paginate(rows, state.page, state.pageSize);

  return (
    <>
      <PageHeader title="설비 분석" description="설비별 생산성·가동률·신뢰성 비교" />
      <DetailFilterCard showOperators={false} showMolds={false} />
      <SearchSortBar
        search={state.search}
        onSearch={(search) => patch({ search })}
        searchPlaceholder="설비명 또는 주요 품번 검색"
        sort={state.sort}
        onSort={(sort) => patch({ sort })}
        order={state.order}
        onOrder={(order) => patch({ order })}
        pageSize={state.pageSize}
        onPageSize={(pageSize) => patch({ pageSize })}
        sortOptions={[
          { value: "production", label: "생산량" },
          { value: "utilization", label: "가동률" },
          { value: "downtime", label: "비가동시간" },
          { value: "failure", label: "고장 건수" },
          { value: "mttr", label: "MTTR" },
          { value: "mtbf", label: "참고 MTBF" },
          { value: "uph", label: "UPH" },
          { value: "defect", label: "불량수량" },
        ]}
        onExcel={() =>
          downloadExcel(
            "설비분석.xlsx",
            rows.map((e) => ({
              설비명: e.name,
              공장: e.factory,
              GROMMET비중: e.productMix.grommetPercent,
              SEAL비중: e.productMix.sealPercent,
              생산품번수: e.partCount,
              생산량: e.kpi.productionQuantity,
              불량수량: e.kpi.defectQuantity,
              작업시간분: e.kpi.elapsedMinutes,
              비가동시간분: e.kpi.downtimeMinutes,
              가동률: e.kpi.utilizationRatePercent,
              UPH: e.kpi.uph,
              고장건수: e.kpi.failureCount,
              MTTR분: e.kpi.mttrMinutes,
              참고MTBF시간: e.kpi.referenceMtbfHours,
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
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>설비명</th>
                  <th>공장</th>
                  <th>제품유형 구성</th>
                  <th className="num">생산 품번 수</th>
                  <th className="num">생산량</th>
                  <th className="num">불량수량</th>
                  <th className="num">작업시간</th>
                  <th className="num">비가동시간</th>
                  <th className="num">가동률</th>
                  <th className="num">UPH</th>
                  <th className="num">고장 건수</th>
                  <th className="num">MTTR</th>
                  <th className="num">참고 MTBF</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link
                        href={withFromParam(`/equipment/${e.id}`, "equipment")}
                        className="linkish"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td>{e.factory}</td>
                    <td>
                      GROMMET {formatNumber(e.productMix.grommetPercent, 0)}% · SEAL{" "}
                      {formatNumber(e.productMix.sealPercent, 0)}%
                    </td>
                    <td className="num">{e.partCount}</td>
                    <td className="num">{formatQuantity(e.kpi.productionQuantity)}</td>
                    <td className="num">{formatQuantity(e.kpi.defectQuantity)}</td>
                    <td className="num">{formatMinutes(e.kpi.elapsedMinutes)}</td>
                    <td className="num">{formatMinutes(e.kpi.downtimeMinutes)}</td>
                    <td className="num">{formatPercent(e.kpi.utilizationRatePercent)}</td>
                    <td className="num">{formatUph(e.kpi.uph)}</td>
                    <td className="num">
                      <Link
                        href={`/downtime?equipment=${e.id}`}
                        className="linkish"
                      >
                        {formatNumber(e.kpi.failureCount)}
                      </Link>
                    </td>
                    <td className="num">
                      {e.kpi.mttrMinutes == null
                        ? "-"
                        : `${formatNumber(e.kpi.mttrMinutes, 1)}분`}
                    </td>
                    <td className="num">{formatHours(e.kpi.referenceMtbfHours)}</td>
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
