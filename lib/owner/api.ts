import { getBrowserSupabase, publicAnonKey, publicSupabaseUrl } from "@/lib/supabase-public";
import { parseOwnerMetrics } from "./parse";
import type { OwnerMetricsBundle } from "./types";

export class OwnerApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnerApiError";
  }
}

export async function fetchOwnerMetrics(): Promise<OwnerMetricsBundle> {
  const supabase = getBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new OwnerApiError("Entra con Google para continuar.");
  }

  let res: Response;
  try {
    res = await fetch(`${publicSupabaseUrl()}/functions/v1/get-owner-metrics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: publicAnonKey(),
      },
      body: "{}",
    });
  } catch {
    throw new OwnerApiError(
      "No pudimos conectarnos. Revisa tu internet e inténtalo de nuevo.",
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new OwnerApiError("No se pudo completar la operación. Inténtalo más tarde.");
  }

  if (!res.ok) {
    const message =
      json && typeof json === "object" && "error" in json
        ? String((json as { error?: unknown }).error ?? "").trim()
        : "";
    throw new OwnerApiError(
      message || "No se pudo completar la operación. Inténtalo más tarde.",
    );
  }

  return parseOwnerMetrics(json);
}
