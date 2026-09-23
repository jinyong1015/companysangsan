"use client";

import Link from "next/link";
import { useMemo } from "react";
import { OperatorProductionTopChart } from "@/components/operators/OperatorProductionTopChart";
import type { OperatorProdTopView } from "@/components/operators/OperatorProductionTopChart";
import type { ProductTab } from "@/components/production/ProductPerformanceSummary";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";

import { usePageState } from "@/hooks/usePageState";
import { aggregateOperators } from "@/lib/aggregates";
import {
  formatMinutes,
  formatPercent,
  formatQuantity,
  formatUph,
} from "@/lib/format";
import { paginate, sortBy } from "@/lib/metrics";
import { withFromParam } from "@/lib/navigation";
import { downloadExcel } from "@/lib/excelParse";

function parseProductTab(value: unknown): ProductTab {
  if (value === "GROMMET" || value === "SEAL" || value === "전체") return value;
  return "전체";
}

function parseTopView(value: unknown): OperatorProdTopView {
  return value === "bar" ? "bar" : "rank";
}

export default function OperatorsPage() {
  const { filters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const { state, patch } = usePageState("operators", "production", "desc");

  const topProductTab = parseProductTab(state.extra?.topProductTab);
  const topView = parseTopView(state.extra?.topView);

  const setTopProductTab = (tab: ProductTab) => {
    patch({ extra: { topProductTab: tab } });
  };

  const setTopView = (view: OperatorProdTopView) => {
    patch({ extra: { topView: view } });
  };

  const rows = useMemo(() => {
    let list = aggregateOperators(records, filters);
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      list = list.filter((o) => o.name.toLowerCase().includes(q));
    }
    return sortBy(list, state.sort, state.order, {
      production: (o) => o.kpi.productionQuantity,
      uph: (o) => o.kpi.uph,
      defect: (o) => o.kpi.defectQuantity,
      defectRate: (o) => o.kpi.defectRatePercent,
      elapsed: (o) => o.kpi.elapsedMinutes,
      utilization: (o) => o.kpi.utilizationRatePercent,
    });
  }, [filters, state, records]);

  const topRows = useMemo(
    () =>
      aggregateOperators(records, {
        ...filters,
        productType: topProductTab,
      }),
    [records, filters, topProductTab],
  );

  const tabCounts = useMemo(() => {
    const all = aggregateOperators(records, { ...filters, productType: "전체" });
    const grommet = aggregateOperators(records, {
      ...filters,
      productType: "GROMMET",
    });
    const seal = aggregateOperators(records, {
      ...filters,
      productType: "SEAL",
    });
    return {
      전체: all.filter((o) => o.kpi.productionQuantity > 0).length,
      GROMMET: grommet.filter((o) => o.kpi.productionQuantity > 0).length,
      SEAL: seal.filter((o) => o.kpi.productionQuantity > 0).length,
    };
  }, [records, filters]);

  const paged = paginate(rows, state.page, state.pageSize);

  return (
    <>
      <PageHeader title="작업자 분석" description="작업자별 생산실적·UPH 분석" />
      <div className="card mb-4 border-[var(--warning)]/30 px-4 py-3 text-sm text-[var(--text-secondary)]">
        작업자별 지표는 담당 품번과 설비 구성의 영향을 받습니다. 단순 순위만으로 평가하지 마세요.
      </div>

      <OperatorProductionTopChart
        rows={topRows}
        productTab={topProductTab}
        onProductTabChange={setTopProductTab}
        view={topView}
        onViewChange={setTopView}
        tabCounts={tabCounts}
      />

      <SearchSortBar
        search={state.search}
        onSearch={(search) => patch({ search })}
        searchPlaceholder="작업자명, 작업 품번 검색"
        sort={state.sort}
        onSort={(sort) => patch({ sort })}
        order={state.order}
        onOrder={(order) => patch({ order })}
        pageSize={state.pageSize}
        onPageSize={(pageSize) => patch({ pageSize })}
        sortOptions={[
          { value: "production", label: "생산량" },
          { value: "uph", label: "UPH" },
          { value: "defect", label: "불량수량" },
          { value: "defectRate", label: "생산불량률" },
          { value: "elapsed", label: "작업시간" },
          { value: "utilization", label: "가동률" },
        ]}
        resultTitle="작업자 내역"
        onExcel={() =>
          downloadExcel(
            "작업자분석.xlsx",
            rows.map((o) => ({
              작업자: o.name,
              공장: o.factory,
              주야간구성: o.shiftMix,
              작업품번수: o.partCount,
              설비수: o.equipmentCount,
              생산량: o.kpi.productionQuantity,
              불량수량: o.kpi.defectQuantity,
              생산불량률: o.kpi.defectRatePercent,
              작업시간분: o.kpi.elapsedMinutes,
              UPH: o.kpi.uph,
              가동률: o.kpi.utilizationRatePercent,
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
                    <th>작업자</th>
                    <th>공장</th>
                    <th>주/야간 구성</th>
                    <th className="num">작업 품번 수</th>
                    <th className="num">설비 수</th>
                    <th className="num">생산량</th>
                    <th className="num">불량수량</th>
                    <th className="num">생산불량률</th>
                    <th className="num">작업시간</th>
                    <th className="num">UPH</th>
                    <th className="num">가동률</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link
                          href={withFromParam(`/operators/${o.id}`, "operators")}
                          className="linkish"
                        >
                          {o.name}
                        </Link>
                      </td>
                      <td>{o.factory}</td>
                      <td>{o.shiftMix}</td>
                      <td className="num">{o.partCount}</td>
                      <td className="num">{o.equipmentCount}</td>
                      <td className="num">{formatQuantity(o.kpi.productionQuantity)}</td>
                      <td className="num">{formatQuantity(o.kpi.defectQuantity)}</td>
                      <td className="num">{formatPercent(o.kpi.defectRatePercent, 2)}</td>
                      <td className="num">{formatMinutes(o.kpi.elapsedMinutes)}</td>
                      <td className="num">{formatUph(o.kpi.uph)}</td>
                      <td className="num">{formatPercent(o.kpi.utilizationRatePercent)}</td>
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
