"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { QueryFilterShell } from "@/components/filters/FilterCards";
import { UtilizationOverviewPanel } from "@/components/utilization/UtilizationOverviewPanel";
import { EmptyState, PageHeader } from "@/components/ui/PageBits";
import { useDataSource } from "@/context/DataSourceContext";
import { useFilters } from "@/context/FilterContext";
import { useToast } from "@/context/ToastContext";
import { usePageState } from "@/hooks/usePageState";
import { usePreserveGlobalPeriod } from "@/hooks/usePreserveGlobalPeriod";
import { todaySeoul } from "@/lib/dates";
import {
  formatMinutes,
  formatNumber,
  formatPercent,
  formatQuantity,
} from "@/lib/format";
import {
  buildUtilizationMatrix,
  buildUtilizationOverviewBundle,
  cellDisplay,
  cloneTargetMinutes,
  DEFAULT_TARGET_SHOT_COUNTS,
  exportUtilizationExcel,
  formatMonthLabel,
  getCell,
  getDateWeekdayClass,
  loadTargetMinutes,
  loadTargetShotCounts,
  monthDateRange,
  resolveTargetDayKind,
  saveTargetMinutes,
  saveTargetShotCounts,
  WORK_PATTERN_KEYS,
  type UtilizationCell,
} from "@/lib/utilization";
import { withFromParam, withPeriodParams } from "@/lib/navigation";
import type {
  EquipmentType,
  PerformanceShiftPattern,
  ProductType,
  TargetDayKind,
  TargetMinutesSettings,
  TargetShotCountTable,
  UtilizationMetric,
  WorkPattern,
} from "@/types";

type EqTypeFilter = "전체" | EquipmentType;
type WorkPatternFilter = "전체" | WorkPattern | PerformanceShiftPattern;

type ShotTargetRow = {
  product: ProductType;
  equipment: EquipmentType;
  shift: PerformanceShiftPattern;
};

const EDITABLE_SHOT_ROWS: ShotTargetRow[] = [
  { product: "GROMMET", equipment: "PRESS", shift: "주간+야간" },
  { product: "GROMMET", equipment: "PRESS", shift: "단일 교대" },
  { product: "GROMMET", equipment: "INJECTION", shift: "주간+야간" },
  { product: "GROMMET", equipment: "INJECTION", shift: "단일 교대" },
  { product: "SEAL", equipment: "PRESS", shift: "주간+야간" },
  { product: "SEAL", equipment: "PRESS", shift: "단일 교대" },
];

function defaultYearMonth() {
  return format(todaySeoul(), "yyyy-MM");
}

function isTimeWorkPattern(value: string): value is WorkPattern | "전체" {
  return (
    value === "전체" ||
    value === "주간+야간" ||
    value === "주간" ||
    value === "야간"
  );
}

function isPerfWorkPattern(
  value: string,
): value is PerformanceShiftPattern | "전체" {
  return value === "전체" || value === "주간+야간" || value === "단일 교대";
}

