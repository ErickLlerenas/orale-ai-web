import "server-only";

/// Panel /admin: cálculos sobre usage_pings y la nube de comandas.
/// - Suscripciones: eventos de RevenueCat y Stripe; la app cubre el histórico.
/// - Embudos: solo negocios nuevos, sin meseros ni cambios de aparato.

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
  orders_today: number | null;
  days_since_install: number | null;
  plan: string | null;
  subscription_active: boolean | null;
  subscribed_at: string | null;
  updated_at: string | null;
};

export const PING_COLUMNS =
  "install_id, account_key, ping_date, platform, app_version, is_caja, inherited_access, onboarding_stage, menu_path, product_count, orders_total, orders_today, days_since_install, plan, subscription_active, subscribed_at, updated_at";

/// Algunas apps mandan el reporte a veces con la cuenta y a veces sin ella
/// (account_key vacío). Sin esto, un mismo aparato contaba como dos clientes
/// y el «sin cuenta» parecía que dejó de abrir la app. Si un aparato tuvo
/// cuenta, todos sus reportes cuentan para la más reciente.
export function fillAccountKeys(rows: PingRow[]): PingRow[] {
  const latest = new Map<string, { day: string; key: string }>();
  for (const r of rows) {
    if (!r.account_key) continue;
    const prev = latest.get(r.install_id);
    if (!prev || r.ping_date >= prev.day) {
      latest.set(r.install_id, { day: r.ping_date, key: r.account_key });
    }
  }
  return rows.map((r) =>
    r.account_key
      ? r
      : { ...r, account_key: latest.get(r.install_id)?.key ?? null },
  );
}

/// Ventas gratis antes de pedir suscripción (subscription_provider.dart).
const FREE_ORDER_LIMIT = 10;

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
  menuPath: "skipped" | "photo_opened" | "sample" | "ai_saved" | null;
  products: number;
  orders: number;
  subscribed: boolean;
  version: string | null;
  /** Versión con la que abrió la app por primera vez. */
  firstVersion: string | null;
  /** Lo más lejos que llegó el día que llegó (para comparar grupos parejo). */
  day1: { stage: number; products: number; orders: number };
};

