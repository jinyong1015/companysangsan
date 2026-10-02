"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProductionQuantityDetailModal } from "@/components/production/ProductionQuantityDetailModal";
import { aggregateOperators } from "@/lib/aggregates";
import { formatNumber } from "@/lib/format";
import {
  withFromParam,
  withPeriodParams,
  type DetailBackSource,
} from "@/lib/navigation";
import type { GlobalFilters, ProductionRecord } from "@/types";

type ProductLineTab = "GROMMET" | "SEAL";

type RankRow = {
  id: string;
  name: string;
  production: number;
  rank: number;
};

const TABS: ProductLineTab[] = ["GROMMET", "SEAL"];

interface OperatorProductionQuantityBoardProps {
  records: ProductionRecord[];
  filters: GlobalFilters;
  startDate?: string;
  endDate?: string;
  from?: DetailBackSource;
  className?: string;
}

export function OperatorProductionQuantityBoard({
  records,
  filters,
  startDate,
  endDate,
  from = "home",
  className,
}: OperatorProductionQuantityBoardProps) {
  const router = useRouter();
  const [tab, setTab] = useState<ProductLineTab>("GROMMET");
  const [selected, setSelected] = useState<RankRow | null>(null);

  const rowsByTab = useMemo(() => {
    const build = (productType: ProductLineTab) =>
      aggregateOperators(records, { ...filters, productType });
    return {
      GROMMET: build("GROMMET"),
      SEAL: build("SEAL"),
    };
  }, [filters, records]);

  const tabCounts = useMemo(
    () => ({
      GROMMET: rowsByTab.GROMMET.filter((r) => r.kpi.productionQuantity > 0)
        .length,
      SEAL: rowsByTab.SEAL.filter((r) => r.kpi.productionQuantity > 0).length,
    }),
    [rowsByTab],
  );

  const chartRows = useMemo(() => {
    const scoped = rowsByTab[tab].filter((r) => r.kpi.productionQuantity > 0);
    return [...scoped]
      .sort((a, b) => b.kpi.productionQuantity - a.kpi.productionQuantity)
      .slice(0, 10)
      .map(
        (r, idx): RankRow => ({
          id: r.id,
          name: r.name,
          production: r.kpi.productionQuantity,
          rank: idx + 1,
        }),
      );
  }, [rowsByTab, tab]);

  const barColor = tab === "SEAL" ? "var(--seal)" : "var(--grommet)";

  const openDetailPage = (row: RankRow) => {
    const periodStart = startDate || filters.startDate;
    const periodEnd = endDate || filters.endDate;
    let href = `/operators/${row.id}`;
    if (periodStart && periodEnd) {
      href = withPeriodParams(href, periodStart, periodEnd);
    }
    router.push(withFromParam(href, from));
  };

  return (
    <section
      className={["ppq-board mb-4", className].filter(Boolean).join(" ")}
      data-tone={tab === "SEAL" ? "seal" : "grommet"}
    >
      <header className="ppq-board-head">
        <div>
          <h2 className="ppq-board-title">작업자별 생산수량</h2>
          <p className="ppq-board-sub">작업자별 생산수량 TOP 10</p>
        </div>
        <div
          className="dt-product-tabs"
          role="tablist"
          aria-label="작업자별 생산수량 제품유형"
        >
          {TABS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className="dt-product-tab"
              data-tone={value === "GROMMET" ? "grommet" : "seal"}
              data-active={tab === value}
              onClick={() => setTab(value)}
            >
              {value}
              <span className="ppq-board-tab-count">
                {tabCounts[value].toLocaleString("ko-KR")}
              </span>
            </button>
          ))}
        </div>
      </header>

      {chartRows.length === 0 ? (
        <p className="ppq-board-empty">
          선택한 제품유형에 해당하는 작업자 생산 수량 데이터가 없습니다.
        </p>
      ) : (
        <div className="ppq-board-body">
          <div className="ppq-board-chart">
            <div className="ppq-board-chart-inner">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  margin={{ top: 8, right: 8, left: 4, bottom: 28 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    height={36}
                    tickMargin={8}
                    tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                    tickFormatter={(v) => {
                      const name = String(v ?? "");
                      return name.length > 6 ? `${name.slice(0, 6)}…` : name;
                    }}
                  />
                  <YAxis
                    tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(v) => formatNumber(Number(v))}
                    width={78}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                    formatter={(value) => [
                      `${formatNumber(Number(value))} EA`,
                      "생산수량",
                    ]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as RankRow | undefined;
                      if (!row) return "";
                      return `${row.rank}위 · ${row.name}`;
                    }}
                  />
                  <Bar
                    dataKey="production"
                    name="생산수량"
                    fill={barColor}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={42}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="ppq-board-table-wrap">
            <table className="ppq-board-table">
              <thead>
                <tr className="ppq-board-table-banner">
                  <th colSpan={4}>생산수량(EA)</th>
                </tr>
                <tr>
                  <th scope="col">NO</th>
                  <th scope="col">작업자</th>
                  <th scope="col">생산수량</th>
                  <th scope="col">상세</th>
                </tr>
              </thead>
              <tbody>
                {chartRows.map((row) => (
                  <tr key={row.id}>
                    <td className="ppq-board-no">{row.rank}</td>
                    <td className="ppq-board-part">
                      <button
                        type="button"
                        className="ppq-board-part-btn"
                        title={`${row.name} 상세 보기`}
                        onClick={() => setSelected(row)}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className="ppq-board-qty num">
                      {formatNumber(row.production)}
                    </td>
                    <td className="ppq-board-detail">
                      <button
                        type="button"
                        className="ppq-board-detail-btn"
                        onClick={() => setSelected(row)}
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected ? (
        <ProductionQuantityDetailModal
          title={`${selected.rank}위 · ${selected.name}`}
          subtitle={`${tab} · 작업자 생산수량`}
          fields={[
            { label: "순위", value: `${selected.rank}위` },
            { label: "작업자", value: selected.name },
            {
              label: "생산수량",
              value: `${formatNumber(selected.production)} EA`,
            },
          ]}
          primaryLabel="작업자 상세내역으로 이동"
          onPrimary={() => openDetailPage(selected)}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
