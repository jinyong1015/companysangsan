"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatMinutes, formatPercent } from "@/lib/format";
import {
  buildDowntimeEquipmentHeatmap,
  downtimeHeatTone,
  formatDowntimeHeatDisplay,
  type DowntimeHeatCell,
  type DowntimeHeatmapMetric,
  type DowntimeHeatmapProductTab,
  type DowntimeHeatmapSelection,
  type DowntimeHeatTone,
} from "@/lib/downtimeHeatmap";
import type { ProductionRecord } from "@/types";

const PRODUCT_TABS: DowntimeHeatmapProductTab[] = ["전체", "GROMMET", "SEAL"];

const METRIC_OPTIONS: Array<{ value: DowntimeHeatmapMetric; label: string }> = [
  { value: "minutes", label: "비가동시간" },
  { value: "count", label: "발생 건수" },
  { value: "rate", label: "비가동률" },
];

const TONE_LABEL: Record<DowntimeHeatTone, string> = {
  empty: "데이터 없음",
  zero: "0",
  low: "낮음",
  mid: "보통",
  high: "높음",
  veryHigh: "매우 높음",
};

function shortDate(date: string) {
  try {
    return format(parseISO(date), "MM/dd");
  } catch {
    return date.slice(5);
  }
}

function CellTooltip({
  cell,
  productTab,
}: {
  cell: DowntimeHeatCell;
  productTab: DowntimeHeatmapProductTab;
}) {
  const productLabel =
    productTab !== "전체"
      ? productTab
      : cell.productTypes.length > 0
        ? cell.productTypes.join(", ")
        : "-";

  return (
    <div className="dt-heat-tooltip" role="tooltip">
      <p>
        <strong>작업일자:</strong> {cell.workDate}
      </p>
      <p>
        <strong>설비명:</strong> {cell.equipmentName}
      </p>
      <p>
        <strong>제품유형:</strong> {productLabel}
      </p>
      <p>
        <strong>비가동시간:</strong> {formatMinutes(cell.downtimeMinutes)}
      </p>
      <p>
        <strong>비가동 발생:</strong> {cell.eventCount}건
      </p>
      <p>
        <strong>고장 발생:</strong> {cell.failureCount}건
      </p>
      <p>
        <strong>비가동률:</strong>{" "}
        {cell.downtimeRatePercent == null
          ? "-"
          : formatPercent(cell.downtimeRatePercent, 1)}
      </p>
      <p>
        <strong>주요 사유:</strong>{" "}
        {cell.topReasons.length > 0 ? cell.topReasons.join(", ") : "-"}
      </p>
    </div>
  );
}

