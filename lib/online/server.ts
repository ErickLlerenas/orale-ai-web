import "server-only";
import type { Menu } from "./types";

export class MenuError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
export async function loadMenu(slug: string): Promise<Menu> {
  if (!/^[a-z0-9-]{1,100}$/.test(slug))
    throw new MenuError("Menú no disponible.", 404);
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base)
    throw new MenuError("No pudimos cargar el menú. Intenta más tarde.");
  try {
    const response = await fetch(
      `${base}/functions/v1/online-store?slug=${encodeURIComponent(slug)}`,
      { cache: "no-store", signal: AbortSignal.timeout(20000) },
    );
    const data = await response.json();
    if (!response.ok)
      throw new MenuError(data.error ?? "Menú no disponible.", response.status);
    return data as Menu;
  } catch (e) {
    if (e instanceof MenuError) throw e;
    throw new MenuError("No pudimos cargar el menú. Intenta más tarde.");
  }
}
