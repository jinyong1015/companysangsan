import type {
  ErrorCode,
  Factory,
  ProductionRecord,
  ProductType,
  ShiftType,
  UploadBatch,
} from "@/types";
import {
  equipmentIdFromName,
  getEquipmentMasterById,
  getEquipmentMasterByName,
} from "@/data/equipmentMaster";
import { toDateString, todaySeoul } from "@/lib/dates";
import { subDays } from "date-fns";

/** ë°ëª¨ì© ìí ì¤ë¹ â ê³µì¥êµ¬ë¶ì equipmentMaster ê³ ì ê° */
const MOCK_EQUIPMENT_NAMES = [
  "IN-01",
  "IN-02",
  "IN-03",
  "IN-05",
  "IN-07",
  "IN-08",
  "IN-09",
  "IN-10",
  "IN-11",
  "IN-12",
  "IN-14",
  "GP01-1",
  "GP01-2",
  "GP01-3",
  "GP02-1",
  "GP02-2",
  "GP02-3",
  "PS01-1",
  "PS09-3",
  "PG01-1",
  "PG05-1",
] as const;

const EQUIPMENT = MOCK_EQUIPMENT_NAMES.flatMap((name) => {
  const m = getEquipmentMasterByName(name);
  if (!m) return [];
  return [
    {
      id: equipmentIdFromName(m.name),
      name: m.name,
      factory: m.factory,
    },
  ];
});

const PARTS = [
  { id: "pt-necc051", partNumber: "NE-CC051", productType: "GROMMET" as ProductType },
  { id: "pt-necc088", partNumber: "NE-CC088", productType: "GROMMET" as ProductType },
  { id: "pt-se1201", partNumber: "SE-1201", productType: "SEAL" as ProductType },
  { id: "pt-se2204", partNumber: "SE-2204", productType: "SEAL" as ProductType },
  { id: "pt-gr330", partNumber: "GR-330A", productType: "GROMMET" as ProductType },
  { id: "pt-sl441", partNumber: "SL-441B", productType: "SEAL" as ProductType },
];

const OPERATORS = [
  { id: "op-kim", name: "ÃªÂ¹ÂÃ«Â¯Â¼Ã¬ÂÂ" },
  { id: "op-lee", name: "Ã¬ÂÂ´Ã¬ÂÂÃ¬ÂÂ°" },
  { id: "op-park", name: "Ã«Â°ÂÃ¬Â¤ÂÃ­ÂÂ¸" },
  { id: "op-choi", name: "Ã¬ÂµÂÃ¬ÂÂ Ã¬Â§Â" },
  { id: "op-jung", name: "Ã¬Â ÂÃ­ÂÂÃ«ÂÂ" },
  { id: "op-han", name: "Ã­ÂÂÃ¬Â§ÂÃ­ÂÂ" },
];

const MOLDS = [
  { id: "md-a12", moldNumber: "M-A12" },
  { id: "md-b08", moldNumber: "M-B08" },
  { id: "md-c21", moldNumber: "M-C21" },
  { id: "md-d05", moldNumber: "M-D05" },
  { id: "md-e17", moldNumber: "M-E17" },
];

