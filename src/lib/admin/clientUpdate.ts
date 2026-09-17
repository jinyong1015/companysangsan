import type { ProductionRecord } from "@/types";
import type { ProductionRecordDraft } from "@/lib/recordValidate";
import { AdminAuthError } from "@/lib/admin/errors";

const SNAPSHOT_KEYS = [
  "factory",
  "workDate",
  "equipmentName",
  "productType",
  "partNumber",
  "cavity",
  "shotCount",
  "defectQuantity",
  "productionQuantity",
  "operatorName",
  "shiftType",
  "moldNumber",
  "startedAt",
  "endedAt",
  "elapsedMinutes",
  "downtimeMinutes",
  "downtimeReasonRaw",
  "averageShot",
] as const;

export type RecordSnapshot = Record<(typeof SNAPSHOT_KEYS)[number], unknown>;

export function snapshotRecord(
  record: ProductionRecord | ProductionRecordDraft,
): RecordSnapshot {
  const out = {} as RecordSnapshot;
  for (const key of SNAPSHOT_KEYS) {
    out[key] = (record as Record<string, unknown>)[key] ?? null;
  }
  return out;
}

export function diffRecordFields(
  before: RecordSnapshot,
  after: RecordSnapshot,
): string[] {
  return SNAPSHOT_KEYS.filter((key) => {
    const a = before[key];
    const b = after[key];
    return JSON.stringify(a) !== JSON.stringify(b);
  });
}

export async function authorizeProductionUpdate(input: {
  id: string;
  reason: string;
  before: ProductionRecord;
  after: ProductionRecord;
}): Promise<void> {
  const beforeSnap = snapshotRecord(input.before);
  const afterSnap = snapshotRecord(input.after);
  const fields = diffRecordFields(beforeSnap, afterSnap);

  const res = await fetch(`/api/production-data/${encodeURIComponent(input.id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: input.reason,
      before: beforeSnap,
      after: afterSnap,
      fields,
      statusBefore: {
        isAnalysisEligible: input.before.isAnalysisEligible,
        errorCodes: input.before.errorCodes,
      },
      statusAfter: {
        isAnalysisEligible: input.after.isAnalysisEligible,
        errorCodes: input.after.errorCodes,
      },
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    message?: string;
  } | null;

  if (res.status === 401 || res.status === 403) {
    throw new AdminAuthError(
      data?.message ??
        "관리자 세션이 만료되었습니다. 생산 DATA를 수정하려면 다시 로그인해 주세요.",
    );
  }

  if (!res.ok) {
    throw new Error(data?.message ?? "수정 권한이 없거나 저장에 실패했습니다.");
  }
}
