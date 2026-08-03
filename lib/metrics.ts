export type Plan =
  | "monthly"
  | "yearly"
  | "pro_monthly"
  | "pro_yearly"
  | "none"
  | "unknown";

export type AnalyticsPlatform =
  | "ios"
  | "android"
  | "windows"
  | "mac"
  | "unknown";

export type Ping = {
  install_id: string; // id ESTABLE de dispositivo
  account_key: string | null; // identidad de CUENTA (misma en todas las sucursales)
  ping_date: string; // yyyy-mm-dd
  platform: AnalyticsPlatform | string | null;
  app_version: string | null;
  orders_today: number;
  orders_total: number; // órdenes cerradas acumuladas en el dispositivo
  sales_bucket: string | null; // rango de ventas del día (no el monto exacto)
  product_count: number;
  days_since_install: number;
  subscription_active: boolean;
  plan: Plan | null; // qué producto compró
  subscribed_at: string | null; // yyyy-mm-dd primera suscripción
  updated_at: string;
};

/// Qué es en realidad una cuenta con varios equipos.
///   - `pro`: plan Pro, donde los celulares de los meseros son parte del plan.
///   - `branches`: 2+ equipos COBRANDO en el mes = sucursales de verdad.
///   - `device_change`: solo uno cobra; el otro es un cambio de equipo o una
///     instalación que quedó vacía.
export type MultiDeviceKind = "pro" | "branches" | "device_change";

/// Una cuenta de pago y cuántos dispositivos la usan.
export type AccountRow = {
  account_key: string;
  device_count: number;
  selling_devices: number; // equipos que cerraron ventas en el mes
  kind: MultiDeviceKind;
  plan: Plan | null;
  last_seen: string;
};

export function multiDeviceLabel(kind: MultiDeviceKind): string {
  switch (kind) {
    case "pro":
      return "Pro (meseros)";
    case "branches":
      return "Dos sucursales";
    case "device_change":
      return "Cambio de equipo";
  }
}

/// Etiqueta legible del plan para la UI.
export function planLabel(plan: Plan | null): string {
  switch (plan) {
    case "monthly":
      return "Mensual";
    case "yearly":
      return "Anual";
    case "pro_monthly":
      return "Pro mensual";
    case "pro_yearly":
      return "Pro anual";
    default:
      return "—";
  }
}

/// Badge de antigüedad desde la primera descarga.
/// Solo “nuevo” lleva color (teal = buena señal); el resto va neutro.
export function userTenure(days: number): { label: string; className: string } {
  if (days <= 0) {
    return { label: "Nuevo usuario", className: "pill tenure-new" };
  }
  if (days <= 7) {
    return { label: `Nuevo · ${days}d`, className: "pill tenure-new" };
  }
  return { label: `${days} días`, className: "pill tenure-old" };
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
    case "mac":
      return "Mac";
    case "unknown":
      return "Desconocida";
    default:
      return platform ?? "—";
  }
}

/// Chip de color por plataforma.
export function platformChip(platform: string | null): {
  label: string;
  className: string;
} {
  const key =
    platform === "ios" ||
    platform === "android" ||
    platform === "windows" ||
    platform === "mac"
      ? platform
      : "unknown";
  return {
    label: platformLabel(platform),
    className: `platform-tag platform-${key}`,
  };
}

/// Fecha de hoy en zona horaria de México (yyyy-mm-dd).
export function mxToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(new Date());
}

