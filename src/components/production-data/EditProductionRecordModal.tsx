"use client";

import { useEffect, useState } from "react";
import type { ProductionRecord } from "@/types";
import { useDataSource } from "@/context/DataSourceContext";
import { useAdmin, AdminAuthError } from "@/context/AdminContext";
import { useToast } from "@/context/ToastContext";
import { ERROR_MESSAGES } from "@/types";
import {
  combineDateAndTime,
  elapsedMinutesFromRange,
  timeHmFromIso,
  type ProductionRecordDraft,
} from "@/lib/recordValidate";

type FormState = {
  factory: string;
  workDate: string;
  equipmentName: string;
  productType: string;
  partNumber: string;
  cavity: string;
  shotCount: string;
  defectQuantity: string;
  productionQuantity: string;
  operatorName: string;
  shiftType: string;
  moldNumber: string;
  startedAt: string;
  endedAt: string;
  elapsedMinutes: string;
  downtimeMinutes: string;
  downtimeReasonRaw: string;
  averageShot: string;
};

function recordToForm(record: ProductionRecord): FormState {
  return {
    factory: record.factory,
    workDate: record.workDate,
    equipmentName: record.equipmentName,
    productType: record.productType,
    partNumber: record.partNumber,
    cavity: String(record.cavity),
    shotCount: String(record.shotCount),
    defectQuantity: String(record.defectQuantity),
    productionQuantity: String(record.productionQuantity),
    operatorName: record.operatorName,
    shiftType: record.shiftType,
    moldNumber: record.moldNumber,
    startedAt: timeHmFromIso(record.startedAt),
    endedAt: timeHmFromIso(record.endedAt),
    elapsedMinutes: String(record.elapsedMinutes),
    downtimeMinutes: String(record.downtimeMinutes),
    downtimeReasonRaw: record.downtimeReasonRaw ?? "",
    averageShot:
      record.averageShot == null ? "" : String(Number(record.averageShot.toFixed(4))),
  };
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function formToDraft(
  form: FormState,
  averageShotManual: boolean,
): ProductionRecordDraft {
  const productionQuantity = parseOptionalNumber(form.productionQuantity) ?? 0;
  const shotCount = parseOptionalNumber(form.shotCount) ?? 0;
  let averageShot = parseOptionalNumber(form.averageShot);
  if (!averageShotManual) {
    averageShot =
      shotCount > 0 ? productionQuantity / shotCount : null;
  }

  return {
    factory: form.factory,
    workDate: form.workDate,
    equipmentName: form.equipmentName,
    productType: form.productType,
    partNumber: form.partNumber,
    cavity: parseOptionalNumber(form.cavity) ?? 0,
    shotCount,
    defectQuantity: parseOptionalNumber(form.defectQuantity) ?? 0,
    productionQuantity,
    operatorName: form.operatorName,
    shiftType: form.shiftType,
    moldNumber: form.moldNumber,
    startedAt: form.startedAt.trim() || null,
    endedAt: form.endedAt.trim() || null,
    elapsedMinutes: parseOptionalNumber(form.elapsedMinutes) ?? 0,
    downtimeMinutes: parseOptionalNumber(form.downtimeMinutes) ?? 0,
    downtimeReasonRaw: form.downtimeReasonRaw.trim() || null,
    averageShot,
  };
}

export function EditProductionRecordModal({
  record,
  onClose,
  source = "production",
}: {
  record: ProductionRecord;
  onClose: () => void;
  /** production = 생산 DATA에서 수정 / error = 오류 DATA에서 수정 */
  source?: "production" | "error";
}) {
  const { updateRecord } = useDataSource();
  const { setHasUnsavedEdits, markSessionExpired, openLogin } = useAdmin();
  const { pushToast } = useToast();
  const [form, setForm] = useState<FormState>(() => recordToForm(record));
  const [reason, setReason] = useState("");
  const [averageShotManual, setAverageShotManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const isErrorSource = source === "error";
  const title = isErrorSource ? "오류 DATA 수정" : "생산 DATA 수정";

  useEffect(() => {
    setHasUnsavedEdits(dirty);
    return () => setHasUnsavedEdits(false);
  }, [dirty, setHasUnsavedEdits]);

  const patch = (partial: Partial<FormState>) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, ...partial }));
  };

  const applyElapsedFromTimes = (
    next: FormState,
    startedAt: string,
    endedAt: string,
    workDate: string,
  ) => {
    const startIso = combineDateAndTime(workDate, startedAt);
    const endIso = combineDateAndTime(workDate, endedAt);
    const mins = elapsedMinutesFromRange(startIso, endIso);
    if (mins == null || mins < 0) return next;
    return { ...next, elapsedMinutes: String(mins) };
  };

  const applyAverageShot = (
    next: FormState,
    manual: boolean,
  ): FormState => {
    if (manual) return next;
    const production = parseOptionalNumber(next.productionQuantity);
    const shots = parseOptionalNumber(next.shotCount);
    if (production == null || shots == null || shots <= 0) {
      return { ...next, averageShot: "" };
    }
    return {
      ...next,
      averageShot: String(Number((production / shots).toFixed(4))),
    };
  };

  const onStartOrEndChange = (field: "startedAt" | "endedAt", value: string) => {
    setDirty(true);
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      return applyElapsedFromTimes(
        next,
        field === "startedAt" ? value : next.startedAt,
        field === "endedAt" ? value : next.endedAt,
        next.workDate,
      );
    });
  };

  const onWorkDateChange = (value: string) => {
    setDirty(true);
    setForm((prev) => {
      const next = { ...prev, workDate: value };
      return applyElapsedFromTimes(
        next,
        next.startedAt,
        next.endedAt,
        value,
      );
    });
  };

  const onQuantityChange = (
    field: "productionQuantity" | "shotCount",
    value: string,
  ) => {
    setDirty(true);
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      return applyAverageShot(next, averageShotManual);
    });
  };

  const requestClose = () => {
    if (dirty && !saving) {
      const ok = window.confirm(
        "저장하지 않은 변경사항이 있습니다. 수정을 취소하시겠습니까?",
      );
      if (!ok) return;
    }
    onClose();
  };

  const handleSave = async () => {
    if (!reason.trim()) {
      pushToast("수정 사유를 입력해 주세요.", "error");
      return;
    }
    setSaving(true);
    try {
      const draft = formToDraft(form, averageShotManual);
      const updated = await updateRecord(record.id, draft, {
        reason: reason.trim(),
      });
      setDirty(false);
      if (!updated.isAnalysisEligible) {
        const reasons = updated.errorCodes
          .map((c) => ERROR_MESSAGES[c] ?? c)
          .join(" · ");
        pushToast(
          isErrorSource
            ? `저장했습니다. 오류 조건이 남아 오류 DATA에 유지됩니다.${reasons ? ` (${reasons})` : ""}`
            : `생산 DATA가 수정되었습니다. 검증 오류로 분석에서 제외됩니다.${reasons ? ` (${reasons})` : ""} 오류 DATA 메뉴에서 확인하세요.`,
          "error",
        );
      } else if (updated.warningCodes.length > 0) {
        pushToast(
          isErrorSource
            ? "오류가 해소되어 경고 상태로 생산 DATA에 반영되었습니다."
            : "생산 DATA가 수정되었습니다. 경고 상태로 전체 분석 메뉴에 반영되었습니다.",
          "success",
        );
      } else {
        pushToast(
          isErrorSource
            ? "오류가 해소되어 정상 상태로 생산 DATA에 반영되었습니다."
            : "생산 DATA가 수정되었습니다. 변경 내용이 전체 분석 메뉴에 반영되었습니다.",
          "success",
        );
      }
      onClose();
    } catch (err) {
      if (err instanceof AdminAuthError) {
        markSessionExpired();
        pushToast(err.message, "error");
        openLogin();
      } else {
        pushToast(
          err instanceof Error ? err.message : "저장에 실패했습니다.",
          "error",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="util-modal-backdrop" onClick={requestClose} role="presentation">
      <div
        className="util-modal util-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              원본 행 {record.sourceRowNumber} · 저장 시 재검증 후{" "}
              {isErrorSource
                ? "정상·경고면 생산 DATA로 이동"
                : "전체 메뉴에 반영"}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={requestClose}>
            닫기
          </button>
        </div>

        {isErrorSource && record.errorCodes.length > 0 ? (
          <div className="mb-4 rounded-[12px] border border-[color-mix(in_srgb,var(--error)_35%,var(--border))] bg-[color-mix(in_srgb,var(--error)_8%,transparent)] px-3 py-2 text-sm">
            <p className="font-semibold text-[var(--error)]">현재 오류 사유</p>
            <p className="mt-1 text-[var(--text-secondary)]">
              {record.errorCodes.map((c) => ERROR_MESSAGES[c] ?? c).join(" · ")}
            </p>
          </div>
        ) : null}

        <div className="pd-edit-grid">
          <label className="pd-edit-field">
            <span>공장</span>
            <select
              value={form.factory}
              onChange={(e) => patch({ factory: e.target.value })}
            >
              <option value="본사">본사</option>
              <option value="2공장">2공장</option>
            </select>
          </label>
          <label className="pd-edit-field">
            <span>작업일자</span>
            <input
              type="date"
              value={form.workDate}
              onChange={(e) => onWorkDateChange(e.target.value)}
            />
          </label>
          <label className="pd-edit-field">
            <span>설비명</span>
            <input
              value={form.equipmentName}
              onChange={(e) => patch({ equipmentName: e.target.value })}
            />
          </label>
          <label className="pd-edit-field">
            <span>제품유형</span>
            <select
              value={form.productType}
              onChange={(e) => patch({ productType: e.target.value })}
            >
              <option value="GROMMET">GROMMET</option>
              <option value="SEAL">SEAL</option>
            </select>
          </label>
          <label className="pd-edit-field">
            <span>품번</span>
            <input
              value={form.partNumber}
              onChange={(e) => patch({ partNumber: e.target.value })}
            />
          </label>
          <label className="pd-edit-field">
            <span>작업자</span>
            <input
              value={form.operatorName}
              onChange={(e) => patch({ operatorName: e.target.value })}
            />
          </label>
          <label className="pd-edit-field">
            <span>근무 구분</span>
            <select
              value={form.shiftType}
              onChange={(e) => patch({ shiftType: e.target.value })}
            >
              <option value="주간">주간</option>
              <option value="야간">야간</option>
            </select>
          </label>
          <label className="pd-edit-field">
            <span>금형번호</span>
            <input
              value={form.moldNumber}
              onChange={(e) => patch({ moldNumber: e.target.value })}
            />
          </label>

          <label className="pd-edit-field">
            <span>Cavity</span>
            <input
              inputMode="numeric"
              value={form.cavity}
              onChange={(e) => patch({ cavity: e.target.value })}
            />
          </label>
          <label className="pd-edit-field">
            <span>작업판수</span>
            <input
              inputMode="numeric"
              value={form.shotCount}
              onChange={(e) => onQuantityChange("shotCount", e.target.value)}
            />
          </label>
          <label className="pd-edit-field">
            <span>불량수량</span>
            <input
              inputMode="numeric"
              value={form.defectQuantity}
              onChange={(e) => patch({ defectQuantity: e.target.value })}
            />
          </label>
          <label className="pd-edit-field">
            <span>실적수량</span>
            <input
              inputMode="numeric"
              value={form.productionQuantity}
              onChange={(e) =>
                onQuantityChange("productionQuantity", e.target.value)
              }
            />
          </label>
          <label className="pd-edit-field">
            <span>평균 SHOT</span>
            <input
              inputMode="decimal"
              value={form.averageShot}
              onChange={(e) => {
                setAverageShotManual(true);
                patch({ averageShot: e.target.value });
              }}
            />
          </label>

          <label className="pd-edit-field">
            <span>시작시간</span>
            <input
              type="time"
              value={form.startedAt}
              onChange={(e) => onStartOrEndChange("startedAt", e.target.value)}
            />
          </label>
          <label className="pd-edit-field">
            <span>종료시간</span>
            <input
              type="time"
              value={form.endedAt}
              onChange={(e) => onStartOrEndChange("endedAt", e.target.value)}
            />
          </label>
          <label className="pd-edit-field">
            <span>작업시간(분)</span>
            <input
              inputMode="numeric"
              value={form.elapsedMinutes}
              onChange={(e) => patch({ elapsedMinutes: e.target.value })}
            />
          </label>
          <label className="pd-edit-field">
            <span>비가동시간(분)</span>
            <input
              inputMode="numeric"
              value={form.downtimeMinutes}
              onChange={(e) => patch({ downtimeMinutes: e.target.value })}
            />
          </label>
          <label className="pd-edit-field pd-edit-field-span">
            <span>비가동내역</span>
            <input
              value={form.downtimeReasonRaw}
              onChange={(e) => patch({ downtimeReasonRaw: e.target.value })}
              placeholder="예: 금형교체, 설비이상"
            />
          </label>
          <label className="pd-edit-field pd-edit-field-span">
            <span>수정 사유 (필수)</span>
            <input
              value={reason}
              onChange={(e) => {
                setDirty(true);
                setReason(e.target.value);
              }}
              placeholder="예: 실적수량 오기입 정정"
              required
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-[var(--text-secondary)]">
          시작·종료 시간을 바꾸면 작업시간이 자동 계산됩니다. 종료가 시작보다
          이르면 익일 종료(야간)로 처리합니다. 저장 시 관리자 세션이 서버에서
          검증됩니다.
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={requestClose} disabled={saving}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={saving || !reason.trim()}
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
