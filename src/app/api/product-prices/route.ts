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

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: "관리자 모드에서만 조회할 수 있습니다." },
      { status: auth.status },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Supabase가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const sort = searchParams.get("sort") ?? "updated_at";
  const ascending = searchParams.get("order") === "asc";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? 20) || 20),
  );
  const from = (page - 1) * pageSize;

  try {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase.rpc("rpc_list_product_prices", {
      p_secret: getProductPricesRpcSecret(),
      p_q: q || null,
      p_sort: sort,
      p_ascending: ascending,
      p_from: from,
      p_limit: pageSize,
    });
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 },
      );
    }

    const payload = data as {
      items?: unknown[];
      total?: number;
      lastUpload?: unknown;
    } | null;

    const res = NextResponse.json({
      ok: true,
      items: payload?.items ?? [],
      total: Number(payload?.total ?? 0),
      page,
      pageSize,
      lastUpload: payload?.lastUpload ?? null,
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
        message: e instanceof Error ? e.message : "조회에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
