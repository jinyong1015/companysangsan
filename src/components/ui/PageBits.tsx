"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { nowLabel } from "@/lib/dates";
import { useToast } from "@/context/ToastContext";

interface PageHeaderProps {
  title: string;
  description?: string;
  showExcel?: boolean;
  excelName?: string;
  showTimestamp?: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  showExcel = true,
  excelName,
  showTimestamp = true,
  titleClassName,
  descriptionClassName,
  actions,
}: PageHeaderProps) {
  const { pushToast } = useToast();

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1
          className={
            titleClassName ??
            "text-[20px] font-bold leading-tight md:text-[24px]"
          }
        >
          {title}
        </h1>
        {description ? (
          <p
            className={
              descriptionClassName ??
              "mt-1 text-sm text-[var(--text-secondary)]"
            }
          >
            {description}
          </p>
        ) : null}
        {showTimestamp ? (
          <p className="mt-1 text-xs text-[var(--text-secondary)]">기준 {nowLabel()}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {showExcel ? (
          <button
            type="button"
            className="btn"
            onClick={() =>
              pushToast(
                `Excel 파일 생성을 시작했습니다.${excelName ? ` (${excelName})` : ""}`,
                "info",
              )
            }
          >
            <Download size={16} />
            <span>Excel 다운로드</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function BackBanner({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="card mb-4 flex items-start gap-3 px-4 py-3 transition hover:border-[var(--accent)]"
    >
      <span className="text-[var(--accent)]">←</span>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-[var(--text-secondary)]">
          이전 검색·정렬·페이지·조회조건을 유지합니다.
        </p>
      </div>
    </Link>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-md text-sm text-[var(--text-secondary)]">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" className="btn btn-primary mt-2" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] text-[11px] text-[var(--text-secondary)]"
        aria-label="정보"
      >
        i
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-left text-xs leading-relaxed text-[var(--text)] shadow-lg group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

export function ResponsiveGrid({
  variant = "kpi",
  children,
  className = "",
}: {
  variant?: "kpi" | "filters" | "split" | "cards" | "dense";
  children: React.ReactNode;
  className?: string;
}) {
  const mins = {
    kpi: "200px",
    filters: "280px",
    split: "420px",
    cards: "320px",
    dense: "220px",
  } as const;
  return (
    <div className={`responsive-grid ${className}`} style={{ ["--min" as string]: mins[variant] }}>
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-4 md:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-base font-bold">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