function HeatCell({
  cell,
  tone,
  metric,
  selected,
  selectable,
  productTab,
  onSelect,
}: {
  cell: DowntimeHeatCell;
  tone: DowntimeHeatTone;
  metric: DowntimeHeatmapMetric;
  selected: boolean;
  selectable: boolean;
  productTab: DowntimeHeatmapProductTab;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  const label = formatDowntimeHeatDisplay(cell, metric);
  const showWarning = cell.hasData && cell.failureCount > 0;
  const canSelect = selectable && cell.hasData;

  return (
    <td
      className="dt-heat-cell"
      data-tone={tone}
      data-selected={selected}
      data-interactive={canSelect ? "true" : "false"}
      onClick={() => {
        if (canSelect) onSelect();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={canSelect ? "button" : undefined}
      tabIndex={canSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (!canSelect) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      title={
        cell.hasData
          ? `${cell.equipmentName} · ${cell.workDate}`
          : "데이터 없음"
      }
    >
      <span className="dt-heat-cell-inner">
        <span className="dt-heat-cell-value">{label}</span>
        {showWarning ? (
          <AlertTriangle
            className="dt-heat-warn"
            size={11}
            aria-label="설비이상 포함"
          />
        ) : null}
      </span>
      {hover && cell.hasData ? (
        <CellTooltip cell={cell} productTab={productTab} />
      ) : null}
    </td>
  );
}

interface DowntimeEquipmentHeatmapProps {
  records: ProductionRecord[];
  startDate: string;
  endDate: string;
  productTab: DowntimeHeatmapProductTab;
  onProductTabChange: (tab: DowntimeHeatmapProductTab) => void;
  metric: DowntimeHeatmapMetric;
  onMetricChange: (metric: DowntimeHeatmapMetric) => void;
  /** 셀 클릭으로 상세 필터 연동 (비가동 분석용). 기본 true */
  selectable?: boolean;
  selection?: DowntimeHeatmapSelection | null;
  onSelectionChange?: (next: DowntimeHeatmapSelection | null) => void;
}

export function DowntimeEquipmentHeatmap({
  records,
  startDate,
  endDate,
  productTab,
  onProductTabChange,
  metric,
  onMetricChange,
  selectable = true,
  selection = null,
  onSelectionChange,
}: DowntimeEquipmentHeatmapProps) {
  const bundle = useMemo(
    () =>
      buildDowntimeEquipmentHeatmap(records, {
        startDate,
        endDate,
        productTab,
        metric,
      }),
    [records, startDate, endDate, productTab, metric],
  );

  const zeroLabel =
    metric === "minutes" ? "0분" : metric === "count" ? "0건" : "0%";

  return (
    <div className="dt-heat">
      <div className="dt-heat-toolbar">
        <div className="dt-product-tabs" role="tablist" aria-label="제품유형">
          {PRODUCT_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              className="dt-product-tab"
              aria-selected={productTab === tab}
              data-active={productTab === tab}
              onClick={() => onProductTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="filter-pills" role="tablist" aria-label="히트맵 지표">
          {METRIC_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="filter-pill"
              role="tab"
              aria-selected={metric === opt.value}
              data-active={metric === opt.value}
              onClick={() => onMetricChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {selectable && selection ? (
        <div className="dt-heat-chips" aria-label="선택 필터">
          <span className="dt-heat-chip">{selection.workDate}</span>
          <span className="dt-heat-chip">{selection.equipmentName}</span>
          <span className="dt-heat-chip">{selection.productType}</span>
          <button
            type="button"
            className="dt-heat-chip-clear"
            onClick={() => onSelectionChange?.(null)}
          >
            선택 해제
          </button>
        </div>
      ) : null}

      {bundle.rows.length === 0 ? (
        <p className="dt-heat-empty">표시할 설비 데이터가 없습니다.</p>
      ) : (
        <>
          <div className="dt-heat-scroll">
            <table className="dt-heat-table">
              <thead>
                <tr>
                  <th className="dt-heat-sticky">설비명</th>
                  {bundle.dates.map((d) => (
                    <th key={d}>{shortDate(d)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bundle.rows.map((row) => (
                  <tr key={row.equipmentId}>
                    <th className="dt-heat-sticky" scope="row">
                      {row.equipmentName}
                    </th>
                    {row.cells.map((cell) => {
                      const tone = downtimeHeatTone(cell, metric, bundle.breaks);
                      const selected =
                        selectable &&
                        selection?.equipmentId === cell.equipmentId &&
                        selection.workDate === cell.workDate;
                      return (
                        <HeatCell
                          key={`${cell.equipmentId}-${cell.workDate}`}
                          cell={cell}
                          tone={tone}
                          metric={metric}
                          selected={!!selected}
                          selectable={selectable}
                          productTab={productTab}
                          onSelect={() => {
                            if (!selectable || !onSelectionChange) return;
                            onSelectionChange(
                              selected
                                ? null
                                : {
                                    workDate: cell.workDate,
                                    equipmentId: cell.equipmentId,
                                    equipmentName: cell.equipmentName,
                                    productType: productTab,
                                  },
                            );
                          }}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dt-heat-legend" aria-label="색상 범례">
            <span className="dt-heat-legend-item">
              <i data-tone="empty" />
              데이터 없음
            </span>
            <span className="dt-heat-legend-item">
              <i data-tone="zero" />
              {zeroLabel}
            </span>
            {bundle.breaks.map((b) => (
              <span key={b.tone} className="dt-heat-legend-item">
                <i data-tone={b.tone} />
                {TONE_LABEL[b.tone]} ({b.label})
              </span>
            ))}
            <span className="dt-heat-legend-item dt-heat-legend-warn">
              <AlertTriangle size={12} aria-hidden />
              설비이상 포함
            </span>
          </div>
        </>
      )}
    </div>
  );
}
