"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, ResponsiveGrid, SectionCard } from "@/components/ui/PageBits";
import { useDataSource } from "@/context/DataSourceContext";
import { formatNumber } from "@/lib/format";

export default function UploadResultPage() {
  const params = useParams<{ batchId: string }>();
  const { batch, summary, isDemo, records } = useDataSource();
  const [tab, setTab] = useState<"valid" | "warning" | "error">("error");

  const preview = useMemo(() => {
    const list =
      tab === "valid"
        ? records.filter((r) => r.isAnalysisEligible && r.warningCodes.length === 0)
        : tab === "warning"
          ? records.filter((r) => r.isAnalysisEligible && r.warningCodes.length > 0)
          : records.filter((r) => !r.isAnalysisEligible);
    return list.slice(0, 100);
  }, [records, tab]);

  const matchesBatch = !isDemo && batch.id === params.batchId;

  return (
    <>
      <PageHeader title="업로드 검증 결과" showExcel={false} />
      <SectionCard className="mb-4">
        <p className="text-sm">
          파일명 {matchesBatch ? batch.originalFileName : batch.originalFileName}
        </p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {isDemo
            ? "아직 업로드된 활성 DATA가 없습니다. 데이터 업로드에서 엑셀을 반영하세요."
            : "헤더 탐지 완료 · 컬럼 매핑 완료 · 활성 DATA로 저장됨"}
        </p>
      </SectionCard>

      <ResponsiveGrid variant="kpi" className="mb-4">
        <SummaryCard label="전체 DATA" value={summary.total} />
        <SummaryCard label="분석 대상" value={summary.valid} />
        <SummaryCard label="경고 DATA" value={summary.warning} />
        <SummaryCard label="오류·제외 DATA" value={summary.error} tone="error" />
      </ResponsiveGrid>

      <SectionCard title="미리보기" className="mb-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              ["valid", "정상 DATA"],
              ["warning", "경고 DATA"],
              ["error", "오류 DATA"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="pill"
              data-active={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {preview.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">표시할 행이 없습니다.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>행</th>
                  <th>작업일자</th>
                  <th>설비</th>
                  <th>품번</th>
                  <th>실적</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.id}>
                    <td className="num">{r.sourceRowNumber}</td>
                    <td>{r.workDate}</td>
                    <td>{r.equipmentName}</td>
                    <td>{r.partNumber}</td>
                    <td className="num">{formatNumber(r.productionQuantity)}</td>
                    <td>
                      {!r.isAnalysisEligible
                        ? r.errorCodes.join(", ")
                        : r.warningCodes.join(", ") || "정상"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <Link href="/manage" className="btn">
          업로드로 돌아가기
        </Link>
        <Link href="/" className="btn btn-primary">
          대시보드로 이동
        </Link>
        <Link href="/data-errors" className="btn">
          데이터 오류 보기
        </Link>
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "error";
}) {
  return (
    <div className="card p-4">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p
        className="mt-2 text-2xl font-bold"
        style={tone === "error" ? { color: "var(--error)" } : undefined}
      >
        {formatNumber(value)}건
      </p>
    </div>
  );
}
