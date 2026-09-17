"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Download, LayoutList, Maximize2, X } from "lucide-react";
import { InfoTooltip, SectionCard } from "@/components/ui/PageBits";
import { useToast } from "@/context/ToastContext";
import {
  type EquipmentReliabilityTable,
  type PeriodReasonTable,
  type ProductTypeDowntimeSummaryTable,
  type ProductTypeSummaryKey,
  MTTR_UNAVAILABLE_HINT,
  buildEquipmentFamilyAverageSpans,
  downtimeHeatLevel,
  equipmentReliabilityTitle,
  exportEquipmentReliabilityExcel,
  exportPeriodReasonExcel,
  periodTitle,
} from "@/lib/downtimeDetail";
import { formatNumber } from "@/lib/format";
import { withFromParam } from "@/lib/navigation";
import type { ProductType } from "@/types";

const REFERENCE_MTBF_HINT =
  "고장·복구 시각이 없어 유효 가동시간을 고장 건수로 나눈 참고 지표입니다.";

function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    let dragged = false;

    const isInteractive = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest("a, button, input, select, textarea, label"));
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || isInteractive(e.target)) return;
      pointerId = e.pointerId;
      dragged = false;
      startX = e.clientX;
      startY = e.clientY;
      scrollLeft = el.scrollLeft;
      scrollTop = el.scrollTop;
      el.classList.add("dt-dragging");
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragged && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        dragged = true;
      }
      if (!dragged) return;
      e.preventDefault();
      el.scrollLeft = scrollLeft - dx;
      el.scrollTop = scrollTop - dy;
    };

    const endDrag = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      pointerId = null;
      el.classList.remove("dt-dragging");
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return ref;
}

function dashMinutes(value: number): string {
  if (!value) return "-";
  return `${formatNumber(Math.round(value))}분`;
}

function dashMinutesPlain(value: number): string {
  if (!value) return "-";
  return formatNumber(Math.round(value));
}

function dashNumber(value: number): string {
  if (!value) return "-";
  return formatNumber(value);
}

function dashHours(value: number, digits = 1): string {
  if (!value) return "-";
  return formatNumber(value, digits);
}

function dashRank(value: number | null | undefined): string {
  if (value == null) return "-";
  return String(value);
}

function heatClass(level: 0 | 1 | 2 | 3 | 4): string {
  if (level === 0) return "";
  return `dt-heat-${level}`;
}

function TableToolbar({
  onSummary,
  onExcel,
  onFullscreen,
}: {
  onSummary?: () => void;
  onExcel: () => void;
  onFullscreen: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSummary ? (
        <button type="button" className="btn" onClick={onSummary}>
          <LayoutList size={16} />
          <span>요약</span>
        </button>
      ) : null}
      <button type="button" className="btn" onClick={onExcel}>
        <Download size={16} />
        <span>Excel 다운로드</span>
      </button>
      <button type="button" className="btn" onClick={onFullscreen}>
        <Maximize2 size={16} />
        <span>전체화면 보기</span>
      </button>
    </div>
  );
}