/// Fecha relativa a hoy en México, en días (ej. -1 = ayer).
export function mxDateOffset(days: number): string {
  const [y, m, d] = mxToday().split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/// Fecha de ayer en zona horaria de México (yyyy-mm-dd).
export function mxYesterday(): string {
  return mxDateOffset(-1);
}

/// Etiqueta corta de un día yyyy-mm-dd, ej. "31 jul 2026".
export function dayLabel(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
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
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
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
  pro: number;
};

export type PlatformKey = AnalyticsPlatform;

export type Summary = {
  activeInstalls: number; // dispositivos que ABRIERON la app en el mes
  selling: number; // negocios que COBRARON al menos una vez en el mes
  sellingSubscribed: number; // de los que cobran, cuántos pagan
  configured: number; // capturaron menú pero no han cobrado
  empty: number; // ni menú ni ventas: descargaron y ya
  totalOrders: number; // suma de órdenes del día (actividad del mes)
  subscribed: number; // DISPOSITIVOS con suscripción activa
  payingAccounts: number; // CLIENTES: cuentas únicas con suscripción
  multiDevice: AccountRow[]; // cuentas usadas en 2+ dispositivos
  realBranches: number; // de esas, las que sí son dos sucursales cobrando
  monthly: number; // clientes en plan mensual (no Pro)
  yearly: number; // clientes en plan anual (no Pro)
  pro: number; // clientes en plan Pro
  platforms: Record<PlatformKey, PlatformStats>;
  daily: DailyPoint[]; // por día del mes
  soldDaysByInstall: Map<string, number>; // días con venta en el mes
  latest: Ping[]; // último ping por instalación (más reciente primero)
};

/// Actividad de un día: abrieron, cobraron y descargas nuevas.
export type DailyPoint = {
  date: string;
  active: number;
  selling: number;
  newInstalls: number;
};

/// Lo que hizo una instalación durante el mes.
type InstallStats = {
  latest: Ping;
  soldDays: number; // días con al menos una orden cerrada
  products: number; // productos en el menú (último ping)
};

function emptyPlatformStats(): PlatformStats {
  return { installs: 0, subscribed: 0, monthly: 0, yearly: 0, pro: 0 };
}

function platformKey(platform: string | null): PlatformKey {
  if (
    platform === "ios" ||
    platform === "android" ||
    platform === "windows" ||
    platform === "mac"
  ) {
    return platform;
  }
  return "unknown";
}

function isMonthlyPlan(plan: Plan | null): boolean {
  return plan === "monthly" || plan === "pro_monthly";
}

function isYearlyPlan(plan: Plan | null): boolean {
  return plan === "yearly" || plan === "pro_yearly";
}

function isProPlan(plan: Plan | null): boolean {
  return plan === "pro_monthly" || plan === "pro_yearly";
}

/// Métricas del día de hoy (independientes del mes seleccionado).
export type TodaySummary = {
  activeInstalls: number; // dispositivos que ABRIERON la app hoy
  selling: number; // dispositivos que COBRARON hoy
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
  subscribed_at: string; // yyyy-mm-dd
};

/// Suscriptores cuya primera suscripción es HOY (`subscribed_at === today`).
export function newSubscribersToday(
  todayPings: Ping[],
  today: string,
): NewSubscriber[] {
  const byIdentity = new Map<string, NewSubscriber>();
  for (const p of todayPings) {
    if (p.subscribed_at !== today) continue;
    const isAccount = !!p.account_key;
    const identity = p.account_key ?? p.install_id;
    const prev = byIdentity.get(identity);
    if (!prev || p.updated_at > prev.updated_at) {
      byIdentity.set(identity, {
        identity,
        isAccount,
        plan: p.plan,
        platform: p.platform ?? null,
        updated_at: p.updated_at,
        subscribed_at: p.subscribed_at,
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
  const selling = new Set<string>();
  let orders = 0;
  let subscribed = 0;
  let newInstalls = 0;
  for (const p of pings) {
    installs.add(p.install_id);
    if ((p.orders_today ?? 0) > 0) selling.add(p.install_id);
    orders += p.orders_today ?? 0;
    if (p.subscription_active) subscribed++;
    if (p.days_since_install === 0) newInstalls++;
  }
  let aiCalls = 0;
  for (const r of aiRows) aiCalls += r.count;
  return {
    activeInstalls: installs.size,
    selling: selling.size,
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

  let totalOrders = 0;

  // Qué hizo cada instalación en el mes. Abrir la app no es usar la app: hay
  // que separar al que cobra del que apenas descargó.
  const byInstall = new Map<string, InstallStats>();

  for (const r of rows) {
    totalOrders += r.orders_today ?? 0;

    const prev = byInstall.get(r.install_id);
    const sold = (r.orders_today ?? 0) > 0 ? 1 : 0;
    if (!prev) {
      byInstall.set(r.install_id, {
        latest: r,
        soldDays: sold,
        products: r.product_count,
      });
    } else {
      prev.soldDays += sold;
      if (r.ping_date > prev.latest.ping_date) {
        prev.latest = r;
        prev.products = r.product_count;
      }
    }
  }

  let selling = 0;
  let sellingSubscribed = 0;
  let configured = 0;
  let empty = 0;
  for (const s of byInstall.values()) {
    if (s.soldDays > 0) {
      selling++;
      if (s.latest.subscription_active) sellingSubscribed++;
    } else if (s.products > 0) {
      configured++;
    } else {
      empty++;
    }
  }

  // Ordenados por visita más reciente (usa el timestamp exacto).
  const latest = [...byInstall.values()]
    .map((s) => s.latest)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  let subscribed = 0;
  const platforms: Record<PlatformKey, PlatformStats> = {
    ios: emptyPlatformStats(),
    android: emptyPlatformStats(),
    windows: emptyPlatformStats(),
    mac: emptyPlatformStats(),
    unknown: emptyPlatformStats(),
  };
  for (const p of latest) {
    const key = platformKey(p.platform);
    platforms[key].installs++;
    if (p.subscription_active) {
      subscribed++;
      platforms[key].subscribed++;
      if (isMonthlyPlan(p.plan)) platforms[key].monthly++;
      else if (isYearlyPlan(p.plan)) platforms[key].yearly++;
      if (isProPlan(p.plan)) platforms[key].pro++;
    }
  }

  // Deduplicación por CUENTA: agrupa los dispositivos que comparten account_key.
  // Solo cuentas de pago (account_key solo existe cuando hay suscripción).
  const accounts = new Map<
    string,
    {
      installs: Set<string>;
      selling: number; // equipos de la cuenta que sí cobraron
      isPro: boolean;
      plan: Plan | null;
      last_seen: string;
    }
  >();
  for (const p of latest) {
    if (!p.account_key) continue;
    const sold = (byInstall.get(p.install_id)?.soldDays ?? 0) > 0 ? 1 : 0;
    const a = accounts.get(p.account_key);
    if (!a) {
      accounts.set(p.account_key, {
        installs: new Set([p.install_id]),
        selling: sold,
        isPro: isProPlan(p.plan),
        plan: p.plan,
        last_seen: p.ping_date,
      });
    } else {
      a.installs.add(p.install_id);
      a.selling += sold;
      a.isPro = a.isPro || isProPlan(p.plan);
      if (p.ping_date > a.last_seen) {
        a.last_seen = p.ping_date;
        a.plan = p.plan;
      }
    }
  }

  // Planes por CUENTA (sin doble conteo: Pro no se suma también como mensual).
  let monthly = 0;
  let yearly = 0;
  let pro = 0;
  for (const a of accounts.values()) {
    if (isProPlan(a.plan)) pro++;
    else if (isMonthlyPlan(a.plan)) monthly++;
    else if (isYearlyPlan(a.plan)) yearly++;
  }

  const multiDevice: AccountRow[] = [...accounts.entries()]
    .filter(([, a]) => a.installs.size > 1)
    .map(([account_key, a]) => ({
      account_key,
      device_count: a.installs.size,
      selling_devices: a.selling,
      // En Pro los equipos extra son los meseros: eso lo vendemos, no es fuga.
      kind: a.isPro
        ? ("pro" as const)
        : a.selling > 1
          ? ("branches" as const)
          : ("device_change" as const),
      plan: a.plan,
      last_seen: a.last_seen,
    }))
    .sort(
      (x, y) =>
        y.selling_devices - x.selling_devices ||
        y.device_count - x.device_count,
    );

  // Por día del mes: abrieron, cobraron y descargas nuevas.
  const daily: DailyPoint[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const active = new Set<string>();
    const sellingToday = new Set<string>();
    const newToday = new Set<string>();
    for (const r of rows) {
      if (r.ping_date !== date) continue;
      active.add(r.install_id);
      if ((r.orders_today ?? 0) > 0) sellingToday.add(r.install_id);
      if (r.days_since_install === 0) newToday.add(r.install_id);
    }
    daily.push({
      date,
      active: active.size,
      selling: sellingToday.size,
      newInstalls: newToday.size,
    });
  }

  return {
    activeInstalls: byInstall.size,
    selling,
    sellingSubscribed,
    configured,
    empty,
    totalOrders,
    subscribed,
    payingAccounts: accounts.size,
    multiDevice,
    realBranches: multiDevice.filter((a) => a.kind === "branches").length,
    monthly,
    yearly,
    pro,
    platforms,
    daily,
    soldDaysByInstall: new Map(
      [...byInstall.entries()].map(([id, s]) => [id, s.soldDays]),
    ),
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
///
/// `knownInstalls` acota "usuarios con IA" a las instalaciones que sí tienen
/// pings en el periodo. Si se purgan pings viejos y no sus filas de IA, sin
/// este filtro salen más usuarios de IA que instalaciones activas.
export function summarizeAi(
  rows: AiUsage[],
  knownInstalls?: Set<string>,
): AiSummary {
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

  const users = knownInstalls
    ? [...byInstall.keys()].filter((id) => knownInstalls.has(id)).length
    : byInstall.size;

  return {
    totalCalls,
    callsToday,
    usersWithAi: users,
    byInstall: [...byInstall.values()].sort((a, b) => b.total - a.total),
  };
}
