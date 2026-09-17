import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "pa_admin_session";

/** 유휴 만료 (ms) — 활동 없으면 자동 로그아웃 */
export const ADMIN_IDLE_MS = 30 * 60 * 1000;
/** 절대 만료 (ms) */
export const ADMIN_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export type AdminSessionPayload = {
  sid: string;
  iat: number;
  exp: number;
  lastActivity: number;
};

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "dev-only-admin-session-secret";
  }
  throw new Error("ADMIN_SESSION_SECRET is not configured");
}

function sign(body: string): string {
  return createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
}

export function encodeSession(payload: AdminSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined | null): AdminSessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as AdminSessionPayload;
    if (
      typeof payload.sid !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      typeof payload.lastActivity !== "number"
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createSessionPayload(now = Date.now()): AdminSessionPayload {
  return {
    sid: randomBytes(16).toString("hex"),
    iat: now,
    exp: now + ADMIN_ABSOLUTE_MS,
    lastActivity: now,
  };
}

export function isSessionValid(
  payload: AdminSessionPayload | null,
  now = Date.now(),
): payload is AdminSessionPayload {
  if (!payload) return false;
  if (now > payload.exp) return false;
  if (now - payload.lastActivity > ADMIN_IDLE_MS) return false;
  return true;
}

export function touchSession(
  payload: AdminSessionPayload,
  now = Date.now(),
): AdminSessionPayload {
  return { ...payload, lastActivity: now };
}

export function sessionCookieOptions(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    // maxAge 미설정 = 브라우저 세션 쿠키 (종료 시 삭제). 유휴/절대 만료는 토큰 payload에서 검증.
    ...(typeof maxAgeSeconds === "number" ? { maxAge: maxAgeSeconds } : {}),
  };
}

export async function readAdminSession(): Promise<AdminSessionPayload | null> {
  const jar = await cookies();
  return decodeSession(jar.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminSession(): Promise<
  | { ok: true; session: AdminSessionPayload }
  | { ok: false; status: 401 | 403; message: string }
> {
  const payload = await readAdminSession();
  if (!isSessionValid(payload)) {
    return {
      ok: false,
      status: 403,
      message: "관리자 권한이 없어 생산 DATA를 수정할 수 없습니다.",
    };
  }
  return { ok: true, session: payload };
}
