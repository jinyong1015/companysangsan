export type Factory = "본사" | "2공장";
export type ProductType = "GROMMET" | "SEAL";
export type ShiftType = "주간" | "야간";
/** 시간가동률 목표시간 적용용 근무형태 */
export type WorkPattern = "주간+야간" | "주간" | "야간";
/** 평일 / 주말 (토·일) 구분 — 목표 가동시간 적용용 */
export type TargetDayKind = "weekday" | "weekend";
/** 성능가동률 목표 작업판수 적용용 교대 구분 */
export type PerformanceShiftPattern = "주간+야간" | "단일 교대";
export type UtilizationMetric = "time" | "performance";
export type EquipmentType = "INJECTION" | "PRESS";
export type DatePreset =
  | "today"
  | "last7"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom";
export type Grain = "day" | "week" | "month";
/** 화면 모드 (라이트 / 다크) */
export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode;

export interface TargetMinutesByPattern {
  "주간+야간": number;
  주간: number;
  야간: number;
}

/** 평일·주말 × 근무형태별 목표 가동시간(분) */
export interface TargetMinutesSettings {
  weekday: TargetMinutesByPattern;
  weekend: TargetMinutesByPattern;
}

/** 제품유형 × 설비유형 × 교대 구분별 목표 작업판수 (미설정은 null) */
export type TargetShotCountTable = Record<
  ProductType,
  Record<EquipmentType, Record<PerformanceShiftPattern, number | null>>
>;

export type ErrorCode =
  | "WORK_TIME_ZERO"
  | "PRODUCTION_ZERO"
  | "DOWNTIME_GT_WORK_TIME"
  | "OPERATING_TIME_NON_POSITIVE"
  | "REQUIRED_VALUE_MISSING"
  | "INVALID_DATE"
  | "INVALID_NUMBER"
  | "NEGATIVE_VALUE"
  | "INVALID_PRODUCT_TYPE"
  | "NA_PLACEHOLDER"
  | "DUPLICATE_RECORD";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  WORK_TIME_ZERO: "작업시간이 0분입니다.",
  PRODUCTION_ZERO: "실적수량이 0입니다.",
  DOWNTIME_GT_WORK_TIME: "비가동시간이 작업시간보다 큽니다.",
  OPERATING_TIME_NON_POSITIVE: "계산된 가동시간이 0분 이하입니다.",
  REQUIRED_VALUE_MISSING: "필수값이 누락되었습니다.",
  INVALID_DATE: "날짜 또는 시간이 올바르지 않습니다.",
  INVALID_NUMBER: "숫자 형식이 올바르지 않습니다.",
  NEGATIVE_VALUE: "음수 값은 사용할 수 없습니다.",
  INVALID_PRODUCT_TYPE: "지원하지 않는 제품유형입니다.",
  NA_PLACEHOLDER: "#N/A 값이 포함되어 있습니다.",
  DUPLICATE_RECORD: "중복 DATA입니다.",
};

export type DowntimeReason =
  | "금형교체"
  | "설비이상"
  | "근태변경"
  | "금형세척"
  | "고무이상"
  | "제품이상"
  | "복합 사유";

export interface ProductionRecord {
  id: string;
  batchId: string;
  sourceRowNumber: number;
  factoryRaw: string;
  factory: Factory;
  workDate: string;
  equipmentId: string;
  equipmentName: string;
  productType: ProductType;
  partId: string;
  partNumber: string;
  cavity: number;
  shotCount: number;
  defectQuantity: number;
  productionQuantity: number;
  operatorId: string;
  operatorName: string;
  shiftType: ShiftType;
  moldId: string;
  moldNumber: string;
  startedAt: string | null;
  endedAt: string | null;
  elapsedMinutes: number;
  downtimeMinutes: number;
  operatingMinutes: number;
  downtimeReasonRaw: string | null;
  reasonTokens: string[];
  isFailureCandidate: boolean;
  isMttrEligible: boolean;
  averageShot: number | null;
  isAnalysisEligible: boolean;
  errorCodes: ErrorCode[];
  warningCodes: string[];
}

export interface KpiSummary {
  productionQuantity: number;
  defectQuantity: number;
  defectRatePercent: number | null;
  elapsedMinutes: number;
  downtimeMinutes: number;
  operatingMinutes: number;
  utilizationRatePercent: number | null;
  uph: number | null;
  failureCount: number;
  mttrEligibleCount: number;
  mttrMinutes: number | null;
  referenceMtbfHours: number | null;
  validRows: number;
}

export interface KpiWithCompare extends KpiSummary {
  previous?: KpiSummary;
  productionChangePercent: number | null;
  defectChangePercent: number | null;
  defectRateChangePp: number | null;
  utilizationChangePp: number | null;
  uphChangePercent: number | null;
}

export interface GlobalFilters {
  factory: "전체" | Factory;
  productType: "전체" | ProductType;
  datePreset: DatePreset;
  startDate: string;
  endDate: string;
  equipmentIds: string[];
  partIds: string[];
  operatorIds: string[];
  moldIds: string[];
  shiftType: "전체" | ShiftType;
  downtimeReason: "전체" | DowntimeReason;
}

export interface PageListState {
  search: string;
  sort: string;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
  scrollY?: number;
  extra?: Record<string, string | number | boolean | null>;
}

export interface TrendPoint {
  period: string;
  label: string;
  productionQuantity: number;
  defectQuantity: number;
  elapsedMinutes: number;
  downtimeMinutes: number;
  operatingMinutes: number;
  utilizationRatePercent: number | null;
  uph: number | null;
  failureCount: number;
  validRows: number;
}

export interface ReasonShare {
  reason: string;
  downtimeMinutes: number;
  sharePercent: number;
  count: number;
}

export interface EquipmentRow {
  id: string;
  name: string;
  factory: Factory;
  productMix: { grommetPercent: number; sealPercent: number };
  partCount: number;
  kpi: KpiSummary;
}

export interface PartRow {
  id: string;
  partNumber: string;
  productType: ProductType;
  factories: Factory[];
  equipmentCount: number;
  moldCount: number;
  kpi: KpiSummary;
}

/** PROD-01 제품별 생산 종합 실적 행 */
export interface ProductPerformanceRow {
  id: string;
  partNumber: string;
  productType: ProductType;
  downtimeMinutes: number;
  elapsedMinutes: number;
  operatingMinutes: number;
  shotCount: number;
  /** 총 SHOT ÷ 가동시간(hr) */
  avgShotByOperating: number | null;
  /** 총 SHOT ÷ 작업시간(hr) */
  avgShotByElapsed: number | null;
  workDays: number;
  /** 총 SHOT ÷ 작업일수 */
  dailyAvgShots: number | null;
  productionQuantity: number;
  defectQuantity: number;
  goodQuantity: number;
  /** 생산수량 ÷ 가동시간(hr) */
  uph: number | null;
}

export interface OperatorRow {
  id: string;
  name: string;
  factory: Factory;
  shiftMix: string;
  partCount: number;
  equipmentCount: number;
  kpi: KpiSummary;
}

export interface MoldRow {
  id: string;
  moldNumber: string;
  representativePart: string;
  productType: ProductType;
  equipmentCount: number;
  workCount: number;
  shotCount: number;
  kpi: KpiSummary;
}

export interface UploadBatch {
  id: string;
  originalFileName: string;
  status: "validating" | "validated" | "active" | "failed" | "archived";
  sourceRowCount: number;
  validRowCount: number;
  excludedRowCount: number;
  warningRowCount: number;
  uploadedAt: string;
  activatedAt: string | null;
}
