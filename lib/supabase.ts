import "server-only";
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

/// Como [fetchAll], pero pide las páginas [concurrency] a la vez en lugar de
/// una tras otra. [make] crea la consulta (con un orden estable) para cada
/// página; [total] es el conteo aproximado de filas. Se pide una página de más
/// por si entraron filas entre el conteo y la lectura.
export async function fetchAllParallel<T>(
  make: () => RangeQuery<T>,
  total: number,
  concurrency = 8,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const pages = Math.ceil(Math.max(0, total) / PAGE) + 1;
  const results: T[][] = new Array(pages);
  let next = 0;
  let failure: { message: string } | null = null;
  const worker = async () => {
    while (next < pages && !failure) {
      const i = next++;
      const { data, error } = await make().range(i * PAGE, i * PAGE + PAGE - 1);
      if (error) failure = error;
      results[i] = data ?? [];
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, pages) }, worker),
  );
  if (failure) return { data: results.flat(), error: failure };
  // Si la última página vino llena, todavía hay más: se sigue en orden.
  const out = results.flat();
  for (let from = pages * PAGE; results[pages - 1]?.length === PAGE; from += PAGE) {
    const { data, error } = await make().range(from, from + PAGE - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return { data: out, error: null };
}

