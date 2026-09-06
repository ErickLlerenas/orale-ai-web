import { pesos } from "./format";
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

export function summarizeOwnerDashboard(
  bundle: OwnerMetricsBundle,
  todayKey: string,
): OwnerDashboardSummary {
  let today: OwnerDashboardSummary["today"];
  let bizName: string | undefined;
  for (const day of bundle.days) {
    if (day.day === todayKey) today = day;
    const name = day.bizName?.trim();
    if (!bizName && name) bizName = name;
  }
  return {
    todayKey,
    bizName,
    today,
    caja: bundle.caja,
  };
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
