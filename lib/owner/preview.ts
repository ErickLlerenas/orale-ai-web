import { parseOwnerMetrics } from "./parse";
import type { OwnerMetricsBundle } from "./types";

const now = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const y = new Date(now);
y.setDate(y.getDate() - 1);
const yesterday = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
const earlier = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
const cutAt = new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString();
const updatedAt = now.toISOString();

/** Datos de muestra solo para ver el diseño en local (`?demo=1`). */
export const previewBundle: OwnerMetricsBundle = parseOwnerMetrics({
  locations: [
    {
      businessId: "centro",
      bizName: "Taquería Centro",
      days: [
        {
          day,
          totalCents: 485000,
          orderCount: 18,
          cashCents: 210000,
          cardCents: 195000,
          transferCents: 80000,
          avgTicketCents: 26944,
          bizName: "Taquería Centro",
          updatedAt,
        },
        {
          day: yesterday,
          totalCents: 610000,
          orderCount: 22,
          cashCents: 280000,
          cardCents: 250000,
          transferCents: 80000,
          avgTicketCents: 27727,
          bizName: "Taquería Centro",
          updatedAt,
        },
      ],
      orders: [
        {
          orderId: "o1",
          day,
          closedAt: now.toISOString(),
          displayName: "Mesa 4",
          paymentMethod: "cash",
          salesCents: 24500,
          tipCents: 0,
          paidCash: 24500,
          paidCard: 0,
          paidTransfer: 0,
          waiterName: "Ana",
        },
        {
          orderId: "o2",
          day,
          closedAt: earlier,
          displayName: "Para llevar",
          paymentMethod: "split",
          salesCents: 38000,
          tipCents: 4000,
          paidCash: 20000,
          paidCard: 18000,
          paidTransfer: 0,
          waiterName: "Luis",
        },
      ],
      caja: {
        periodStart: earlier,
        openingCashCents: 50000,
        cashSalesCents: 210000,
        cashTipsCents: 8000,
        cardSalesCents: 195000,
        transferSalesCents: 80000,
        incomeCents: 0,
        expenseCents: 15000,
        orderCount: 18,
        updatedAt,
        movements: [
          {
            movementId: "m1",
            type: "expense",
            description: "Cambio de garrafón",
            amountCents: 15000,
            createdAt: earlier,
          },
        ],
        cuts: [
          {
            cutId: "c1",
            cutAt,
            salesTotalCents: 620000,
            expectedCashCents: 180000,
            openingCashCents: 50000,
            cashSalesCents: 130000,
            cardSalesCents: 400000,
            transferSalesCents: 90000,
            cashTipsCents: 5000,
            incomeCents: 0,
            expenseCents: 5000,
            countedCashCents: 180000,
          },
        ],
      },
    },
    {
      businessId: "norte",
      bizName: "Sucursal Norte",
      days: [
        {
          day,
          totalCents: 210000,
          orderCount: 9,
          cashCents: 90000,
          cardCents: 120000,
          transferCents: 0,
          avgTicketCents: 23333,
          bizName: "Sucursal Norte",
          updatedAt,
        },
        {
          day: yesterday,
          totalCents: 180000,
          orderCount: 7,
          cashCents: 80000,
          cardCents: 100000,
          transferCents: 0,
          avgTicketCents: 25714,
          bizName: "Sucursal Norte",
          updatedAt,
        },
      ],
      orders: [
        {
          orderId: "o3",
          day,
          closedAt: earlier,
          displayName: "Mesa 1",
          paymentMethod: "card",
          salesCents: 52000,
          tipCents: 0,
          paidCash: 0,
          paidCard: 52000,
          paidTransfer: 0,
          waiterName: "María",
        },
      ],
      caja: {
        periodStart: null,
        openingCashCents: 30000,
        cashSalesCents: 90000,
        cashTipsCents: 0,
        cardSalesCents: 120000,
        transferSalesCents: 0,
        incomeCents: 20000,
        expenseCents: 0,
        orderCount: 9,
        updatedAt,
        movements: [
          {
            movementId: "m2",
            type: "income",
            description: "Fondo extra",
            amountCents: 20000,
            createdAt: earlier,
          },
        ],
        cuts: [],
      },
    },
  ],
});
