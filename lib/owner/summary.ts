import { pesos, prevDayKey } from "./format";
import type {
  ArqueoBadge,
  OwnerCajaSnapshot,
  OwnerDashboardSummary,
  OwnerMetricsBundle,
  OwnerWaiterSales,
} from "./types";

export function totalSalesCents(caja: OwnerCajaSnapshot): number {
  return caja.cashSalesCents + caja.cardSalesCents + caja.transferSalesCents;
}

export function expectedCashCents(caja: OwnerCajaSnapshot): number {
  return (
    caja.openingCashCents +
    caja.cashSalesCents +
    caja.cashTipsCents +
    caja.incomeCents -
    caja.expenseCents
  );
}

function latestTime(dates: Array<Date | null | undefined>): Date | null {
  let latest: Date | null = null;
  for (const date of dates) {
    if (!date) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

export function summarizeOwnerDashboard(
  bundle: OwnerMetricsBundle,
  todayKey: string,
): OwnerDashboardSummary {
  let today: OwnerDashboardSummary["today"];
  let yesterday: OwnerDashboardSummary["yesterday"];
  let bizName: string | undefined;
  let weekTotal = 0;
  let weekOrders = 0;
  const yesterdayKey = prevDayKey(todayKey);

  for (const day of bundle.days) {
    if (day.day === todayKey) today = day;
    if (day.day === yesterdayKey) yesterday = day;
    const name = day.bizName?.trim();
    if (!bizName && name) bizName = name;
    weekTotal += day.totalCents;
    weekOrders += day.orderCount;
  }

  const lastSale = [...bundle.orders].sort(
    (a, b) => b.closedAt.getTime() - a.closedAt.getTime(),
  )[0] ?? null;

  const periodOrders = bundle.caja?.periodStart
    ? bundle.orders.filter((order) => order.closedAt >= bundle.caja!.periodStart!)
    : bundle.orders.filter((order) => order.day === todayKey);
  const tipCents = periodOrders.reduce((sum, order) => sum + order.tipCents, 0);

  const periodTotal = bundle.caja
    ? totalSalesCents(bundle.caja)
    : (today?.totalCents ?? 0);
  const periodOrdersCount = bundle.caja?.orderCount ?? today?.orderCount ?? 0;
  const avgTicketCents =
    periodOrdersCount > 0
      ? Math.round(periodTotal / periodOrdersCount)
      : (today?.avgTicketCents ?? 0);

  const todayTotal = today?.totalCents ?? 0;
  const vsYesterdayCents = yesterday ? todayTotal - yesterday.totalCents : null;

  const syncedAt = latestTime([
    bundle.caja?.updatedAt,
    ...bundle.days.map((day) => day.updatedAt),
    lastSale?.closedAt,
    ...(bundle.caja?.movements.map((movement) => movement.createdAt) ?? []),
    ...(bundle.caja?.cuts.map((cut) => cut.cutAt) ?? []),
  ]);

  return {
    todayKey,
    bizName,
    today,
    yesterday,
    caja: bundle.caja,
    lastSale,
    weekTotalCents: weekTotal,
    weekOrderCount: weekOrders,
    tipCents,
    avgTicketCents,
    vsYesterdayCents,
    syncedAt,
  };
}

export function vsYesterdayLabel(diffCents: number): string {
  if (diffCents === 0) return "Igual que ayer";
  const sign = diffCents > 0 ? "+" : "−";
  return `${sign}${pesos(Math.abs(diffCents))} vs ayer`;
}

export function waiterSalesFromOrders(
  orders: OwnerMetricsBundle["orders"],
): OwnerWaiterSales[] {
  if (!orders.some((order) => order.waiterName)) return [];
  const count = new Map<string, number>();
  const total = new Map<string, number>();
  for (const order of orders) {
    const name = order.waiterName?.trim() || "Sin asignar";
    count.set(name, (count.get(name) ?? 0) + 1);
    total.set(name, (total.get(name) ?? 0) + order.salesCents);
  }
  return [...total.entries()]
    .map(([name, totalCents]) => ({
      name,
      orderCount: count.get(name) ?? 0,
      totalCents,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function arqueoBadge(
  expectedCash: number,
  countedCash?: number,
): ArqueoBadge {
  if (countedCash == null) {
    return { label: "Sin arqueo", cashNote: pesos(expectedCash), tone: "muted" };
  }
  const diff = countedCash - expectedCash;
  if (diff === 0) {
    return { label: "Cuadró", cashNote: pesos(countedCash), tone: "ok" };
  }
  if (diff > 0) {
    return { label: `Sobró ${pesos(diff)}`, tone: "warn" };
  }
  return { label: `Faltó ${pesos(Math.abs(diff))}`, tone: "danger" };
}
