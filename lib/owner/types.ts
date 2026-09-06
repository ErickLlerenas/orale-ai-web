export type OwnerDayMetrics = {
  day: string;
  totalCents: number;
  orderCount: number;
  cashCents: number;
  cardCents: number;
  transferCents: number;
  avgTicketCents: number;
  bizName?: string;
  updatedAt?: Date;
};

export type OwnerOrderSummary = {
  orderId: string;
  day: string;
  closedAt: Date;
  displayName: string;
  paymentMethod: string;
  salesCents: number;
  tipCents: number;
  paidCash: number;
  paidCard: number;
  paidTransfer: number;
  waiterName?: string;
};

export type OwnerCashMovement = {
  movementId: string;
  type: "income" | "expense";
  description: string;
  amountCents: number;
  createdAt: Date;
};

export type OwnerCutSummary = {
  cutId: string;
  cutAt: Date;
  salesTotalCents: number;
  expectedCashCents: number;
  openingCashCents: number;
  cashSalesCents: number;
  cardSalesCents: number;
  transferSalesCents: number;
  cashTipsCents: number;
  incomeCents: number;
  expenseCents: number;
  countedCashCents?: number;
};

export type OwnerCajaSnapshot = {
  periodStart: Date | null;
  openingCashCents: number;
  cashSalesCents: number;
  cashTipsCents: number;
  cardSalesCents: number;
  transferSalesCents: number;
  incomeCents: number;
  expenseCents: number;
  orderCount: number;
  movements: OwnerCashMovement[];
  cuts: OwnerCutSummary[];
  updatedAt: Date | null;
};

export type OwnerLocation = {
  businessId: string;
  bizName?: string;
  days: OwnerDayMetrics[];
  orders: OwnerOrderSummary[];
  caja: OwnerCajaSnapshot | null;
};

export type OwnerMetricsBundle = {
  days: OwnerDayMetrics[];
  orders: OwnerOrderSummary[];
  caja: OwnerCajaSnapshot | null;
  locations: OwnerLocation[];
};

export type OwnerDashboardSummary = {
  todayKey: string;
  bizName?: string;
  today?: OwnerDayMetrics;
  yesterday?: OwnerDayMetrics;
  caja: OwnerCajaSnapshot | null;
  lastSale: OwnerOrderSummary | null;
  weekTotalCents: number;
  weekOrderCount: number;
  tipCents: number;
  avgTicketCents: number;
  vsYesterdayCents: number | null;
  syncedAt: Date | null;
};

export type OwnerWaiterSales = {
  name: string;
  orderCount: number;
  totalCents: number;
};

export type ArqueoBadge = {
  label: string;
  cashNote?: string;
  tone: "muted" | "ok" | "warn" | "danger";
};
