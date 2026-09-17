import { NextResponse } from "next/server";
import { appendChangeLog } from "@/lib/admin/audit";
import {
  ADMIN_SESSION_COOKIE,
  encodeSession,
  requireAdminSession,
  sessionCookieOptions,
  touchSession,
} from "@/lib/admin/session";

type BulkItem = {
  id?: unknown;
  reason?: unknown;
  before?: unknown;
  after?: unknown;
  fields?: unknown;
  statusBefore?: unknown;
  statusAfter?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asStatus(value: unknown): {
  isAnalysisEligible: boolean;
  errorCodes: string[];
} {
  const rec = asRecord(value);
  return {
    isAnalysisEligible: Boolean(rec.isAnalysisEligible),
    errorCodes: asStringArray(rec.errorCodes),
  };
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as {
    items?: unknown;
  } | null;
  const items = Array.isArray(body?.items) ? (body.items as BulkItem[]) : [];
  if (items.length === 0) {
    return NextResponse.json(
      { ok: false, message: "수정할 항목이 없습니다." },
      { status: 400 },
    );
  }

  const clientInfo =
    request.headers.get("user-agent")?.slice(0, 240) ?? "unknown";
  const changeIds: string[] = [];

  for (const item of items) {
    const id = typeof item.id === "string" ? item.id : "";
    const reason = typeof item.reason === "string" ? item.reason.trim() : "";
    if (!id || !reason) {
      return NextResponse.json(
        { ok: false, message: "각 항목에 ID와 수정 사유가 필요합니다." },
        { status: 400 },
      );
    }
    const entry = await appendChangeLog({
      recordId: id,
      fields: asStringArray(item.fields),
      before: asRecord(item.before),
      after: asRecord(item.after),
      reason,
      sessionId: auth.session.sid,
      clientInfo,
      statusBefore: asStatus(item.statusBefore),
      statusAfter: asStatus(item.statusAfter),
    });
    changeIds.push(entry.id);
  }

  const refreshed = touchSession(auth.session);
  const response = NextResponse.json({
    ok: true,
    changeIds,
    message: "생산 DATA가 수정되었습니다. 변경 내용이 전체 분석 메뉴에 반영되었습니다.",
  });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    encodeSession(refreshed),
    sessionCookieOptions(),
  );
  return response;
}