/// Mismo orden que bump_onboarding_funnel: solo sube.
const MENU_RANK = {
  skipped: 1,
  photo_opened: 2,
  sample: 3,
  ai_saved: 4,
} as const;

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
        firstVersion: r.app_version,
        day1: { stage: 0, products: 0, orders: 0 },
      };
      map.set(r.install_id, i);
    }
    if (r.ping_date < i.firstDay) {
      i.firstDay = r.ping_date;
      i.platform = plat;
      i.firstVersion = r.app_version;
      i.day1 = { stage: 0, products: 0, orders: 0 };
    }
    if (r.ping_date === i.firstDay) {
      i.day1.stage = Math.max(i.day1.stage, r.onboarding_stage ?? 0);
      i.day1.products = Math.max(i.day1.products, r.product_count ?? 0);
      i.day1.orders = Math.max(i.day1.orders, r.orders_total ?? 0);
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

type JourneyStep = {
  label: string;
  n: number;
  hint?: string;
  /** Necesita días: los que llegaron hace poco todavía no alcanzan. */
  later?: boolean;
};

/// El camino de un dueño nuevo: la bienvenida pantalla por pantalla, el
/// menú, la primera venta y, aparte, lo que necesita tiempo.
export function journeySteps(list: Install[]): JourneyStep[] {
  const c = (f: (i: Install) => boolean) => list.filter(f).length;
  return [
    { label: "Abrieron la app", n: list.length },
    {
      label: "Pasaron la primera pregunta",
      n: c((i) => (i.stage ?? 0) >= 2),
      hint: "la primera pantalla de la bienvenida",
    },
    {
      label: "Crearon su PIN",
      n: c((i) => (i.stage ?? 0) >= 6),
      hint: "preguntas 2 a 5",
    },
    {
      label: "Terminaron la bienvenida",
      n: c((i) => (i.stage ?? 0) >= 7),
    },
    {
      label: "Tienen menú",
      n: c((i) => i.products > 0),
      hint: "IA, a mano o ejemplo",
    },
    { label: "Primera venta", n: c((i) => i.orders > 0) },
    {
      label: `${FREE_ORDER_LIMIT} ventas`,
      n: c((i) => i.orders >= FREE_ORDER_LIMIT),
      hint: "aquí se les pide pagar",
      later: true,
    },
    { label: "Se suscribieron", n: c((i) => i.subscribed), later: true },
  ];
}

/// El mes [ym] (2026-10) y contra qué se compara: si es el mes en curso, los
/// mismos días del mes anterior; si ya terminó, el mes anterior completo.
export function monthWindow(today: string, ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const current = ym === today.slice(0, 7);
  const iso = (yy: number, mm: number, dd: number) =>
    `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const lastDay = (yy: number, mm: number) =>
    new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const name = (yy: number, mm: number) =>
    new Date(Date.UTC(yy, mm - 1, 15)).toLocaleDateString("es-MX", {
      month: "long",
      timeZone: "UTC",
    });
  const d = current ? Number(today.slice(8, 10)) : lastDay(y, m);
  return {
    current,
    start: iso(y, m, 1),
    end: iso(y, m, lastDay(y, m)),
    /// Último día que ya pasó (o hoy) dentro del mes.
    to: iso(y, m, d),
    prevStart: iso(py, pm, 1),
    prevTo: iso(py, pm, current ? Math.min(d, lastDay(py, pm)) : lastDay(py, pm)),
    name: name(y, m),
    prevName: name(py, pm),
  };
}

/// Ventas a la semana debajo de las cuales un cliente que paga «vende poco».
/// 10 a la semana ≈ 20 en 2 semanas: de los que vendían menos de 20, se fue
/// 60–79% en octubre; de los que vendían 100 o más, 18% (29 oct).
export const LOW_USE_WEEK = 10;

export type LowUseWeek = { end: string; paying: number; low: number };

/// Por semana (7 días que terminan en [end]): cuántas cuentas que pagan y
/// cuántas de ellas vendieron menos de [limit] veces. De la más vieja a la
/// más nueva. Sin cambios de aparato.
export function lowUseWeeks(
  rows: PingRow[],
  end: string,
  weeks = 8,
  limit = LOW_USE_WEEK,
): LowUseWeek[] {
  const first = dayPlus(end, -7 * weeks + 1);
  // Ventas del día por cuenta: lo más alto que reportó alguno de sus
  // aparatos (la caja y el mesero cuentan las mismas ventas).
  const sold = new Map<string, Map<string, number>>();
  const paidOn = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.ping_date < first || r.ping_date > end || r.inherited_access) continue;
    const k = r.account_key ?? r.install_id;
    let byDay = sold.get(k);
    if (!byDay) sold.set(k, (byDay = new Map()));
    byDay.set(r.ping_date, Math.max(byDay.get(r.ping_date) ?? 0, r.orders_today ?? 0));
    if (r.subscription_active) {
      let days = paidOn.get(k);
      if (!days) paidOn.set(k, (days = new Set()));
      days.add(r.ping_date);
    }
  }
  const out: LowUseWeek[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const to = dayPlus(end, -7 * w);
    const from = dayPlus(to, -6);
    let paying = 0;
    let low = 0;
    for (const [k, days] of paidOn) {
      if (![...days].some((d) => d >= from && d <= to)) continue;
      paying++;
      let n = 0;
      for (const [d, v] of sold.get(k) ?? []) if (d >= from && d <= to) n += v;
      if (n < limit) low++;
    }
    out.push({ end: to, paying, low });
  }
  return out;
}

/// yyyy-mm-dd más N días.
export function dayPlus(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const PLATFORMS = ["android", "ios", "windows"] as const;

/// Semana que empieza en lunes (yyyy-mm-dd).
function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

type WeekRow = {
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
  for (const s of firstSubscriptions(rows)) {
    const w = byWeek.get(weekStart(s.day));
    if (w && s.platform && s.platform in w.subs) w.subs[s.platform]++;
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

type RcOverview =
  | {
      ok: true;
      metrics: { id: string; name: string; value: number; unit?: string }[];
    }
  | { ok: false; reason: string };

/// Métricas del resumen que se toman de su gráfica. El resumen de la API
/// (metrics/overview) todavía usa el cálculo viejo de RevenueCat y daba
/// otras cifras que el tablero con Charts v3 (27 oct: 312 activas contra
/// 316); las gráficas ya usan el nuevo.
///
/// El MRR NO sale de la gráfica: Charts v3 cuenta casi en $0 a los de Play
/// que entraron antes del aumento del 1 sep (27 oct: 43 Básico mensual de
/// agosto sumaban $455) y daba MX$39,359 cuando lo real andaba entre
/// MX$45,400 y MX$48,500. El resumen viejo da MX$46,969. Si RevenueCat
/// retira el cálculo viejo, revisar que el MRR no vuelva a caer.
const RC_CHART_FOR: Record<string, string> = {
  active_subscriptions: "actives",
  active_trials: "trials",
};

/// Métricas generales del proyecto en RevenueCat (API v2, solo lectura).
/// Necesita REVENUECAT_V2_SECRET_KEY y REVENUECAT_PROJECT_ID en el entorno.
export async function revenueCatOverview(): Promise<RcOverview> {
  const key = process.env.REVENUECAT_V2_SECRET_KEY;
  const project = process.env.REVENUECAT_PROJECT_ID;
  if (!key || !project) {
    return {
      ok: false,
      reason: process.env.VERCEL
        ? "Falta REVENUECAT_V2_SECRET_KEY o REVENUECAT_PROJECT_ID en Vercel (Settings › Environment Variables)."
        : "Falta REVENUECAT_V2_SECRET_KEY o REVENUECAT_PROJECT_ID en .env.local.",
    };
  }
  const base = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(project)}`;
  const init = {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store" as const,
  };
  try {
    const [res, charts] = await Promise.all([
      // En pesos, como el tablero de RevenueCat.
      fetch(`${base}/metrics/overview?currency=MXN`, init),
      Promise.all(
        Object.entries(RC_CHART_FOR).map(
          async ([id, chart]) => [id, await rcChartToday(base, chart, init)] as const,
        ),
      ),
    ]);
    if (!res.ok) {
      return { ok: false, reason: `RevenueCat contestó ${res.status}.` };
    }
    const json = (await res.json()) as {
      metrics?: { id?: string; name?: string; value?: number; unit?: string }[];
    };
    const fromChart = new Map(charts);
    const metrics = (json.metrics ?? [])
      .filter((m) => typeof m.id === "string" && typeof m.value === "number")
      .map((m) => ({
        id: m.id as string,
        name: m.name ?? (m.id as string),
        // Si la gráfica falla, queda la cifra del resumen.
        value: fromChart.get(m.id as string) ?? (m.value as number),
        unit: m.unit,
      }));
    return { ok: true, metrics };
  } catch {
    return { ok: false, reason: "No se pudo conectar con RevenueCat." };
  }
}

export type RcGrowth =
  | {
      ok: true;
      /** Activas al cierre del día anterior a [from] (con cuántas empezó el
       * periodo) y hoy: start + added + back − churned = now. */
      start: number;
      now: number;
      /** Nuevas, las que regresaron y las que se fueron entre [from] y hoy. */
      added: number;
      back: number;
      churned: number;
      /** Días que van del periodo (para llevar todo a 30 días). */
      days: number;
    }
  | { ok: false; reason: string };

/// Cuántas suscripciones entran y cuántas se van desde [from], según las
/// gráficas de RevenueCat (actives y actives_movement). Es lo que dice si el
/// negocio crece: la app solo ve a quien la abre.
export async function revenueCatGrowth(from: string, to: string): Promise<RcGrowth> {
  const key = process.env.REVENUECAT_V2_SECRET_KEY;
  const project = process.env.REVENUECAT_PROJECT_ID;
  if (!key || !project) return { ok: false, reason: "Falta la llave de RevenueCat." };
  const base = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(project)}`;
  const init = { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" as const };
  type Chart = { measures?: { display_name?: string }[]; values?: { cohort?: number; measure?: number; value?: number }[] };
  const load = async (chart: string, since = from) => {
    const res = await fetch(
      `${base}/charts/${chart}?resolution=day&start_date=${since}&end_date=${to}`,
      init,
    );
    if (!res.ok) throw new Error(`${chart}: ${res.status}`);
    return (await res.json()) as Chart;
  };
  try {
    // Las activas de cada día ya traen los movimientos de ese día. Para que
    // cuadre con los movimientos desde [from], se empieza el día anterior.
    const before = new Date(Date.parse(`${from}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const [actives, movement] = await Promise.all([
      load("actives", before),
      load("actives_movement"),
    ]);
    const series = (actives.values ?? [])
      .filter((v) => (v.measure ?? 0) === 0 && typeof v.value === "number")
      .sort((a, b) => (a.cohort ?? 0) - (b.cohort ?? 0));
    // Las medidas por nombre: el orden lo pone RevenueCat.
    const names = (movement.measures ?? []).map((m) => m.display_name ?? "");
    const sum = (name: string) => {
      const i = names.indexOf(name);
      return (movement.values ?? [])
        .filter((v) => v.measure === i)
        .reduce((a, v) => a + (v.value ?? 0), 0);
    };
    if (!series.length) return { ok: false, reason: "RevenueCat no mandó activas." };
    return {
      ok: true,
      start: series[0].value as number,
      now: series[series.length - 1].value as number,
      added: sum("New Actives"),
      back: sum("Resubscription Actives"),
      churned: sum("Churned Actives"),
      days: Math.max(1, series.length - 1),
    };
  } catch (e) {
    return { ok: false, reason: `RevenueCat: ${(e as Error).message}` };
  }
}

