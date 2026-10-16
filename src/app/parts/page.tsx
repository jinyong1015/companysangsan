"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NumberPagination, SearchSortBar } from "@/components/ui/SearchSortBar";
import { EmptyState, PageHeader } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";

import { usePageState } from "@/hooks/usePageState";
import { aggregateParts } from "@/lib/aggregates";
import {
  formatMinutes,
  formatPercent,
  formatQuantity,
  formatUph,
  formatWon,
} from "@/lib/format";
import { paginate, sortBy } from "@/lib/metrics";
import { withFromParam } from "@/lib/navigation";
import { downloadExcel } from "@/lib/excelParse";
import type { PartRow } from "@/types";

function normalizePartKey(partNumber: string) {
  return String(partNumber ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

type PartRowWithAmount = PartRow & { productionAmount: number };

export default function PartsPage() {
  const { filters, resetGlobal } = useFilters();
  const { records } = useDataSource();
  const { state, patch } = usePageState("parts", "production", "desc");
  const [priceByPart, setPriceByPart] = useState<Map<string, number>>(
    () => new Map(),
  );

  const baseRows = useMemo(
    () => aggregateParts(records, filters),
    [filters, records],
  );

  const partNumbersKey = useMemo(() => {
    const set = new Set<string>();
    for (const r of baseRows) {
      const key = normalizePartKey(r.partNumber);
      if (key) set.add(key);
    }
    return [...set].sort().join("\0");
  }, [baseRows]);

  useEffect(() => {
    if (!partNumbersKey) {
      setPriceByPart(new Map());
      return;
    }
    const parts = partNumbersKey.split("\0");
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/product-prices/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partNumbers: parts }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          prices?: Record<string, number>;
        };
        if (cancelled || !data.ok || !data.prices) return;
        setPriceByPart(new Map(Object.entries(data.prices)));
      } catch {
        if (!cancelled) setPriceByPart(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partNumbersKey]);

  const rows = useMemo(() => {
    let list: PartRowWithAmount[] = baseRows.map((p) => {
      const price = priceByPart.get(normalizePartKey(p.partNumber));
      const productionAmount =
        price != null && Number.isFinite(price) && price > 0
          ? p.kpi.productionQuantity * price
          : 0;
      return { ...p, productionAmount };
    });
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      list = list.filter((p) => p.partNumber.toLowerCase().includes(q));
    }
    return sortBy(list, state.sort, state.order, {
      production: (p) => p.kpi.productionQuantity,
      amount: (p) => p.productionAmount,
      defect: (p) => p.kpi.defectQuantity,
      defectRate: (p) => p.kpi.defectRatePercent,
      uph: (p) => p.kpi.uph,
      utilization: (p) => p.kpi.utilizationRatePercent,
      downtime: (p) => p.kpi.downtimeMinutes,
    });
  }, [baseRows, priceByPart, state]);

  const paged = paginate(rows, state.page, state.pageSize);

  return (
    <>
      <PageHeader title="품번 분석" />
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
          { value: "amount", label: "생산금액" },
          { value: "defect", label: "불량수량" },
          { value: "defectRate", label: "생산불량률" },
          { value: "uph", label: "UPH" },
          { value: "utilization", label: "가동률" },
          { value: "downtime", label: "비가동시간" },
        ]}
        resultTitle="품번 내역"
        onExcel={() =>
          downloadExcel(
            "품번분석.xlsx",
            rows.map((p) => ({
              품번: p.partNumber,
              제품유형: p.productType,
              생산공장: p.factories.join(", "),
              설비수: p.equipmentCount,
              금형수: p.moldCount,
              생산금액: Math.round(p.productionAmount),
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
                    <th>품번</th>
                    <th>제품유형</th>
                    <th>생산 공장</th>
                    <th className="num">설비 수</th>
                    <th className="num">금형 수</th>
                    <th className="num">생산금액</th>
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
                      <td className="num">
                        {p.productionAmount > 0
                          ? formatWon(p.productionAmount)
                          : "-"}
                      </td>
                      <td className="num">
                        {formatQuantity(p.kpi.productionQuantity)}
                      </td>
                      <td className="num">
                        {formatQuantity(p.kpi.defectQuantity)}
                      </td>
                      <td className="num">
                        {formatPercent(p.kpi.defectRatePercent, 2)}
                      </td>
                      <td className="num">
                        {formatMinutes(p.kpi.elapsedMinutes)}
                      </td>
                      <td className="num">
                        {formatPercent(p.kpi.utilizationRatePercent)}
                      </td>
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
          </>
        )}
      </SearchSortBar>
    </>
  );
}
