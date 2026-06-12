export type Plan = "monthly" | "yearly" | "lifetime" | "none" | "unknown";

export type Ping = {
  install_id: string;
  ping_date: string; // yyyy-mm-dd
  platform: string | null;
  app_version: string | null;
  orders_today: number;
  sales_today_cents: number;
  product_count: number;
  days_since_install: number;
  subscription_active: boolean;
  plan: Plan | null; // qué producto compró: monthly | yearly | lifetime
  trial: boolean;
  updated_at: string;
};

/// Etiqueta legible del plan para la UI.
export function planLabel(plan: Plan | null): string {
  switch (plan) {
    case "monthly":
      return "Mensual";
    case "yearly":
      return "Anual";
    case "lifetime":
      return "De por vida";
    default:
      return "—";
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
  subscribed: number;
  monthly: number;
  yearly: number;
  lifetime: number;
  inTrial: number;
  ordersToday: number;
  salesTodayCents: number;
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
  let salesTodayCents = 0;

  // Último ping por instalación.
  const latestByInstall = new Map<string, Ping>();

  for (const r of rows) {
    installs.add(r.install_id);
    if (r.ping_date === today) {
      activeTodaySet.add(r.install_id);
      ordersToday += r.orders_today;
      salesTodayCents += r.sales_today_cents;
    }
    if (r.ping_date >= since7) active7Set.add(r.install_id);
    if (r.ping_date >= since30) active30Set.add(r.install_id);

    const prev = latestByInstall.get(r.install_id);
    if (!prev || r.ping_date > prev.ping_date) {
      latestByInstall.set(r.install_id, r);
    }
  }

  const latest = [...latestByInstall.values()].sort((a, b) =>
    b.ping_date.localeCompare(a.ping_date),
  );

  let subscribed = 0;
  let monthly = 0;
  let yearly = 0;
  let lifetime = 0;
  let inTrial = 0;
  for (const p of latest) {
    if (p.subscription_active) {
      subscribed++;
      if (p.plan === "monthly") monthly++;
      else if (p.plan === "yearly") yearly++;
      else if (p.plan === "lifetime") lifetime++;
    } else if (p.trial) {
      inTrial++;
    }
  }

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
    monthly,
    yearly,
    lifetime,
    inTrial,
    ordersToday,
    salesTodayCents,
    dailyActive,
    latest,
  };
}

export function pesos(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(cents / 100);
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
