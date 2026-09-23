"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Megaphone,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
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
import {
  ERROR_MESSAGES,
  WARNING_CODES,
  WARNING_MESSAGES,
  type ErrorCode,
  type WarningCode,
} from "@/types";

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

  const errorChecks = useMemo(() => {
    const codes = Object.keys(ERROR_MESSAGES) as ErrorCode[];
    return codes.map((code) => ({
      code,
      label: ERROR_MESSAGES[code].replace(/\.$/, ""),
      count: records.filter((r) => r.errorCodes.includes(code)).length,
    }));
  }, [records]);

  const warningChecks = useMemo(() => {
    return WARNING_CODES.map((code) => ({
      code,
      label: WARNING_MESSAGES[code].replace(/\.$/, ""),
      count: records.filter(
        (r) =>
          r.isAnalysisEligible &&
          r.warningCodes.includes(code as WarningCode | string),
      ).length,
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

  const showFileCard = Boolean(
    localName || uploading || hasUploadedData || stage === "done",
  );

  return (
    <div className="manage-page">
      <header className="manage-page-header">
        <div className="min-w-0">
          <p className="manage-page-kicker">DATA MANAGEMENT</p>
          <h1 className="manage-page-title">데이터 업로드</h1>
          <p className="manage-page-desc">
            MES 성형작업일보 엑셀을 업로드하면 검증·집계 후 전체 분석 메뉴에
            반영됩니다.
          </p>
        </div>
        <div className="manage-page-actions">
          <button
            type="button"
            onClick={handleSampleDownload}
            className="manage-action-btn"
          >
            <Download size={14} />
            샘플 엑셀
          </button>
          {hasUploadedData ? (
            <button
              type="button"
              onClick={() => void handleRestoreSeed()}
              className="manage-action-btn"
            >
              <RotateCcw size={14} />
              시드 복원
            </button>
          ) : null}
        </div>
      </header>

      <div className="manage-notice" role="note">
        <Megaphone size={18} className="manage-notice-icon" aria-hidden />
        <div className="min-w-0">
          <p className="manage-notice-title">공지사항</p>
          <p className="manage-notice-body">
            MES 성형작업일보 데이터를 업로드하시면 됩니다. 오류 행은 분석에서
            제외되고, 경고 행은 분석에 포함됩니다.
          </p>
        </div>
      </div>

      <section className="manage-panel">
        <div className="manage-panel-head">
          <div>
            <h2 className="manage-panel-title">Excel Upload</h2>
            <p className="manage-panel-sub">
              .xlsx / .xls · 헤더 자동 인식 · 업로드 즉시 재검증
            </p>
          </div>
        </div>
        <div className="manage-panel-body">
          <div
            role="button"
            tabIndex={0}
            className={`manage-dropzone${dragging ? " is-dragging" : ""}`}
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
            <div className="manage-dropzone-icon">
              <Upload size={22} />
            </div>
            <p className="manage-dropzone-title">
              엑셀 파일을 드래그하거나 클릭하여 업로드
            </p>
            <p className="manage-dropzone-hint">
              성형작업일보 원본 · 컬럼명 변형도 자동 매핑됩니다
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
            <div className="manage-file-card">
              <FileSpreadsheet size={18} className="text-[var(--accent)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text)]">
                  {localName ?? batch.originalFileName ?? "파일"}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
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
                <CheckCircle2 size={18} className="text-[var(--success)]" />
              ) : null}
              {!uploading && stage === "error" ? (
                <AlertTriangle size={18} className="text-[var(--error)]" />
              ) : null}
            </div>
          ) : null}

          {errorMessage ? (
            <p className="manage-error-banner">{errorMessage}</p>
          ) : null}
        </div>
      </section>

      {showResult ? (
        <>
          <div className="manage-kpi-grid">
            {[
              {
                label: "정상",
                value: summary.valid - summary.warning,
                tone: "ok" as const,
                hint: "경고 없는 분석 대상",
              },
              {
                label: "경고",
                value: summary.warning,
                tone: "warn" as const,
                hint: "분석 포함 · 품질 주의",
              },
              {
                label: "오류",
                value: summary.error,
                tone: "danger" as const,
                hint: "분석 제외",
              },
              {
                label: "품질 Score",
                value: qualityScore,
                tone: "accent" as const,
                hint: `분석 ${formatNumber(summary.valid)} / 전체 ${formatNumber(summary.total)}`,
                suffix: "%",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`manage-kpi-card manage-kpi-card-${item.tone}`}
              >
                <p className="manage-kpi-label">{item.label}</p>
                <p className="manage-kpi-value num">
                  {item.value.toLocaleString("ko-KR")}
                  {item.suffix ?? "건"}
                </p>
                <p className="manage-kpi-hint">{item.hint}</p>
              </div>
            ))}
          </div>

          <section className="manage-panel">
            <div className="manage-panel-head">
              <div>
                <h2 className="manage-panel-title">
                  데이터 품질 검사 결과 · Score {qualityScore}%
                </h2>
                <p className="manage-panel-sub">
                  오류는 분석에서 제외되고, 경고는 생산 DATA에 포함됩니다.
                </p>
              </div>
              <div className="manage-panel-links">
                <Link href="/data-errors" className="manage-inline-link">
                  오류 DATA
                  <ArrowRight size={14} aria-hidden />
                </Link>
                <Link href="/production-data" className="manage-inline-link">
                  생산 DATA
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </div>
            <div className="manage-panel-body manage-quality-split">
              <div className="manage-quality-col manage-quality-col-error">
                <div className="manage-quality-col-head">
                  <ShieldAlert size={16} aria-hidden />
                  <div>
                    <h3>오류 조건</h3>
                    <p>해당 시 분석 제외 · 오류 DATA로 분류</p>
                  </div>
                </div>
                <div className="manage-quality-list">
                  {errorChecks.map((item) => (
                    <div
                      key={item.code}
                      className={`manage-quality-row${item.count > 0 ? " has-count" : ""}`}
                    >
                      <span title={item.label}>{item.label}</span>
                      <span className="num">{item.count}건</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="manage-quality-col manage-quality-col-warn">
                <div className="manage-quality-col-head">
                  <ShieldCheck size={16} aria-hidden />
                  <div>
                    <h3>경고 조건</h3>
                    <p>분석에는 포함 · 생산 DATA에서 경고로 표시</p>
                  </div>
                </div>
                <div className="manage-quality-list">
                  {warningChecks.map((item) => (
                    <div
                      key={item.code}
                      className={`manage-quality-row manage-quality-row-warn${item.count > 0 ? " has-count" : ""}`}
                    >
                      <span title={item.label}>{item.label}</span>
                      <span className="num">{item.count}건</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {hasUploadedData ? (
            <section className="manage-panel">
              <div className="manage-panel-head">
                <div>
                  <h2 className="manage-panel-title">분석 반영 완료</h2>
                  <p className="manage-panel-sub">
                    업로드한 엑셀 기준으로 KPI · 차트 · 상세 분석이
                    재계산되었습니다.
                  </p>
                </div>
                <Link href="/" className="manage-inline-link">
                  Dashboard 보기
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              <div className="manage-panel-body">
                <div className="manage-result-grid">
                  <div className="manage-result-tile">
                    <p>분석 건수</p>
                    <strong className="num">{formatNumber(summary.valid)}건</strong>
                  </div>
                  <div className="manage-result-tile">
                    <p>생산량</p>
                    <strong className="num">
                      {formatNumber(kpi.productionQuantity)}
                    </strong>
                  </div>
                  <div className="manage-result-tile">
                    <p>불량률</p>
                    <strong className="num">
                      {formatPercent(kpi.defectRatePercent)}
                    </strong>
                  </div>
                  <div className="manage-result-tile">
                    <p>분석 제외</p>
                    <strong className="num">
                      {formatNumber(summary.excluded)}건
                    </strong>
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
