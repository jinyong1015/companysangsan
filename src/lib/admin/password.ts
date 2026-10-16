import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  getProductPricesRpcSecret,
  getSupabaseAnonClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const scryptAsync = promisify(scrypt);

const SCRYPT_KEYLEN = 64;
const HASH_PREFIX = "scrypt";

export type PasswordHashParts = {
  salt: Buffer;
  hash: Buffer;
};

/** `scrypt:<salt_b64>:<hash_b64>` 형식 */
export function serializePasswordHash(parts: PasswordHashParts): string {
  return `${HASH_PREFIX}:${parts.salt.toString("base64")}:${parts.hash.toString("base64")}`;
}

export function parsePasswordHash(serialized: string): PasswordHashParts | null {
  const [prefix, saltB64, hashB64] = serialized.split(":");
  if (prefix !== HASH_PREFIX || !saltB64 || !hashB64) return null;
  try {
    return {
      salt: Buffer.from(saltB64, "base64"),
      hash: Buffer.from(hashB64, "base64"),
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string, salt?: Buffer): Promise<string> {
  const usedSalt = salt ?? randomBytes(16);
  const derived = (await scryptAsync(password, usedSalt, SCRYPT_KEYLEN)) as Buffer;
  return serializePasswordHash({ salt: usedSalt, hash: derived });
}

async function hashWithSalt(password: string, salt: Buffer): Promise<Buffer> {
  return (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function fetchAdminPasswordHashFromSupabase(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase.rpc("rpc_get_admin_password_hash", {
      p_secret: getProductPricesRpcSecret(),
    });
    if (error || typeof data !== "string" || !data.trim()) return null;
    return data.trim();
  } catch {
    return null;
  }
}

function envAdminPasswordHash(): string | null {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || null;
}

/**
 * 관리자 비밀번호 해시 조회.
 * 1) Supabase private.app_config (admin_password_hash)
 * 2) 환경변수 ADMIN_PASSWORD_HASH (폴백)
 */
export async function resolveAdminPasswordHash(): Promise<string | null> {
  const fromDb = await fetchAdminPasswordHashFromSupabase();
  if (fromDb) return fromDb;
  return envAdminPasswordHash();
}

/**
 * - Supabase에 저장된 scrypt 해시로 검증 (우선)
 * - ADMIN_PASSWORD_HASH / ADMIN_PASSWORD 환경변수 폴백
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!password || !password.trim()) return false;

  const configuredHash = await resolveAdminPasswordHash();
  if (configuredHash) {
    const parts = parsePasswordHash(configuredHash);
    if (!parts) return false;
    const derived = await hashWithSalt(password, parts.salt);
    return safeEqual(derived, parts.hash);
  }

  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) return false;

  const secret = process.env.ADMIN_SESSION_SECRET ?? "dev-only-admin-session";
  const salt = createHash("sha256")
    .update(`admin-pw-salt:${secret}`)
    .digest()
    .subarray(0, 16);
  const a = await hashWithSalt(password, salt);
  const b = await hashWithSalt(configuredPassword, salt);
  return safeEqual(a, b);
}

export async function isAdminPasswordConfigured(): Promise<boolean> {
  if (await resolveAdminPasswordHash()) return true;
  return Boolean(process.env.ADMIN_PASSWORD);
}
