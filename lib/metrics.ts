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
  trial: boolean;
  updated_at: string;
};

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
  let inTrial = 0;
  for (const p of latest) {
    if (p.subscription_active) subscribed++;
    else if (p.trial) inTrial++;
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
