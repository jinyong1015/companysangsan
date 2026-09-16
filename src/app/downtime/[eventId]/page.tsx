"use client";

import Link from "next/link";
import { useDataSource } from "@/context/DataSourceContext";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { BackBanner, EmptyState, PageHeader, SectionCard } from "@/components/ui/PageBits";
import { getRecordById } from "@/data/mock";
import { formatMinutes, formatQuantity } from "@/lib/format";

export default function DowntimeEventPage() {
  const { records } = useDataSource();
  const params = useParams<{ eventId: string }>();
  const record = useMemo(
    () => getRecordById(params.eventId) ?? records.find((r) => r.id === params.eventId),
    [params.eventId, records],
  );

  if (!record) {
    return (
      <EmptyState
        title="현재 DATA에서 찾을 수 없는 이력입니다."
        description="활성 배치가 변경되었거나 잘못된 주소입니다."
      />
    );
  }

  const rows = [
    ["작업일자", record.workDate],
    ["공장", record.factory],
    ["설비명", record.equipmentName],
    ["제품유형", record.productType],
    ["품번", record.partNumber],
    ["금형번호", record.moldNumber],
    ["작업자", record.operatorName],
    ["구분", record.shiftType],
    ["시작 / 종료", `${record.startedAt?.slice(11, 16) ?? "-"} / ${record.endedAt?.slice(11, 16) ?? "-"}`],
    ["작업시간", formatMinutes(record.elapsedMinutes)],
    ["비가동시간", formatMinutes(record.downtimeMinutes)],
    ["가동시간", formatMinutes(record.operatingMinutes)],
    ["비가동내역", record.downtimeReasonRaw ?? "-"],
    ["고장 후보", record.isFailureCandidate ? "예" : "아니오"],
    ["MTTR 포함", record.isMttrEligible ? "예" : "아니오"],
    ["실적수량", formatQuantity(record.productionQuantity)],
  ] as const;

  return (
    <>
      <BackBanner href="/downtime" label="비가동 분석으로 돌아가기" />
      <PageHeader title="비가동 이벤트 상세" showExcel={false} />
      <SectionCard>
        <dl className="grid gap-3 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-[var(--border)] px-3 py-2">
              <dt className="text-xs text-[var(--text-secondary)]">{k}</dt>
              <dd className="mt-1 font-medium">
                {k === "설비명" ? (
                  <Link href={`/equipment/${record.equipmentId}`} className="linkish">
                    {v}
                  </Link>
                ) : k === "품번" ? (
                  <Link href={`/parts/${record.partId}`} className="linkish">
                    {v}
                  </Link>
                ) : k === "금형번호" ? (
                  <Link href={`/molds/${record.moldId}`} className="linkish">
                    {v}
                  </Link>
                ) : k === "작업자" ? (
                  <Link href={`/operators/${record.operatorId}`} className="linkish">
                    {v}
                  </Link>
                ) : (
                  v
                )}
              </dd>
            </div>
          ))}
        </dl>
        {record.isFailureCandidate && !record.isMttrEligible ? (
          <p className="mt-4 rounded-xl border border-[var(--warning)]/40 px-3 py-2 text-sm text-[var(--warning)]">
            복합 사유는 설비이상 시간만 분리할 수 없어 MTTR에서 제외했습니다.
          </p>
        ) : null}
        <div className="mt-4">
          <Link href="/production-data" className="btn">
            원본 DATA 보기
          </Link>
        </div>
      </SectionCard>
    </>
  );
}
