export type AllDataTab = "production" | "errors" | "integrated";

/** 구 경로 → 전체 DATA 탭 */
export function allDataHref(
  tab: AllDataTab,
  query?: Record<string, string | null | undefined> | URLSearchParams | string,
): string {
  const params =
    typeof query === "string"
      ? new URLSearchParams(query.startsWith("?") ? query.slice(1) : query)
      : query instanceof URLSearchParams
        ? new URLSearchParams(query.toString())
        : new URLSearchParams(
            Object.entries(query ?? {})
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => [k, String(v)]),
          );
  params.set("tab", tab);
  const qs = params.toString();
  return qs ? `/all-data?${qs}` : `/all-data?tab=${tab}`;
}

export function legacyDataRedirectPath(
  legacy: "production-data" | "data-errors" | "integrated-status",
  search: string,
): string {
  const tab: AllDataTab =
    legacy === "data-errors"
      ? "errors"
      : legacy === "integrated-status"
        ? "integrated"
        : "production";
  return allDataHref(tab, search);
}
