"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { DataErrorsPanel } from "@/components/all-data/DataErrorsPanel";
import { IntegratedDataPanel } from "@/components/all-data/IntegratedDataPanel";
import { ProductionDataPanel } from "@/components/all-data/ProductionDataPanel";
import { PageHeader } from "@/components/ui/PageBits";
import { useDataSource } from "@/context/DataSourceContext";
import { useFilters } from "@/context/FilterContext";
import { type AllDataTab } from "@/lib/allDataRoutes";
import { formatNumber } from "@/lib/format";
import { filterRecords } from "@/lib/metrics";

const TABS: Array<{
  id: AllDataTab;
  label: string;
  hint: string;
  tone: "all" | "ok" | "error";
  Icon: LucideIcon;
}> = [
  {
    id: "integrated",
    label: "통합 DATA",
    hint: "정상+오류 전체",
    tone: "all",
    Icon: Layers,
  },
  {
    id: "production",
    label: "생산 DATA",
    hint: "분석 대상 정상",
    tone: "ok",
    Icon: CheckCircle2,
  },
  {
    id: "errors",
    label: "오류 DATA",
    hint: "분석 제외",
    tone: "error",
    Icon: AlertTriangle,
  },
];

function parseTab(raw: string | null): AllDataTab {
  if (raw === "errors" || raw === "error") return "errors";
  if (raw === "production" || raw === "ok") return "production";
  return "integrated";
}

export default function AllDataPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { records } = useDataSource();
  const { filters } = useFilters();
  const tab = useMemo(
    () => parseTab(searchParams.get("tab")),
    [searchParams],
  );

  const counts = useMemo(() => {
    const inPeriod = filterRecords(records, filters, { includeErrors: true });
    return {
      integrated: inPeriod.length,
      production: inPeriod.filter((r) => r.isAnalysisEligible).length,
      errors: inPeriod.filter((r) => !r.isAnalysisEligible).length,
    };
  }, [filters, records]);

  const setTab = useCallback(
    (next: AllDataTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <>
      <PageHeader title="전체 DATA" />

      <div className="all-data-tabs-bar mb-4">
        <span className="all-data-tabs-bar__label">DATA 구분</span>
        <div
          className="all-data-tabs"
          role="tablist"
          aria-label="전체 DATA 구분"
        >
          {TABS.map(({ id, label, hint, tone, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                className="all-data-tab"
                data-tone={tone}
                data-active={active}
                aria-selected={active}
                onClick={() => setTab(id)}
              >
                <span className="all-data-tab__icon" aria-hidden>
                  <Icon size={15} strokeWidth={2.25} />
                </span>
                <span className="all-data-tab__copy">
                  <span className="all-data-tab__label">{label}</span>
                  <span className="all-data-tab__hint">{hint}</span>
                </span>
                <span className="all-data-tab__count">
                  {formatNumber(counts[id])}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        {tab === "production" ? <ProductionDataPanel /> : null}
        {tab === "errors" ? <DataErrorsPanel /> : null}
        {tab === "integrated" ? <IntegratedDataPanel /> : null}
      </div>
    </>
  );
}
