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
import {
  normalizeReasonFlagsAll,
  type UploadSummary,
} from "@/lib/excelParse";
import {
  revalidateRecord,
  summarizeRecords,
  type ProductionRecordDraft,
} from "@/lib/recordValidate";
import { authorizeProductionUpdate } from "@/lib/admin/clientUpdate";
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
  updateRecord: (
    id: string,
    draft: ProductionRecordDraft,
    options: { reason: string },
  ) => Promise<ProductionRecord>;
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

const DEMO_RECORDS = normalizeReasonFlagsAll(ALL_RECORDS);

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DataSourceMode>("demo");
  const [records, setRecords] = useState<ProductionRecord[]>(DEMO_RECORDS);
  const [batch, setBatch] = useState<UploadBatch>(DEMO_BATCH);
  const [summary, setSummary] = useState<UploadSummary>(DEMO_SUMMARY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await idbGet<PersistedDataset>(IDB_PAYLOAD_KEY);
        if (!cancelled && saved?.mode === "uploaded" && saved.records?.length) {
          const normalized = normalizeReasonFlagsAll(saved.records);
          setMode("uploaded");
          setRecords(normalized);
          setBatch(saved.batch);
          setSummary(saved.summary);
          localStorage.setItem(SOURCE_KEY, "uploaded");
          // 예전 규칙으로 저장된 MTTR 플래그 교정 후 재저장
          void idbSet(IDB_PAYLOAD_KEY, { ...saved, records: normalized });
        } else {
          const flag =
            typeof window !== "undefined" ? localStorage.getItem(SOURCE_KEY) : null;
          if (flag === "uploaded") {
            localStorage.setItem(SOURCE_KEY, "demo");
          }
          setMode("demo");
          setRecords(DEMO_RECORDS);
          setBatch(DEMO_BATCH);
          setSummary(DEMO_SUMMARY);
        }
      } catch {
        if (!cancelled) {
          setMode("demo");
          setRecords(DEMO_RECORDS);
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
      const normalized = normalizeReasonFlagsAll(payload.records);
      const next: PersistedDataset = {
        mode: "uploaded",
        records: normalized,
        batch: payload.batch,
        summary: payload.summary,
      };
      await idbSet(IDB_PAYLOAD_KEY, next);
      localStorage.setItem(SOURCE_KEY, "uploaded");
      setMode("uploaded");
      setRecords(normalized);
      setBatch(payload.batch);
      setSummary(payload.summary);
    },
    [],
  );

  const updateRecord = useCallback(
    async (id: string, draft: ProductionRecordDraft, options: { reason: string }) => {
      const current = records.find((r) => r.id === id);
      if (!current) {
        throw new Error("수정할 행을 찾을 수 없습니다.");
      }

      const reason = options.reason.trim();
      if (!reason) {
        throw new Error("수정 사유를 입력해 주세요.");
      }

      const updated = revalidateRecord(
        {
          id: current.id,
          batchId: current.batchId,
          sourceRowNumber: current.sourceRowNumber,
        },
        draft,
      );

      await authorizeProductionUpdate({
        id,
        reason,
        before: current,
        after: updated,
      });

      const nextRecords = records.map((r) => (r.id === id ? updated : r));
      const nextSummary = summarizeRecords(nextRecords);
      const nextBatch: UploadBatch = {
        ...batch,
        sourceRowCount: nextRecords.length,
        validRowCount: nextSummary.valid,
        excludedRowCount: nextSummary.excluded,
        warningRowCount: nextSummary.warning,
      };

      setRecords(nextRecords);
      setSummary(nextSummary);
      setBatch(nextBatch);

      if (mode === "uploaded") {
        await idbSet(IDB_PAYLOAD_KEY, {
          mode: "uploaded",
          records: nextRecords,
          batch: nextBatch,
          summary: nextSummary,
        } satisfies PersistedDataset);
      }

      return updated;
    },
    [records, batch, mode],
  );

  const resetToDemo = useCallback(async () => {
    await idbDel(IDB_PAYLOAD_KEY);
    localStorage.setItem(SOURCE_KEY, "demo");
    setMode("demo");
    setRecords(DEMO_RECORDS);
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
      updateRecord,
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
      updateRecord,
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
