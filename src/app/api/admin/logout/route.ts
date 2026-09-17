import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/admin/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
