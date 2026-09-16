import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  Database,
  Factory,
  Grid3x3,
  LayoutDashboard,
  Package,
  PauseCircle,
  Users,
} from "lucide-react";

export type DetailBackSource =
  | "home"
  | "downtime"
  | "utilization"
  | "parts"
  | "equipment"
  | "production"
  | "production-data"
  | "operators"
  | "molds";

const BACK_BY_SOURCE: Record<
  DetailBackSource,
  { href: string; label: string; icon: LucideIcon }
> = {
  home: { href: "/", label: "대시보드", icon: LayoutDashboard },
  downtime: { href: "/downtime", label: "비가동 분석", icon: PauseCircle },
  utilization: { href: "/utilization", label: "가동률 분석", icon: Grid3x3 },
  parts: { href: "/parts", label: "품번 분석", icon: Package },
  equipment: { href: "/equipment", label: "설비 분석", icon: Factory },
  production: { href: "/production", label: "생산 분석", icon: BarChart3 },
  "production-data": {
    href: "/production-data",
    label: "생산 DATA",
    icon: Database,
  },
  operators: { href: "/operators", label: "작업자 분석", icon: Users },
  molds: { href: "/molds", label: "금형 분석", icon: Boxes },
};

export function isDetailBackSource(
  value: string | null | undefined,
): value is DetailBackSource {
  return !!value && value in BACK_BY_SOURCE;
}

export function resolveFrom(
  currentFrom: string | null | undefined,
  fallback: DetailBackSource,
): DetailBackSource {
  return isDetailBackSource(currentFrom) ? currentFrom : fallback;
}

export function detailBackNav(
  from: string | null | undefined,
  fallback: DetailBackSource,
): { href: string; label: string; icon: LucideIcon } {
  return BACK_BY_SOURCE[resolveFrom(from, fallback)];
}

export function withFromParam(href: string, from: DetailBackSource): string {
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}from=${from}`;
}

/** 상세→상세 이동 시 기존 from을 유지하고, 없으면 fallback 사용 */
export function detailHref(
  href: string,
  currentFrom: string | null | undefined,
  fallback: DetailBackSource,
): string {
  return withFromParam(href, resolveFrom(currentFrom, fallback));
}
