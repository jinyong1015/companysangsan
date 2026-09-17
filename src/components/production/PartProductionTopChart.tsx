"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, ListOrdered, Package, Trophy } from "lucide-react";
import { ProductTypeTabs } from "@/components/production/ProductTypeTabs";
import type { ProductTab } from "@/components/production/ProductPerformanceSummary";
import { formatPercent, formatQuantity } from "@/lib/format";
import {
  withFromParam,
  type DetailBackSource,
} from "@/lib/navigation";
import type { ProductPerformanceRow } from "@/types";

export type PartProdTopView = "rank" | "bar";

type RankRow = {
  id: string;
  partNumber: string;
  productType: string;
  production: number;
  sharePercent: number;
  barPercent: number;
  rank: number;
  label: string;
};

function rankTone(rank: number): "gold" | "silver" | "bronze" | "muted" {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "muted";
}

function barFill(rank: number): string {
  if (rank === 1) return "#c2410c";
  if (rank === 2) return "#ea580c";
  if (rank === 3) return "#f97316";
  return "#fdba74";
}

function openPart(
  router: ReturnType<typeof useRouter>,
  id: string,
  from: DetailBackSource,
) {
  router.push(withFromParam(`/parts/${id}`, from));
}

function RankListView({
  rows,
  from,
}: {
  rows: RankRow[];
  from: DetailBackSource;
}) {
  const router = useRouter();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hovered = rows.find((r) => r.id === hoverId) ?? null;

  return (
    <div className="op-prod-top-list" onMouseLeave={() => setHoverId(null)}>
      {rows.map((row) => (
        <div
          key={row.id}
          className="op-prod-top-item"
          data-top={row.rank <= 3 ? "true" : undefined}
          onMouseEnter={() => setHoverId(row.id)}
        >
          <button
            type="button"
            className="op-prod-top-row"
            data-rank={row.rank}
            onClick={() => openPart(router, row.id, from)}
            title={`${row.partNumber} 상세 보기`}
          >
            <span className="op-prod-top-rank" data-tone={rankTone(row.rank)}>
              {row.rank}
            </span>
            <div className="op-prod-top-main">
              <div className="op-prod-top-row-head">
                <strong className="op-prod-top-name">{row.partNumber}</strong>
                <span className="op-prod-top-factory">{row.productType}</span>
              </div>
              <div className="op-prod-top-track" aria-hidden>
                <div
                  className="op-prod-top-fill"
                  style={{
                    width: `${Math.max(row.barPercent, 3)}%`,
                    background: barFill(row.rank),
                  }}
                />
              </div>
            </div>
            <div className="op-prod-top-metrics">
              <span className="op-prod-top-qty num">
                <Package size={13} aria-hidden />
                {formatQuantity(row.production)}
              </span>
              <span className="op-prod-top-share num">
                {formatPercent(row.sharePercent, 1)}
              </span>
            </div>
          </button>

          {hovered?.id === row.id ? (
            <div className="op-prod-top-tooltip" role="tooltip">
              <p>
                <strong>{row.rank}위</strong> · {row.partNumber}
              </p>
              <p>제품유형: {row.productType}</p>
              <p>생산수량: {formatQuantity(row.production)} EA</p>
              <p>전체 대비: {formatPercent(row.sharePercent, 1)}</p>
              <p className="op-prod-top-tooltip-hint">클릭하여 상세 보기</p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function BarChartView({
  rows,
  from,
}: {
  rows: RankRow[];
  from: DetailBackSource;
}) {
  const router = useRouter();

  return (
    <div className="op-prod-top-chart op-prod-top-chart--labeled">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={rows}
          margin={{ top: 36, right: 16, left: 8, bottom: 56 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="partNumber"
            interval={0}
            height={58}
            tickMargin={10}
            tick={(props) => {
              const { x, y, payload, index } = props;
              const row = rows[index ?? 0];
              const name = String(payload?.value ?? "");
              const display =
                name.length > 10 ? `${name.slice(0, 10)}…` : name;
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={14}
                    textAnchor="middle"
                    className="op-prod-top-bar-name"
                  >
                    {display}
                  </text>
                  {row ? (
                    <text
                      x={0}
                      y={0}
                      dy={30}
                      textAnchor="middle"
                      className="op-prod-top-bar-rank"
                    >
                      {row.rank}위
                    </text>
                  ) : null}
                </g>
              );
            }}
          />
          <YAxis
            tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
            tickFormatter={(v) => formatQuantity(Number(v))}
            width={72}
          />
          <Tooltip
            contentStyle={{
              background: "var(--elevated)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
            formatter={(value) => [
              `${formatQuantity(Number(value))} EA`,
              "생산수량",
            ]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as RankRow | undefined;
              if (!row) return "";
              return `${row.rank}위 · ${row.partNumber} (${row.productType})`;
            }}
          />
          <Bar
            dataKey="production"
            name="생산수량"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
            cursor="pointer"
            onClick={(entry) => {
              const payload = entry as unknown as { id?: string };
              if (payload?.id) openPart(router, payload.id, from);
            }}
          >
            {rows.map((d) => (
              <Cell key={d.id} fill={barFill(d.rank)} />
            ))}
            <LabelList
              dataKey="production"
              position="top"
              offset={8}
              className="op-prod-top-bar-value"
              formatter={(value) => formatQuantity(Number(value))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="op-prod-top-hint">막대 클릭 시 해당 품번 상세로 이동합니다.</p>
    </div>
  );
}

interface PartProductionTopChartProps {
  rows: ProductPerformanceRow[];
  productTab: ProductTab;
  onProductTabChange: (tab: ProductTab) => void;
  view: PartProdTopView;
  onViewChange: (view: PartProdTopView) => void;
  tabCounts?: Partial<Record<ProductTab, number>>;
  from?: DetailBackSource;
}

export function PartProductionTopChart({
  rows,
  productTab,
  onProductTabChange,
  view,
  onViewChange,
  tabCounts,
  from = "home",
}: PartProductionTopChartProps) {
  const { chartRows, topSum, totalProduction, topShare } = useMemo(() => {
    const positive = rows.filter((r) => r.productionQuantity > 0);
    const total = positive.reduce((s, r) => s + r.productionQuantity, 0);
    const ranked = [...positive]
      .sort((a, b) => b.productionQuantity - a.productionQuantity)
      .slice(0, 10);
    const max = ranked[0]?.productionQuantity ?? 0;
    const sum = ranked.reduce((s, r) => s + r.productionQuantity, 0);

    return {
      totalProduction: total,
      topSum: sum,
      topShare: total > 0 ? (sum / total) * 100 : 0,
      chartRows: ranked.map((r, idx) => ({
        id: r.id,
        partNumber: r.partNumber,
        productType: r.productType,
        production: r.productionQuantity,
        sharePercent: total > 0 ? (r.productionQuantity / total) * 100 : 0,
        barPercent: max > 0 ? (r.productionQuantity / max) * 100 : 0,
        rank: idx + 1,
        label: r.partNumber,
      })) as RankRow[],
    };
  }, [rows]);

  const titlePrefix = productTab === "전체" ? "전체" : productTab;
  const tone =
    productTab === "SEAL" ? "seal" : productTab === "GROMMET" ? "grommet" : "all";

  return (
    <section className="op-prod-top mb-4" data-tone={tone}>
      <header className="op-prod-top-head">
        <div className="op-prod-top-head-main">
          <span className="op-prod-top-badge">
            <Trophy size={14} aria-hidden />
            {titlePrefix}
          </span>
          <div>
            <h2 className="op-prod-top-title">생산 수량 품번 TOP 10</h2>
            <p className="op-prod-top-sub">품번별 생산수량 기준 상위 10개</p>
          </div>
        </div>
        <div className="op-prod-top-head-controls">
          <ProductTypeTabs
            value={productTab}
            onChange={onProductTabChange}
            counts={tabCounts}
            ariaLabel="생산 수량 TOP 제품유형"
            compact
            className="op-prod-top-tabs"
          />
          <div className="filter-pills" role="tablist" aria-label="보기 방식">
            <button
              type="button"
              className="filter-pill"
              role="tab"
              aria-selected={view === "rank"}
              data-active={view === "rank"}
              onClick={() => onViewChange("rank")}
            >
              <ListOrdered size={14} aria-hidden />
              가로 순위
            </button>
            <button
              type="button"
              className="filter-pill"
              role="tab"
              aria-selected={view === "bar"}
              data-active={view === "bar"}
              onClick={() => onViewChange("bar")}
            >
              <BarChart3 size={14} aria-hidden />
              막대 차트
            </button>
          </div>
        </div>
      </header>

      {chartRows.length === 0 ? (
        <p className="op-prod-top-empty">
          선택한 제품유형에 해당하는 생산 수량 데이터가 없습니다.
        </p>
      ) : (
        <div className="op-prod-top-body">
          <div className="op-prod-top-summary">
            <div className="op-prod-top-stat">
              <span className="op-prod-top-stat-label">TOP 10 합계</span>
              <strong className="op-prod-top-stat-value">
                {formatQuantity(topSum)}
                <span>EA</span>
              </strong>
            </div>
            <div className="op-prod-top-stat">
              <span className="op-prod-top-stat-label">전체 대비</span>
              <strong className="op-prod-top-stat-value">
                {formatPercent(topShare, 1)}
              </strong>
            </div>
            <div className="op-prod-top-stat">
              <span className="op-prod-top-stat-label">조회 범위 전체</span>
              <strong className="op-prod-top-stat-value">
                {formatQuantity(totalProduction)}
                <span>EA</span>
              </strong>
            </div>
          </div>

          {view === "bar" ? (
            <BarChartView rows={chartRows} from={from} />
          ) : (
            <RankListView rows={chartRows} from={from} />
          )}
        </div>
      )}
    </section>
  );
}
