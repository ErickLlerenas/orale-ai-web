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

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(d);
}

export type Summary = {
  totalInstalls: number;
  activeToday: number;
  active7: number;
  active30: number;
  subscribed: number; // DISPOSITIVOS con suscripción activa
  payingAccounts: number; // CUENTAS de pago (deduplicado, no por dispositivo)
  multiDevice: AccountRow[]; // cuentas usadas en 2+ dispositivos (doble sucursal)
  monthly: number;
  yearly: number;
  ios: number;
  android: number;
  windows: number;
  ordersToday: number;
  dailyActive: { date: string; count: number }[];
  latest: Ping[]; // último ping por instalación (más reciente primero)
};

/// Calcula todas las métricas del dashboard a partir de los pings.
export function summarize(rows: Ping[]): Summary {
  const today = mxToday();
  const since7 = daysAgo(7);
  const since30 = daysAgo(30);

  const installs = new Set<string>();
  const activeTodaySet = new Set<string>();
  const active7Set = new Set<string>();
  const active30Set = new Set<string>();
  let ordersToday = 0;

  // Último ping por instalación.
  const latestByInstall = new Map<string, Ping>();

  for (const r of rows) {
    installs.add(r.install_id);
    if (r.ping_date === today) {
      activeTodaySet.add(r.install_id);
      ordersToday += r.orders_today;
    }
    if (r.ping_date >= since7) active7Set.add(r.install_id);
    if (r.ping_date >= since30) active30Set.add(r.install_id);

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
  let ios = 0;
  let android = 0;
  let windows = 0;
  for (const p of latest) {
    switch (p.platform) {
      case "ios":
        ios++;
        break;
      case "android":
        android++;
        break;
      case "windows":
        windows++;
        break;
    }
    if (p.subscription_active) {
      subscribed++;
      if (p.plan === "monthly") monthly++;
      else if (p.plan === "yearly") yearly++;
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

  // Activos por día, últimos 14 días.
  const dailyActive: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = daysAgo(i);
    const set = new Set<string>();
    for (const r of rows) {
      if (r.ping_date === date) set.add(r.install_id);
    }
    dailyActive.push({ date, count: set.size });
  }

  return {
    totalInstalls: installs.size,
    activeToday: activeTodaySet.size,
    active7: active7Set.size,
    active30: active30Set.size,
    subscribed,
    payingAccounts: accounts.size,
    multiDevice,
    monthly,
    yearly,
    ios,
    android,
    windows,
    ordersToday,
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
