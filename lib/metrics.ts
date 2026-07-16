export type Plan = "monthly" | "yearly" | "none" | "unknown";

export type AnalyticsPlatform = "ios" | "android" | "windows" | "unknown";

export type Ping = {
  install_id: string; // id ESTABLE de dispositivo
  account_key: string | null; // identidad de CUENTA (misma en todas las sucursales)
  ping_date: string; // yyyy-mm-dd
  platform: AnalyticsPlatform | string | null;
  app_version: string | null;
  orders_today: number;
  sales_bucket: string | null; // rango de ventas del día (no el monto exacto)
  product_count: number;
  days_since_install: number;
  subscription_active: boolean;
  plan: Plan | null; // qué producto compró: monthly | yearly
  updated_at: string;
};

/// Una cuenta de pago y cuántos dispositivos la usan. device_count > 1 = misma
/// cuenta en varias sucursales.
export type AccountRow = {
  account_key: string;
  device_count: number;
  plan: Plan | null;
  last_seen: string;
};

/// Etiqueta legible del plan para la UI.
export function planLabel(plan: Plan | null): string {
  switch (plan) {
    case "monthly":
      return "Mensual";
    case "yearly":
      return "Anual";
    default:
      return "—";
  }
}

/// Etiqueta legible de la plataforma para la UI.
export function platformLabel(platform: string | null): string {
  switch (platform) {
    case "ios":
      return "iOS";
    case "android":
      return "Android";
    case "windows":
      return "Windows";
    case "unknown":
      return "Desconocida";
    default:
      return platform ?? "—";
  }
}

/// Fecha de hoy en zona horaria de México (yyyy-mm-dd).
export function mxToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(new Date());
}

/// Mes actual (yyyy-mm) en zona horaria de México.
export function currentMonth(): string {
  return mxToday().slice(0, 7);
}

