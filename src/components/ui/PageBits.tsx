"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
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
  showTimestamp = false,
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
  periodStart,
  periodEnd,
  scopeLabel,
  scopeValue,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 제공 시 오른쪽에 조회기간 박스를 표시합니다. (company ProductDetailBackNav 동일) */
  periodStart?: string;
  periodEnd?: string;
  /** 제공 시 조회기간 왼쪽에 품번 등 스코프 박스를 표시합니다. */
  scopeLabel?: string;
  scopeValue?: string;
}) {
  const hasPeriod = Boolean(periodStart && periodEnd);
  const hasScope = Boolean(scopeLabel && scopeValue);

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

        {hasScope ? (
          <span className="hidden shrink-0 rounded-xl border border-line bg-canvas px-3 py-2 text-right sm:block">
            <span className="block text-[10px] font-semibold tracking-wide text-muted uppercase">
              {scopeLabel}
            </span>
            <span className="mt-0.5 block max-w-[9rem] truncate text-xs font-semibold text-ink">
              {scopeValue}
            </span>
          </span>
        ) : null}

        {hasPeriod ? (
          <span className="hidden shrink-0 rounded-xl border border-line bg-canvas px-3 py-2 text-right sm:block">
            <span className="block text-[10px] font-semibold tracking-wide text-muted uppercase">
              조회기간
            </span>
            <span className="num mt-0.5 block text-xs font-semibold text-ink">
              {periodStart} ~ {periodEnd}
            </span>
          </span>
        ) : null}

        <ChevronRight
          size={20}
          className="shrink-0 text-muted/60 transition group-hover:translate-x-0.5 group-hover:text-accent"
          aria-hidden
        />
      </Link>
      {hasScope || hasPeriod ? (
        <p className="mt-2 px-1 text-center text-xs font-medium text-muted sm:hidden">
          {hasScope ? (
            <span>
              {scopeLabel}{" "}
              <span className="font-semibold text-ink">{scopeValue}</span>
            </span>
          ) : null}
          {hasScope && hasPeriod ? <span className="mx-1.5">·</span> : null}
          {hasPeriod ? (
            <span className="num">
              조회기간 {periodStart} ~ {periodEnd}
            </span>
          ) : null}
        </p>
      ) : null}
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
  const tipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placeAbove: boolean;
  } | null>(null);

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const tipWidth = 224; // w-56
    const gap = 8;
    const placeAbove = rect.top > 120;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, tipWidth / 2 + 8),
      window.innerWidth - tipWidth / 2 - 8,
    );
    const top = placeAbove ? rect.top - gap : rect.bottom + gap;
    setCoords({ top, left, placeAbove });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setPinned(false);
      setHovered(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinned(false);
        setHovered(false);
      }
    };
    const onReposition = () => updatePosition();

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, updatePosition]);

  const panelStyle: CSSProperties | undefined = coords
    ? {
        position: "fixed",
        top: coords.top,
        left: coords.left,
        transform: coords.placeAbove
          ? "translate(-50%, -100%)"
          : "translate(-50%, 0)",
        zIndex: 80,
      }
    : undefined;

  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHovered(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[11px] text-[var(--text-secondary)]"
        aria-label="정보"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setPinned((prev) => !prev);
        }}
      >
        i
      </button>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              style={panelStyle}
              className="pointer-events-none w-56 rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-left text-xs leading-relaxed text-[var(--text)] shadow-lg"
            >
              {text}
            </span>,
            document.body,
          )
        : null}
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
  description,
  action,
  children,
  className = "",
  id,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`card p-4 md:p-5 ${className}`}>
      {(title || description || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-bold">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-sm text-muted">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