/// Último valor (el de hoy, aunque el día no haya cerrado) de una gráfica
/// diaria de RevenueCat, o null si no se pudo leer.
async function rcChartToday(
  base: string,
  chart: string,
  init: RequestInit,
): Promise<number | null> {
  const day = (ago: number) =>
    new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `${base}/charts/${chart}?resolution=day&start_date=${day(2)}&end_date=${day(0)}`,
      init,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      values?: { measure?: number; value?: number }[];
    };
    const values = (json.values ?? []).filter(
      (v) => (v.measure ?? 0) === 0 && typeof v.value === "number",
    );
    return values.length ? (values[values.length - 1].value as number) : null;
  } catch {
    return null;
  }
}

/// Compara versiones tipo 3.0.94 (negativo si a < b).
export function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// ---------------------------------------------------------------- Descargas

/// Días yyyy-mm-dd de [from] a [to] inclusive.
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  while (d.toISOString().slice(0, 10) <= to) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export type DayRow = {
  day: string;
  byPlatform: Record<string, number>;
  total: number;
};

/// Aparatos nuevos por día (primera señal), dueños y meseros, sin cambios de
/// aparato. Es lo más cercano a "descargas" que tenemos.
export function downloadsDaily(
  installs: Install[],
  from: string,
  to: string,
): DayRow[] {
  const days = new Map(
    dayRange(from, to).map((day) => [
      day,
      {
        day,
        byPlatform: Object.fromEntries(PLATFORMS.map((p) => [p, 0])),
        total: 0,
      } as DayRow,
    ]),
  );
  for (const i of installs) {
    if (i.inherited) continue;
    const d = days.get(i.firstDay);
    if (!d || !(i.platform in d.byPlatform)) continue;
    d.byPlatform[i.platform]++;
    d.total++;
  }
  return [...days.values()];
}