function CellTooltip({
  cell,
  metric,
}: {
  cell: UtilizationCell;
  metric: UtilizationMetric;
}) {
  if (metric === "performance") {
    return (
      <div className="util-tooltip" role="tooltip">
        <p className="util-tooltip-title">
          {cell.equipmentName} · {formatMonthLabel(cell.date)}
        </p>
        <dl>
          <div>
            <dt>작업판수</dt>
            <dd>{formatNumber(cell.shotCount)}</dd>
          </div>
          <div>
            <dt>교대 구분</dt>
            <dd>{cell.performanceShiftPattern ?? "-"}</dd>
          </div>
          <div>
            <dt>목표 작업판수</dt>
            <dd>
              {cell.targetShotCount != null
                ? `${formatNumber(cell.targetShotCount)}판`
                : "목표 미설정"}
            </dd>
          </div>
          <div>
            <dt>성능가동률</dt>
            <dd>
              {cell.performanceUtilizationPercent != null
                ? formatPercent(cell.performanceUtilizationPercent, 1)
                : "목표 미설정"}
            </dd>
          </div>
          <div>
            <dt>제품유형</dt>
            <dd>
              {cell.productTypes.length > 0
                ? cell.productTypes.join(", ")
                : "-"}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="util-tooltip" role="tooltip">
      <p className="util-tooltip-title">
        {cell.equipmentName} · {formatMonthLabel(cell.date)}
      </p>
      <dl>
        <div>
          <dt>작업시간</dt>
          <dd>{formatMinutes(cell.elapsedMinutes)}</dd>
        </div>
        <div>
          <dt>비가동시간</dt>
          <dd>{formatMinutes(cell.downtimeMinutes)}</dd>
        </div>
        <div>
          <dt>유효 가동시간</dt>
          <dd>{formatMinutes(cell.operatingMinutes)}</dd>
        </div>
        <div>
          <dt>시간가동률</dt>
          <dd>
            {cell.timeUtilizationPercent != null
              ? formatPercent(cell.timeUtilizationPercent, 1)
              : "목표 미설정"}
          </dd>
        </div>
        <div>
          <dt>적용 근무형태</dt>
          <dd>
            {cell.workPattern ?? "-"}
            {cell.date
              ? ` · ${
                  resolveTargetDayKind(cell.date) === "weekend"
                    ? "주말"
                    : "평일"
                }`
              : ""}
          </dd>
        </div>
        <div>
          <dt>목표 가동시간</dt>
          <dd>
            {cell.targetMinutes != null
              ? `${formatNumber(cell.targetMinutes)}분`
              : "목표 미설정"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function HeatCell({
  cell,
  metric,
  onClick,
}: {
  cell: UtilizationCell | undefined;
  metric: UtilizationMetric;
  onClick: () => void;
}) {
  const display = cellDisplay(cell, metric);

  if (display.kind === "empty" || !cell) {
    return (
      <td className="util-cell util-tone-empty">
        <span>-</span>
      </td>
    );
  }

  if (display.kind === "no-target") {
    return (
      <td
        className="util-cell util-tone-empty util-cell-hover"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
      >
        <span className="util-cell-muted">목표 미설정</span>
        <CellTooltip cell={cell} metric={metric} />
      </td>
    );
  }

  return (
    <td
      className={`util-cell util-tone-${display.tone} util-cell-hover`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {display.label}
      <CellTooltip cell={cell} metric={metric} />
    </td>
  );
}

function SummaryCell({
  cell,
  metric,
  colSpan,
}: {
  cell: UtilizationCell | null | undefined;
  metric: UtilizationMetric;
  colSpan?: number;
}) {
  const display = cellDisplay(cell ?? undefined, metric);
  return (
    <td
      className={`util-cell util-tone-${display.tone}`}
      colSpan={colSpan}
    >
      {display.label}
    </td>
  );
}

function FamilyAverageCell({
  label,
  cell,
  metric,
  colSpan,
}: {
  label: string;
  cell: UtilizationCell | null | undefined;
  metric: UtilizationMetric;
  colSpan: number;
}) {
  const display = cellDisplay(cell ?? undefined, metric);
  return (
    <td
      className={`util-cell util-family-cell util-tone-${display.tone}`}
      colSpan={colSpan}
    >
      <div className="util-family-cell-inner">
        <span className="util-family-cell-name">{label}</span>
        <strong className="util-family-cell-rate">{display.label}</strong>
      </div>
    </td>
  );
}

function DetailModal({
  cell,
  metric,
  onClose,
  onOpenEquipment,
}: {
  cell: UtilizationCell;
  metric: UtilizationMetric;
  onClose: () => void;
  onOpenEquipment: (equipmentId: string) => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: Array<[string, string]> =
    metric === "performance"
      ? [
          ["날짜", cell.date],
          ["설비명", cell.equipmentName],
          ["공장", cell.factory || "-"],
          [
            "제품유형",
            cell.productTypes.length > 0 ? cell.productTypes.join(", ") : "-",
          ],
          ["설비유형", cell.equipmentType],
          ["교대 구분", cell.performanceShiftPattern ?? "-"],
          [
            "목표 작업판수",
            cell.targetShotCount != null
              ? `${formatNumber(cell.targetShotCount)}판`
              : "목표 미설정",
          ],
          ["작업판수 합계", formatNumber(cell.shotCount)],
          [
            "성능가동률",
            cell.performanceUtilizationPercent != null
              ? formatPercent(cell.performanceUtilizationPercent, 1)
              : "목표 미설정",
          ],
          ["생산량", formatQuantity(cell.productionQuantity)],
        ]
      : [
          ["날짜", cell.date],
          ["설비명", cell.equipmentName],
          ["공장", cell.factory || "-"],
          [
            "제품유형",
            cell.productTypes.length > 0 ? cell.productTypes.join(", ") : "-",
          ],
          ["적용 근무형태", cell.workPattern ?? "-"],
          [
            "목표 가동시간",
            cell.targetMinutes != null
              ? `${formatNumber(cell.targetMinutes)}분`
              : "목표 미설정",
          ],
          ["작업시간", formatMinutes(cell.elapsedMinutes)],
          ["비가동시간", formatMinutes(cell.downtimeMinutes)],
          ["유효 가동시간", formatMinutes(cell.operatingMinutes)],
          [
            "시간가동률",
            cell.timeUtilizationPercent != null
              ? formatPercent(cell.timeUtilizationPercent, 1)
              : "목표 미설정",
          ],
          [
            "비가동 사유",
            cell.downtimeReasons.length > 0
              ? cell.downtimeReasons.join(" / ")
              : "-",
          ],
          ["고장 건수", formatNumber(cell.failureCount)],
        ];

  const openProductionData = () => {
    router.push(
      withFromParam(
        withPeriodParams(
          `/production-data?equipment=${encodeURIComponent(cell.equipmentId)}`,
          cell.date,
          cell.date,
        ),
        "utilization",
      ),
    );
  };

  return (
    <div className="util-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="util-modal"
        role="dialog"
        aria-modal="true"
        aria-label={metric === "time" ? "시간가동률 상세" : "성능가동률 상세"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              {metric === "time" ? "시간가동률 상세" : "성능가동률 상세"}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {cell.equipmentName} · {formatMonthLabel(cell.date)}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        <dl className="util-detail-grid">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onOpenEquipment(cell.equipmentId)}
          >
            설비 상세 이동
          </button>
          <button type="button" className="btn" onClick={openProductionData}>
            원본 생산 DATA 보기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UtilizationPage() {
  const router = useRouter();
  const { filters, setFilters, resetGlobal, resetDetail } = useFilters();
  const { records } = useDataSource();
  const { pushToast } = useToast();
  const pathname = usePathname();
  const { state, patch, ready } = usePageState("utilization", "date", "asc");
  usePreserveGlobalPeriod(ready);
  const scrollRef = useRef<HTMLDivElement>(null);
  const persistRef = useRef({ scrollY: 0, scrollX: 0 });
  const [selected, setSelected] = useState<UtilizationCell | null>(null);
  const [targetSettings, setTargetSettings] = useState<TargetMinutesSettings>(
    () =>
      typeof window === "undefined"
        ? cloneTargetMinutes()
        : loadTargetMinutes(),
  );
  const [shotSettings, setShotSettings] = useState<TargetShotCountTable>(() =>
    typeof window === "undefined"
      ? DEFAULT_TARGET_SHOT_COUNTS
      : loadTargetShotCounts(),
  );
  const [editTargets, setEditTargets] = useState(false);

  const metric: UtilizationMetric =
    state.extra?.metric === "performance" ? "performance" : "time";

  const yearMonth =
    typeof state.extra?.yearMonth === "string" && state.extra.yearMonth
      ? state.extra.yearMonth
      : defaultYearMonth();
  const equipmentType = (state.extra?.equipmentType as EqTypeFilter) || "전체";

  const rawWorkPattern =
    typeof state.extra?.workPattern === "string"
      ? state.extra.workPattern
      : "전체";
  const workPattern: WorkPatternFilter =
    metric === "time"
      ? isTimeWorkPattern(rawWorkPattern)
        ? rawWorkPattern
        : "전체"
      : isPerfWorkPattern(rawWorkPattern)
        ? rawWorkPattern
        : "전체";

  /** 종합 현황·히트맵은 조회월 전체 기간으로 집계 */
  const monthRange = useMemo(() => monthDateRange(yearMonth), [yearMonth]);

  useEffect(() => {
    if (!ready) return;
    const y = state.scrollY ?? 0;
    const x =
      typeof state.extra?.scrollX === "number" ? Number(state.extra.scrollX) : 0;
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
      if (scrollRef.current) scrollRef.current.scrollLeft = x;
    });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 생산 DATA 드릴다운에서 남은 설비 등이 전역 필터에 남지 않게 정리 (조회기간은 유지) */
  useEffect(() => {
    if (!ready || pathname !== "/utilization") return;
    setFilters({
      equipmentIds: [],
      partIds: [],
      operatorIds: [],
      moldIds: [],
      shiftType: "전체",
      downtimeReason: "전체",
    });
  }, [ready, pathname, setFilters]);

  const matrix = useMemo(
    () =>
      buildUtilizationMatrix(records, filters, {
        equipmentType,
        workPattern,
        metric,
        targetSettings,
        targetShotTable: shotSettings,
        startDate: monthRange.startDate,
        endDate: monthRange.endDate,
      }),
    [
      records,
      filters,
      equipmentType,
      workPattern,
      metric,
      targetSettings,
      shotSettings,
      monthRange.startDate,
      monthRange.endDate,
    ],
  );

  const overviewOptions = useMemo(
    () => ({
      workPattern,
      metric,
      targetSettings,
      targetShotTable: shotSettings,
      startDate: monthRange.startDate,
      endDate: monthRange.endDate,
    }),
    [
      workPattern,
      metric,
      targetSettings,
      shotSettings,
      monthRange.startDate,
      monthRange.endDate,
    ],
  );

  const { overview, trends: dailyTrends } = useMemo(
    () => buildUtilizationOverviewBundle(records, filters, overviewOptions),
    [records, filters, overviewOptions],
  );

  const productFilter = filters.productType;
  const grommetEmphasized =
    productFilter === "전체" || productFilter === "GROMMET";
  const sealEmphasized = productFilter === "전체" || productFilter === "SEAL";
  const injectionEmphasized =
    equipmentType === "전체" || equipmentType === "INJECTION";
  const pressEmphasized =
    equipmentType === "전체" || equipmentType === "PRESS";

  // 스크롤만 저장. metric 등을 cleanup에서 다시 patch하면 탭 전환 시 이전 값으로 덮어써 루프가 난다.
  useEffect(() => {
    if (!ready) return;
    const persist = persistRef.current;
    const onWindowScroll = () => {
      persist.scrollY = window.scrollY;
    };
    const onMatrixScroll = () => {
      persist.scrollX = scrollRef.current?.scrollLeft ?? 0;
    };
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    const el = scrollRef.current;
    el?.addEventListener("scroll", onMatrixScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onWindowScroll);
      el?.removeEventListener("scroll", onMatrixScroll);
      patch({
        scrollY: persist.scrollY,
        extra: { scrollX: persist.scrollX },
      });
    };
  }, [ready, patch, matrix.equipment.length]);

  const setExtra = useCallback(
    (patchExtra: Record<string, string | number | boolean | null>) => {
      patch({
        extra: {
          ...state.extra,
          metric,
          yearMonth,
          equipmentType,
          workPattern,
          ...patchExtra,
        },
      });
    },
    [patch, state.extra, metric, yearMonth, equipmentType, workPattern],
  );

  const setMetric = (next: UtilizationMetric) => {
    setSelected(null);
    setEditTargets(false);
    const nextWork: WorkPatternFilter =
      next === "time"
        ? isTimeWorkPattern(rawWorkPattern)
          ? rawWorkPattern
          : "전체"
        : isPerfWorkPattern(rawWorkPattern)
          ? rawWorkPattern
          : "전체";
    setExtra({ metric: next, workPattern: nextWork });
  };

  const applyYearMonth = (ym: string) => {
    setExtra({ yearMonth: ym });
  };

  const openEquipmentDetail = (equipmentId: string) => {
    const range = monthDateRange(yearMonth);
    setExtra({ yearMonth });
    router.push(
      withFromParam(
        withPeriodParams(
          `/equipment/${encodeURIComponent(equipmentId)}`,
          range.startDate,
          range.endDate,
        ),
        "utilization",
      ),
    );
  };

  const handleExcel = () => {
    try {
      exportUtilizationExcel(matrix, metric);
      pushToast(
        `Excel 파일 생성을 시작했습니다. (${
          metric === "time" ? "시간가동률" : "성능가동률"
        })`,
        "success",
      );
    } catch {
      pushToast("Excel 다운로드에 실패했습니다.", "error");
    }
  };

  const saveTargets = () => {
    saveTargetMinutes(targetSettings);
    setEditTargets(false);
    pushToast("목표 가동시간 설정을 저장했습니다.", "success");
  };

  const saveShotTargets = () => {
    saveTargetShotCounts(shotSettings);
    setEditTargets(false);
    pushToast("목표 작업판수 설정을 저장했습니다.", "success");
  };

  const updateTargetMinutes = (
    dayKind: TargetDayKind,
    key: WorkPattern,
    raw: string,
  ) => {
    const next: TargetMinutesSettings = {
      ...targetSettings,
      [dayKind]: {
        ...targetSettings[dayKind],
        [key]: Math.max(1, Number(raw) || 1),
      },
    };
    setTargetSettings(next);
    saveTargetMinutes(next);
  };

  const updateShotTarget = (
    product: ProductType,
    equipment: EquipmentType,
    shift: PerformanceShiftPattern,
    raw: string,
  ) => {
    const trimmed = raw.trim();
    let nextValue: number | null = null;
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (Number.isFinite(n) && n > 0) nextValue = Math.round(n);
    }
    const next: TargetShotCountTable = {
      ...shotSettings,
      [product]: {
        ...shotSettings[product],
        [equipment]: {
          ...shotSettings[product][equipment],
          [shift]: nextValue,
        },
      },
    };
    setShotSettings(next);
    saveTargetShotCounts(next);
  };

  const periodLabel = `${format(parseISO(monthRange.startDate), "yyyy.MM.dd")} ~ ${format(
    parseISO(monthRange.endDate),
    "yyyy.MM.dd",
  )}`;
  const monthLabel = format(parseISO(`${yearMonth}-01`), "yyyy년 M월");

  const footerEquipmentLabel =
    metric === "time" ? "설비별 시간가동률" : "설비별 성능가동률";
  const footerGrandLabel =
    metric === "time" ? "전체 시간가동률" : "전체 성능가동률";

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="가동률 분석"
        description="전체 종합 현황·제품·설비 요약 → 날짜 × 설비 히트맵"
        actions={
          <button type="button" className="btn" onClick={handleExcel}>
            Excel 다운로드
          </button>
        }
      />

      <QueryFilterShell
        title="조회조건"
        activeCount={
          (equipmentType !== "전체" ? 1 : 0) + (workPattern !== "전체" ? 1 : 0)
        }
        onReset={() => {
          resetDetail();
          setFilters({ equipmentIds: [] });
          const ym = defaultYearMonth();
          setExtra({
            yearMonth: ym,
            equipmentType: "전체",
            workPattern: "전체",
          });
          applyYearMonth(ym);
          pushToast("조회조건을 초기화했습니다.", "info");
        }}
      >
        <div className="query-filter-grid">
          <div className="query-filter-field">
            <p className="query-filter-label">조회월</p>
            <input
              type="month"
              className="query-filter-input"
              value={yearMonth}
              onChange={(e) => applyYearMonth(e.target.value)}
            />
            <p className="query-filter-hint">
              {monthLabel} ({periodLabel}) 기준 종합 현황 · 히트맵
            </p>
          </div>
          <div className="query-filter-field">
            <p className="query-filter-label">설비</p>
            <div className="filter-pills">
              {(
                [
                  { value: "전체" as const, label: "전체설비" },
                  { value: "PRESS" as const, label: "PRESS" },
                  { value: "INJECTION" as const, label: "INJECTION" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="filter-pill"
                  data-active={equipmentType === opt.value}
                  onClick={() => {
                    setFilters({ equipmentIds: [] });
                    setExtra({ equipmentType: opt.value });
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="query-filter-field">
            <p className="query-filter-label">
              {metric === "time" ? "근무형태" : "교대 구분"}
            </p>
            <div className="filter-pills">
              {(metric === "time"
                ? (["전체", "주간+야간", "주간", "야간"] as const)
                : (["전체", "주간+야간", "단일 교대"] as const)
              ).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className="filter-pill"
                  data-active={workPattern === opt}
                  onClick={() => setExtra({ workPattern: opt })}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </QueryFilterShell>

      <UtilizationOverviewPanel
        monthLabel={monthLabel}
        overview={overview}
        trends={dailyTrends}
        grommetEmphasized={grommetEmphasized}
        sealEmphasized={sealEmphasized}
        injectionEmphasized={injectionEmphasized}
        pressEmphasized={pressEmphasized}
      />

      <div className="util-metric-tabs mb-4" role="tablist" aria-label="가동률 구분">
        <button
          type="button"
          role="tab"
          className="util-metric-tab"
          aria-selected={metric === "time"}
          data-active={metric === "time"}
          onClick={() => setMetric("time")}
        >
          <span className="util-metric-tab-label">시간가동률</span>
          <span className="util-metric-tab-desc">유효 가동시간 ÷ 목표 가동시간</span>
        </button>
        <button
          type="button"
          role="tab"
          className="util-metric-tab"
          aria-selected={metric === "performance"}
          data-active={metric === "performance"}
          onClick={() => setMetric("performance")}
        >
          <span className="util-metric-tab-label">성능가동률</span>
          <span className="util-metric-tab-desc">작업판수 ÷ 목표 작업판수</span>
        </button>
      </div>

      <section className="card mb-4 p-4 md:p-5">
        {metric === "time" ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">목표 가동시간 기준</h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  평일·주말과 주간/야간/주간+야간에 따라 적용됩니다. 변경 값은
                  바로 저장되며 히트맵에 반영됩니다.
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="w-10 shrink-0 font-medium text-[var(--text-secondary)]">
                      평일
                    </span>
                    {WORK_PATTERN_KEYS.map((key) => (
                      <span key={`wd-${key}`}>
                        {key}{" "}
                        <strong className="num">
                          {formatNumber(targetSettings.weekday[key])}분
                        </strong>
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="w-10 shrink-0 font-medium text-[var(--text-secondary)]">
                      주말
                    </span>
                    {WORK_PATTERN_KEYS.map((key) => (
                      <span key={`we-${key}`}>
                        {key}{" "}
                        <strong className="num">
                          {formatNumber(targetSettings.weekend[key])}분
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditTargets((v) => !v)}
              >
                {editTargets ? "닫기" : "설정 변경"}
              </button>
            </div>
            {editTargets ? (
              <div className="mt-4 space-y-4">
                {(
                  [
                    { kind: "weekday" as const, label: "평일" },
                    { kind: "weekend" as const, label: "주말(토·일)" },
                  ] as const
                ).map((section) => (
                  <div key={section.kind}>
                    <p className="mb-2 text-sm font-semibold">{section.label}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {WORK_PATTERN_KEYS.map((key) => (
                        <label key={`${section.kind}-${key}`} className="text-sm">
                          <span className="mb-1 block text-xs text-[var(--text-secondary)]">
                            {key} (분)
                          </span>
                          <input
                            type="number"
                            min={1}
                            className="w-full rounded-[10px] border border-[var(--border)] bg-transparent px-3 py-2"
                            value={targetSettings[section.kind][key]}
                            onChange={(e) =>
                              updateTargetMinutes(
                                section.kind,
                                key,
                                e.target.value,
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveTargets}
                >
                  저장 후 닫기
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">목표 작업판수 기준</h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  SEAL·GROMMET PRESS 기본 240/120판. SEAL에는 INJECTION이 없습니다.
                  변경 값은 바로 저장·반영됩니다.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditTargets((v) => !v)}
              >
                {editTargets ? "닫기" : "설정 변경"}
              </button>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="data-table text-sm">
                <thead>
                  <tr>
                    <th>제품유형</th>
                    <th>설비유형</th>
                    <th>근무형태</th>
                    <th className="num">목표 작업판수</th>
                  </tr>
                </thead>
                <tbody>
                  {EDITABLE_SHOT_ROWS.map(({ product, equipment, shift }) => {
                    const value = shotSettings[product][equipment][shift];
                    return (
                      <tr key={`${product}-${equipment}-${shift}`}>
                        <td>{product}</td>
                        <td>{equipment}</td>
                        <td>{shift}</td>
                        <td className="num">
                          {editTargets ? (
                            <input
                              type="number"
                              min={1}
                              placeholder="미설정"
                              className="w-24 rounded-[8px] border border-[var(--border)] bg-transparent px-2 py-1 text-right"
                              value={value ?? ""}
                              onChange={(e) =>
                                updateShotTarget(
                                  product,
                                  equipment,
                                  shift,
                                  e.target.value,
                                )
                              }
                            />
                          ) : value != null ? (
                            `${formatNumber(value)}판`
                          ) : (
                            "목표 미설정"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {editTargets ? (
              <div className="mt-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveShotTargets}
                >
                  저장 후 닫기
                </button>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              주간·야간 DATA가 모두 있으면 주간+야간, 하나만 있으면 단일 교대
              목표를 적용합니다.
            </p>
          </div>
        )}

        <div className="util-legend mt-4">
          <span className="util-legend-item">
            <i className="util-swatch util-tone-blue" /> 95% 이상
          </span>
          <span className="util-legend-item">
            <i className="util-swatch util-tone-green" /> 90% 이상 ~ 95% 미만
          </span>
          <span className="util-legend-item">
            <i className="util-swatch util-tone-yellow" /> 80% 이상 ~ 90% 미만
          </span>
          <span className="util-legend-item">
            <i className="util-swatch util-tone-red" /> 0% 이상 ~ 80% 미만
          </span>
          <span className="util-legend-item">
            <i className="util-swatch util-tone-empty" /> 데이터 없음 · 목표 미설정
          </span>
        </div>
      </section>

      {matrix.equipment.length === 0 ? (
        <EmptyState
          title="표시할 설비가 없습니다."
          description="조회기간·공장·제품유형·설비유형 조건을 변경해 주세요."
          actionLabel="조회조건 초기화"
          onAction={() => {
            resetGlobal();
            setExtra({
              yearMonth: defaultYearMonth(),
              equipmentType: "전체",
              workPattern: "전체",
            });
          }}
        />
      ) : (
        <section aria-label="날짜 × 설비 가동률 히트맵">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-base font-bold">날짜 × 설비 가동률 히트맵</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {metric === "time" ? "시간가동률 상세" : "성능가동률 상세"} ·{" "}
              {equipmentType === "전체" ? "전체 설비" : equipmentType}
            </p>
          </div>
          <div className="util-matrix-wrap" ref={scrollRef}>
          <table className="util-matrix">
            <thead>
              <tr>
                <th className="util-sticky-corner" rowSpan={2}>
                  일자
                </th>
                {matrix.injection.length > 0 ? (
                  <th
                    className="util-group-head"
                    colSpan={matrix.injection.length}
                  >
                    INJECTION
                  </th>
                ) : null}
                {matrix.press.length > 0 ? (
                  <th
                    className="util-group-head util-group-press"
                    colSpan={matrix.press.length}
                  >
                    PRESS
                  </th>
                ) : null}
              </tr>
              <tr>
                {matrix.equipment.map((eq) => (
                  <th key={eq.id} className="util-eq-head">
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => openEquipmentDetail(eq.id)}
                    >
                      {eq.name}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.dates.map((date) => (
                <tr key={date}>
                  <th
                    className={`util-date-cell${getDateWeekdayClass(date)}`}
                  >
                    {formatMonthLabel(date)}
                  </th>
                  {matrix.equipment.map((eq) => {
                    const cell = getCell(matrix, date, eq.id);
                    return (
                      <HeatCell
                        key={`${date}-${eq.id}`}
                        cell={cell}
                        metric={metric}
                        onClick={() => {
                          if (cell?.hasData) setSelected(cell);
                        }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="util-date-cell">{footerEquipmentLabel}</th>
                {matrix.equipment.map((eq) => (
                  <SummaryCell
                    key={eq.id}
                    cell={matrix.equipmentTotals.get(eq.id)}
                    metric={metric}
                  />
                ))}
              </tr>
              <tr className="util-family-row">
                <th className="util-date-cell">호기 평균</th>
                {matrix.familyGroups.map((group) =>
                  group.isFamily ? (
                    <FamilyAverageCell
                      key={group.key}
                      label={group.label}
                      cell={group.total}
                      metric={metric}
                      colSpan={group.colSpan}
                    />
                  ) : (
                    <td
                      key={group.key}
                      className="util-cell util-tone-empty util-family-cell-empty"
                      colSpan={group.colSpan}
                    >
                      -
                    </td>
                  ),
                )}
              </tr>
              {matrix.injection.length > 0 ? (
                <tr>
                  <th className="util-date-cell">INJECTION</th>
                  <SummaryCell
                    cell={matrix.injectionTotal}
                    metric={metric}
                    colSpan={matrix.injection.length}
                  />
                  {matrix.press.length > 0 ? (
                    <td
                      colSpan={matrix.press.length}
                      className="util-cell util-tone-empty"
                    />
                  ) : null}
                </tr>
              ) : null}
              {matrix.press.length > 0 ? (
                <tr>
                  <th className="util-date-cell">PRESS</th>
                  {matrix.injection.length > 0 ? (
                    <td
                      colSpan={matrix.injection.length}
                      className="util-cell util-tone-empty"
                    />
                  ) : null}
                  <SummaryCell
                    cell={matrix.pressTotal}
                    metric={metric}
                    colSpan={matrix.press.length}
                  />
                </tr>
              ) : null}
              <tr className="util-grand-row">
                <th className="util-date-cell">{footerGrandLabel}</th>
                <td
                  className={`util-cell util-grand-cell util-tone-${
                    cellDisplay(matrix.grandTotal ?? undefined, metric).tone
                  }`}
                  colSpan={matrix.equipment.length}
                >
                  {cellDisplay(matrix.grandTotal ?? undefined, metric).label}
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        </section>
      )}

      {selected ? (
        <DetailModal
          cell={selected}
          metric={metric}
          onClose={() => setSelected(null)}
          onOpenEquipment={openEquipmentDetail}
        />
      ) : null}
    </>
  );
}
