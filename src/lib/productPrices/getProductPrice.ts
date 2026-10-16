import {
  getProductPricesRpcSecret,
  getSupabaseAnonClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { normalizePartNumber } from "@/lib/productPrices/parseExcel";

export type ProductPriceLookup =
  | { status: "ok"; partNumber: string; unitPrice: number }
  | { status: "missing"; partNumber: string; unitPrice: null }
  | { status: "unavailable"; partNumber: string; unitPrice: null; reason: string };

/**
 * 품번 기준 최신 단가 조회 (서버 전용 RPC).
 * 단가 미등록은 0으로 바꾸지 않고 missing 으로 구분한다.
 */
export async function getProductPrice(
  partNumber: string,
): Promise<ProductPriceLookup> {
  const normalized = normalizePartNumber(partNumber);
  if (!normalized) {
    return {
      status: "unavailable",
      partNumber: "",
      unitPrice: null,
      reason: "품번이 비어 있습니다.",
    };
  }
  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      partNumber: normalized,
      unitPrice: null,
      reason: "Supabase가 설정되지 않았습니다.",
    };
  }
  try {
    const map = await getProductPriceMap([normalized]);
    if (!map.has(normalized)) {
      return { status: "missing", partNumber: normalized, unitPrice: null };
    }
    return {
      status: "ok",
      partNumber: normalized,
      unitPrice: map.get(normalized)!,
    };
  } catch (e) {
    return {
      status: "unavailable",
      partNumber: normalized,
      unitPrice: null,
      reason: e instanceof Error ? e.message : "조회 실패",
    };
  }
}

/** 여러 품번 단가를 Map으로 조회 (없는 품번은 키 없음). 서버 RPC 시크릿 필요. */
export async function getProductPriceMap(
  partNumbers: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const unique = [
    ...new Set(partNumbers.map(normalizePartNumber).filter(Boolean)),
  ];
  if (!unique.length || !isSupabaseConfigured()) return map;

  const supabase = getSupabaseAnonClient();
  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase.rpc(
      "rpc_get_product_prices_by_parts",
      {
        p_secret: getProductPricesRpcSecret(),
        p_parts: chunk,
      },
    );
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      part_number?: string;
      unit_price?: number;
    }>;
    for (const row of rows) {
      if (row.part_number == null) continue;
      map.set(String(row.part_number), Number(row.unit_price));
    }
  }
  return map;
}
