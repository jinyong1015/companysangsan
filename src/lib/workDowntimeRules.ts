import { getDay, parseISO } from "date-fns";
import type { ErrorCode, ShiftType, TargetDayKind } from "@/types";

/** 작업시간 0 또는 작업시간 < 비가동시간일 때, 이 상한 이하면 정상 통과 */
export const DOWNTIME_SOFT_CAP_MINUTES = {
  weekday: { 주간: 620, 야간: 660 },
  weekend: { 주간: 540, 야간: 750 },
} as const;

function resolveDayKind(workDate: string): TargetDayKind {
  const day = getDay(parseISO(workDate));
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

export function getDowntimeSoftCapMinutes(
  workDate: string,
  shiftType: ShiftType,
): number {
  const dayKind = resolveDayKind(workDate);
  return DOWNTIME_SOFT_CAP_MINUTES[dayKind][shiftType];
}

/**
 * 작업시간=0+비가동 있음, 또는 작업시간 < 비가동시간인 경우
 * 비가동이 평일/주말·주간/야간 상한 이하면 오류·경고 없이 정상 처리한다.
 */
export function applyWorkDowntimeMismatchRules(
  errorCodes: ErrorCode[],
  _warningCodes: string[],
  opts: {
    elapsedMinutes: number | null;
    downtimeMinutes: number;
    workDate: string | null;
    shiftType: ShiftType;
  },
): void {
  const { elapsedMinutes, downtimeMinutes, workDate, shiftType } = opts;

  const workZero = elapsedMinutes === 0;
  const downtimeExceedsWork =
    elapsedMinutes != null && downtimeMinutes > elapsedMinutes;
  const mismatch =
    downtimeMinutes > 0 && (workZero || downtimeExceedsWork);

  if (!mismatch) {
    if (workZero) errorCodes.push("WORK_TIME_ZERO");
    if (downtimeExceedsWork) errorCodes.push("DOWNTIME_GT_WORK_TIME");
    const operating =
      elapsedMinutes != null ? elapsedMinutes - downtimeMinutes : null;
    if (operating != null && operating <= 0) {
      errorCodes.push("OPERATING_TIME_NON_POSITIVE");
    }
    return;
  }

  const dateOk = Boolean(workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate));
  const cap = dateOk ? getDowntimeSoftCapMinutes(workDate!, shiftType) : 0;
  const withinCap = dateOk && downtimeMinutes <= cap;

  // 상한 이내 불일치 → 정상 (오류·경고 미부여)
  if (withinCap) return;

  if (workZero) errorCodes.push("WORK_TIME_ZERO");
  if (downtimeExceedsWork) errorCodes.push("DOWNTIME_GT_WORK_TIME");
  const operating =
    elapsedMinutes != null ? elapsedMinutes - downtimeMinutes : null;
  if (operating != null && operating <= 0) {
    errorCodes.push("OPERATING_TIME_NON_POSITIVE");
  }
}
