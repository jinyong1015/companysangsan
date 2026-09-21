"use client";

import { useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/PageBits";
import { formatNumber, formatPercent } from "@/lib/format";
import type { KpiSummary } from "@/types";

export type WorkPartOption = {
  id: string;
  partNumber: string;
  productType?: string;
  kpi: KpiSummary;
};

type WorkPartSelectProps = {
  parts: WorkPartOption[];
  selectedPartId: string;
  onSelect: (partId: string) => void;
  selectId?: string;
  hintText?: string;
  className?: string;
};

export function WorkPartSelect({
  parts,
  selectedPartId,
  onSelect,
  selectId = "work-part-select",
  hintText = "해 생산량·UPH·불량률을 확인하세요.",
  className = "mb-4",
}: WorkPartSelectProps) {
  const [partQuery, setPartQuery] = useState("");

  const activePartId = parts.some((p) => p.id === selectedPartId)
    ? selectedPartId
    : "";
  const hasSelection = Boolean(activePartId);
  const activePart = hasSelection
    ? parts.find((p) => p.id === activePartId)
    : null;
  const totalQty = parts.reduce((s, p) => s + p.kpi.productionQuantity, 0);

  const visibleParts = useMemo(() => {
    const q = partQuery.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter(
      (p) =>
        p.partNumber.toLowerCase().includes(q) ||
        (p.productType ?? "").toLowerCase().includes(q),
    );
  }, [parts, partQuery]);

  return (
    <SectionCard
      title="작업 품번 선택"
      description="카드를 클릭하면 아래 KPI·차트가 해당 품번 기준으로 바뀝니다."
      className={className}
    >
      {!parts.length ? (
        <p className="text-sm text-muted">해당 기간에 작업한 품번이 없습니다.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-accent/40 bg-accent/5 px-3 py-2.5">
            <p className="text-sm text-ink">
              <span className="font-medium text-accent">작업 품번을 선택</span>
              {hintText}
            </p>
            <p className="text-xs text-muted">
              현재{" "}
              <span className="font-semibold text-accent">
                {hasSelection
                  ? (activePart?.partNumber ?? "")
                  : `전체 (${parts.length})`}
              </span>
            </p>
          </div>

          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="min-w-[200px] flex-1 text-xs font-medium text-muted">
              품번 검색
              <input
                type="search"
                value={partQuery}
                onChange={(e) => setPartQuery(e.target.value)}
                placeholder="품번명으로 찾기"
                className="mt-1.5 w-full rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-normal text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="text-xs font-medium text-muted">
              빠른 선택
              <select
                id={selectId}
                value={activePartId}
                onChange={(e) => onSelect(e.target.value)}
                className="mt-1.5 min-w-[200px] rounded-full border border-line bg-surface px-3 py-2 text-sm font-normal text-ink"
                aria-label="작업 품번 빠른 선택"
              >
                <option value="">전체 ({parts.length})</option>
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.partNumber}
                    {p.productType ? ` · ${p.productType}` : ""} ·{" "}
                    {formatNumber(p.kpi.productionQuantity)} EA
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            className="grid-dense max-h-[320px] overflow-y-auto pr-1"
            role="radiogroup"
            aria-label="작업 품번 선택"
          >
            <button
              type="button"
              role="radio"
              aria-checked={!hasSelection}
              onClick={() => onSelect("")}
              className={`group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                !hasSelection
                  ? "border-accent bg-accent/5 shadow-sm ring-1 ring-accent/30"
                  : "border-line bg-surface hover:border-accent/50 hover:bg-canvas"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  !hasSelection
                    ? "border-accent"
                    : "border-line group-hover:border-accent/60"
                }`}
                aria-hidden
              >
                {!hasSelection ? (
                  <span className="h-2 w-2 rounded-full bg-accent" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      !hasSelection ? "text-accent" : "text-ink"
                    }`}
                  >
                    전체 품번
                  </span>
                  {!hasSelection ? (
                    <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
                      선택됨
                    </span>
                  ) : null}
                </span>
                <span className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span>
                    품번{" "}
                    <span className="num font-medium text-ink/80">{parts.length}</span>
                  </span>
                  <span>
                    생산{" "}
                    <span className="num font-medium text-ink/80">
                      {formatNumber(totalQty)}
                    </span>
                  </span>
                </span>
              </span>
            </button>

            {visibleParts.map((p) => {
              const active = p.id === activePartId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(p.id)}
                  className={`group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                    active
                      ? "border-accent bg-accent/5 shadow-sm ring-1 ring-accent/30"
                      : "border-line bg-surface hover:border-accent/50 hover:bg-canvas"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      active
                        ? "border-accent"
                        : "border-line group-hover:border-accent/60"
                    }`}
                    aria-hidden
                  >
                    {active ? (
                      <span className="h-2 w-2 rounded-full bg-accent" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${
                          active ? "text-accent" : "text-ink"
                        }`}
                        title={p.partNumber}
                      >
                        {p.partNumber}
                      </span>
                      {active ? (
                        <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
                          선택됨
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] text-muted opacity-0 transition group-hover:opacity-100">
                          클릭
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-muted">
                      <span>
                        생산{" "}
                        <span className="num font-medium text-ink/80">
                          {formatNumber(p.kpi.productionQuantity)}
                        </span>
                      </span>
                      <span>
                        불량률{" "}
                        <span className="num font-medium text-ink/80">
                          {formatPercent(p.kpi.defectRatePercent, 2)}
                        </span>
                      </span>
                      <span>
                        UPH{" "}
                        <span className="num font-medium text-ink/80">
                          {p.kpi.uph == null
                            ? "-"
                            : formatNumber(Math.round(p.kpi.uph))}
                        </span>
                      </span>
                      {p.productType ? (
                        <span>
                          제품유형{" "}
                          <span className="font-medium text-ink/80">
                            {p.productType}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {partQuery.trim() && !visibleParts.length ? (
            <p className="mt-3 text-center text-sm text-muted">
              「{partQuery.trim()}」에 맞는 품번이 없습니다.
            </p>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}
