"use client";

import Link from "next/link";
import { useMemo } from "react";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";

import { usePageState } from "@/hooks/usePageState";
import { aggregateMolds } from "@/lib/aggregates";
import {
  formatMinutes,
  formatNumber,
  formatPercent,
  formatQuantity,
} from "@/lib/format";
import { paginate, sortBy } from "@/lib/metrics";
import { withFromParam } from "@/lib/navigation";
import { downloadExcel } from "@/lib/excelParse";

export default function MoldsPage() {
  const { filters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const { state, patch } = usePageState("molds", "production", "desc");

  const rows = useMemo(() => {
    let list = aggregateMolds(records, filters);
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      list = list.filter(
        (m) =>
          m.moldNumber.toLowerCase().includes(q) ||
          m.representativePart.toLowerCase().includes(q),
      );
    }
    return sortBy(list, state.sort, state.order, {
      production: (m) => m.kpi.productionQuantity,
      defect: (m) => m.kpi.defectQuantity,
      defectRate: (m) => m.kpi.defectRatePercent,
      downtime: (m) => m.kpi.downtimeMinutes,
      usage: (m) => m.workCount,
    });
  }, [filters, state, records]);

  const paged = paginate(rows, state.page, state.pageSize);

  return (
    <>
      <PageHeader title="금형 분석" description="금형별 생산·불량·비가동 분석" />
      <SearchSortBar
        search={state.search}
        onSearch={(search) => patch({ search })}
        searchPlaceholder="금형 / 설비 / 품번 검색"
        sort={state.sort}
        onSort={(sort) => patch({ sort })}
        order={state.order}
        onOrder={(order) => patch({ order })}
        pageSize={state.pageSize}
        onPageSize={(pageSize) => patch({ pageSize })}
        sortOptions={[
          { value: "production", label: "생산량" },
          { value: "defect", label: "불량수량" },
          { value: "defectRate", label: "생산불량률" },
          { value: "downtime", label: "비가동시간" },
          { value: "usage", label: "사용 횟수" },
        ]}
        resultTitle="금형 내역"
        onExcel={() =>
          downloadExcel(
            "금형분석.xlsx",
            rows.map((m) => ({
              금형번호: m.moldNumber,
              대표품번: m.representativePart,
              제품유형: m.productType,
              사용설비수: m.equipmentCount,
              작업건수: m.workCount,
              작업판수: m.shotCount,
              생산량: m.kpi.productionQuantity,
              불량수량: m.kpi.defectQuantity,
              생산불량률: m.kpi.defectRatePercent,
              비가동시간분: m.kpi.downtimeMinutes,
            })),
          )
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            title="검색 결과가 없습니다."
            description="검색어나 상단 조회조건을 변경해 주세요."
            actionLabel="조회조건 초기화"
            onAction={resetGlobal}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>금형번호</th>
                    <th>대표 품번</th>
                    <th>제품유형</th>
                    <th className="num">사용 설비 수</th>
                    <th className="num">작업 건수</th>
                    <th className="num">작업판수</th>
                    <th className="num">생산량</th>
                    <th className="num">불량수량</th>
                    <th className="num">생산불량률</th>
                    <th className="num">비가동시간</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link
                          href={withFromParam(`/molds/${m.id}`, "molds")}
                          className="linkish"
                        >
                          {m.moldNumber}
                        </Link>
                      </td>
                      <td>{m.representativePart}</td>
                      <td>{m.productType}</td>
                      <td className="num">{m.equipmentCount}</td>
                      <td className="num">{formatNumber(m.workCount)}</td>
                      <td className="num">{formatNumber(m.shotCount)}</td>
                      <td className="num">{formatQuantity(m.kpi.productionQuantity)}</td>
                      <td className="num">{formatQuantity(m.kpi.defectQuantity)}</td>
                      <td className="num">{formatPercent(m.kpi.defectRatePercent, 2)}</td>
                      <td className="num">{formatMinutes(m.kpi.downtimeMinutes)}</td>
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
          </>
        )}
      </SearchSortBar>
    </>
  );
}
