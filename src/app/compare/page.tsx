"use client";

import { useMemo, useState } from "react";
import { SimpleBarChart } from "@/components/charts/Charts";
import { PageHeader, SectionCard } from "@/components/ui/PageBits";
import { useFilters } from "@/context/FilterContext";
import { useDataSource } from "@/context/DataSourceContext";
import { previousPeriod } from "@/lib/dates";
import {
  formatHours,
  formatMinutes,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatUph,
} from "@/lib/format";
import { computeKpi, filterRecords } from "@/lib/metrics";
import { downloadExcel } from "@/lib/excelParse";
import type { KpiSummary } from "@/types";

type CompareMode = "period" | "equipment" | "parts";

function metricRows(a: KpiSummary, b: KpiSummary) {
  const pct = (cur: number | null, prev: number | null) => {
    if (cur == null || prev == null) return null;
    if (prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  };
  const diff = (cur: number | null, prev: number | null) =>
    cur == null || prev == null ? null : cur - prev;

  return [
    {
      label: "생산량",
      a: formatQuantity(a.productionQuantity),
      b: formatQuantity(b.productionQuantity),
      diff: formatQuantity(b.productionQuantity - a.productionQuantity),
      rate: pct(b.productionQuantity, a.productionQuantity),
      chartA: a.productionQuantity,
      chartB: b.productionQuantity,
    },
    {
      label: "불량수량",
      a: formatQuantity(a.defectQuantity),
      b: formatQuantity(b.defectQuantity),
      diff: formatQuantity(b.defectQuantity - a.defectQuantity),
      rate: pct(b.defectQuantity, a.defectQuantity),
      chartA: a.defectQuantity,
      chartB: b.defectQuantity,
    },
    {
      label: "생산불량률",
      a: formatPercent(a.defectRatePercent, 2),
      b: formatPercent(b.defectRatePercent, 2),
      diff:
        a.defectRatePercent == null || b.defectRatePercent == null
          ? "-"
          : `${formatNumber(b.defectRatePercent - a.defectRatePercent, 2)}%p`,
      rate: null,
      chartA: a.defectRatePercent ?? 0,
      chartB: b.defectRatePercent ?? 0,
    },
    {
      label: "작업시간",
      a: formatMinutes(a.elapsedMinutes),
      b: formatMinutes(b.elapsedMinutes),
      diff: formatMinutes(b.elapsedMinutes - a.elapsedMinutes),
      rate: pct(b.elapsedMinutes, a.elapsedMinutes),
      chartA: a.elapsedMinutes,
      chartB: b.elapsedMinutes,
    },
    {
      label: "비가동시간",
      a: formatMinutes(a.downtimeMinutes),
      b: formatMinutes(b.downtimeMinutes),
      diff: formatMinutes(b.downtimeMinutes - a.downtimeMinutes),
      rate: pct(b.downtimeMinutes, a.downtimeMinutes),
      chartA: a.downtimeMinutes,
      chartB: b.downtimeMinutes,
    },
    {
      label: "가동률",
      a: formatPercent(a.utilizationRatePercent),
      b: formatPercent(b.utilizationRatePercent),
      diff:
        a.utilizationRatePercent == null || b.utilizationRatePercent == null
          ? "-"
          : `${formatNumber(b.utilizationRatePercent - a.utilizationRatePercent, 1)}%p`,
      rate: null,
      chartA: a.utilizationRatePercent ?? 0,
      chartB: b.utilizationRatePercent ?? 0,
    },
    {
      label: "UPH",
      a: formatUph(a.uph),
      b: formatUph(b.uph),
      diff:
        a.uph == null || b.uph == null ? "-" : formatNumber(Math.round(b.uph - a.uph)),
      rate: pct(b.uph, a.uph),
      chartA: a.uph ?? 0,
      chartB: b.uph ?? 0,
    },
    {
      label: "고장 건수",
      a: `${a.failureCount}`,
      b: `${b.failureCount}`,
      diff: `${b.failureCount - a.failureCount}`,
      rate: pct(b.failureCount, a.failureCount),
      chartA: a.failureCount,
      chartB: b.failureCount,
    },
    {
      label: "MTTR",
      a: a.mttrMinutes == null ? "-" : `${formatNumber(a.mttrMinutes, 1)}분`,
      b: b.mttrMinutes == null ? "-" : `${formatNumber(b.mttrMinutes, 1)}분`,
      diff:
        a.mttrMinutes == null || b.mttrMinutes == null
          ? "-"
          : `${formatNumber(diff(b.mttrMinutes, a.mttrMinutes), 1)}분`,
      rate: pct(b.mttrMinutes, a.mttrMinutes),
      chartA: a.mttrMinutes ?? 0,
      chartB: b.mttrMinutes ?? 0,
    },
    {
      label: "참고 MTBF",
      a: formatHours(a.referenceMtbfHours),
      b: formatHours(b.referenceMtbfHours),
      diff:
        a.referenceMtbfHours == null || b.referenceMtbfHours == null
          ? "-"
          : formatHours(diff(b.referenceMtbfHours, a.referenceMtbfHours)),
      rate: pct(b.referenceMtbfHours, a.referenceMtbfHours),
      chartA: a.referenceMtbfHours ?? 0,
      chartB: b.referenceMtbfHours ?? 0,
    },
  ];
}

export default function ComparePage() {
  const { filters } = useFilters();
  const { records, filterOptions } = useDataSource();
  const [mode, setMode] = useState<CompareMode>("period");
  const [selected, setSelected] = useState<string[]>([]);
  const prev = previousPeriod(filters.startDate, filters.endDate);
  const [periodA, setPeriodA] = useState(prev);
  const [periodB, setPeriodB] = useState({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  const periodCompare = useMemo(() => {
    const a = computeKpi(
      filterRecords(records, {
        ...filters,
        startDate: periodA.startDate,
        endDate: periodA.endDate,
      }),
    );
    const b = computeKpi(
      filterRecords(records, {
        ...filters,
        startDate: periodB.startDate,
        endDate: periodB.endDate,
      }),
    );
    return metricRows(a, b);
  }, [filters, periodA, periodB, records]);

  const entityCompare = useMemo(() => {
    if (mode === "period" || selected.length === 0) return [];
    return selected.map((id) => {
      const patch =
        mode === "equipment"
          ? { equipmentIds: [id] }
          : { partIds: [id] };
      const kpi = computeKpi(filterRecords(records, { ...filters, ...patch }));
      const label =
        mode === "equipment"
          ? filterOptions.equipment.find((e) => e.id === id)?.label ?? id
          : filterOptions.parts.find((p) => p.id === id)?.label ?? id;
      return { id, label, kpi };
    });
  }, [mode, selected, filters, records, filterOptions]);

  const options = mode === "equipment" ? filterOptions.equipment : filterOptions.parts;

  const handleExcel = () => {
    if (mode === "period") {
      downloadExcel(
        "스마트비교_기간.xlsx",
        periodCompare.map((r) => ({
          지표: r.label,
          기간A: r.a,
          기간B: r.b,
          차이: r.diff,
          증감률: r.rate,
        })),
      );
      return;
    }
    downloadExcel(
      mode === "equipment" ? "스마트비교_설비.xlsx" : "스마트비교_품번.xlsx",
      entityCompare.map((e) => ({
        대상: e.label,
        생산량: e.kpi.productionQuantity,
        불량수량: e.kpi.defectQuantity,
        생산불량률: e.kpi.defectRatePercent,
        가동률: e.kpi.utilizationRatePercent,
        UPH: e.kpi.uph,
        비가동시간분: e.kpi.downtimeMinutes,
        고장건수: e.kpi.failureCount,
        MTTR분: e.kpi.mttrMinutes,
        참고MTBF시간: e.kpi.referenceMtbfHours,
      })),
    );
  };

  return (
    <>
      <PageHeader
        title="스마트 비교"
        description="기간·설비·품번 비교"
        onExcel={handleExcel}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["period", "기간 비교"],
            ["equipment", "설비 비교"],
            ["parts", "품번 비교"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="pill"
            data-active={mode === key}
            onClick={() => {
              setMode(key);
              setSelected([]);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "period" ? (
        <SectionCard title="비교 조건" className="mb-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold">기간 A</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={periodA.startDate}
                  onChange={(e) =>
                    setPeriodA((p) => ({ ...p, startDate: e.target.value }))
                  }
                  className="rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={periodA.endDate}
                  onChange={(e) =>
                    setPeriodA((p) => ({ ...p, endDate: e.target.value }))
                  }
                  className="rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">기간 B</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={periodB.startDate}
                  onChange={(e) =>
                    setPeriodB((p) => ({ ...p, startDate: e.target.value }))
                  }
                  className="rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={periodB.endDate}
                  onChange={(e) =>
                    setPeriodB((p) => ({ ...p, endDate: e.target.value }))
                  }
                  className="rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="비교 대상 (최대 5개)" className="mb-4">
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
              const active = selected.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  className="pill"
                  data-active={active}
                  onClick={() => {
                    if (active) {
                      setSelected((s) => s.filter((x) => x !== opt.id));
                    } else if (selected.length >= 5) {
                      return;
                    } else {
                      setSelected((s) => [...s, opt.id]);
                    }
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {selected.length >= 5 ? (
            <p className="mt-2 text-xs text-[var(--warning)]">
              최대 5개까지 비교할 수 있습니다.
            </p>
          ) : null}
        </SectionCard>
      )}

      {mode === "period" ? (
        <>
          <SectionCard title="지표별 비교" className="mb-4">
            <SimpleBarChart
              data={periodCompare.slice(0, 4).flatMap((r) => [
                { label: `${r.label} A`, value: r.chartA },
                { label: `${r.label} B`, value: r.chartB },
              ])}
              dataKey="value"
              name="값"
            />
          </SectionCard>
          <SectionCard title="비교 테이블">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>지표</th>
                    <th className="num">기간 A</th>
                    <th className="num">기간 B</th>
                    <th className="num">차이(B-A)</th>
                    <th className="num">증감률</th>
                  </tr>
                </thead>
                <tbody>
                  {periodCompare.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="num">{r.a}</td>
                      <td className="num">{r.b}</td>
                      <td className="num">{r.diff}</td>
                      <td className="num">
                        {r.rate == null ? "-" : `${formatNumber(r.rate, 1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      ) : (
        <SectionCard title="대상 비교">
          {entityCompare.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">비교 대상을 선택하세요.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>대상</th>
                    <th className="num">생산량</th>
                    <th className="num">불량수량</th>
                    <th className="num">가동률</th>
                    <th className="num">UPH</th>
                    <th className="num">고장 건수</th>
                    <th className="num">MTTR</th>
                    <th className="num">참고 MTBF</th>
                  </tr>
                </thead>
                <tbody>
                  {entityCompare.map((e) => (
                    <tr key={e.id}>
                      <td>{e.label}</td>
                      <td className="num">{formatQuantity(e.kpi.productionQuantity)}</td>
                      <td className="num">{formatQuantity(e.kpi.defectQuantity)}</td>
                      <td className="num">{formatPercent(e.kpi.utilizationRatePercent)}</td>
                      <td className="num">{formatUph(e.kpi.uph)}</td>
                      <td className="num">{e.kpi.failureCount}</td>
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
          )}
        </SectionCard>
      )}
    </>
  );
}
