import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  encodeSession,
  requireAdminSession,
  sessionCookieOptions,
  touchSession,
} from "@/lib/admin/session";
import {
  buildPricePreview,
  parseProductPriceExcel,
  resolveInFileDuplicates,
} from "@/lib/productPrices/parseExcel";
import { getProductPriceMap } from "@/lib/productPrices/getProductPrice";
import { isSupabaseConfigured } from "@/lib/supabase/client";

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

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "엑셀 파일이 필요합니다." },
        { status: 400 },
      );
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      return NextResponse.json(
        { ok: false, message: ".xlsx 또는 .xls 파일만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseProductPriceExcel(buffer);
    const { unique, conflicts } = resolveInFileDuplicates(parsed.rows);
    const existing = await getProductPriceMap(
      unique.map((r) => r.partNumber),
    );
    const preview = buildPricePreview(
      unique,
      existing,
      parsed.errors,
      conflicts,
    );

    const summary = {
      total: preview.length,
      insert: preview.filter((p) => p.action === "insert").length,
      update: preview.filter((p) => p.action === "update").length,
      unchanged: preview.filter((p) => p.action === "unchanged").length,
      error: preview.filter((p) => p.action === "error").length,
      upsertCandidates: unique.length,
    };

    // DB 반영은 "업로드 실행"에서만. 미리보기는 신규·변경 후보만 내려준다.
    const changeRows = preview
      .filter((p) => p.action === "insert" || p.action === "update")
      .map((p) => ({
        part_number: p.partNumber,
        unit_price: p.uploadPrice as number,
      }));

    const res = NextResponse.json({
      ok: true,
      fileName: file.name,
      summary,
      preview,
      upsertRows: changeRows,
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
        message: e instanceof Error ? e.message : "미리보기에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}
