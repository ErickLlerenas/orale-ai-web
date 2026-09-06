import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function publicSupabaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  return url.replace(/\/$/, "");
}

export function publicAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function ownerAuthConfigured(): boolean {
  return publicSupabaseUrl().length > 0 && publicAnonKey().length > 0;
}

/** Cliente de navegador. La anon key es pública (la misma de la app). */
export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = publicSupabaseUrl();
  const key = publicAnonKey();
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  browserClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}
