const pesosFmt = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

const dayFmt = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

const longDayFmt = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function pesos(cents: number): string {
  return pesosFmt.format(cents / 100);
}

function two(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatTimeAmPmEs(value: Date): string {
  const local = value;
  let hour12 = local.getHours() % 12;
  if (hour12 === 0) hour12 = 12;
  const suffix = local.getHours() >= 12 ? "p.m." : "a.m.";
  return `${hour12}:${two(local.getMinutes())} ${suffix}`;
}

export function dayTimeLabel(value: Date, separator = " · "): string {
  return `${dayFmt.format(value)}${separator}${formatTimeAmPmEs(value)}`;
}

export function ownerDayKey(local = new Date()): string {
  return `${local.getFullYear()}-${two(local.getMonth() + 1)}-${two(local.getDate())}`;
}

export function historyDayLabel(day: string): string {
  const parsed = new Date(`${day}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  const label = longDayFmt.format(parsed);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function cutPeriodNote(cutAt: Date, periodStart: Date | null): string | null {
  if (!periodStart) return null;
  const sameDay =
    periodStart.getFullYear() === cutAt.getFullYear() &&
    periodStart.getMonth() === cutAt.getMonth() &&
    periodStart.getDate() === cutAt.getDate();
  if (sameDay) return null;
  return `Desde el ${dayTimeLabel(periodStart, " ")}`;
}

export function ownerFirstName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null): string | null {
  const meta = user?.user_metadata;
  if (meta) {
    for (const key of ["full_name", "name", "given_name"] as const) {
      const raw = meta[key];
      if (typeof raw !== "string") continue;
      const first = raw.trim().split(/\s+/)[0];
      if (first) return first;
    }
  }
  const email = user?.email?.trim();
  if (email?.includes("@")) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }
  return null;
}

export function ownerHomeTitle(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null, bizName?: string): string {
  const first = ownerFirstName(user);
  if (first) return `Hola, ${first}`;
  const biz = bizName?.trim();
  if (biz) return biz;
  return "Tu negocio";
}

export function paymentLabel(method: string): string {
  switch (method) {
    case "cash":
      return "Efectivo";
    case "card":
      return "Tarjeta";
    case "transfer":
      return "Transferencia";
    case "split":
      return "Mixto";
    default:
      return "Otro";
  }
}
