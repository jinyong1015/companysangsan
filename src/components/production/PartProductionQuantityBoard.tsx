"use client";

import { useEffect, useMemo, useState } from "react";
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

type QtyRankRow = {
  id: string;
  partNumber: string;
  production: number;
  sharePercent: number;
  rank: number;
};

type AmountRankRow = {
  id: string;
  partNumber: string;
  amount: number;
  sharePercent: number;
  rank: number;
};

const TABS: ProductLineTab[] = ["GROMMET", "SEAL"];
const AMOUNT_BAR_COLOR = "#6DC16A";

function normalizePartKey(partNumber: string) {
  return String(partNumber ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

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
  const [selectedQty, setSelectedQty] = useState<QtyRankRow | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<AmountRankRow | null>(
    null,
  );
  const [priceByPart, setPriceByPart] = useState<Map<string, number>>(
    () => new Map(),
  );

  const tabCounts = useMemo(
    () => ({
      GROMMET: rows.filter((r) => r.productType === "GROMMET").length,
      SEAL: rows.filter((r) => r.productType === "SEAL").length,
    }),
    [rows],
  );

  const partNumbersKey = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const key = normalizePartKey(r.partNumber);
      if (key) set.add(key);
    }
    return [...set].sort().join("\0");
  }, [rows]);

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

  const chartRows = useMemo(() => {
    const scoped = rows.filter(
      (r) => r.productType === tab && r.productionQuantity > 0,
    );
    const total = scoped.reduce((s, r) => s + r.productionQuantity, 0);
    return [...scoped]
      .sort((a, b) => b.productionQuantity - a.productionQuantity)
      .slice(0, 10)
      .map(
        (r, idx): QtyRankRow => ({
          id: r.id,
          partNumber: r.partNumber,
          production: r.productionQuantity,
          sharePercent:
            total > 0 ? (r.productionQuantity / total) * 100 : 0,
          rank: idx + 1,
        }),
      );
  }, [rows, tab]);

  const amountRows = useMemo(() => {
    const scoped = rows
      .filter((r) => r.productType === tab && r.productionQuantity > 0)
      .map((r) => {
        const price = priceByPart.get(normalizePartKey(r.partNumber));
        const amount =
          price != null && Number.isFinite(price) && price > 0
            ? r.productionQuantity * price
            : 0;
        return { row: r, amount };
      })
      .filter((x) => x.amount > 0);
    const total = scoped.reduce((s, x) => s + x.amount, 0);
    return [...scoped]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(
        (x, idx): AmountRankRow => ({
          id: x.row.id,
          partNumber: x.row.partNumber,
          amount: x.amount,
          sharePercent: total > 0 ? (x.amount / total) * 100 : 0,
          rank: idx + 1,
        }),
      );
  }, [priceByPart, rows, tab]);

  const barColor = tab === "SEAL" ? "var(--seal)" : "var(--grommet)";

  const openDetailPage = (id: string) => {
    let href = `/parts/${id}`;
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
          <h2 className="ppq-board-title">제품별 실적현황</h2>
          <p className="ppq-board-sub">
            품번별 생산수량·생산금액 TOP 10 · 비중은 해당 제품유형 전체 대비
          </p>
        </div>
        <div
          className="dt-product-tabs"
          role="tablist"
          aria-label="제품별 실적현황 제품유형"
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

      <div className="ppq-board-stack">
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
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="partNumber"
                      interval={0}
                      height={56}
                      tickMargin={8}
                      angle={-40}
                      textAnchor="end"
                      tick={{
                        fill: "var(--text)",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                      tickFormatter={(v) => {
                        const name = String(v ?? "");
                        return name.length > 12
                          ? `${name.slice(0, 12)}…`
                          : name;
                      }}
                    />
                    <YAxis
                      tick={{
                        fill: "var(--text)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
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
                        const row = item?.payload as QtyRankRow | undefined;
                        return [
                          `${formatNumber(Number(value))} EA (${formatPercent(row?.sharePercent ?? 0, 0)})`,
                          "생산수량",
                        ];
                      }}
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload as
                          | QtyRankRow
                          | undefined;
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
                    <tr key={`qty-${row.id}`}>
                      <td className="ppq-board-no">{row.rank}</td>
                      <td className="ppq-board-part">
                        <button
                          type="button"
                          className="ppq-board-part-btn"
                          title={`${row.partNumber} 상세 보기`}
                          onClick={() => setSelectedQty(row)}
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
                          onClick={() => setSelectedQty(row)}
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

        {amountRows.length === 0 ? (
          <p className="ppq-board-empty">
            단가가 등록된 품번의 생산금액 데이터가 없습니다.
          </p>
        ) : (
          <div className="ppq-board-body">
            <div className="ppq-board-chart">
              <div className="ppq-board-chart-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={amountRows}
                    margin={{ top: 8, right: 8, left: 4, bottom: 48 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="partNumber"
                      interval={0}
                      height={56}
                      tickMargin={8}
                      angle={-40}
                      textAnchor="end"
                      tick={{
                        fill: "var(--text)",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                      tickFormatter={(v) => {
                        const name = String(v ?? "");
                        return name.length > 12
                          ? `${name.slice(0, 12)}…`
                          : name;
                      }}
                    />
                    <YAxis
                      tick={{
                        fill: "var(--text)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                      tickFormatter={(v) => formatNumber(Number(v))}
                      width={86}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                      }}
                      formatter={(value, _name, item) => {
                        const row = item?.payload as AmountRankRow | undefined;
                        return [
                          `${formatNumber(Math.round(Number(value)))}원 (${formatPercent(row?.sharePercent ?? 0, 0)})`,
                          "생산금액",
                        ];
                      }}
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload as
                          | AmountRankRow
                          | undefined;
                        if (!row) return "";
                        return `${row.rank}위 · ${row.partNumber}`;
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      name="생산금액"
                      fill={AMOUNT_BAR_COLOR}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={42}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="ppq-board-table-wrap ppq-board-table-wrap--amount">
              <table className="ppq-board-table">
                <thead>
                  <tr className="ppq-board-table-banner">
                    <th colSpan={5}>생산금액(원)</th>
                  </tr>
                  <tr>
                    <th scope="col">NO</th>
                    <th scope="col">품번</th>
                    <th scope="col">생산금액</th>
                    <th scope="col">비중</th>
                    <th scope="col">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {amountRows.map((row) => (
                    <tr key={`amt-${row.id}`}>
                      <td className="ppq-board-no">{row.rank}</td>
                      <td className="ppq-board-part">
                        <button
                          type="button"
                          className="ppq-board-part-btn"
                          title={`${row.partNumber} 상세 보기`}
                          onClick={() => setSelectedAmount(row)}
                        >
                          {row.partNumber}
                        </button>
                      </td>
                      <td className="ppq-board-qty num">
                        {formatNumber(Math.round(row.amount))}
                      </td>
                      <td className="ppq-board-share num">
                        {formatPercent(row.sharePercent, 0)}
                      </td>
                      <td className="ppq-board-detail">
                        <button
                          type="button"
                          className="ppq-board-detail-btn"
                          onClick={() => setSelectedAmount(row)}
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
      </div>

      {selectedQty ? (
        <ProductionQuantityDetailModal
          title={`${selectedQty.rank}위 · ${selectedQty.partNumber}`}
          subtitle={`${tab} · 품번 생산수량`}
          fields={[
            { label: "순위", value: `${selectedQty.rank}위` },
            { label: "품번", value: selectedQty.partNumber },
            {
              label: "생산수량",
              value: `${formatNumber(selectedQty.production)} EA`,
            },
            {
              label: "비중",
              value: formatPercent(selectedQty.sharePercent, 0),
            },
          ]}
          primaryLabel="품번 상세내역으로 이동"
          onPrimary={() => openDetailPage(selectedQty.id)}
          onClose={() => setSelectedQty(null)}
        />
      ) : null}

      {selectedAmount ? (
        <ProductionQuantityDetailModal
          title={`${selectedAmount.rank}위 · ${selectedAmount.partNumber}`}
          subtitle={`${tab} · 품번 생산금액`}
          fields={[
            { label: "순위", value: `${selectedAmount.rank}위` },
            { label: "품번", value: selectedAmount.partNumber },
            {
              label: "생산금액",
              value: `${formatNumber(Math.round(selectedAmount.amount))}원`,
            },
            {
              label: "비중",
              value: formatPercent(selectedAmount.sharePercent, 0),
            },
          ]}
          primaryLabel="품번 상세내역으로 이동"
          onPrimary={() => openDetailPage(selectedAmount.id)}
          onClose={() => setSelectedAmount(null)}
        />
      ) : null}
    </section>
  );
}
