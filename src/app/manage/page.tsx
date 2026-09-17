"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Upload,
} from "lucide-react";
import { useDataSource } from "@/context/DataSourceContext";
import { useFilters } from "@/context/FilterContext";
import { useToast } from "@/context/ToastContext";
import { ALL_RECORDS } from "@/data/mock";
import { dateRangeFromRecords } from "@/lib/dimensions";
import {
  buildSampleWorkbookBuffer,
  downloadArrayBuffer,
  parseProductionExcel,
} from "@/lib/excelParse";
import { formatNumber, formatPercent } from "@/lib/format";
import { computeKpi } from "@/lib/metrics";
import { ERROR_MESSAGES, type ErrorCode } from "@/types";

type Stage = "idle" | "parsing" | "done" | "error";

export default function ManagePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { pushToast } = useToast();
  const { resetAllAfterActivation, setFilters } = useFilters();
  const { isDemo, batch, summary, records, activateUploaded, resetToDemo } =
    useDataSource();

  const [localName, setLocalName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [progressLabel, setProgressLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasUploadedData = !isDemo;
  const uploading = stage === "parsing";
  const showResult = hasUploadedData || stage === "done";

  const qualityScore = useMemo(() => {
    if (summary.total <= 0) return 0;
    return Math.round((summary.valid / summary.total) * 100);
  }, [summary.total, summary.valid]);

  const qualityChecks = useMemo(() => {
    const codes = Object.keys(ERROR_MESSAGES) as ErrorCode[];
    return codes.map((code) => ({
      label: ERROR_MESSAGES[code].replace(/\.$/, ""),
      count: records.filter((r) => r.errorCodes.includes(code)).length,
    }));
  }, [records]);

  const kpi = useMemo(
    () => computeKpi(records.filter((r) => r.isAnalysisEligible)),
    [records],
  );

  const applyUpload = useCallback(
    async (file: File) => {
      const ext = file.name.toLowerCase();
      if (!ext.endsWith(".xls") && !ext.endsWith(".xlsx")) {
        pushToast(
          "지원하지 않는 파일 형식입니다. .xls 또는 .xlsx 파일을 선택해 주세요.",
          "error",
        );
        return;
      }

      setLocalName(file.name);
      setStage("parsing");
      setErrorMessage(null);
      setProgressLabel("파일 구조 검증 · 컬럼 매핑 · 중복/누락/타입 검사 중…");

      try {
        await wait(200);
        setProgressLabel("컬럼 확인 · 헤더 자동 인식");
        await wait(250);
        setProgressLabel("검증 · 오류 차단(#N/A 포함) / 경고 확인");

        const parsed = await parseProductionExcel(file);

        setProgressLabel("저장 · Dashboard 갱신");
        await activateUploaded({
          records: parsed.records,
          batch: parsed.batch,
          summary: parsed.summary,
        });
        resetAllAfterActivation();

        const range = dateRangeFromRecords(
          parsed.records.filter((r) => r.isAnalysisEligible),
        );
        if (range) {
          setFilters({
            datePreset: "custom",
            startDate: range.startDate,
            endDate: range.endDate,
          });
        }

        setStage("done");
        setProgressLabel("");
        pushToast(
          `${file.name} 반영 완료 · 분석 ${formatNumber(parsed.summary.valid)}건`,
          "success",
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "업로드 처리 중 오류가 발생했습니다.";
        setStage("error");
        setErrorMessage(message);
        setProgressLabel("");
        pushToast(message, "error");
      }
    },
    [activateUploaded, pushToast, resetAllAfterActivation, setFilters],
  );

  const handleFile = async (file: File) => {
    await applyUpload(file);
  };

  const handleSampleDownload = () => {
    const buffer = buildSampleWorkbookBuffer(ALL_RECORDS);
    downloadArrayBuffer(buffer, "성형작업일보_샘플.xlsx");
    pushToast("샘플 엑셀 다운로드를 시작했습니다.", "info");
  };

  const handleRestoreSeed = async () => {
    if (isDemo) {
      pushToast("이미 시드(가데이터) 상태입니다.", "info");
      return;
    }
    await resetToDemo();
    resetAllAfterActivation();
    setLocalName(null);
    setStage("idle");
    setErrorMessage(null);
    pushToast("시드(가데이터)로 복원했습니다.", "success");
  };

  const showFileCard = Boolean(localName || uploading || hasUploadedData || stage === "done");

  return (
    <div className="space-y-5">
      <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-[26px]">
            데이터 업로드
          </h1>
          <p className="mt-1 text-sm text-muted">
            Excel 선택 → 컬럼 확인 → 검증 → 오류 차단(#N/A 포함) / 경고 확인 → 저장 → Dashboard
            갱신
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSampleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas"
          >
            <Download size={14} />
            샘플 엑셀 다운로드
          </button>
          {hasUploadedData ? (
            <button
              type="button"
              onClick={() => void handleRestoreSeed()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas"
            >
              <RotateCcw size={14} />
              시드 데이터로 복원
            </button>
          ) : null}
        </div>
      </div>

      <section className="card min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">Excel Upload</h2>
          </div>
        </div>
        <div className="min-w-0 p-5">
          <div
            role="button"
            tabIndex={0}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center transition ${
              dragging
                ? "border-accent/60 bg-accent-soft"
                : "border-line bg-canvas/70 hover:border-accent/40"
            }`}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Upload size={22} />
            </div>
            <p className="text-sm font-medium">엑셀 파일을 드래그하거나 클릭하여 업로드</p>
            <p className="mt-1 text-xs text-muted">
              .xlsx, .xls · 성형작업일보 · 헤더 자동 인식
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {showFileCard ? (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
              <FileSpreadsheet size={18} className="text-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {localName ?? batch.originalFileName ?? "파일"}
                </p>
                <p className="text-xs text-muted">
                  {uploading
                    ? progressLabel ||
                      "파일 구조 검증 · 컬럼 매핑 · 중복/누락/타입 검사 중…"
                    : stage === "error"
                      ? "오류로 업로드 차단됨"
                      : hasUploadedData
                        ? `업로드 완료 · 분석 레코드 ${formatNumber(summary.valid)}건 반영`
                        : "대기 중"}
                </p>
              </div>
              {!uploading && hasUploadedData && stage !== "error" ? (
                <CheckCircle2 size={18} className="text-ok" />
              ) : null}
              {!uploading && stage === "error" ? (
                <AlertTriangle size={18} className="text-danger" />
              ) : null}
            </div>
          ) : null}

          {errorMessage ? (
            <p className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </section>

      {showResult ? (
        <>
          <div className="grid-kpi">
            {[
              ["정상", summary.valid, "text-ok"],
              ["경고", summary.warning, "text-warn"],
              ["오류 (#N/A 포함)", summary.error, "text-danger"],
              ["분석 제외", summary.excluded, "text-muted"],
            ].map(([label, value, color]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-line bg-surface px-4 py-3"
              >
                <p className="text-xs text-muted">{label}</p>
                <p className={`num mt-1 text-xl font-semibold ${color}`}>
                  {Number(value).toLocaleString()}건
                </p>
              </div>
            ))}
          </div>

          <section className="card min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-ink">
                  데이터 품질 검사 결과 · Score {qualityScore}%
                </h2>
                <p className="mt-0.5 text-sm text-muted">문제 데이터 건수</p>
              </div>
            </div>
            <div className="min-w-0 p-5">
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
                {qualityChecks.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate" title={item.label}>
                      {item.label.replace(/\.$/, "")}
                    </span>
                    <span
                      className={`num shrink-0 whitespace-nowrap font-medium ${item.count > 0 ? "text-danger" : "text-ok"}`}
                    >
                      {item.count}건
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {hasUploadedData ? (
            <section className="card min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-ink">분석 반영 완료</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    업로드한 엑셀 기준으로 KPI · 차트 · 상세 분석이 재계산되었습니다. #N/A 행은
                    오류로 차단되거나 제외됩니다.
                  </p>
                </div>
                <Link href="/" className="text-sm font-medium text-accent hover:underline">
                  Dashboard 보기
                </Link>
              </div>
              <div className="min-w-0 p-5">
                <div className="grid-kpi text-sm">
                  <div className="rounded-lg border border-line px-3 py-2">
                    <p className="text-xs text-muted">분석 건수</p>
                    <p className="num mt-1 font-semibold">
                      {formatNumber(summary.valid)}건
                    </p>
                  </div>
                  <div className="rounded-lg border border-line px-3 py-2">
                    <p className="text-xs text-muted">생산량</p>
                    <p className="num mt-1 font-semibold">
                      {formatNumber(kpi.productionQuantity)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-line px-3 py-2">
                    <p className="text-xs text-muted">불량률</p>
                    <p className="num mt-1 font-semibold">
                      {formatPercent(kpi.defectRatePercent)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-line px-3 py-2">
                    <p className="text-xs text-muted">분석 제외</p>
                    <p className="num mt-1 font-semibold">
                      {formatNumber(summary.excluded)}건
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
