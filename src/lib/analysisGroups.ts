import type {
  GlobalFilters,
  KpiSummary,
  ProductionRecord,
  ProductType,
} from "@/types";
import { computeKpi, filterRecords } from "@/lib/metrics";

export type AnalysisGroupId = "seal" | "grommet";

export type AnalysisGroupDef = {
  id: AnalysisGroupId;
  label: string;
  productType: ProductType;
  color: string;
};

export const ANALYSIS_GROUPS: AnalysisGroupDef[] = [
  {
    id: "seal",
    label: "SEAL",
    productType: "SEAL",
    color: "var(--seal)",
  },
  {
    id: "grommet",
    label: "GROMMET",
    productType: "GROMMET",
    color: "var(--grommet)",
  },
];

export type AnalysisGroupRow = AnalysisGroupDef & {
  kpi: KpiSummary;
  productionSharePercent: number;
  defectRateAboveTotal: boolean;
};

export type AnalysisGroupBundle = {
  total: KpiSummary;
  groups: AnalysisGroupRow[];
  selectedLabel: string | null;
};

export function resolveSelectedAnalysisGroup(
  filters: GlobalFilters,
): AnalysisGroupDef | null {
  return (
    ANALYSIS_GROUPS.find((g) => filters.productType === g.productType) ?? null
  );
}

/** 기간·공장·상세 필터는 유지하고 제품유형(SEAL/GROMMET)만 그룹별로 집계 */
export function buildAnalysisGroupBundle(
  records: ProductionRecord[],
  filters: GlobalFilters,
): AnalysisGroupBundle {
  const base: GlobalFilters = {
    ...filters,
    productType: "전체",
  };
  const total = computeKpi(filterRecords(records, base));
  const productionTotal = total.productionQuantity || 1;

  const groups: AnalysisGroupRow[] = ANALYSIS_GROUPS.map((group) => {
    const kpi = computeKpi(
      filterRecords(records, {
        ...base,
        productType: group.productType,
      }),
    );
    return {
      ...group,
      kpi,
      productionSharePercent: (kpi.productionQuantity / productionTotal) * 100,
      defectRateAboveTotal:
        kpi.defectRatePercent != null &&
        total.defectRatePercent != null &&
        kpi.defectRatePercent > total.defectRatePercent,
    };
  });

  const selected = resolveSelectedAnalysisGroup(filters);

  return {
    total,
    groups,
    selectedLabel: selected?.label ?? null,
  };
}
