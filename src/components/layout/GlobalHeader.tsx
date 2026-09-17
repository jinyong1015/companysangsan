"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  BarChart3,
  Boxes,
  Factory,
  Grid3x3,
  LayoutDashboard,
  Moon,
  MoreHorizontal,
  Package,
  PauseCircle,
  Plus,
  Sun,
  Users,
  type LucideProps,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { clsx } from "@/lib/format";

type IconComp = ComponentType<LucideProps>;

const PRIMARY_MENUS: Array<{
  href: string;
  label: string;
  Icon: IconComp;
}> = [
  { href: "/", label: "대시보드", Icon: LayoutDashboard },
  { href: "/production", label: "생산 분석", Icon: BarChart3 },
  { href: "/utilization", label: "가동률 분석", Icon: Grid3x3 },
  { href: "/downtime", label: "비가동 분석", Icon: PauseCircle },
  { href: "/parts", label: "품번 분석", Icon: Package },
  { href: "/equipment", label: "설비 분석", Icon: Factory },
  { href: "/operators", label: "작업자 분석", Icon: Users },
];

/** 좁을 때 더보기로 먼저 보내는 메뉴 (작업자 분석은 최대한 메인에 유지) */
const OVERFLOW_FIRST = new Set(["/equipment", "/parts", "/downtime"]);

