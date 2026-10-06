import type {
  EquipmentFamilyMttrMtbfSummaryTable,
  PeriodReasonTable,
} from "@/lib/downtimeDetail";
import type { MonthlyDashboardPoint } from "@/lib/metrics";
import type {
  EquipmentUtilizationByProduct,
  UtilizationOverview,
} from "@/lib/utilization";
import type { ProductType } from "@/types";

export type PptKpiRow = {
  yearMonth: string;
  monthNum: number;
  label: string;
  oee: number | null;
  performance: number | null;
  time: number | null;
  yieldRate: number | null;
  mttr: number | null;
  mtbf: number | null;
};

export type PptEqUtilRow = {
  label: string;
  performancePercent: number | null;
  timePercent: number | null;
};

export type PptEqMttrRow = {
  label: string;
  mttrMinutes: number | null;
  mtbfHours: number | null;
};

export type PptProdMonthSummary = {
  yearMonth: string;
  monthNum: number;
  partKindCount: number;
  productionQuantity: number;
  avgShot: number;
  dailyAvgShots: number;
};

export type PptRankRow = {
  name: string;
  value: number;
  sharePercent: number;
};

export type PptEfficiencySummary = {
  elapsedMinutes: number;
  operatingMinutes: number;
  shotCount: number;
  dailyAvgShots: number;
  downtimeTop: PptRankRow[];
  workTimeTop: PptRankRow[];
};

export type MonthlyKpiPptSnapshot = {
  yearMonth: string;
  previousYearMonth: string;
  year: number;
  month: number;
  monthLabel: string;
  fileName: string;
  /** 전체 종합 KPI (전월·당월) */
  kpiPrev: PptKpiRow;
  kpiCurrent: PptKpiRow;
  /** GROMMET / SEAL 범위 KPI (슬라이드 3~5 월 표기·지표) */
  kpiPrevGrommet: PptKpiRow;
  kpiCurrentGrommet: PptKpiRow;
  kpiPrevSeal: PptKpiRow;
  kpiCurrentSeal: PptKpiRow;
  overview: UtilizationOverview;
  equipmentByProduct: EquipmentUtilizationByProduct;
  mttrMtbfSummary: EquipmentFamilyMttrMtbfSummaryTable;
  downtime: Record<
    ProductType,
    { current: PeriodReasonTable; previous: PeriodReasonTable }
  >;
  /** 전년 12월~당해 12월 추이 (설비라인 기준 — 비가동, 조회월 이후 값은 NaN) */
  monthlyTrends: Record<
    ProductType | "ALL",
    {
      downtimeMinutes: number[];
      productionQuantity: number[];
      partKindCount: number[];
      avgShot: number[];
      labels: string[];
      queryMonthIndex: number;
    }
  >;
  /** 전년 12월~당해 12월 추이 (productType 기준 — 생산변동, 조회월 이후 값은 NaN) */
  productionTrends: Record<
    ProductType,
    {
      productionQuantity: number[];
      partKindCount: number[];
      avgShot: number[];
      labels: string[];
      queryMonthIndex: number;
    }
  >;
  productionSummary: Record<
    ProductType,
    { previous: PptProdMonthSummary; current: PptProdMonthSummary }
  >;
  dailyProduction: Record<
    ProductType,
    { days: number[]; quantities: number[] }
  >;
  partQtyTop: Record<ProductType, PptRankRow[]>;
  operatorQtyTop: Record<ProductType, PptRankRow[]>;
  efficiency: Record<ProductType, PptEfficiencySummary>;
  dailyTrendPoints: Record<ProductType, MonthlyDashboardPoint[]>;
};
