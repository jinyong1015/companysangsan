"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Download, type LucideIcon } from "lucide-react";
import { nowLabel } from "@/lib/dates";
import { useToast } from "@/context/ToastContext";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** 제공 시에만 Excel 버튼을 표시합니다. */
  onExcel?: () => void;
  excelName?: string;
  showTimestamp?: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  onExcel,
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
        {onExcel ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              try {
                onExcel();
                pushToast(
                  `Excel 파일 생성을 시작했습니다.${excelName ? ` (${excelName})` : ""}`,
                  "success",
                );
              } catch {
                pushToast("Excel 다운로드에 실패했습니다.", "error");
              }
            }}
          >
            <Download size={16} />
            <span>Excel 다운로드</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function BackBanner({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <nav aria-label="상세 돌아가기" className="sticky top-16 z-10 mb-4">
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-2xl border-2 border-accent/50 bg-surface p-3 shadow-[0_8px_24px_rgba(59,130,246,0.12)] ring-1 ring-accent/20 transition hover:border-accent hover:bg-accent/[0.03] hover:shadow-[0_12px_28px_rgba(59,130,246,0.18)] sm:gap-4 sm:p-4"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm transition group-hover:bg-blue-600 sm:h-12 sm:w-12">
          <ArrowLeft size={20} strokeWidth={2.5} aria-hidden />
        </span>

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/25 sm:h-12 sm:w-12">
          <Icon size={20} strokeWidth={2.25} aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold tracking-[0.12em] text-accent uppercase">
            돌아가기
          </span>
          <span className="mt-0.5 block truncate text-base font-bold text-ink transition group-hover:text-accent sm:text-lg">
            {label}
          </span>
        </span>

        <ChevronRight
          size={20}
          className="shrink-0 text-muted/60 transition group-hover:translate-x-0.5 group-hover:text-accent"
          aria-hidden
        />
      </Link>
    </nav>
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
  id,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`card p-4 md:p-5 ${className}`}>
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
