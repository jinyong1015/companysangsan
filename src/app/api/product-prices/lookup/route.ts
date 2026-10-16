import { NextResponse } from "next/server";
import { getProductPriceMap } from "@/lib/productPrices/getProductPrice";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** 분석용 품번→단가 조회 (관리 화면과 별도, 서버 RPC) */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Supabase가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    partNumbers?: unknown;
  } | null;
  const raw = body?.partNumbers;
  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { ok: false, message: "partNumbers 배열이 필요합니다." },
      { status: 400 },
    );
  }

  const partNumbers = raw
    .filter((v): v is string => typeof v === "string")
    .slice(0, 2000);

  try {
    const map = await getProductPriceMap(partNumbers);
    const prices: Record<string, number> = {};
    for (const [k, v] of map) prices[k] = v;
    return NextResponse.json({ ok: true, prices });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "단가 조회에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
