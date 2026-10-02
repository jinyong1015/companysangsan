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
import { formatNumber, formatPercent } from "@/lib/format";
import {
  withFromParam,
  withPeriodParams,
  type DetailBackSource,
} from "@/lib/navigation";
import type { ProductPerformanceRow } from "@/types";

type ProductLineTab = "GROMMET" | "SEAL";

type RankRow = {
  id: string;
  partNumber: string;
  production: number;
  sharePercent: number;
  rank: number;
};

const TABS: ProductLineTab[] = ["GROMMET", "SEAL"];

interface PartProductionQuantityBoardProps {
  rows: ProductPerformanceRow[];
  from?: DetailBackSource;
  startDate?: string;
  endDate?: string;
  className?: string;
}

export function PartProductionQuantityBoard({
  rows,
  from = "home",
  startDate,
  endDate,
  className,
}: PartProductionQuantityBoardProps) {
  const router = useRouter();
  const [tab, setTab] = useState<ProductLineTab>("GROMMET");
  const [selected, setSelected] = useState<RankRow | null>(null);

  const tabCounts = useMemo(
    () => ({
      GROMMET: rows.filter((r) => r.productType === "GROMMET").length,
      SEAL: rows.filter((r) => r.productType === "SEAL").length,
    }),
    [rows],
  );

  const chartRows = useMemo(() => {
    const scoped = rows.filter(
      (r) => r.productType === tab && r.productionQuantity > 0,
    );
    const total = scoped.reduce((s, r) => s + r.productionQuantity, 0);
    return [...scoped]
      .sort((a, b) => b.productionQuantity - a.productionQuantity)
      .slice(0, 10)
      .map(
        (r, idx): RankRow => ({
          id: r.id,
          partNumber: r.partNumber,
          production: r.productionQuantity,
          sharePercent:
            total > 0 ? (r.productionQuantity / total) * 100 : 0,
          rank: idx + 1,
        }),
      );
  }, [rows, tab]);

  const barColor = tab === "SEAL" ? "var(--seal)" : "var(--grommet)";

  const openDetailPage = (row: RankRow) => {
    let href = `/parts/${row.id}`;
    if (startDate && endDate) {
      href = withPeriodParams(href, startDate, endDate);
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
          <h2 className="ppq-board-title">제품별 생산수량</h2>
          <p className="ppq-board-sub">
            품번별 생산수량 TOP 10 · 비중은 해당 제품유형 전체 대비
          </p>
        </div>
        <div
          className="dt-product-tabs"
          role="tablist"
          aria-label="제품별 생산수량 제품유형"
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
          선택한 제품유형에 해당하는 생산 수량 데이터가 없습니다.
        </p>
      ) : (
        <div className="ppq-board-body">
          <div className="ppq-board-chart">
            <div className="ppq-board-chart-inner">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  margin={{ top: 8, right: 8, left: 4, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="partNumber"
                    interval={0}
                    height={56}
                    tickMargin={8}
                    angle={-40}
                    textAnchor="end"
                    tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                    tickFormatter={(v) => {
                      const name = String(v ?? "");
                      return name.length > 12 ? `${name.slice(0, 12)}…` : name;
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
                    formatter={(value, _name, item) => {
                      const row = item?.payload as RankRow | undefined;
                      return [
                        `${formatNumber(Number(value))} EA (${formatPercent(row?.sharePercent ?? 0, 0)})`,
                        "생산수량",
                      ];
                    }}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as RankRow | undefined;
                      if (!row) return "";
                      return `${row.rank}위 · ${row.partNumber}`;
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
                  <th colSpan={5}>생산수량(EA)</th>
                </tr>
                <tr>
                  <th scope="col">NO</th>
                  <th scope="col">품번</th>
                  <th scope="col">생산수량</th>
                  <th scope="col">비중</th>
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
                        title={`${row.partNumber} 상세 보기`}
                        onClick={() => setSelected(row)}
                      >
                        {row.partNumber}
                      </button>
                    </td>
                    <td className="ppq-board-qty num">
                      {formatNumber(row.production)}
                    </td>
                    <td className="ppq-board-share num">
                      {formatPercent(row.sharePercent, 0)}
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
          title={`${selected.rank}위 · ${selected.partNumber}`}
          subtitle={`${tab} · 품번 생산수량`}
          fields={[
            { label: "순위", value: `${selected.rank}위` },
            { label: "품번", value: selected.partNumber },
            {
              label: "생산수량",
              value: `${formatNumber(selected.production)} EA`,
            },
            {
              label: "비중",
              value: formatPercent(selected.sharePercent, 0),
            },
          ]}
          primaryLabel="품번 상세내역으로 이동"
          onPrimary={() => openDetailPage(selected)}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
