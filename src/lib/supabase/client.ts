import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
}

export function getSupabaseAnonKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    null
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/** 브라우저/서버 공용 anon 클라이언트 (읽기·RPC 호출용) */
export function getSupabaseAnonClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error(
      "Supabase 환경변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정하세요.",
    );
  }
  if (typeof window === "undefined") {
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  if (!browserClient) {
    browserClient = createClient(url, key);
  }
  return browserClient;
}

export function getProductPricesRpcSecret(): string {
  const secret = process.env.PRODUCT_PRICES_RPC_SECRET?.trim();
  if (!secret) {
    throw new Error("PRODUCT_PRICES_RPC_SECRET 이 설정되지 않았습니다.");
  }
  return secret;
}
