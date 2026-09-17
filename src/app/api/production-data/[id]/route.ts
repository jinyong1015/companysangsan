import { NextResponse } from "next/server";
import { appendChangeLog } from "@/lib/admin/audit";
import {
  ADMIN_SESSION_COOKIE,
  encodeSession,
  requireAdminSession,
  sessionCookieOptions,
  touchSession,
} from "@/lib/admin/session";

type PatchBody = {
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { ok: false, message: "수정 대상 ID가 없습니다." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json(
      { ok: false, message: "수정 사유를 입력해 주세요." },
      { status: 400 },
    );
  }

  const before = asRecord(body?.before);
  const after = asRecord(body?.after);
  const fields = asStringArray(body?.fields);
  const clientInfo =
    request.headers.get("user-agent")?.slice(0, 240) ?? "unknown";

  const entry = await appendChangeLog({
    recordId: id,
    fields: fields.length > 0 ? fields : Object.keys(after),
    before,
    after,
    reason,
    sessionId: auth.session.sid,
    clientInfo,
    statusBefore: asStatus(body?.statusBefore),
    statusAfter: asStatus(body?.statusAfter),
  });

  const refreshed = touchSession(auth.session);
  const response = NextResponse.json({
    ok: true,
    changeId: entry.id,
    message:
      "생산 DATA가 수정되었습니다. 변경 내용이 전체 분석 메뉴에 반영되었습니다.",
  });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    encodeSession(refreshed),
    sessionCookieOptions(),
  );
  return response;
}