const MORE_FIXED: Array<{
  href: string;
  label: string;
  Icon?: IconComp;
}> = [
  { href: "/molds", label: "금형 분석", Icon: Boxes },
  { href: "/production-data", label: "생산 DATA" },
  { href: "/data-errors", label: "오류 DATA" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function totalWidth(widths: number[], moreWidth: number, gap: number) {
  if (widths.length === 0) return moreWidth;
  return moreWidth + widths.length * gap + widths.reduce((sum, w) => sum + w, 0);
}

/** 작업자 분석을 우선 유지하며 넘치는 메뉴를 골라낸다 */
function pickVisibleIndices(
  itemWidths: number[],
  moreWidth: number,
  gap: number,
  available: number,
): number[] {
  let indices = itemWidths.map((_, i) => i);

  if (totalWidth(itemWidths, moreWidth, gap) <= available) {
    return indices;
  }

  const keepPriority = (index: number) => {
    const href = PRIMARY_MENUS[index]?.href ?? "";
    if (href === "/operators") return 100;
    if (OVERFLOW_FIRST.has(href)) return 10;
    return 50;
  };

  while (indices.length > 0) {
    const widths = indices.map((i) => itemWidths[i]!);
    if (totalWidth(widths, moreWidth, gap) <= available) break;

    let dropPos = indices.length - 1;
    let lowest = Infinity;
    for (let p = indices.length - 1; p >= 0; p--) {
      const pri = keepPriority(indices[p]!);
      if (pri < lowest) {
        lowest = pri;
        dropPos = p;
      }
    }
    indices.splice(dropPos, 1);
  }

  return indices;
}

export function GlobalHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const navigationRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [visibleIndices, setVisibleIndices] = useState<number[]>(() =>
    PRIMARY_MENUS.map((_, i) => i),
  );
  const [moreOpen, setMoreOpen] = useState(false);

  const recalc = useCallback(() => {
    const navigation = navigationRef.current;
    const measure = measureRef.current;
    if (!navigation || !measure) return;

    const itemWidths = Array.from(
      measure.querySelectorAll<HTMLElement>("[data-measure-pill]"),
    ).map((item) => item.getBoundingClientRect().width);
    const moreWidth =
      measure.querySelector<HTMLElement>("[data-measure-more]")?.getBoundingClientRect()
        .width ?? 52;
    const gap = 6;
    const available = navigation.clientWidth;

    if (window.innerWidth >= 1440) {
      setVisibleIndices(PRIMARY_MENUS.map((_, i) => i));
      return;
    }

    setVisibleIndices(
      pickVisibleIndices(itemWidths, moreWidth, gap, available),
    );
  }, []);

  useLayoutEffect(() => {
    recalc();
    const ro = new ResizeObserver(recalc);
    if (navigationRef.current) ro.observe(navigationRef.current);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [recalc]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  const visible = visibleIndices.map((i) => PRIMARY_MENUS[i]!);
  const overflow = PRIMARY_MENUS.filter((_, i) => !visibleIndices.includes(i));
  const moreItems = useMemo(
    () => [...overflow.map((m) => ({ href: m.href, label: m.label })), ...MORE_FIXED],
    [overflow],
  );
  const moreActive = moreItems.some((m) => isActive(pathname, m.href));

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_95%,transparent)] shadow-sm backdrop-blur">
      <div className="content-shell px-4 py-3 sm:px-5 lg:px-8">
        <div className="flex min-h-[68px] items-center gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hyundai-logo.png"
              alt="Hyundai Corporation"
              className="h-10 w-28 shrink-0 object-contain"
            />
            <span className="hidden min-w-0 xl:block">
              <span className="block truncate text-[15px] font-semibold leading-tight text-[var(--text)]">
                Hyundaecorp
              </span>
              <span className="block text-[11px] text-[var(--text-secondary)]">
                생산현황 분석
              </span>
            </span>
          </Link>

          <div className="min-w-0 flex-1">
            <nav
              aria-label="주 메뉴"
              className="top-nav-shell relative min-w-0 rounded-[1.6rem] p-1.5"
            >
              <div
                ref={navigationRef}
                className="flex min-w-0 items-center gap-1.5"
              >
                {visible.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="nav-pill shrink-0"
                      data-active={active}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="nav-pill-icon">
                        <item.Icon size={16} strokeWidth={2} />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                <div ref={dropdownRef} className="relative shrink-0">
                  <button
                    type="button"
                    className="nav-pill shrink-0"
                    data-active={moreActive}
                    aria-expanded={moreOpen}
                    aria-haspopup="menu"
                    aria-label="더보기"
                    onClick={() => setMoreOpen((v) => !v)}
                  >
                    <span className="nav-pill-icon">
                      <MoreHorizontal size={18} aria-hidden="true" />
                    </span>
                    <span>더보기</span>
                  </button>

                  {moreOpen ? (
                    <div
                      role="menu"
                      className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
                    >
                      <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                        {overflow.length > 0 ? "메뉴 · Insight" : "Insight"}
                      </p>
                      {overflow.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          className={clsx(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                            isActive(pathname, item.href)
                              ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                              : "text-[var(--text)] hover:bg-[var(--app-bg)]",
                          )}
                          onClick={() => setMoreOpen(false)}
                        >
                          <span className="nav-pill-icon">
                            <item.Icon size={16} />
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      ))}
                      {MORE_FIXED.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          className={clsx(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                            isActive(pathname, item.href)
                              ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                              : "text-[var(--text)] hover:bg-[var(--app-bg)]",
                          )}
                          onClick={() => setMoreOpen(false)}
                        >
                          {item.Icon ? (
                            <span className="nav-pill-icon">
                              <item.Icon size={16} />
                            </span>
                          ) : null}
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                ref={measureRef}
                aria-hidden="true"
                className="pointer-events-none fixed -left-[9999px] top-0 flex invisible items-center gap-1.5"
              >
                {PRIMARY_MENUS.map((item) => (
                  <span
                    key={item.href}
                    data-measure-pill
                    className="nav-pill shrink-0"
                  >
                    <span className="nav-pill-icon">
                      <item.Icon size={16} />
                    </span>
                    <span>{item.label}</span>
                  </span>
                ))}
                <span data-measure-more className="nav-pill shrink-0">
                  <span className="nav-pill-icon">
                    <MoreHorizontal size={18} />
                  </span>
                  <span>더보기</span>
                </span>
              </div>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href="/manage" className="header-action">
              <Plus size={16} />
              <span className="hidden md:inline">데이터 업로드</span>
            </Link>
            <button
              type="button"
              className="header-action"
              aria-label={
                theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"
              }
              title={
                theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"
              }
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              <span className="hidden sm:inline">
                {theme === "light" ? "다크 모드" : "라이트 모드"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
