import { createClient } from "@supabase/supabase-js";

const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

/// Tope de PostgREST: cada request trae a lo más esto. `fetchAll` pide
/// páginas hasta vaciar la tabla, para que el dashboard no se quede corto.
const PAGE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type RangeQuery<T> = {
  range: (from: number, to: number) => PromiseLike<PageResult<T>>;
};

/// Cliente con service role. SOLO debe usarse del lado servidor.
export function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: noStoreFetch },
  });
}

/// Trae todas las filas de una consulta, página a página.
/// Sin esto, Supabase corta en 1000 y el panel cuenta de menos.
export async function fetchAll<T>(
  query: RangeQuery<T>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) return { data: out, error };
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return { data: out, error: null };
  }
}
