"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ACTIVE_BATCH, ALL_RECORDS, FILTER_OPTIONS as SEED_FILTER_OPTIONS } from "@/data/mock";
import { buildFilterOptions, type FilterOption } from "@/lib/dimensions";
import { idbDel, idbGet, idbSet } from "@/lib/idb";
import type { UploadSummary } from "@/lib/excelParse";
import type { ProductionRecord, UploadBatch } from "@/types";

const SOURCE_KEY = "production-analytics-data-source";
const IDB_PAYLOAD_KEY = "uploaded-dataset";

export type DataSourceMode = "demo" | "uploaded";

export type PersistedDataset = {
  mode: "uploaded";
  records: ProductionRecord[];
  batch: UploadBatch;
  summary: UploadSummary;
};

interface DataSourceContextValue {
  mode: DataSourceMode;
  isDemo: boolean;
  records: ProductionRecord[];
  batch: UploadBatch;
  summary: UploadSummary;
  filterOptions: {
    equipment: FilterOption[];
    parts: FilterOption[];
    operators: FilterOption[];
    molds: FilterOption[];
  };
  lastFileName: string | null;
  activateUploaded: (payload: {
    records: ProductionRecord[];
    batch: UploadBatch;
    summary: UploadSummary;
  }) => Promise<void>;
  resetToDemo: () => Promise<void>;
}

const DataSourceContext = createContext<DataSourceContextValue | null>(null);

const DEMO_SUMMARY: UploadSummary = {
  total: ACTIVE_BATCH.sourceRowCount,
  valid: ACTIVE_BATCH.validRowCount,
  warning: ACTIVE_BATCH.warningRowCount,
  error: ACTIVE_BATCH.excludedRowCount,
  excluded: ACTIVE_BATCH.excludedRowCount,
};

const DEMO_BATCH: UploadBatch = {
  ...ACTIVE_BATCH,
  id: "batch-demo",
  originalFileName: "가데이터 (샘플)",
  activatedAt: null,
};

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DataSourceMode>("demo");
  const [records, setRecords] = useState<ProductionRecord[]>(ALL_RECORDS);
  const [batch, setBatch] = useState<UploadBatch>(DEMO_BATCH);
  const [summary, setSummary] = useState<UploadSummary>(DEMO_SUMMARY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await idbGet<PersistedDataset>(IDB_PAYLOAD_KEY);
        if (!cancelled && saved?.mode === "uploaded" && saved.records?.length) {
          setMode("uploaded");
          setRecords(saved.records);
          setBatch(saved.batch);
          setSummary(saved.summary);
          localStorage.setItem(SOURCE_KEY, "uploaded");
        } else {
          const flag =
            typeof window !== "undefined" ? localStorage.getItem(SOURCE_KEY) : null;
          if (flag === "uploaded") {
            localStorage.setItem(SOURCE_KEY, "demo");
          }
          setMode("demo");
          setRecords(ALL_RECORDS);
          setBatch(DEMO_BATCH);
          setSummary(DEMO_SUMMARY);
        }
      } catch {
        if (!cancelled) {
          setMode("demo");
          setRecords(ALL_RECORDS);
          setBatch(DEMO_BATCH);
          setSummary(DEMO_SUMMARY);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activateUploaded = useCallback(
    async (payload: {
      records: ProductionRecord[];
      batch: UploadBatch;
      summary: UploadSummary;
    }) => {
      const next: PersistedDataset = {
        mode: "uploaded",
        records: payload.records,
        batch: payload.batch,
        summary: payload.summary,
      };
      await idbSet(IDB_PAYLOAD_KEY, next);
      localStorage.setItem(SOURCE_KEY, "uploaded");
      setMode("uploaded");
      setRecords(payload.records);
      setBatch(payload.batch);
      setSummary(payload.summary);
    },
    [],
  );

  const resetToDemo = useCallback(async () => {
    await idbDel(IDB_PAYLOAD_KEY);
    localStorage.setItem(SOURCE_KEY, "demo");
    setMode("demo");
    setRecords(ALL_RECORDS);
    setBatch(DEMO_BATCH);
    setSummary(DEMO_SUMMARY);
  }, []);

  const isDemo = mode === "demo";

  const filterOptions = useMemo(() => {
    if (isDemo) return SEED_FILTER_OPTIONS;
    return buildFilterOptions(records);
  }, [isDemo, records]);

  const value = useMemo(
    () => ({
      mode,
      isDemo,
      records,
      batch,
      summary,
      filterOptions,
      lastFileName: isDemo ? null : batch.originalFileName,
      activateUploaded,
      resetToDemo,
    }),
    [
      mode,
      isDemo,
      records,
      batch,
      summary,
      filterOptions,
      activateUploaded,
      resetToDemo,
    ],
  );

  if (!ready) {
    return <div className="min-h-screen bg-[var(--app-bg)]" />;
  }

  return (
    <DataSourceContext.Provider value={value}>{children}</DataSourceContext.Provider>
  );
}

export function useDataSource() {
  const ctx = useContext(DataSourceContext);
  if (!ctx) throw new Error("useDataSource must be used within DataSourceProvider");
  return ctx;
}