const REASONS = [
  "ÃªÂ¸ÂÃ­ÂÂÃªÂµÂÃ¬Â²Â´",
  "Ã¬ÂÂ¤Ã«Â¹ÂÃ¬ÂÂ´Ã¬ÂÂ",
  "ÃªÂ·Â¼Ã­ÂÂÃ«Â³ÂÃªÂ²Â½",
  "ÃªÂ¸ÂÃ­ÂÂÃ¬ÂÂ¸Ã¬Â²Â",
  "ÃªÂ³Â Ã«Â¬Â´Ã¬ÂÂ´Ã¬ÂÂ",
  "Ã¬Â ÂÃ­ÂÂÃ¬ÂÂ´Ã¬ÂÂ",
  "ÃªÂ¸ÂÃ­ÂÂÃªÂµÂÃ¬Â²Â´, Ã¬ÂÂ¤Ã«Â¹ÂÃ¬ÂÂ´Ã¬ÂÂ",
  "ÃªÂ¸ÂÃ­ÂÂÃ¬ÂÂ¸Ã¬Â²Â, ÃªÂ·Â¼Ã­ÂÂÃ«Â³ÂÃªÂ²Â½",
];

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function tokenize(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildRecord(
  index: number,
  overrides: Partial<ProductionRecord> & {
    workDate: string;
    factory: Factory;
    productType: ProductType;
  },
): ProductionRecord {
  const equipment =
    EQUIPMENT.find((e) => e.id === overrides.equipmentId) ??
    EQUIPMENT.find((e) => e.factory === overrides.factory) ??
    EQUIPMENT[0]!;
  const part =
    PARTS.find((p) => p.productType === overrides.productType) ?? PARTS[0]!;
  const operator = OPERATORS[index % OPERATORS.length]!;
  const mold = MOLDS[index % MOLDS.length]!;
  const elapsed = overrides.elapsedMinutes ?? 480;
  const downtime = overrides.downtimeMinutes ?? 0;
  const operating = elapsed;
  const reasonRaw = overrides.downtimeReasonRaw ?? null;
  const tokens = tokenize(reasonRaw);
  const isFailure = tokens.includes("Ã¬ÂÂ¤Ã«Â¹ÂÃ¬ÂÂ´Ã¬ÂÂ");
  const isMttr = isFailure;
  const production = overrides.productionQuantity ?? 1200;
  const errorCodes = overrides.errorCodes ?? [];
  const isEligible =
    overrides.isAnalysisEligible ??
    (errorCodes.length === 0 &&
      elapsed > 0 &&
      production > 0 &&
      downtime <= elapsed &&
      operating > 0);

const base: ProductionRecord = {
    id: `rec-${index}`,
    batchId: "batch-active-001",
    sourceRowNumber: index + 2,
    factoryRaw: overrides.factory === "2공장" ? "구지공장" : overrides.factory,
    factory: overrides.factory,
    workDate: overrides.workDate,
    equipmentId: overrides.equipmentId ?? equipment.id,
    equipmentName: overrides.equipmentName ?? equipment.name,
    productType: overrides.productType,
    partId: overrides.partId ?? part.id,
    partNumber: overrides.partNumber ?? part.partNumber,
    cavity: overrides.cavity ?? 4,
    shotCount: overrides.shotCount ?? Math.max(1, Math.round(production / 4)),
    defectQuantity: overrides.defectQuantity ?? 0,
    productionQuantity: production,
    operatorId: overrides.operatorId ?? operator.id,
    operatorName: overrides.operatorName ?? operator.name,
    shiftType: (overrides.shiftType ?? (index % 3 === 0 ? "Ã¬ÂÂ¼ÃªÂ°Â" : "Ã¬Â£Â¼ÃªÂ°Â")) as ShiftType,
    moldId: overrides.moldId ?? mold.id,
    moldNumber: overrides.moldNumber ?? mold.moldNumber,
    startedAt: overrides.startedAt ?? `${overrides.workDate}T07:30:00`,
    endedAt: overrides.endedAt ?? `${overrides.workDate}T19:30:00`,
    elapsedMinutes: elapsed,
    downtimeMinutes: downtime,
    operatingMinutes: overrides.operatingMinutes ?? operating,
    downtimeReasonRaw: reasonRaw,
    reasonTokens: tokens,
    isFailureCandidate: isEligible && isFailure,
    isMttrEligible: isEligible && isMttr,
    averageShot: overrides.averageShot ?? 3.8,
    isAnalysisEligible: isEligible,
    errorCodes,
    warningCodes: overrides.warningCodes ?? [],
  };

  return {
    ...base,
    ...overrides,
    equipmentId: overrides.equipmentId ?? base.equipmentId,
    equipmentName: overrides.equipmentName ?? base.equipmentName,
    partId: overrides.partId ?? base.partId,
    partNumber: overrides.partNumber ?? base.partNumber,
    reasonTokens: tokenize(overrides.downtimeReasonRaw ?? base.downtimeReasonRaw),
    isFailureCandidate:
      overrides.isFailureCandidate ??
      ((overrides.isAnalysisEligible ?? isEligible) &&
        tokenize(overrides.downtimeReasonRaw ?? base.downtimeReasonRaw).includes("Ã¬ÂÂ¤Ã«Â¹ÂÃ¬ÂÂ´Ã¬ÂÂ")),
    isMttrEligible:
      overrides.isMttrEligible ??
      ((overrides.isAnalysisEligible ?? isEligible) &&
        tokenize(overrides.downtimeReasonRaw ?? base.downtimeReasonRaw).includes(
          "Ã¬ÂÂ¤Ã«Â¹ÂÃ¬ÂÂ´Ã¬ÂÂ",
        )),
  };
}

function generateDataset(): {
  records: ProductionRecord[];
  batch: UploadBatch;
} {
  const rand = mulberry32(20260916);
  const today = todaySeoul();
  const records: ProductionRecord[] = [];
  let idx = 0;

  // Ã¬ÂµÂÃªÂ·Â¼ 31Ã¬ÂÂ¼ ÃÂ· Ã¬ÂÂ¤Ã«Â¹ÂÃ«Â³Â Ã¬Â£Â¼/Ã¬ÂÂ¼ ÃªÂµÂÃ«ÂÂ Ã­ÂÂ¬Ã­ÂÂ¨ (ÃªÂ°ÂÃ«ÂÂÃ«Â¥Â  Ã­ÂÂÃ­ÂÂ¸Ã«Â§ÂµÃ¬ÂÂ©)
  for (let dayOffset = 0; dayOffset < 31; dayOffset++) {
    const date = toDateString(subDays(today, dayOffset));
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    for (const equipment of EQUIPMENT) {
      // Ã¬ÂÂ¼Ã«Â¶Â Ã¬ÂÂ¤Ã«Â¹ÂÃÂ·Ã«ÂÂ Ã¬Â§ÂÃ«ÂÂ Ã«Â¹ÂÃªÂ°ÂÃ«ÂÂ(Ã«ÂÂ°Ã¬ÂÂ´Ã­ÂÂ° Ã¬ÂÂÃ¬ÂÂ)
      if (rand() < (isWeekend ? 0.35 : 0.08)) continue;

      const shiftModes: ShiftType[] =
        isWeekend
          ? rand() < 0.55
            ? ["Ã¬Â£Â¼ÃªÂ°Â"]
            : ["Ã¬ÂÂ¼ÃªÂ°Â"]
          : rand() < 0.55
            ? ["Ã¬Â£Â¼ÃªÂ°Â", "Ã¬ÂÂ¼ÃªÂ°Â"]
            : rand() < 0.7
              ? ["Ã¬Â£Â¼ÃªÂ°Â"]
              : ["Ã¬ÂÂ¼ÃªÂ°Â"];

      for (const shiftType of shiftModes) {
        const partPool = PARTS.filter((p) => {
          if (equipment.factory === "2공장")
            return p.productType === "GROMMET" || rand() > 0.9;
          return true;
        });
        const part = pick(rand, partPool.length ? partPool : PARTS);
        const hasDowntime = rand() < 0.3;
        const reason = hasDowntime ? pick(rand, REASONS) : null;
        const downtime = hasDowntime ? 15 + Math.floor(rand() * 140) : 0;
        const elapsed = 480 + Math.floor(rand() * 80);
        const safeDowntime = Math.min(downtime, elapsed - 20);
        const production = 700 + Math.floor(rand() * 2400);
        const defect = Math.floor(rand() * (production * 0.02));

        records.push(
          buildRecord(idx++, {
            workDate: date,
            factory: equipment.factory,
            productType: part.productType,
            equipmentId: equipment.id,
            equipmentName: equipment.name,
            partId: part.id,
            partNumber: part.partNumber,
            shiftType,
            elapsedMinutes: elapsed,
            downtimeMinutes: safeDowntime,
            downtimeReasonRaw: safeDowntime > 0 ? reason : null,
            productionQuantity: production,
            defectQuantity: defect,
            cavity: part.productType === "SEAL" ? 2 : 4,
            startedAt:
              shiftType === "Ã¬Â£Â¼ÃªÂ°Â"
                ? `${date}T07:30:00`
                : `${date}T19:30:00`,
            endedAt:
              shiftType === "Ã¬Â£Â¼ÃªÂ°Â"
                ? `${date}T16:30:00`
                : `${date}T04:30:00`,
          }),
        );
      }
    }
  }

  // Ã¬ÂÂ¤Ã«Â¥Â Ã¬ÂÂÃ­ÂÂ Ã¬ÂÂÃ«ÂÂÃ«Â§Â Ã¬ÂÂ Ã¬Â§Â
  const errorSpecs: Array<{ codes: ErrorCode[]; patch: Partial<ProductionRecord> }> = [
    ...Array.from({ length: 3 }, () => ({
      codes: ["WORK_TIME_ZERO"] as ErrorCode[],
      patch: { elapsedMinutes: 0, downtimeMinutes: 0, productionQuantity: 500 },
    })),
    ...Array.from({ length: 4 }, () => ({
      codes: ["PRODUCTION_ZERO"] as ErrorCode[],
      patch: { productionQuantity: 0, elapsedMinutes: 480, downtimeMinutes: 30 },
    })),
    ...Array.from({ length: 2 }, () => ({
      codes: ["DOWNTIME_GT_WORK_TIME"] as ErrorCode[],
      patch: { elapsedMinutes: 100, downtimeMinutes: 140, productionQuantity: 300 },
    })),
    {
      codes: ["OPERATING_TIME_NON_POSITIVE"] as ErrorCode[],
      patch: { elapsedMinutes: 0, downtimeMinutes: 120, productionQuantity: 200 },
    },
  ];

  for (const spec of errorSpecs) {
    const equipment = pick(rand, EQUIPMENT);
    const part = pick(rand, PARTS);
    const date = toDateString(subDays(today, Math.floor(rand() * 31)));
    const elapsed = spec.patch.elapsedMinutes ?? 0;
    const downtime = spec.patch.downtimeMinutes ?? 0;
    records.push(
      buildRecord(idx++, {
        workDate: date,
        factory: equipment.factory,
        productType: part.productType,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        partId: part.id,
        partNumber: part.partNumber,
        ...spec.patch,
        operatingMinutes: elapsed,
        errorCodes: spec.codes,
        isAnalysisEligible: false,
        isFailureCandidate: false,
        isMttrEligible: false,
        downtimeReasonRaw:
          spec.codes.includes("DOWNTIME_GT_WORK_TIME") ||
          spec.codes.includes("OPERATING_TIME_NON_POSITIVE")
            ? "Ã¬ÂÂ¤Ã«Â¹ÂÃ¬ÂÂ´Ã¬ÂÂ"
            : null,
      }),
    );
  }

  const validCount = records.filter((r) => r.isAnalysisEligible).length;
  const excludedCount = records.length - validCount;

  const batch: UploadBatch = {
    id: "batch-active-001",
    originalFileName: "Ã¬ÂÂ±Ã­ÂÂÃ¬ÂÂÃ¬ÂÂÃ¬ÂÂ¼Ã«Â³Â´ Ã¬ÂÂÃ­ÂÂ.xls",
    status: "active",
    sourceRowCount: records.length,
    validRowCount: validCount,
    excludedRowCount: excludedCount,
    warningRowCount: 2,
    uploadedAt: `${toDateString(subDays(today, 1))}T18:40:00+09:00`,
    activatedAt: `${toDateString(subDays(today, 1))}T18:45:00+09:00`,
  };

  return { records, batch };
}

const generated = generateDataset();

export const ACTIVE_BATCH = generated.batch;
export const ALL_RECORDS = generated.records;

export const FILTER_OPTIONS = {
  equipment: EQUIPMENT.map((e) => ({ id: e.id, label: e.name, factory: e.factory })),
  parts: PARTS.map((p) => ({
    id: p.id,
    label: p.partNumber,
    productType: p.productType,
  })),
  operators: OPERATORS.map((o) => ({ id: o.id, label: o.name })),
  molds: MOLDS.map((m) => ({ id: m.id, label: m.moldNumber })),
};

export function getRecordById(id: string) {
  return ALL_RECORDS.find((r) => r.id === id);
}

export function getEquipmentById(id: string) {
  const fromList = EQUIPMENT.find((e) => e.id === id);
  const master =
    (fromList ? getEquipmentMasterByName(fromList.name) : undefined) ??
    getEquipmentMasterById(id);
  if (!master && !fromList) return undefined;
  return {
    id: fromList?.id ?? equipmentIdFromName(master!.name),
    name: fromList?.name ?? master!.name,
    factory: master?.factory ?? fromList!.factory,
    platenSize: master?.platenSize ?? null,
    capacityTon: master?.capacityTon ?? null,
    productType: master?.productType ?? null,
  };
}

export function getPartById(id: string) {
  return PARTS.find((p) => p.id === id);
}

export function getOperatorById(id: string) {
  return OPERATORS.find((o) => o.id === id);
}

export function getMoldById(id: string) {
  return MOLDS.find((m) => m.id === id);
}
