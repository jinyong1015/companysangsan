import { NextResponse } from "next/server";
import { listChangeLogs } from "@/lib/admin/audit";
import {
  ADMIN_SESSION_COOKIE,
  encodeSession,
  requireAdminSession,
  sessionCookieOptions,
  touchSession,
} from "@/lib/admin/session";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "50");
  const items = await listChangeLogs(Number.isFinite(limit) ? limit : 50);

  const refreshed = touchSession(auth.session);
  const response = NextResponse.json({ ok: true, items });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    encodeSession(refreshed),
    sessionCookieOptions(),
  );
  return response;
}