/// Etiqueta legible de un mes, ej. "Julio 2026".
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  const label = new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/// Rango de fechas (inclusivo) de un mes: primer y último día en yyyy-mm-dd.
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/// Lista de los últimos `count` meses (más reciente primero) para el selector.
export function monthOptions(count = 12): { value: string; label: string }[] {
  const [y, m] = currentMonth().split("-").map(Number);
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(Date.UTC(y, m - 1 - i, 1));
    const value = `${date.getUTCFullYear()}-${String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    out.push({ value, label: monthLabel(value) });
  }
  return out;
}

export type PlatformStats = {
  installs: number;
  subscribed: number;
  monthly: number;
  yearly: number;
};

export type PlatformKey = AnalyticsPlatform;

export type Summary = {
  activeInstalls: number; // dispositivos que pingearon en el mes
  totalOrders: number; // suma de órdenes en el mes
  subscribed: number; // DISPOSITIVOS con suscripción activa
  payingAccounts: number; // CUENTAS de pago (deduplicado, no por dispositivo)
  multiDevice: AccountRow[]; // cuentas usadas en 2+ dispositivos (doble sucursal)
  monthly: number;
  yearly: number;
  platforms: Record<PlatformKey, PlatformStats>;
  dailyActive: { date: string; count: number }[]; // por día del mes
  latest: Ping[]; // último ping por instalación (más reciente primero)
};

function emptyPlatformStats(): PlatformStats {
  return { installs: 0, subscribed: 0, monthly: 0, yearly: 0 };
}

function platformKey(platform: string | null): PlatformKey {
  if (platform === "ios" || platform === "android" || platform === "windows") {
    return platform;
  }
  return "unknown";
}

/// Métricas del día de hoy (independientes del mes seleccionado).
export type TodaySummary = {
  activeInstalls: number; // dispositivos que pingearon hoy
  orders: number; // órdenes de hoy
  aiCalls: number; // llamadas a IA hoy
  subscribed: number; // dispositivos con suscripción activa hoy
  newInstalls: number; // instalaciones hechas hoy (days_since_install === 0)
};

/// Una suscripción nueva detectada hoy.
export type NewSubscriber = {
  identity: string; // account_key (cuenta) o install_id (dispositivo)
  isAccount: boolean; // true si se identifica por cuenta de pago
  plan: Plan | null;
  platform: string | null;
  updated_at: string;
};

/// Detecta quién se suscribió HOY por primera vez: dispositivos/cuentas con
/// suscripción activa hoy que NO tenían historial de suscripción previa.
/// `priorAccountKeys` y `priorInstallIds` son identidades que ya estaban
/// suscritas antes de hoy (se calculan con una consulta al historial).
export function newSubscribersToday(
  todayPings: Ping[],
  priorAccountKeys: Set<string>,
  priorInstallIds: Set<string>,
): NewSubscriber[] {
  const byIdentity = new Map<string, NewSubscriber>();
  for (const p of todayPings) {
    if (!p.subscription_active) continue;
    const isAccount = !!p.account_key;
    const identity = p.account_key ?? p.install_id;
    const existedBefore = isAccount
      ? priorAccountKeys.has(p.account_key as string)
      : priorInstallIds.has(p.install_id);
    if (existedBefore) continue;

    const prev = byIdentity.get(identity);
    if (!prev || p.updated_at > prev.updated_at) {
      byIdentity.set(identity, {
        identity,
        isAccount,
        plan: p.plan,
        platform: p.platform ?? null,
        updated_at: p.updated_at,
      });
    }
  }
  return [...byIdentity.values()].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );
}

/// Resume la actividad de hoy. `pings` y `aiRows` ya vienen filtrados a hoy.
export function summarizeToday(pings: Ping[], aiRows: AiUsage[]): TodaySummary {
  const installs = new Set<string>();
  let orders = 0;
  let subscribed = 0;
  let newInstalls = 0;
  for (const p of pings) {
    installs.add(p.install_id);
    orders += p.orders_today;
    if (p.subscription_active) subscribed++;
    if (p.days_since_install === 0) newInstalls++;
  }
  let aiCalls = 0;
  for (const r of aiRows) aiCalls += r.count;
  return {
    activeInstalls: installs.size,
    orders,
    aiCalls,
    subscribed,
    newInstalls,
  };
}

/// Calcula todas las métricas del dashboard para un mes dado (yyyy-mm).
/// `rows` ya vienen filtradas a ese mes desde la consulta.
export function summarize(rows: Ping[], month: string): Summary {
  const lastDay = Number(monthRange(month).end.slice(8, 10));

  const installs = new Set<string>();
  let totalOrders = 0;

  // Último ping por instalación.
  const latestByInstall = new Map<string, Ping>();

  for (const r of rows) {
    installs.add(r.install_id);
    totalOrders += r.orders_today;

    const prev = latestByInstall.get(r.install_id);
    if (!prev || r.ping_date > prev.ping_date) {
      latestByInstall.set(r.install_id, r);
    }
  }

  // Ordenados por visita más reciente (usa el timestamp exacto).
  const latest = [...latestByInstall.values()].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );

  let subscribed = 0;
  let monthly = 0;
  let yearly = 0;
  const platforms: Record<PlatformKey, PlatformStats> = {
    ios: emptyPlatformStats(),
    android: emptyPlatformStats(),
    windows: emptyPlatformStats(),
    unknown: emptyPlatformStats(),
  };
  for (const p of latest) {
    const key = platformKey(p.platform);
    platforms[key].installs++;
    if (p.subscription_active) {
      subscribed++;
      platforms[key].subscribed++;
      if (p.plan === "monthly") {
        monthly++;
        platforms[key].monthly++;
      } else if (p.plan === "yearly") {
        yearly++;
        platforms[key].yearly++;
      }
    }
  }

  // Deduplicación por CUENTA: agrupa los dispositivos que comparten account_key.
  // Solo cuentas de pago (account_key solo existe cuando hay suscripción).
  const accounts = new Map<
    string,
    { installs: Set<string>; plan: Plan | null; last_seen: string }
  >();
  for (const p of latest) {
    if (!p.account_key) continue;
    const a = accounts.get(p.account_key);
    if (!a) {
      accounts.set(p.account_key, {
        installs: new Set([p.install_id]),
        plan: p.plan,
        last_seen: p.ping_date,
      });
    } else {
      a.installs.add(p.install_id);
      if (p.ping_date > a.last_seen) {
        a.last_seen = p.ping_date;
        a.plan = p.plan;
      }
    }
  }

  const multiDevice: AccountRow[] = [...accounts.entries()]
    .filter(([, a]) => a.installs.size > 1)
    .map(([account_key, a]) => ({
      account_key,
      device_count: a.installs.size,
      plan: a.plan,
      last_seen: a.last_seen,
    }))
    .sort((x, y) => y.device_count - x.device_count);

  // Activos por día del mes.
  const dailyActive: { date: string; count: number }[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const set = new Set<string>();
    for (const r of rows) {
      if (r.ping_date === date) set.add(r.install_id);
    }
    dailyActive.push({ date, count: set.size });
  }

  return {
    activeInstalls: installs.size,
    totalOrders,
    subscribed,
    payingAccounts: accounts.size,
    multiDevice,
    monthly,
    yearly,
    platforms,
    dailyActive,
    latest,
  };
}

/// Fecha y hora legibles (ej. "5 jul 2026, 2:04 p.m.") en hora de México.
export function fechaHora(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

// ---- Uso de IA (tabla ai_usage) ----

export type AiUsage = {
  install_id: string;
  usage_date: string; // yyyy-mm-dd
  count: number;
};

export type AiUsageRow = {
  install_id: string;
  total: number; // llamadas a IA en el periodo
  today: number; // llamadas a IA hoy
  lastDate: string; // último día con uso de IA
};

export type AiSummary = {
  totalCalls: number; // total de llamadas a IA en el periodo
  callsToday: number; // llamadas a IA hoy
  usersWithAi: number; // instalaciones que han usado IA
  byInstall: AiUsageRow[]; // por instalación, mayor uso primero
};

/// Agrega el uso de IA por instalación a partir de los registros de ai_usage.
export function summarizeAi(rows: AiUsage[]): AiSummary {
  const today = mxToday();
  let totalCalls = 0;
  let callsToday = 0;
  const byInstall = new Map<string, AiUsageRow>();

  for (const r of rows) {
    totalCalls += r.count;
    const isToday = r.usage_date === today;
    if (isToday) callsToday += r.count;

    const prev = byInstall.get(r.install_id);
    if (!prev) {
      byInstall.set(r.install_id, {
        install_id: r.install_id,
        total: r.count,
        today: isToday ? r.count : 0,
        lastDate: r.usage_date,
      });
    } else {
      prev.total += r.count;
      if (isToday) prev.today += r.count;
      if (r.usage_date > prev.lastDate) prev.lastDate = r.usage_date;
    }
  }

  return {
    totalCalls,
    callsToday,
    usersWithAi: byInstall.size,
    byInstall: [...byInstall.values()].sort((a, b) => b.total - a.total),
  };
}
