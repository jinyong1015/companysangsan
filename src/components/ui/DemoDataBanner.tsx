"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDataSource } from "@/context/DataSourceContext";

export function DemoDataBanner() {
  const pathname = usePathname();
  const { isDemo } = useDataSource();

  if (!isDemo) return null;
  if (pathname.startsWith("/manage")) return null;

  return (
    <div className="card mb-4 flex flex-col gap-3 border-[var(--accent)]/25 bg-[var(--accent-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-[var(--accent)]">가데이터로 표시 중</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          엑셀을 업로드하면 브라우저에 저장되어, 시드 데이터로 복원하기 전까지 계속 유지됩니다.
        </p>
      </div>
      <Link href="/manage" className="btn btn-primary shrink-0">
        데이터 업로드
      </Link>
    </div>
  );
}
