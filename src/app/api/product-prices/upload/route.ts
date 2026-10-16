import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  encodeSession,
  requireAdminSession,
  sessionCookieOptions,
  touchSession,
} from "@/lib/admin/session";
import {
  getProductPricesRpcSecret,
  getSupabaseAnonClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

type UploadBody = {
  fileName?: string;
  /** 실제 DB 반영 대상: 신규·단가 변경만 */
  rows?: Array<{ part_number: string; unit_price: number }>;
  summary?: {
    total?: number;
    insert?: number;
    update?: number;
    unchanged?: number;
    error?: number;
  };
};

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: "관리자 모드에서만 업로드할 수 있습니다." },
      { status: auth.status },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Supabase가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as UploadBody | null;
  const rows = (body?.rows ?? []).filter(
    (r) =>
      r &&
      typeof r.part_number === "string" &&
      r.part_number.trim() &&
      Number.isFinite(Number(r.unit_price)) &&
      Number(r.unit_price) > 0,
  );

  const summary = body?.summary;
  const insertCount = Math.max(0, Number(summary?.insert ?? 0));
  const updateCount = Math.max(0, Number(summary?.update ?? 0));
  const unchangedCount = Math.max(0, Number(summary?.unchanged ?? 0));
  const errorCount = Math.max(0, Number(summary?.error ?? 0));
  const totalCount = Math.max(
    0,
    Number(summary?.total ?? insertCount + updateCount + unchangedCount + errorCount),
  );

  // 신규/변경이 하나도 없으면 DB 단가 테이블은 건드리지 않음
  if (rows.length === 0 && insertCount + updateCount === 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "DB에 반영할 신규·단가 변경 건이 없습니다. 미리보기에서 확인 후 다시 시도해 주세요.",
      },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAnonClient();
    const secret = getProductPricesRpcSecret();

    let inserted = 0;
    let updated = 0;
    let unchanged = unchangedCount;

    if (rows.length > 0) {
      // 미리보기 확정(업로드 실행) 시에만 단가 테이블에 기록
      const { data, error } = await supabase.rpc("rpc_upsert_product_prices", {
        p_secret: secret,
        p_rows: rows,
        p_file_name: body?.fileName ?? null,
        p_write_history: false,
      });
      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message },
          { status: 500 },
        );
      }
      const result = data as {
        inserted?: number;
        updated?: number;
        unchanged?: number;
      } | null;
      inserted = Number(result?.inserted ?? 0);
      updated = Number(result?.updated ?? 0);
      // RPC에 넘긴 행은 신규·변경만이어야 하므로 unchanged는 요약값 유지
      unchanged = unchangedCount;
    }

    const { error: histError } = await supabase.rpc(
      "rpc_record_product_price_upload",
      {
        p_secret: secret,
        p_file_name: body?.fileName ?? null,
        p_total_count: totalCount || inserted + updated + unchanged + errorCount,
        p_inserted_count: insertCount || inserted,
        p_updated_count: updateCount || updated,
        p_unchanged_count: unchanged,
        p_error_count: errorCount,
      },
    );
    if (histError) {
      return NextResponse.json(
        {
          ok: false,
          message: `단가는 반영되었으나 업로드 이력 저장에 실패했습니다: ${histError.message}`,
          result: {
            inserted,
            updated,
            unchanged,
            total: inserted + updated + unchanged,
          },
        },
        { status: 500 },
      );
    }

    const res = NextResponse.json({
      ok: true,
      result: {
        inserted: insertCount || inserted,
        updated: updateCount || updated,
        unchanged,
        error: errorCount,
        total: totalCount || inserted + updated + unchanged + errorCount,
      },
    });
    res.cookies.set(
      ADMIN_SESSION_COOKIE,
      encodeSession(touchSession(auth.session)),
      sessionCookieOptions(),
    );
    return res;
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "업로드에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