function FullscreenTableShell({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="dt-fullscreen-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dt-fullscreen-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold md:text-lg">{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            <X size={16} />
            <span>닫기</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PeriodReasonTableView({
  table,
  compact,
}: {
  table: PeriodReasonTable;
  compact?: boolean;
}) {
  const scrollRef = useDragScroll<HTMLDivElement>();
  const maxMinutes = Math.max(
    0,
    ...table.days.flatMap((d) => [
      d.dailyMinutes,
      ...table.reasonColumns.map((c) => d.byReason[c] ?? 0),
    ]),
  );

  return (
    <div
      ref={scrollRef}
      className={`dt-table-wrap ${compact ? "dt-table-wrap-compact" : ""}`}
    >
      <table className="dt-table">
        <thead>
          <tr>
            <th className="dt-sticky-col dt-sticky-1">날짜</th>
            {table.reasonColumns.map((reason) => (
              <th key={reason} className="num">
                {reason}
              </th>
            ))}
            <th className="num">
              일일 비가동시간
              <span className="dt-unit">분</span>
            </th>
            <th className="num">일일 비가동횟수</th>
          </tr>
        </thead>
        <tbody>
          {table.days.map((day) => (
            <tr
              key={day.date}
              className={
                day.isSunday ? "dt-sunday" : day.isSaturday ? "dt-saturday" : ""
              }
            >
              <td className="dt-sticky-col dt-sticky-1">{day.label}</td>
              {table.reasonColumns.map((reason) => {
                const minutes = day.byReason[reason] ?? 0;
                const level = downtimeHeatLevel(minutes, maxMinutes);
                return (
                  <td
                    key={reason}
                    className={`num ${heatClass(level)}`}
                    title={minutes > 0 ? `${reason}: ${dashMinutes(minutes)}` : undefined}
                  >
                    {dashMinutesPlain(minutes)}
                  </td>
                );
              })}
              <td className={`num ${heatClass(downtimeHeatLevel(day.dailyMinutes, maxMinutes))}`}>
                {dashMinutes(day.dailyMinutes)}
              </td>
              <td className="num">{dashNumber(day.dailyCount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="dt-summary-row">
            <td className="dt-sticky-col dt-sticky-1">사유별 비가동시간 합계</td>
            {table.reasonColumns.map((reason) => (
              <td key={reason} className="num">
                {dashMinutesPlain(table.summary.minutesByReason[reason] ?? 0)}
              </td>
            ))}
            <td className="num dt-total-cell">
              {dashMinutes(table.summary.totalMinutes)}
            </td>
            <td className="num">-</td>
          </tr>
          <tr className="dt-summary-row">
            <td className="dt-sticky-col dt-sticky-1">사유별 비가동시간 순위</td>
            {table.reasonColumns.map((reason) => (
              <td key={reason} className="num">
                {dashRank(table.summary.minutesRankByReason[reason])}
              </td>
            ))}
            <td className="num">-</td>
            <td className="num">-</td>
          </tr>
          <tr className="dt-summary-row">
            <td className="dt-sticky-col dt-sticky-1">사유별 비가동 발생 횟수</td>
            {table.reasonColumns.map((reason) => (
              <td key={reason} className="num">
                {dashNumber(table.summary.countByReason[reason] ?? 0)}
              </td>
            ))}
            <td className="num">-</td>
            <td className="num dt-total-cell">
              {dashNumber(table.summary.totalCount)}
            </td>
          </tr>
          <tr className="dt-summary-row">
            <td className="dt-sticky-col dt-sticky-1">사유별 발생 횟수 순위</td>
            {table.reasonColumns.map((reason) => (
              <td key={reason} className="num">
                {dashRank(table.summary.countRankByReason[reason])}
              </td>
            ))}
            <td className="num">-</td>
            <td className="num">-</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function MetricCell({
  value,
  formatter,
  className = "num",
  rowSpan,
}: {
  value: number | null;
  formatter: (v: number) => string;
  className?: string;
  rowSpan?: number;
}) {
  if (value == null) {
    return (
      <td className={className} rowSpan={rowSpan} title={MTTR_UNAVAILABLE_HINT}>
        -
      </td>
    );
  }
  return (
    <td className={className} rowSpan={rowSpan}>
      {formatter(value)}
    </td>
  );
}

function EquipmentReliabilityTableView({
  table,
  compact,
}: {
  table: EquipmentReliabilityTable;
  compact?: boolean;
}) {
  const scrollRef = useDragScroll<HTMLDivElement>();
  const equipmentOnly = table.rows.filter((r) => r.kind === "equipment");
  const familySpans = buildEquipmentFamilyAverageSpans(equipmentOnly);

  const maxMinutes = Math.max(
    0,
    ...equipmentOnly.map((r) => r.totalDowntimeMinutes),
    ...equipmentOnly.flatMap((r) =>
      table.reasonColumns.map((c) => r.byReason[c] ?? 0),
    ),
  );

  return (
    <>
      <div
        ref={scrollRef}
        className={`dt-table-wrap ${compact ? "dt-table-wrap-compact" : ""}`}
      >
        <table className="dt-table dt-eq-table">
          <thead>
            <tr>
              <th className="dt-sticky-col dt-sticky-1">공장</th>
              <th className="dt-sticky-col dt-sticky-2">설비명</th>
              {table.reasonColumns.map((reason) => (
                <th key={reason} className="num dt-reason-col">
                  {reason}
                </th>
              ))}
              <th className="num dt-col-month dt-group-start dt-metric-col">
                月비가동시간
                <span className="dt-unit">min</span>
              </th>
              <th className="num dt-col-part dt-metric-col">
                설비part 비가동시간
                <span className="dt-unit">min</span>
              </th>
              <th className="num dt-col-part dt-metric-col">
                설비part 비가동시간
                <span className="dt-unit">hr</span>
              </th>
              <th className="num dt-metric-col dt-metric-col-count">발생건수</th>
              <th className="num dt-metric-col">
                정상 가동시간
                <span className="dt-unit">hr</span>
              </th>
              <th className="num dt-col-mttr dt-group-start dt-metric-col">
                MTTR [설비복구시간]
                <span className="dt-unit">min</span>
              </th>
              <th className="num dt-col-mtbf dt-metric-col">
                <span className="inline-flex items-center justify-end gap-1">
                  MTBF [고장간격시간]
                  <InfoTooltip text={REFERENCE_MTBF_HINT} />
                </span>
                <span className="dt-unit">hr</span>
              </th>
              <th className="num dt-col-factory-mttr dt-group-start dt-metric-col">
                호기 평균 MTTR
                <span className="dt-unit">min</span>
              </th>
              <th className="num dt-col-factory-mtbf dt-metric-col">
                <span className="inline-flex items-center justify-end gap-1">
                  호기 평균 MTBF
                  <InfoTooltip text={REFERENCE_MTBF_HINT} />
                </span>
                <span className="dt-unit">hr</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, idx) => {
              const rowClass =
                row.kind === "factorySubtotal"
                  ? "dt-subtotal-row"
                  : row.kind === "grandTotal"
                    ? "dt-grand-row"
                    : "";
              const partHours = row.mttrTargetMinutes / 60;
              const family =
                row.kind === "equipment" && row.equipmentId
                  ? familySpans.get(row.equipmentId)
                  : null;
              const showFamilyMetricCells =
                row.kind === "factorySubtotal" ||
                row.kind === "grandTotal" ||
                (row.kind === "equipment" && (family?.rowSpan ?? 0) > 0);
              const familySpan =
                row.kind === "equipment" && family && family.rowSpan > 0
                  ? family.rowSpan
                  : undefined;
              const familyMttr =
                row.kind === "equipment"
                  ? (family?.mttrMinutes ?? null)
                  : row.mttrMinutes;
              const familyMtbf =
                row.kind === "equipment"
                  ? (family?.referenceMtbfHours ?? null)
                  : row.referenceMtbfHours;

              return (
                <tr
                  key={`${row.kind}-${row.equipmentId ?? row.equipmentName}-${idx}`}
                  className={rowClass}
                >
                  <td className="dt-sticky-col dt-sticky-1">{row.factory}</td>
                  <td className="dt-sticky-col dt-sticky-2">
                    {row.kind === "equipment" && row.equipmentId ? (
                      <Link
                        href={withFromParam(
                          `/equipment/${row.equipmentId}`,
                          "downtime",
                        )}
                        className="linkish"
                        title="설비 상세로 이동 (조회기간·제품유형·공장 유지)"
                      >
                        {row.equipmentName}
                      </Link>
                    ) : (
                      row.equipmentName
                    )}
                  </td>
                  {table.reasonColumns.map((reason) => {
                    const minutes = row.byReason[reason] ?? 0;
                    const level =
                      row.kind === "equipment"
                        ? downtimeHeatLevel(minutes, maxMinutes)
                        : 0;
                    return (
                      <td
                        key={reason}
                        className={`num ${heatClass(level)}`}
                        title={
                          minutes > 0 ? `${reason}: ${dashMinutes(minutes)}` : undefined
                        }
                      >
                        {dashMinutesPlain(minutes)}
                      </td>
                    );
                  })}
                  <td
                    className={`num dt-metric-col dt-group-start ${heatClass(
                      row.kind === "equipment"
                        ? downtimeHeatLevel(row.totalDowntimeMinutes, maxMinutes)
                        : 0,
                    )}`}
                  >
                    {dashMinutes(row.totalDowntimeMinutes)}
                  </td>
                  <td className="num dt-metric-col">
                    {dashMinutes(row.mttrTargetMinutes)}
                  </td>
                  <td className="num dt-metric-col">
                    {dashHours(partHours, 1)}
                  </td>
                  <td className="num dt-metric-col dt-metric-col-count">
                    {dashNumber(row.mttrTargetCount)}
                  </td>
                  <td className="num dt-metric-col">
                    {dashHours(row.operatingHours, 1)}
                  </td>
                  <MetricCell
                    value={row.mttrMinutes}
                    formatter={(v) => formatNumber(v, 1)}
                    className={`num dt-cell-mttr dt-metric-col${
                      row.kind === "grandTotal" ? " dt-cell-mttr-total" : ""
                    }`}
                  />
                  <MetricCell
                    value={row.referenceMtbfHours}
                    formatter={(v) => formatNumber(v, 1)}
                    className={`num dt-cell-mtbf dt-metric-col${
                      row.kind === "grandTotal" ? " dt-cell-mtbf-total" : ""
                    }`}
                  />
                  {showFamilyMetricCells ? (
                    <>
                      <MetricCell
                        value={familyMttr}
                        formatter={(v) => formatNumber(v, 1)}
                        className="num dt-cell-family-mttr dt-metric-col"
                        rowSpan={familySpan}
                      />
                      <MetricCell
                        value={familyMtbf}
                        formatter={(v) => formatNumber(v, 1)}
                        className="num dt-cell-family-mtbf dt-metric-col"
                        rowSpan={familySpan}
                      />
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        복합 사유는 각 사유를 분리해 발생 건수로 집계합니다. 설비이상이 포함된 복합은
        고장·MTTR에 포함하고, 수리시간은 비가동시간 전체를 반영합니다. 설비이상이 없는
        복합은 사유별 건수만 증가하고 고장·MTTR에는 넣지 않습니다.
      </p>
    </>
  );
}

const PRODUCT_TABS: Array<"전체" | ProductType> = ["전체", "GROMMET", "SEAL"];

function ProductTypeTabs({
  value,
  onChange,
  label = "제품유형",
}: {
  value: "전체" | ProductType;
  onChange: (next: "전체" | ProductType) => void;
  label?: string;
}) {
  return (
    <div className="dt-product-tabs" role="tablist" aria-label={label}>
      {PRODUCT_TABS.map((opt) => (
        <button
          key={opt}
          type="button"
          role="tab"
          className="dt-product-tab"
          aria-selected={value === opt}
          data-active={value === opt}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function PeriodReasonSection({
  table,
  productType,
  onProductTypeChange,
  sectionId,
  summaryTable,
}: {
  table: PeriodReasonTable;
  productType: "전체" | ProductType;
  onProductTypeChange: (next: "전체" | ProductType) => void;
  sectionId?: string;
  summaryTable?: ProductTypeDowntimeSummaryTable;
}) {
  const { pushToast } = useToast();
  const title = periodTitle(productType);
  const [fullscreen, setFullscreen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const handleExcel = () => {
    try {
      exportPeriodReasonExcel(table, title);
      pushToast(`Excel 파일 생성을 시작했습니다. (${title})`, "success");
    } catch {
      pushToast("Excel 다운로드에 실패했습니다.", "error");
    }
  };

  const body = (
    <PeriodReasonTableView table={table} compact={fullscreen} />
  );

  return (
    <>
      <SectionCard
        id={sectionId}
        className="mb-4"
        title={title}
        action={
          <TableToolbar
            onSummary={
              summaryTable ? () => setSummaryOpen(true) : undefined
            }
            onExcel={handleExcel}
            onFullscreen={() => setFullscreen(true)}
          />
        }
      >
        <div className="mb-3">
          <ProductTypeTabs
            value={productType}
            onChange={onProductTypeChange}
            label="기간별 비가동 제품유형"
          />
        </div>
        {body}
      </SectionCard>
      <FullscreenTableShell
        title={title}
        open={fullscreen}
        onClose={() => setFullscreen(false)}
      >
        <div className="mb-3">
          <ProductTypeTabs
            value={productType}
            onChange={onProductTypeChange}
            label="기간별 비가동 제품유형"
          />
        </div>
        {body}
      </FullscreenTableShell>
      {summaryTable ? (
        <FullscreenTableShell
          title="제품유형별 비가동 요약"
          open={summaryOpen}
          onClose={() => setSummaryOpen(false)}
        >
          <ProductTypeDowntimeSummaryTableView table={summaryTable} />
        </FullscreenTableShell>
      ) : null}
    </>
  );
}

export function EquipmentReliabilitySection({
  table,
  productType,
  onProductTypeChange,
}: {
  table: EquipmentReliabilityTable;
  productType: "전체" | ProductType;
  onProductTypeChange: (next: "전체" | ProductType) => void;
}) {
  const { pushToast } = useToast();
  const title = equipmentReliabilityTitle(productType);
  const [fullscreen, setFullscreen] = useState(false);

  const handleExcel = () => {
    try {
      exportEquipmentReliabilityExcel(table, title);
      pushToast(`Excel 파일 생성을 시작했습니다. (${title})`, "success");
    } catch {
      pushToast("Excel 다운로드에 실패했습니다.", "error");
    }
  };

  const body = (
    <EquipmentReliabilityTableView table={table} compact={fullscreen} />
  );

  return (
    <>
      <SectionCard
        className="mb-4"
        title={title}
        action={
          <TableToolbar
            onExcel={handleExcel}
            onFullscreen={() => setFullscreen(true)}
          />
        }
      >
        <div className="mb-3">
          <ProductTypeTabs
            value={productType}
            onChange={onProductTypeChange}
            label="설비별 비가동·신뢰성 제품유형"
          />
        </div>
        <p className="mb-3 text-xs text-[var(--text-secondary)]">
          설비명을 클릭하면 설비 상세로 이동합니다.
        </p>
        {body}
      </SectionCard>
      <FullscreenTableShell
        title={title}
        open={fullscreen}
        onClose={() => setFullscreen(false)}
      >
        <div className="mb-3">
          <ProductTypeTabs
            value={productType}
            onChange={onProductTypeChange}
            label="설비별 비가동·신뢰성 제품유형"
          />
        </div>
        {body}
      </FullscreenTableShell>
    </>
  );
}

function dashPlainMinutes(value: number): string {
  if (!value) return "-";
  return formatNumber(Math.round(value));
}

function dashPlainCount(value: number): string {
  if (!value) return "-";
  return formatNumber(value);
}

function ProductTypeDowntimeSummaryTableView({
  table,
}: {
  table: ProductTypeDowntimeSummaryTable;
}) {
  const scrollRef = useDragScroll<HTMLDivElement>();
  const groups: Array<{
    key: ProductTypeSummaryKey;
    label: string;
    headClass: string;
    totalClass: string;
  }> = [
    {
      key: "overall",
      label: "전체",
      headClass: "dt-sum-head-overall",
      totalClass: "dt-sum-total-overall",
    },
    {
      key: "grommet",
      label: "GROMMET",
      headClass: "dt-sum-head-grommet",
      totalClass: "dt-sum-total-grommet",
    },
    {
      key: "seal",
      label: "SEAL",
      headClass: "dt-sum-head-seal",
      totalClass: "dt-sum-total-seal",
    },
  ];

  return (
    <div ref={scrollRef} className="dt-table-wrap dt-sum-wrap">
      <table className="dt-table dt-sum-table">
        <thead>
          <tr>
            <th rowSpan={2} className="dt-sticky-col dt-sticky-1 dt-sum-date-head">
              작업일자
            </th>
            {groups.map((g) => (
              <th
                key={g.key}
                colSpan={2}
                className={`dt-sum-group-head ${g.headClass}`}
              >
                {g.label}
              </th>
            ))}
          </tr>
          <tr>
            {groups.map((g) => (
              <Fragment key={`${g.key}-sub`}>
                <th className={`dt-sum-sub-head ${g.headClass}`}>일일 시간</th>
                <th className={`dt-sum-sub-head ${g.headClass}`}>일일 횟수</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.days.map((day) => (
            <tr
              key={day.date}
              className={
                day.isSunday ? "dt-sunday" : day.isSaturday ? "dt-saturday" : ""
              }
            >
              <td className="dt-sticky-col dt-sticky-1">{day.label}</td>
              {groups.map((g) => {
                const pair = day[g.key];
                return (
                  <Fragment key={`${day.date}-${g.key}`}>
                    <td className="num">{dashPlainMinutes(pair.minutes)}</td>
                    <td className="num">{dashPlainCount(pair.count)}</td>
                  </Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="dt-sum-total-row">
            <td className="dt-sticky-col dt-sticky-1">합계</td>
            {groups.map((g) => {
              const pair = table.totals[g.key];
              return (
                <Fragment key={`total-${g.key}`}>
                  <td className={`num ${g.totalClass}`}>
                    {dashPlainMinutes(pair.minutes)}
                  </td>
                  <td className={`num ${g.totalClass}`}>
                    {dashPlainCount(pair.count)}
                  </td>
                </Fragment>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
