"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DetailFilterCard } from "@/components/filters/FilterCards";
import {
  PartProductionTopChart,
  type PartProdTopView,
} from "@/components/production/PartProductionTopChart";
import type { ProductTab } from "@/components/production/ProductPerformanceSummary";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";

import { usePageState } from "@/hooks/usePageState";
import { aggregateParts, aggregateProductPerformance } from "@/lib/aggregates";
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

function parseTopView(value: unknown): PartProdTopView {
  return value === "bar" ? "bar" : "rank";
}

export default function PartsPage() {
  const { filters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const { state, patch } = usePageState("parts", "production", "desc");

  const topProductTab = parseProductTab(state.extra?.topProductTab);
  const topView = parseTopView(state.extra?.topView);

  const setTopProductTab = (tab: ProductTab) => {
    patch({ extra: { topProductTab: tab } });
  };

  const setTopView = (view: PartProdTopView) => {
    patch({ extra: { topView: view } });
  };

  const rows = useMemo(() => {
    let list = aggregateParts(records, filters);
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      list = list.filter((p) => p.partNumber.toLowerCase().includes(q));
    }
    return sortBy(list, state.sort, state.order, {
      production: (p) => p.kpi.productionQuantity,
      defect: (p) => p.kpi.defectQuantity,
      defectRate: (p) => p.kpi.defectRatePercent,
      uph: (p) => p.kpi.uph,
      utilization: (p) => p.kpi.utilizationRatePercent,
      downtime: (p) => p.kpi.downtimeMinutes,
    });
  }, [filters, state, records]);

  const productPerfRows = useMemo(
    () =>
      aggregateProductPerformance(records, {
        ...filters,
        productType: "전체",
      }),
    [records, filters],
  );

  const topRows = useMemo(() => {
    if (topProductTab === "전체") return productPerfRows;
    return productPerfRows.filter((r) => r.productType === topProductTab);
  }, [productPerfRows, topProductTab]);

  const tabCounts = useMemo(
    () => ({
      전체: productPerfRows.filter((r) => r.productionQuantity > 0).length,
      GROMMET: productPerfRows.filter(
        (r) => r.productType === "GROMMET" && r.productionQuantity > 0,
      ).length,
      SEAL: productPerfRows.filter(
        (r) => r.productType === "SEAL" && r.productionQuantity > 0,
      ).length,
    }),
    [productPerfRows],
  );

  const paged = paginate(rows, state.page, state.pageSize);

  return (
    <>
      <PageHeader title="품번 분석" description="품번별 생산량·불량·UPH 분석" />
      <PartProductionTopChart
        rows={topRows}
        productTab={topProductTab}
        onProductTabChange={setTopProductTab}
        view={topView}
        onViewChange={setTopView}
        tabCounts={tabCounts}
        from="parts"
      />

      <DetailFilterCard showParts={false} showMolds showOperators />

      <SearchSortBar
        search={state.search}
        onSearch={(search) => patch({ search })}
        searchPlaceholder="품번 또는 금형번호 검색"
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
          { value: "uph", label: "UPH" },
          { value: "utilization", label: "가동률" },
          { value: "downtime", label: "비가동시간" },
        ]}
        onExcel={() =>
          downloadExcel(
            "품번분석.xlsx",
            rows.map((p) => ({
              품번: p.partNumber,
              제품유형: p.productType,
              생산공장: p.factories.join(", "),
              설비수: p.equipmentCount,
              금형수: p.moldCount,
              생산량: p.kpi.productionQuantity,
              불량수량: p.kpi.defectQuantity,
              생산불량률: p.kpi.defectRatePercent,
              작업시간분: p.kpi.elapsedMinutes,
              가동률: p.kpi.utilizationRatePercent,
              UPH: p.kpi.uph,
              비가동시간분: p.kpi.downtimeMinutes,
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
                  <th>품번</th>
                  <th>제품유형</th>
                  <th>생산 공장</th>
                  <th className="num">설비 수</th>
                  <th className="num">금형 수</th>
                  <th className="num">생산량</th>
                  <th className="num">불량수량</th>
                  <th className="num">생산불량률</th>
                  <th className="num">작업시간</th>
                  <th className="num">가동률</th>
                  <th className="num">UPH</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={withFromParam(`/parts/${p.id}`, "parts")}
                        className="linkish"
                      >
                        {p.partNumber}
                      </Link>
                    </td>
                    <td>{p.productType}</td>
                    <td>{p.factories.join(", ")}</td>
                    <td className="num">{p.equipmentCount}</td>
                    <td className="num">{p.moldCount}</td>
                    <td className="num">{formatQuantity(p.kpi.productionQuantity)}</td>
                    <td className="num">{formatQuantity(p.kpi.defectQuantity)}</td>
                    <td className="num">{formatPercent(p.kpi.defectRatePercent, 2)}</td>
                    <td className="num">{formatMinutes(p.kpi.elapsedMinutes)}</td>
                    <td className="num">{formatPercent(p.kpi.utilizationRatePercent)}</td>
                    <td className="num">{formatUph(p.kpi.uph)}</td>
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
