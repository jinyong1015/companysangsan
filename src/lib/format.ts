export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatQuantity(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${formatNumber(value)} EA`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${formatNumber(value, digits)}%`;
}

export function formatUph(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${formatNumber(Math.round(value))} EA/h`;
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "-";
  const rounded = Math.round(minutes);
  return `${formatNumber(rounded)}분`;
}

/** 시간 값을 분 단위로 표시 (MTBF 등) */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "-";
  return `${formatNumber(Math.round(hours * 60))}분`;
}

export function formatChangePercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "이전 기간 0";
  const sign = value > 0 ? "▲" : value < 0 ? "▼" : "–";
  return `${sign} ${formatNumber(Math.abs(value), 1)}%`;
}

export function formatChangePp(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "이전 기간 0";
  const sign = value > 0 ? "▲" : value < 0 ? "▼" : "–";
  return `${sign} ${formatNumber(Math.abs(value), 1)}%p`;
}

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
