import type {
  OwnerCajaSnapshot,
  OwnerCashMovement,
  OwnerCutSummary,
  OwnerDayMetrics,
  OwnerLocation,
  OwnerMetricsBundle,
  OwnerOrderSummary,
} from "./types";

function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  return 0;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asDate(value: unknown): Date | null {
  const raw = asText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDay(raw: Record<string, unknown>): OwnerDayMetrics | null {
  const day = asText(raw.day);
  if (!day) return null;
  const bizName = asText(raw.bizName);
  return {
    day,
    totalCents: asInt(raw.totalCents),
    orderCount: asInt(raw.orderCount),
    cashCents: asInt(raw.cashCents),
    cardCents: asInt(raw.cardCents),
    transferCents: asInt(raw.transferCents),
    avgTicketCents: asInt(raw.avgTicketCents),
    bizName: bizName || undefined,
  };
}

function parseOrder(raw: Record<string, unknown>): OwnerOrderSummary | null {
  const orderId = asText(raw.orderId);
  const day = asText(raw.day);
  const closedAt = asDate(raw.closedAt);
  if (!orderId || !day || !closedAt) return null;
  const displayName = asText(raw.displayName);
  const paymentMethod = asText(raw.paymentMethod);
  const waiterName = asText(raw.waiterName);
  return {
    orderId,
    day,
    closedAt,
    displayName: displayName || "Orden",
    paymentMethod: paymentMethod || "cash",
    salesCents: asInt(raw.salesCents),
    tipCents: asInt(raw.tipCents),
    paidCash: asInt(raw.paidCash),
    paidCard: asInt(raw.paidCard),
    paidTransfer: asInt(raw.paidTransfer),
    waiterName: waiterName || undefined,
  };
}

function parseMovement(raw: Record<string, unknown>): OwnerCashMovement | null {
  const movementId = asText(raw.movementId);
  const type = asText(raw.type);
  const description = asText(raw.description);
  const createdAt = asDate(raw.createdAt);
  if (
    !movementId ||
    (type !== "income" && type !== "expense") ||
    !description ||
    !createdAt
  ) {
    return null;
  }
  const amountCents = asInt(raw.amountCents);
  if (amountCents < 0) return null;
  return { movementId, type, description, amountCents, createdAt };
}

function parseCut(raw: Record<string, unknown>): OwnerCutSummary | null {
  const cutId = asText(raw.cutId);
  const cutAt = asDate(raw.cutAt);
  if (!cutId || !cutAt) return null;
  const counted = raw.countedCashCents;
  return {
    cutId,
    cutAt,
    salesTotalCents: asInt(raw.salesTotalCents),
    expectedCashCents: asInt(raw.expectedCashCents),
    openingCashCents: asInt(raw.openingCashCents),
    cashSalesCents: asInt(raw.cashSalesCents),
    cardSalesCents: asInt(raw.cardSalesCents),
    transferSalesCents: asInt(raw.transferSalesCents),
    cashTipsCents: asInt(raw.cashTipsCents),
    incomeCents: asInt(raw.incomeCents),
    expenseCents: asInt(raw.expenseCents),
    countedCashCents:
      typeof counted === "number" && Number.isFinite(counted)
        ? Math.round(counted)
        : undefined,
  };
}

function parseCaja(raw: Record<string, unknown> | null): OwnerCajaSnapshot | null {
  if (!raw) return null;
  const movements: OwnerCashMovement[] = [];
  if (Array.isArray(raw.movements)) {
    for (const item of raw.movements) {
      if (!item || typeof item !== "object") continue;
      const movement = parseMovement(item as Record<string, unknown>);
      if (movement) movements.push(movement);
    }
  }
  const cuts: OwnerCutSummary[] = [];
  if (Array.isArray(raw.cuts)) {
    for (const item of raw.cuts) {
      if (!item || typeof item !== "object") continue;
      const cut = parseCut(item as Record<string, unknown>);
      if (cut) cuts.push(cut);
    }
  }
  return {
    periodStart: asDate(raw.periodStart),
    openingCashCents: asInt(raw.openingCashCents),
    cashSalesCents: asInt(raw.cashSalesCents),
    cashTipsCents: asInt(raw.cashTipsCents),
    cardSalesCents: asInt(raw.cardSalesCents),
    transferSalesCents: asInt(raw.transferSalesCents),
    incomeCents: asInt(raw.incomeCents),
    expenseCents: asInt(raw.expenseCents),
    orderCount: asInt(raw.orderCount),
    movements,
    cuts,
  };
}

function parseDays(raw: unknown): OwnerDayMetrics[] {
  if (!Array.isArray(raw)) return [];
  const days: OwnerDayMetrics[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const day = parseDay(item as Record<string, unknown>);
    if (day) days.push(day);
  }
  return days;
}

function parseOrders(raw: unknown): OwnerOrderSummary[] {
  if (!Array.isArray(raw)) return [];
  const orders: OwnerOrderSummary[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const order = parseOrder(item as Record<string, unknown>);
    if (order) orders.push(order);
  }
  return orders;
}

function parseLocation(raw: Record<string, unknown>): OwnerLocation | null {
  const businessId = asText(raw.businessId);
  if (!businessId) return null;
  const days = parseDays(raw.days);
  const bizName = asText(raw.bizName) || days[0]?.bizName;
  return {
    businessId,
    bizName,
    days,
    orders: parseOrders(raw.orders),
    caja: parseCaja(
      raw.caja && typeof raw.caja === "object"
        ? (raw.caja as Record<string, unknown>)
        : null,
    ),
  };
}

function sumDay(day: string, rows: OwnerDayMetrics[]): OwnerDayMetrics {
  let total = 0;
  let orders = 0;
  let cash = 0;
  let card = 0;
  let transfer = 0;
  for (const row of rows) {
    total += row.totalCents;
    orders += row.orderCount;
    cash += row.cashCents;
    card += row.cardCents;
    transfer += row.transferCents;
  }
  return {
    day,
    totalCents: total,
    orderCount: orders,
    cashCents: cash,
    cardCents: card,
    transferCents: transfer,
    avgTicketCents: orders === 0 ? 0 : Math.round(total / orders),
    bizName: rows.length === 1 ? rows[0].bizName : "Todas las sucursales",
  };
}

export function mergeOwnerDays(all: OwnerDayMetrics[]): OwnerDayMetrics[] {
  const byDay = new Map<string, OwnerDayMetrics[]>();
  for (const day of all) {
    const list = byDay.get(day.day) ?? [];
    list.push(day);
    byDay.set(day.day, list);
  }
  return [...byDay.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((day) => sumDay(day, byDay.get(day)!));
}

export function locationLabel(location: OwnerLocation): string {
  const name = location.bizName?.trim();
  return name ? name : "Sucursal";
}

export function parseOwnerMetrics(json: unknown): OwnerMetricsBundle {
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const locations: OwnerLocation[] = [];
  if (Array.isArray(root.locations)) {
    for (const item of root.locations) {
      if (!item || typeof item !== "object") continue;
      const location = parseLocation(item as Record<string, unknown>);
      if (location) locations.push(location);
    }
  }

  const days = parseDays(root.days);
  const orders = parseOrders(root.orders);
  const caja = parseCaja(
    root.caja && typeof root.caja === "object"
      ? (root.caja as Record<string, unknown>)
      : null,
  );

  if (locations.length === 0 && (days.length > 0 || orders.length > 0 || caja)) {
    locations.push({
      businessId: "legacy",
      bizName: days[0]?.bizName,
      days,
      orders,
      caja,
    });
  }

  return { days, orders, caja, locations };
}

/** Una sucursal, o todas juntas si `businessId` es null. */
export function viewFor(
  bundle: OwnerMetricsBundle,
  businessId: string | null,
): OwnerMetricsBundle {
  if (!businessId || bundle.locations.length <= 1) {
    if (bundle.locations.length <= 1) return bundle;
    const orders = bundle.locations.flatMap((location) => location.orders);
    orders.sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());
    return {
      days: mergeOwnerDays(bundle.locations.flatMap((location) => location.days)),
      orders,
      caja: null,
      locations: bundle.locations,
    };
  }
  const location = bundle.locations.find((item) => item.businessId === businessId);
  if (!location) return bundle;
  return {
    days: location.days,
    orders: location.orders,
    caja: location.caja,
    locations: bundle.locations,
  };
}
