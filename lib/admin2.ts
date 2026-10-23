import "server-only";

/// Panel /admin2: cálculos sobre usage_pings y la nube de comandas.
///
/// /admin cuenta por mes con todos los equipos que abrieron la app (nuevos y
/// viejos), así que sirve para ver uso y versiones pero no para saber dónde se
/// pierde la gente nueva ni cuántos pagan de verdad. Aquí:
/// - Suscripciones: las da RevenueCat (la única fuente de verdad de pagos).
/// - Embudos: solo negocios NUEVOS (primera vez que se ve el aparato), sin
///   meseros ni cambios de aparato, seguidos desde que abrieron.

export type PingRow = {
  install_id: string;
  account_key: string | null;
  ping_date: string;
  platform: string | null;
  app_version: string | null;
  is_caja: boolean | null;
  inherited_access: boolean | null;
  onboarding_stage: number | null;
  menu_path: string | null;
  product_count: number | null;
  orders_total: number | null;
  subscription_active: boolean | null;
  subscribed_at: string | null;
};

export const PING_COLUMNS =
  "install_id, account_key, ping_date, platform, app_version, is_caja, inherited_access, onboarding_stage, menu_path, product_count, orders_total, subscription_active, subscribed_at";

/// Ventas gratis antes de pedir suscripción (subscription_provider.dart).
export const FREE_ORDER_LIMIT = 10;

export type Install = {
  id: string;
  firstDay: string;
  lastDay: string;
  platform: string;
  /** Nunca se reportó como mesero. */
  owner: boolean;
  /** Llegó por cambio de aparato (ya era cliente). */
  inherited: boolean;
  stage: number | null;
  menuPath: "skipped" | "photo_opened" | "ai_saved" | null;
  products: number;
  orders: number;
  subscribed: boolean;
  version: string | null;
};

const MENU_RANK = { skipped: 1, photo_opened: 2, ai_saved: 3 } as const;

/// Un registro por aparato con lo más lejos que llegó.
export function toInstalls(rows: PingRow[]): Install[] {
  const map = new Map<string, Install>();
  for (const r of rows) {
    const plat = r.platform ?? "unknown";
    let i = map.get(r.install_id);
    if (!i) {
      i = {
        id: r.install_id,
        firstDay: r.ping_date,
        lastDay: r.ping_date,
        platform: plat,
        owner: true,
        inherited: false,
        stage: null,
        menuPath: null,
        products: 0,
        orders: 0,
        subscribed: false,
        version: r.app_version,
      };
      map.set(r.install_id, i);
    }
    if (r.ping_date < i.firstDay) {
      i.firstDay = r.ping_date;
      i.platform = plat;
    }
    if (r.ping_date > i.lastDay) {
      i.lastDay = r.ping_date;
      i.version = r.app_version ?? i.version;
    }
    if (r.is_caja === false) i.owner = false;
    if (r.inherited_access) i.inherited = true;
    if (r.onboarding_stage != null) {
      i.stage = Math.max(i.stage ?? 0, r.onboarding_stage);
    }
    const mp = r.menu_path as Install["menuPath"];
    if (mp && mp in MENU_RANK) {
      if (!i.menuPath || MENU_RANK[mp] > MENU_RANK[i.menuPath]) i.menuPath = mp;
    }
    i.products = Math.max(i.products, r.product_count ?? 0);
    i.orders = Math.max(i.orders, r.orders_total ?? 0);
    if (r.subscription_active || r.subscribed_at) i.subscribed = true;
  }
  return [...map.values()];
}

/// Negocios nuevos: primera vez en [from, to], dueños, sin cambio de aparato.
export function newOwners(installs: Install[], from: string, to: string) {
  return installs.filter(
    (i) => i.owner && !i.inherited && i.firstDay >= from && i.firstDay <= to,
  );
}

/// [after]: pasos que no van en cadena (alguien puede suscribirse sin llegar
/// a 10 ventas). Se comparan contra «Primera venta» y no cuentan como cuello
/// de botella, porque una semana es poco tiempo para pagar.
export type Step = { label: string; n: number; hint?: string; after?: boolean };