/// Descargas por plataforma en [from, to]: total, dueños y meseros.
export function downloadsByPlatform(
  installs: Install[],
  from: string,
  to: string,
) {
  return PLATFORMS.map((p) => {
    const list = installs.filter(
      (i) =>
        !i.inherited &&
        i.platform === p &&
        i.firstDay >= from &&
        i.firstDay <= to,
    );
    return {
      platform: p as string,
      total: list.length,
      owners: list.filter((i) => i.owner).length,
      waiters: list.filter((i) => !i.owner).length,
    };
  });
}

// ---------------------------------------------------------------- Hoy / ayer

const zeroByPlatform = () =>
  Object.fromEntries(PLATFORMS.map((p) => [p, 0])) as Record<string, number>;

export type Count = { total: number; byPlatform: Record<string, number> };

function bump(c: Count, platform: string | null) {
  c.total++;
  if (platform && platform in c.byPlatform) c.byPlatform[platform]++;
}

/// Primera suscripción por cuenta de tienda (o aparato si no hay cuenta).
type FirstSub = {
  key: string;
  day: string;
  platform: string | null;
  /** monthly / yearly / pro_monthly / pro_yearly, según la app. */
  plan: string | null;
  installIds: string[];
};

/// Primera suscripción de cada cuenta, con el plan que agarró: el primer
/// plan que reporta la app desde ese día.
export function firstSubscriptions(rows: PingRow[]): FirstSub[] {
  const first = new Map<string, FirstSub>();
  const installs = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = r.account_key ?? r.install_id;
    if (!installs.has(key)) installs.set(key, new Set());
    installs.get(key)!.add(r.install_id);
    if (!r.subscribed_at) continue;
    const prev = first.get(key);
    if (!prev || r.subscribed_at < prev.day) {
      first.set(key, {
        key,
        day: r.subscribed_at,
        platform: r.platform,
        plan: null,
        installIds: [],
      });
    }
  }
  const planDay = new Map<string, string>();
  for (const r of rows) {
    const key = r.account_key ?? r.install_id;
    const sub = first.get(key);
    if (!sub || !r.plan || r.plan === "none" || r.ping_date < sub.day) continue;
    const seen = planDay.get(key);
    if (!seen || r.ping_date < seen) {
      planDay.set(key, r.ping_date);
      sub.plan = r.plan;
    }
  }
  for (const sub of first.values()) {
    sub.installIds = [...(installs.get(sub.key) ?? [])];
  }
  return [...first.values()];
}

