import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  encodeSession,
  isSessionValid,
  readAdminSession,
  sessionCookieOptions,
  touchSession,
} from "@/lib/admin/session";

export async function GET() {
  const payload = await readAdminSession();
  if (!isSessionValid(payload)) {
    const response = NextResponse.json({ authenticated: false });
    if (payload) {
      response.cookies.set(ADMIN_SESSION_COOKIE, "", {
        ...sessionCookieOptions(0),
        maxAge: 0,
      });
    }
    return response;
  }

  const refreshed = touchSession(payload);
  const response = NextResponse.json({
    authenticated: true,
    expiresAt: refreshed.exp,
    sessionId: refreshed.sid,
  });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    encodeSession(refreshed),
    sessionCookieOptions(),
  );
  return response;
}