/// Embudo de la bienvenida (apps 3.0.89+: las que mandan la pantalla).
export function onboardingFunnel(list: Install[]): Step[] {
  const m = list.filter((i) => i.stage != null);
  const c = (f: (i: Install) => boolean) => m.filter(f).length;
  return [
    { label: "Abrieron la app", n: m.length },
    {
      label: "Pasaron el nombre del negocio",
      n: c((i) => (i.stage ?? 0) >= 2),
      hint: "Pantalla 1",
    },
    {
      label: "Crearon su PIN",
      n: c((i) => (i.stage ?? 0) >= 6),
      hint: "Pantallas 2 a 5",
    },
    { label: "Terminaron la bienvenida", n: c((i) => (i.stage ?? 0) >= 7) },
    { label: "Menú hecho (con IA o a mano)", n: c((i) => i.products > 0) },
    { label: "Primera venta", n: c((i) => i.orders > 0) },
    {
      label: `Llegaron a ${FREE_ORDER_LIMIT} ventas`,
      after: true,
      n: c((i) => i.orders >= FREE_ORDER_LIMIT),
      hint: "Aquí sale el pago",
    },
    { label: "Se suscribieron", n: c((i) => i.subscribed), after: true },
  ];
}

/// Cómo armaron el menú en la bienvenida y qué pasó después.
export function menuPaths(list: Install[]) {
  const m = list.filter((i) => i.stage != null && (i.stage ?? 0) >= 6);
  const row = (label: string, f: (i: Install) => boolean) => {
    const g = m.filter(f);
    return {
      label,
      n: g.length,
      withMenu: g.filter((i) => i.products > 0).length,
      sold: g.filter((i) => i.orders > 0).length,
      subscribed: g.filter((i) => i.subscribed).length,
    };
  };
  return [
    row("Hicieron el menú con IA", (i) => i.menuPath === "ai_saved"),
    row("Abrieron la IA y no guardaron", (i) => i.menuPath === "photo_opened"),
    row("Se saltaron el menú", (i) => i.menuPath === "skipped"),
    row("Sin dato (no llegaron)", (i) => i.menuPath == null),
  ];
}

/// Activación de todos los negocios nuevos (incluye apps sin el dato de
/// pantalla): abrieron → menú → venta → 10 ventas → pagó.
export function activationFunnel(list: Install[]): Step[] {
  const c = (f: (i: Install) => boolean) => list.filter(f).length;
  return [
    { label: "Abrieron la app", n: list.length },
    { label: "Con menú", n: c((i) => i.products > 0) },
    { label: "Primera venta", n: c((i) => i.orders > 0) },
    {
      label: `${FREE_ORDER_LIMIT} ventas`,
      after: true,
      n: c((i) => i.orders >= FREE_ORDER_LIMIT),
    },
    { label: "Suscritos", n: c((i) => i.subscribed), after: true },
  ];
}

export const PLATFORMS = ["android", "ios", "windows"] as const;

/// Semana que empieza en lunes (yyyy-mm-dd).
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export type WeekRow = {
  week: string;
  installs: Record<string, number>;
  subs: Record<string, number>;
};

/// Instalaciones nuevas y primeras suscripciones por semana y plataforma.
/// Una suscripción cuenta una vez por cuenta de tienda (account_key) o, si no
/// hay, por aparato: así un cambio de celular no se ve como venta nueva.
export function weekly(
  installs: Install[],
  rows: PingRow[],
  weeks: number,
  today: string,
): WeekRow[] {
  const first = weekStart(today);
  const list: string[] = [];
  const d = new Date(`${first}T12:00:00Z`);
  for (let i = 0; i < weeks; i++) {
    list.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 7);
  }
  const empty = () => Object.fromEntries(PLATFORMS.map((p) => [p, 0]));
  const byWeek = new Map(
    list.map((w) => [w, { week: w, installs: empty(), subs: empty() }]),
  );
  for (const i of installs) {
    if (!i.owner || i.inherited) continue;
    const w = byWeek.get(weekStart(i.firstDay));
    if (w && i.platform in w.installs) w.installs[i.platform]++;
  }
  const firstSub = new Map<string, { day: string; platform: string }>();
  for (const r of rows) {
    if (!r.subscribed_at) continue;
    const key = r.account_key ?? r.install_id;
    const prev = firstSub.get(key);
    if (!prev || r.subscribed_at < prev.day) {
      firstSub.set(key, { day: r.subscribed_at, platform: r.platform ?? "" });
    }
  }
  for (const s of firstSub.values()) {
    const w = byWeek.get(weekStart(s.day));
    if (w && s.platform in w.subs) w.subs[s.platform]++;
  }
  return list.map((w) => byWeek.get(w)!);
}