/// Lo que pasó en un día: descargas, se suscribieron, abrieron y cobraron.
export function dayPulse(
  rows: PingRow[],
  installs: Install[],
  subs: { day: string; platform: string | null }[],
  day: string,
) {
  const mk = (): Count => ({ total: 0, byPlatform: zeroByPlatform() });
  const downloads = mk();
  const subscribed = mk();
  const opened = mk();
  const selling = mk();
  for (const i of installs) {
    if (i.firstDay === day && !i.inherited) bump(downloads, i.platform);
  }
  for (const s of subs) if (s.day === day) bump(subscribed, s.platform);
  const seen = new Set<string>();
  const sold = new Set<string>();
  const firstDay = new Map(installs.map((i) => [i.id, i.firstDay]));
  // Reinstalaron: la app dice "instalada hoy" pero el aparato ya se había
  // visto ANTES de ayer. Si se vio por primera vez ayer, es la instalación de
  // ayer que todavía no cumple 24 h (la app cuenta días de 24 h, no de
  // calendario), y ya se contó ayer.
  const dayBefore = new Date(`${day}T12:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const yesterday = dayBefore.toISOString().slice(0, 10);
  const reinstalled = new Set<string>();
  for (const r of rows) {
    if (r.ping_date !== day) continue;
    if (!seen.has(r.install_id)) {
      seen.add(r.install_id);
      bump(opened, r.platform);
    }
    if (
      r.days_since_install === 0 &&
      (firstDay.get(r.install_id) ?? day) < yesterday
    ) {
      reinstalled.add(r.install_id);
    }
    if ((r.orders_today ?? 0) > 0 && !sold.has(r.install_id)) {
      sold.add(r.install_id);
      bump(selling, r.platform);
    }
  }
  return {
    downloads,
    subscribed,
    opened,
    selling,
    reinstalled: reinstalled.size,
  };
}

/// Plan de cada cuenta con suscripción activa vista en los últimos 7 días
/// (su último plan reportado).
export function planMix(rows: PingRow[], since: string) {
  const last = new Map<string, { day: string; plan: string }>();
  for (const r of rows) {
    if (r.ping_date < since || !r.subscription_active || !r.plan) continue;
    if (r.plan === "none") continue;
    const key = r.account_key ?? r.install_id;
    const prev = last.get(key);
    if (!prev || r.ping_date >= prev.day) {
      last.set(key, { day: r.ping_date, plan: r.plan });
    }
  }
  const counts: Record<string, number> = {};
  for (const { plan } of last.values()) counts[plan] = (counts[plan] ?? 0) + 1;
  return counts;
}
