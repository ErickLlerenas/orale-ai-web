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
    if (data.catalog?.currency != null && data.catalog.currency !== "MXN")
      throw new MenuError("El menú usa un formato de importes incompatible.", 410);
    return data as Menu;
  } catch (e) {
    if (e instanceof MenuError) throw e;
    throw new MenuError("No pudimos cargar el menú. Intenta más tarde.");
  }
}

/** Los textos del dueño en inglés: «texto en español» → «texto en inglés». */
export type MenuTranslations = {
  translations: Record<string, string>;
  /** El servidor sigue traduciendo: vale la pena volver a pedir. */
  pending: boolean;
};

/**
 * Pide al servidor la traducción del menú. La primera vez la hace la IA y se
 * guarda; después sale de lo guardado. Nunca lanza: si algo falla el menú se
 * ve con los platillos en español, que es como estaba.
 */
export async function loadMenuTranslations(
  slug: string,
): Promise<MenuTranslations> {
  const none: MenuTranslations = { translations: {}, pending: false };
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return none;
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return none;
  try {
    const response = await fetch(
      `${base}/functions/v1/online-store?slug=${encodeURIComponent(slug)}&lang=en`,
      { cache: "no-store", signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) return none;
    const data = await response.json();
    const raw = data?.translations;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return none;
    return {
      translations: Object.fromEntries(
        Object.entries(raw).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
      pending: data.pending === true,
    };
  } catch {
    // Se tardó o no contestó: puede seguir traduciendo; la página reintenta.
    return { translations: {}, pending: true };
  }
}
