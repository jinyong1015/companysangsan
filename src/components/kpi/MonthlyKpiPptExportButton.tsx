"use client";

import { useState } from "react";
import { LoaderCircle, Lock, Presentation } from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import { useToast } from "@/context/ToastContext";
import { buildMonthlyKpiPptSnapshot } from "@/lib/ppt/buildMonthlyKpiPptSnapshot";
import { downloadBlob, fillMonthlyKpiPpt } from "@/lib/ppt/fillMonthlyKpiPpt";
import type {
  EquipmentType,
  GlobalFilters,
  ProductionRecord,
  WorkPattern,
} from "@/types";

export function MonthlyKpiPptExportButton({
  yearMonth,
  records,
  filters,
  workPattern = "전체",
  equipmentType = "전체",
}: {
  yearMonth: string;
  records: ProductionRecord[];
  filters: GlobalFilters;
  workPattern?: WorkPattern | "전체";
  equipmentType?: "전체" | EquipmentType;
}) {
  const { isAdmin, openLogin } = useAdmin();
  const { pushToast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (busy) return;
    if (!isAdmin) {
      pushToast("PPT 내보내기는 관리자 로그인 후 사용할 수 있습니다.", "info");
      openLogin();
      return;
    }
    setBusy(true);
    try {
      const partNumbers = [
        ...new Set(
          records
            .map((r) => String(r.partNumber ?? "").replace(/\u00a0/g, " ").trim())
            .filter(Boolean),
        ),
      ];
      let priceByPart = new Map<string, number>();
      if (partNumbers.length) {
        try {
          const res = await fetch("/api/product-prices/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ partNumbers }),
          });
          const data = (await res.json()) as {
            ok?: boolean;
            prices?: Record<string, number>;
          };
          if (data.ok && data.prices) {
            priceByPart = new Map(Object.entries(data.prices));
          }
        } catch {
          // 단가 조회 실패 시 금액 0으로 진행
        }
      }
      const snapshot = buildMonthlyKpiPptSnapshot({
        yearMonth,
        records,
        filters,
        workPattern,
        equipmentType,
        priceByPart,
      });
      const blob = await fillMonthlyKpiPpt(snapshot);
      downloadBlob(blob, snapshot.fileName);
      pushToast(`PPT 다운로드를 시작했습니다. (${snapshot.fileName})`, "success");
    } catch (err) {
      console.error(err);
      pushToast(
        "PPT 생성 중 오류가 발생했습니다. 데이터를 확인한 후 다시 시도해주세요.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="ppt-export-btn"
      disabled={busy}
      aria-busy={busy}
      data-locked={isAdmin ? "false" : "true"}
      title={
        isAdmin
          ? undefined
          : "PPT 내보내기는 관리자 모드에서만 가능합니다."
      }
      onClick={() => {
        void handleExport();
      }}
    >
      <span className="ppt-export-btn__icon" aria-hidden>
        {busy ? (
          <LoaderCircle size={16} className="ppt-export-spin" />
        ) : (
          <Presentation size={16} strokeWidth={2.25} />
        )}
      </span>
      <span className="ppt-export-btn__copy">
        <span className="ppt-export-btn__label">
          {busy ? "PPT 생성 중" : "PPT 내보내기"}
          {!isAdmin && !busy ? (
            <Lock size={12} className="ppt-export-btn__lock" aria-hidden />
          ) : null}
        </span>
        <span className="ppt-export-btn__hint">
          {busy
            ? "잠시만 기다려 주세요"
            : isAdmin
              ? "월별 KPI 보고서"
              : "관리자 로그인 필요"}
        </span>
      </span>
    </button>
  );
}
