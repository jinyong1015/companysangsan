import type { Factory, ProductType } from "@/types";
import { slugId } from "@/lib/dimensions";

/** 1·2공장 설비현황 고정 마스터 (공장구분·열판·용량) */
export interface EquipmentMaster {
  name: string;
  factory: Factory;
  productType: ProductType;
  /** 열판 사이즈 (예: 600열판) */
  platenSize: string;
  /** 용량(TON) 원문 (예: 300TON, 2000CC(350TON)) */
  capacityTon: string;
}

export const EQUIPMENT_MASTER: EquipmentMaster[] = [
  { name: 'GP01-1', factory: '1공장', productType: 'GROMMET', platenSize: '400열판', capacityTon: '200TON' },
  { name: 'GP01-2', factory: '1공장', productType: 'GROMMET', platenSize: '400열판', capacityTon: '200TON' },
  { name: 'GP01-3', factory: '1공장', productType: 'GROMMET', platenSize: '400열판', capacityTon: '200TON' },
  { name: 'GP02-1', factory: '1공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'GP02-2', factory: '1공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'GP02-3', factory: '1공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'GP04-1', factory: '1공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'GP04-2', factory: '1공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'GP04-3', factory: '1공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS01-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS01-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS01-3', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS02-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS02-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS02-3', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS03-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS03-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS03-3', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS04-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS04-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS05-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS05-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS06-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS06-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS07-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS07-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS07-3', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS08-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS08-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS08-3', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS09-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS09-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS09-3', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS10-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS10-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS11-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS11-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS12-1', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS12-2', factory: '1공장', productType: 'SEAL', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PS13-1', factory: '1공장', productType: 'SEAL', platenSize: '500열판', capacityTon: '250TON' },
  { name: 'PS13-2', factory: '1공장', productType: 'SEAL', platenSize: '500열판', capacityTon: '250TON' },
  { name: 'PS13-3', factory: '1공장', productType: 'SEAL', platenSize: '500열판', capacityTon: '250TON' },
  { name: 'IN-01', factory: '2공장', productType: 'GROMMET', platenSize: '650열판', capacityTon: '2000CC(350TON)' },
  { name: 'IN-02', factory: '2공장', productType: 'GROMMET', platenSize: '650열판', capacityTon: '2000CC(350TON)' },
  { name: 'IN-03', factory: '2공장', productType: 'GROMMET', platenSize: '650열판', capacityTon: '3000CC(350TON)' },
  { name: 'IN-05', factory: '2공장', productType: 'GROMMET', platenSize: '800열판', capacityTon: '4000CC(450TON)' },
  { name: 'IN-06', factory: '2공장', productType: 'GROMMET', platenSize: '800열판', capacityTon: '4000CC(450TON)' },
  { name: 'IN-07', factory: '2공장', productType: 'GROMMET', platenSize: '800열판', capacityTon: '4000CC(450TON)' },
  { name: 'IN-08', factory: '2공장', productType: 'GROMMET', platenSize: '800열판', capacityTon: '4000CC(450TON)' },
  { name: 'IN-09', factory: '2공장', productType: 'GROMMET', platenSize: '800열판', capacityTon: '4000CC(450TON)' },
  { name: 'IN-10', factory: '2공장', productType: 'GROMMET', platenSize: '800열판', capacityTon: '4000CC(450TON)' },
  { name: 'IN-11', factory: '2공장', productType: 'GROMMET', platenSize: '650열판', capacityTon: '2000CC(350TON)' },
  { name: 'IN-12', factory: '2공장', productType: 'GROMMET', platenSize: '650열판', capacityTon: '2000CC(350TON)' },
  { name: 'IN-13', factory: '2공장', productType: 'GROMMET', platenSize: '650열판', capacityTon: '2000CC(350TON)' },
  { name: 'IN-14', factory: '2공장', productType: 'GROMMET', platenSize: '1000열판', capacityTon: '7000CC(600TON)' },
  { name: 'PG01-1', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG01-2', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG01-3', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG02-1', factory: '2공장', productType: 'GROMMET', platenSize: '500열판', capacityTon: '250TON' },
  { name: 'PG02-2', factory: '2공장', productType: 'GROMMET', platenSize: '500열판', capacityTon: '250TON' },
  { name: 'PG02-3', factory: '2공장', productType: 'GROMMET', platenSize: '500열판', capacityTon: '250TON' },
  { name: 'PG03-1', factory: '2공장', productType: 'GROMMET', platenSize: '400열판', capacityTon: '200TON' },
  { name: 'PG03-2', factory: '2공장', productType: 'GROMMET', platenSize: '400열판', capacityTon: '200TON' },
  { name: 'PG03-3', factory: '2공장', productType: 'GROMMET', platenSize: '400열판', capacityTon: '200TON' },
  { name: 'PG04-1', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG04-2', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG04-3', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG05-1', factory: '2공장', productType: 'GROMMET', platenSize: '300열판', capacityTon: '110TON' },
  { name: 'PG05-2', factory: '2공장', productType: 'GROMMET', platenSize: '300열판', capacityTon: '110TON' },
  { name: 'PG05-3', factory: '2공장', productType: 'GROMMET', platenSize: '300열판', capacityTon: '110TON' },
  { name: 'PG05-4', factory: '2공장', productType: 'GROMMET', platenSize: '300열판', capacityTon: '110TON' },
  { name: 'PG06-1', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG06-2', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG06-3', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG07-1', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG07-2', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG07-3', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG08-1', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG08-2', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG08-3', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG09-1', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG09-2', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG09-3', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG10-1', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG10-2', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG10-3', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '300TON' },
  { name: 'PG11-1', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG11-2', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG11-3', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG12-1', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG12-2', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG12-3', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG13-1', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG13-2', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
  { name: 'PG13-3', factory: '2공장', productType: 'GROMMET', platenSize: '600열판', capacityTon: '350TON' },
];

const BY_NAME = new Map(
  EQUIPMENT_MASTER.map((e) => [e.name.trim().toUpperCase(), e]),
);

export function getEquipmentMasterByName(
  name: string | null | undefined,
): EquipmentMaster | undefined {
  if (!name) return undefined;
  return BY_NAME.get(name.trim().toUpperCase());
}

/** 마스터에 있으면 고정 공장, 없으면 null */
export function resolveFixedFactory(
  equipmentName: string | null | undefined,
): Factory | null {
  return getEquipmentMasterByName(equipmentName)?.factory ?? null;
}

export function equipmentIdFromName(name: string): string {
  return slugId("eq", name);
}

export function getEquipmentMasterById(
  id: string | null | undefined,
): EquipmentMaster | undefined {
  if (!id) return undefined;
  return EQUIPMENT_MASTER.find((e) => equipmentIdFromName(e.name) === id);
}
