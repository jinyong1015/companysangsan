import { NextResponse } from "next/server";
import { isAdminPasswordConfigured, verifyAdminPassword } from "@/lib/admin/password";
import {
  ADMIN_SESSION_COOKIE,
  createSessionPayload,
  encodeSession,
  sessionCookieOptions,
} from "@/lib/admin/session";

export async function POST(request: Request) {
  try {
    if (!isAdminPasswordConfigured()) {
      return NextResponse.json(
        { ok: false, message: "관리자 비밀번호가 서버에 설정되지 않았습니다." },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      password?: unknown;
    } | null;
    const password = typeof body?.password === "string" ? body.password : "";

    if (!password.trim()) {
      return NextResponse.json(
        { ok: false, message: "관리자 비밀번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    const valid = await verifyAdminPassword(password);
    if (!valid) {
      return NextResponse.json(
        { ok: false, message: "관리자 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    const session = createSessionPayload();
    const token = encodeSession(session);
    const response = NextResponse.json({
      ok: true,
      message: "관리자 모드로 로그인되었습니다.",
      expiresAt: session.exp,
    });
    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      token,
      sessionCookieOptions(),
    );
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, message: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