/// Aparatos activos en los últimos días por versión (las 10 más usadas).
export function versions(rows: PingRow[], since: string) {
  const seen = new Map<string, { version: string; platform: string }>();
  for (const r of rows) {
    if (r.ping_date < since) continue;
    const prev = seen.get(r.install_id);
    if (!prev || r.ping_date >= since) {
      seen.set(r.install_id, {
        version: r.app_version ?? "sin versión",
        platform: r.platform ?? "unknown",
      });
    }
  }
  const counts = new Map<string, Record<string, number>>();
  for (const { version, platform } of seen.values()) {
    const c = counts.get(version) ?? {};
    c[platform] = (c[platform] ?? 0) + 1;
    counts.set(version, c);
  }
  return [...counts.entries()]
    .map(([version, byPlatform]) => ({
      version,
      byPlatform,
      total: Object.values(byPlatform).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

export function pct(n: number, of: number): string {
  if (!of) return "—";
  return `${Math.round((n / of) * 100)}%`;
}

/// Día en México (yyyy-mm-dd), con N días atrás.
export function mxDay(daysAgo = 0): string {
  const d = new Date(Date.now() - 6 * 3600_000 - daysAgo * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- RevenueCat

export type RcOverview =
  | {
      ok: true;
      metrics: { id: string; name: string; value: number; unit?: string }[];
    }
  | { ok: false; reason: string };

/// Métricas generales del proyecto en RevenueCat (API v2, solo lectura).
/// Necesita REVENUECAT_V2_SECRET_KEY y REVENUECAT_PROJECT_ID en el entorno.
export async function revenueCatOverview(): Promise<RcOverview> {
  const key = process.env.REVENUECAT_V2_SECRET_KEY;
  const project = process.env.REVENUECAT_PROJECT_ID;
  if (!key || !project) {
    return {
      ok: false,
      reason:
        "Falta REVENUECAT_V2_SECRET_KEY o REVENUECAT_PROJECT_ID en .env.local.",
    };
  }
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v2/projects/${encodeURIComponent(project)}/metrics/overview`,
      {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      return { ok: false, reason: `RevenueCat contestó ${res.status}.` };
    }
    const json = (await res.json()) as {
      metrics?: { id?: string; name?: string; value?: number; unit?: string }[];
    };
    const metrics = (json.metrics ?? [])
      .filter((m) => typeof m.id === "string" && typeof m.value === "number")
      .map((m) => ({
        id: m.id as string,
        name: m.name ?? (m.id as string),
        value: m.value as number,
        unit: m.unit,
      }));
    return { ok: true, metrics };
  } catch {
    return { ok: false, reason: "No se pudo conectar con RevenueCat." };
  }
}

/// El paso donde más gente se va (proporcionalmente). Con pocos datos un
/// paso de 3 a 1 parecería el peor, así que se piden al menos 10 personas.
/// Contra qué paso se compara [i]: el anterior, o el último paso en cadena
/// si es un paso [after].
export function baseOf(steps: Step[], i: number): Step {
  if (!steps[i].after) return steps[Math.max(0, i - 1)];
  for (let j = i - 1; j >= 0; j--) if (!steps[j].after) return steps[j];
  return steps[0];
}

export function worstDrop(steps: Step[]) {
  let worst: { from: Step; to: Step; lostPct: number; lost: number } | null =
    null;
  const chain = steps.filter((st) => !st.after);
  for (let i = 1; i < chain.length; i++) {
    const from = chain[i - 1];
    const to = chain[i];
    if (from.n < 10) continue;
    const lost = from.n - to.n;
    const lostPct = lost / from.n;
    if (!worst || lostPct > worst.lostPct) worst = { from, to, lostPct, lost };
  }
  return worst;
}

/// Promedio de primeras suscripciones por semana en las últimas [n] semanas
/// completas (sin la semana en curso).
export function avgWeeklySubs(weeks: WeekRow[], n = 4): number {
  const done = weeks.slice(0, -1).slice(-n);
  if (done.length === 0) return 0;
  const total = done.reduce(
    (sum, w) => sum + Object.values(w.subs).reduce((a, b) => a + b, 0),
    0,
  );
  return total / done.length;
}
