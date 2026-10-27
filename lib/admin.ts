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
  menuPath: "skipped" | "photo_opened" | "sample" | "ai_saved" | null;
  products: number;
  orders: number;
  subscribed: boolean;
  version: string | null;
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
    row("Con IA", (i) => i.menuPath === "ai_saved"),
    row("Menú de ejemplo", (i) => i.menuPath === "sample"),
    row("Abrieron la IA, no guardaron", (i) => i.menuPath === "photo_opened"),
    row(
      "Se lo saltaron (antes de 3.0.98)",
      (i) => i.menuPath === "skipped",
    ),
    row("Sin dato (no llegaron)", (i) => i.menuPath == null),
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
      reason: process.env.VERCEL
        ? "Falta REVENUECAT_V2_SECRET_KEY o REVENUECAT_PROJECT_ID en Vercel (Settings › Environment Variables)."
        : "Falta REVENUECAT_V2_SECRET_KEY o REVENUECAT_PROJECT_ID en .env.local.",
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

/// La versión más nueva que mandó señales desde [since].
export function newestVersion(rows: PingRow[], since: string): string | null {
  let best: string | null = null;
  for (const r of rows) {
    if (r.ping_date < since || !r.app_version) continue;
    if (!best || cmpVersion(r.app_version, best) > 0) best = r.app_version;
  }
  return best;
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
export type FirstSub = {
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

// ---------------------------------------------------------------- Neto

/// Suscripciones activas según la app al cierre de cada semana: cuentas con
/// plan activo que abrieron la app en los 7 días anteriores. [weeks]
/// intervalos hacia atrás desde [today] (regresa weeks + 1 puntos).
export function activeSeries(rows: PingRow[], today: string, weeks = 8) {
  const cuts: string[] = [];
  const d = new Date(`${today}T12:00:00Z`);
  for (let i = 0; i <= weeks; i++) {
    cuts.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 7);
  }
  const sets = cuts.map(() => new Set<string>());
  const minus7 = cuts.map((c) => {
    const x = new Date(`${c}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() - 7);
    return x.toISOString().slice(0, 10);
  });
  for (const r of rows) {
    if (!r.subscription_active) continue;
    for (let i = 0; i < cuts.length; i++) {
      if (r.ping_date > minus7[i] && r.ping_date <= cuts[i]) {
        sets[i].add(r.account_key ?? r.install_id);
      }
    }
  }
  return cuts.map((day, i) => ({ day, n: sets[i].size }));
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

// ---------------------------------------------------------------- Retención

export type RetRow = { label: string; n: number; gone: number };

/// ¿Quién se queda? Toma las cuentas que pagaban en [baseFrom, baseTo] y ve
/// cuáles siguen con plan activo desde [stayFrom] (en cualquiera de sus
/// aparatos). Las agrupa por cómo usaban la app en esas 2 semanas.
/// "Se fue" = dejó de abrir la app con plan activo; casi siempre termina en
/// cancelación, pero no es la cancelación confirmada por la tienda.
export function retention(
  rows: PingRow[],
  baseFrom: string,
  baseTo: string,
  stayFrom: string,
) {
  type Acc = {
    days: Set<string>;
    orders: number;
    products: number;
    plan: string | null;
    planDay: string;
    platform: string | null;
    paid: boolean;
    inherited: boolean;
  };
  const accs = new Map<string, Acc>();
  const installsOf = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.ping_date < baseFrom || r.ping_date > baseTo) continue;
    const k = r.account_key ?? r.install_id;
    let a = accs.get(k);
    if (!a) {
      a = {
        days: new Set(),
        orders: 0,
        products: 0,
        plan: null,
        planDay: "",
        platform: null,
        paid: false,
        inherited: false,
      };
      accs.set(k, a);
    }
    a.days.add(r.ping_date);
    a.orders += r.orders_today ?? 0;
    a.products = Math.max(a.products, r.product_count ?? 0);
    a.platform = r.platform ?? a.platform;
    if (r.inherited_access) a.inherited = true;
    if (r.subscription_active) {
      a.paid = true;
      if (r.plan && r.ping_date >= a.planDay) {
        a.plan = r.plan;
        a.planDay = r.ping_date;
      }
    }
  }
  const base = new Map([...accs].filter(([, a]) => a.paid && !a.inherited));
  // Aparatos de cada cuenta (para no contar como baja a quien solo cambió
  // de identidad, p. ej. inició sesión y ahora reporta con su cuenta).
  for (const r of rows) {
    const k = r.account_key ?? r.install_id;
    if (!base.has(k)) continue;
    let set = installsOf.get(r.install_id);
    if (!set) installsOf.set(r.install_id, (set = new Set()));
    set.add(k);
  }
  const stayed = new Set<string>();
  for (const r of rows) {
    if (r.ping_date < stayFrom || !r.subscription_active) continue;
    for (const k of installsOf.get(r.install_id) ?? []) stayed.add(k);
    const own = r.account_key ?? r.install_id;
    if (base.has(own)) stayed.add(own);
  }

  const groups: { title: string; rows: RetRow[] }[] = [
    { title: "Cuántos días abren la app (de cada 14)", rows: [] },
    { title: "Cuánto venden en 2 semanas", rows: [] },
    { title: "Qué plan tienen", rows: [] },
    { title: "Cuántos productos tiene su menú", rows: [] },
    { title: "Dónde la usan", rows: [] },
  ];
  const bucket = (g: number, label: string, gone: boolean) => {
    let row = groups[g].rows.find((x) => x.label === label);
    if (!row) groups[g].rows.push((row = { label, n: 0, gone: 0 }));
    row.n++;
    if (gone) row.gone++;
  };
  const order: Record<string, number> = {};
  const total = { n: 0, gone: 0 };
  for (const [k, a] of base) {
    const gone = !stayed.has(k);
    total.n++;
    if (gone) total.gone++;
    const d = a.days.size;
    bucket(
      0,
      d >= 10 ? "10 días o más" : d >= 5 ? "5 a 9 días" : "Menos de 5",
      gone,
    );
    bucket(
      1,
      a.orders >= 100
        ? "100 ventas o más"
        : a.orders >= 20
          ? "20 a 99"
          : "Menos de 20",
      gone,
    );
    const plan = a.plan ?? "";
    const pro = plan.startsWith("pro");
    const yearly = plan.endsWith("yearly");
    bucket(
      2,
      pro
        ? yearly
          ? "Pro anual"
          : "Pro mensual"
        : yearly
          ? "Anual"
          : "Mensual",
      gone,
    );
    bucket(
      3,
      a.products >= 40
        ? "40 o más"
        : a.products >= 15
          ? "15 a 39"
          : "Menos de 15",
      gone,
    );
    const p = a.platform ?? "?";
    if ((PLATFORMS as readonly string[]).includes(p)) {
      bucket(
        4,
        p === "ios" ? "iOS" : p === "android" ? "Android" : "Windows",
        gone,
      );
    }
  }
  // Orden fijo para que siempre se lean igual (de mejor a peor uso).
  const ORDER = [
    "10 días o más",
    "5 a 9 días",
    "Menos de 5",
    "100 ventas o más",
    "20 a 99",
    "Menos de 20",
    "Mensual",
    "Anual",
    "Pro mensual",
    "Pro anual",
    "40 o más",
    "15 a 39",
    "Menos de 15",
    "Android",
    "iOS",
    "Windows",
  ];
  ORDER.forEach((l, i) => (order[l] = i));
  for (const g of groups)
    g.rows.sort((x, y) => order[x.label] - order[y.label]);
  return { total, groups };
}

// ---------------------------------------------------------------- Bajas

export type LostAccount = {
  key: string;
  platform: string | null;
  plan: string | null;
  version: string | null;
  firstPaid: string;
  lastPaid: string;
  /** Ventas en sus últimos 14 días con plan. */
  recentSales: number;
  /** Siguió abriendo la app después de quedarse sin plan. */
  stillOpens: boolean;
  installIds: string[];
};

/// Cuentas que tuvieron plan y lo dejaron de tener: su último día con plan
/// cae en los últimos [windowDays] y en los últimos [quietDays] ya no aparece
/// con plan en ninguno de sus aparatos (una semana: hay quien no abre la app
/// a diario). Aproximado (sale de la app, sin motivo):
/// el motivo exacto llega con el webhook de RevenueCat.
export function recentLost(
  rows: PingRow[],
  today: string,
  windowDays = 28,
  quietDays = 7,
): LostAccount[] {
  const shift = (n: number) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const from = shift(windowDays);
  const quietSince = shift(quietDays - 1);
  type Acc = {
    first: string;
    last: string;
    lastSeen: string;
    plan: string | null;
    platform: string | null;
    version: string | null;
    inherited: boolean;
    installs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  for (const r of rows) {
    const k = r.account_key ?? r.install_id;
    let a = accs.get(k);
    if (!a) {
      a = {
        first: "",
        last: "",
        lastSeen: r.ping_date,
        plan: null,
        platform: null,
        version: null,
        inherited: false,
        installs: new Set(),
      };
      accs.set(k, a);
    }
    a.installs.add(r.install_id);
    if (r.ping_date > a.lastSeen) a.lastSeen = r.ping_date;
    if (r.inherited_access) a.inherited = true;
    if (r.subscription_active) {
      if (!a.first || r.ping_date < a.first) a.first = r.ping_date;
      if (r.ping_date >= a.last) {
        a.last = r.ping_date;
        a.plan = r.plan ?? a.plan;
        a.platform = r.platform ?? a.platform;
        a.version = r.app_version ?? a.version;
      }
    }
  }
  // Último día con plan de cada aparato: si el aparato sigue con plan bajo
  // otra cuenta (inició sesión), no es una baja.
  const lastPaidByInstall = new Map<string, string>();
  for (const r of rows) {
    if (!r.subscription_active) continue;
    const prev = lastPaidByInstall.get(r.install_id);
    if (!prev || r.ping_date > prev)
      lastPaidByInstall.set(r.install_id, r.ping_date);
  }
  const lost: LostAccount[] = [];
  for (const [key, a] of accs) {
    if (!a.last || a.inherited) continue;
    if (a.last < from || a.last >= quietSince) continue;
    const switched = [...a.installs].some(
      (i) => (lastPaidByInstall.get(i) ?? "") > a.last,
    );
    if (switched) continue;
    lost.push({
      key,
      platform: a.platform,
      plan: a.plan,
      version: a.version,
      firstPaid: a.first,
      lastPaid: a.last,
      recentSales: 0,
      stillOpens: a.lastSeen > a.last,
      installIds: [...a.installs],
    });
  }
  // Ventas de sus últimos 14 días con plan.
  const byKey = new Map(lost.map((l) => [l.key, l]));
  for (const r of rows) {
    const l = byKey.get(r.account_key ?? r.install_id);
    if (!l || r.ping_date > l.lastPaid) continue;
    const d = new Date(`${l.lastPaid}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 13);
    if (r.ping_date >= d.toISOString().slice(0, 10)) {
      l.recentSales += r.orders_today ?? 0;
    }
  }
  return lost.sort((x, y) => y.lastPaid.localeCompare(x.lastPaid));
}

export type RiskAccount = {
  key: string;
  platform: string | null;
  plan: string | null;
  version: string | null;
  /** Último día que la caja abrió la app (con plan activo). */
  lastSeen: string;
  /** Días completos sin abrir la app. */
  quietDays: number;
  /** Ventas por día que abrió, en sus 14 días antes de dejar de abrir. */
  avgDaily: number;
  /** De esos 14 días, cuántos abrió la app. */
  activeDays: number;
  installIds: string[];
};

/// Cuentas que HOY todavía pagan pero dejaron de abrir la app hace
/// [minQuiet]–[maxQuiet] días. Es la señal que llega antes de la baja: el 81%
/// de los que se van primero dejan de abrir. A partir de [maxQuiet]+1 ya salen
/// en «Dejaron de tener plan» (ver [recentLost]).
///
/// Solo cuenta la caja (los meseros no pagan) y salta accesos heredados
/// (transferencias): ese aparato no es quien paga.
export function atRisk(
  rows: PingRow[],
  today: string,
  minQuiet = 3,
  maxQuiet = 6,
  minActiveDays = 7,
): RiskAccount[] {
  type Acc = {
    lastSeen: string;
    paidOnLast: boolean;
    inherited: boolean;
    plan: string | null;
    platform: string | null;
    version: string | null;
    installs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  for (const r of rows) {
    if (r.is_caja === false) continue;
    const k = r.account_key ?? r.install_id;
    let a = accs.get(k);
    if (!a) {
      a = {
        lastSeen: "",
        paidOnLast: false,
        inherited: false,
        plan: null,
        platform: null,
        version: null,
        installs: new Set(),
      };
      accs.set(k, a);
    }
    a.installs.add(r.install_id);
    if (r.inherited_access) a.inherited = true;
    if (r.ping_date > a.lastSeen) {
      a.lastSeen = r.ping_date;
      a.paidOnLast = !!r.subscription_active;
      a.plan = r.plan ?? a.plan;
      a.platform = r.platform ?? a.platform;
      a.version = r.app_version ?? a.version;
    } else if (r.ping_date === a.lastSeen && r.subscription_active) {
      a.paidOnLast = true;
      a.plan = r.plan ?? a.plan;
    }
  }
  const dayMs = 86_400_000;
  const todayMs = Date.parse(`${today}T12:00:00Z`);
  const out: RiskAccount[] = [];
  for (const [key, a] of accs) {
    if (!a.lastSeen || !a.paidOnLast || a.inherited) continue;
    const quiet = Math.round(
      (todayMs - Date.parse(`${a.lastSeen}T12:00:00Z`)) / dayMs,
    );
    if (quiet < minQuiet || quiet > maxQuiet) continue;
    out.push({
      key,
      platform: a.platform,
      plan: a.plan,
      version: a.version,
      lastSeen: a.lastSeen,
      quietDays: quiet,
      avgDaily: 0,
      activeDays: 0,
      installIds: [...a.installs],
    });
  }
  // Ventas por día abierto en sus últimos 14 días: quién vendía más pesa más.
  const byKey = new Map(out.map((r) => [r.key, r]));
  const days = new Map<string, Set<string>>();
  const sales = new Map<string, number>();
  for (const r of rows) {
    if (r.is_caja === false) continue;
    const k = r.account_key ?? r.install_id;
    const acc = byKey.get(k);
    if (!acc) continue;
    const from = new Date(`${acc.lastSeen}T12:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 13);
    if (r.ping_date < from.toISOString().slice(0, 10)) continue;
    if (!days.has(k)) days.set(k, new Set());
    days.get(k)!.add(r.ping_date);
    sales.set(k, (sales.get(k) ?? 0) + (r.orders_today ?? 0));
  }
  for (const acc of out) {
    const n = days.get(acc.key)?.size ?? 0;
    acc.activeDays = n;
    acc.avgDaily = n ? Math.round((sales.get(acc.key) ?? 0) / n) : 0;
  }
  // Solo quien abría casi diario: un negocio de fin de semana pasa días sin
  // abrir y no está en riesgo. Primero a quien más vendía.
  return out
    .filter((r) => r.activeDays >= minActiveDays)
    .sort((x, y) => y.avgDaily - x.avgDaily || x.quietDays - y.quietDays);
}
