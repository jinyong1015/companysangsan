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
  const abs = Math.abs(minutes);
  const sign = minutes < 0 ? "-" : "";
  if (abs < 60) return `${sign}${Math.round(abs)}분`;
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  if (m === 0) return `${sign}${h}시간`;
  return `${sign}${h}시간 ${m}분`;
}

export function formatHours(hours: number | null | undefined, digits = 1): string {
  if (hours == null || Number.isNaN(hours)) return "-";
  return `${formatNumber(hours, digits)}시간`;
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
