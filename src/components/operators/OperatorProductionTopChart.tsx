"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import type { OperatorRow } from "@/types";

export type OperatorProdTopView = "rank" | "bar";

type RankRow = {
  id: string;
  name: string;
  factory: string;
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

function openOperator(
  router: ReturnType<typeof useRouter>,
  id: string,
  from: DetailBackSource,
) {
  router.push(withFromParam(`/operators/${id}`, from));
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
            onClick={() => openOperator(router, row.id, from)}
            title={`${row.name} 상세 보기`}
          >
            <span className="op-prod-top-rank" data-tone={rankTone(row.rank)}>
              {row.rank}
            </span>
            <div className="op-prod-top-main">
              <div className="op-prod-top-row-head">
                <strong className="op-prod-top-name">{row.name}</strong>
                <span className="op-prod-top-factory">{row.factory}</span>
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
                <strong>{row.rank}위</strong> · {row.name}
              </p>
              <p>공장: {row.factory}</p>
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
    <div className="op-prod-top-chart">
      <ResponsiveContainer width="100%" height={340}>
        <BarChart
          data={rows}
          margin={{ top: 16, right: 12, left: 4, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            interval={0}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            tickFormatter={(v) =>
              String(v).length > 5 ? `${String(v).slice(0, 5)}…` : String(v)
            }
          />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            tickFormatter={(v) => formatQuantity(Number(v))}
            width={68}
          />
          <Tooltip
            contentStyle={{
              background: "var(--elevated)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
            formatter={(value) => [formatQuantity(Number(value)), "생산수량"]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as RankRow | undefined;
              if (!row) return "";
              return `${row.rank}위 · ${row.name} (${row.factory})`;
            }}
          />
          <Bar
            dataKey="production"
            name="생산수량"
            radius={[6, 6, 0, 0]}
            maxBarSize={44}
            cursor="pointer"
            onClick={(entry) => {
              const payload = entry as unknown as { id?: string };
              if (payload?.id) openOperator(router, payload.id, from);
            }}
          >
            {rows.map((d) => (
              <Cell key={d.id} fill={barFill(d.rank)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="op-prod-top-hint">막대 클릭 시 해당 작업자 상세로 이동합니다.</p>
    </div>
  );
}

interface OperatorProductionTopChartProps {
  rows: OperatorRow[];
  productTab: ProductTab;
  onProductTabChange: (tab: ProductTab) => void;
  view: OperatorProdTopView;
  onViewChange: (view: OperatorProdTopView) => void;
  tabCounts?: Partial<Record<ProductTab, number>>;
  from?: DetailBackSource;
}

export function OperatorProductionTopChart({
  rows,
  productTab,
  onProductTabChange,
  view,
  onViewChange,
  tabCounts,
  from = "operators",
}: OperatorProductionTopChartProps) {
  const { chartRows, topSum, totalProduction, topShare } = useMemo(() => {
    const positive = rows.filter((r) => r.kpi.productionQuantity > 0);
    const total = positive.reduce((s, r) => s + r.kpi.productionQuantity, 0);
    const ranked = [...positive]
      .sort((a, b) => b.kpi.productionQuantity - a.kpi.productionQuantity)
      .slice(0, 10);
    const max = ranked[0]?.kpi.productionQuantity ?? 0;
    const sum = ranked.reduce((s, r) => s + r.kpi.productionQuantity, 0);

    return {
      totalProduction: total,
      topSum: sum,
      topShare: total > 0 ? (sum / total) * 100 : 0,
      chartRows: ranked.map((r, idx) => ({
        id: r.id,
        name: r.name,
        factory: r.factory,
        production: r.kpi.productionQuantity,
        sharePercent: total > 0 ? (r.kpi.productionQuantity / total) * 100 : 0,
        barPercent: max > 0 ? (r.kpi.productionQuantity / max) * 100 : 0,
        rank: idx + 1,
        label: r.name,
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
            <h2 className="op-prod-top-title">생산 수량 작업자 TOP 10</h2>
            <p className="op-prod-top-sub">작업자별 생산수량 기준 상위 10명</p>
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
