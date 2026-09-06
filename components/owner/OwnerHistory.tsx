"use client";

import { useState } from "react";
import { viewFor } from "@/lib/owner/parse";
import { formatTimeAmPmEs, historyDayLabel, paymentLabel, pesos } from "@/lib/owner/format";
import type { OwnerMetricsBundle, OwnerOrderSummary } from "@/lib/owner/types";
import { IconCard, IconCash, IconChevron, IconReceipt, IconTransfer } from "./icons";

type Props = {
  bundle: OwnerMetricsBundle;
  selectedId: string | null;
};

export default function OwnerHistory({ bundle, selectedId }: Props) {
  const view = viewFor(bundle, selectedId);
  if (view.orders.length === 0) {
    return (
      <div className="owner-empty">
        <IconReceipt />
        <h2>Aún no hay ventas aquí</h2>
        <p>Cuando la caja cobre con internet, verás las ventas de los últimos 7 días.</p>
      </div>
    );
  }

  const byDay = new Map<string, OwnerOrderSummary[]>();
  for (const order of view.orders) {
    const list = byDay.get(order.day) ?? [];
    list.push(order);
    byDay.set(order.day, list);
  }
  const dayTotals = new Map(view.days.map((day) => [day.day, day.totalCents]));
  const dayCounts = new Map(view.days.map((day) => [day.day, day.orderCount]));
  const dayKeys = [...byDay.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="owner-page owner-history">
      {dayKeys.map((day) => {
        const orders = byDay.get(day)!;
        const total =
          dayTotals.get(day) ?? orders.reduce((sum, order) => sum + order.salesCents, 0);
        const count = dayCounts.get(day) ?? orders.length;
        return (
          <section key={day}>
            <header className="owner-day-head">
              <h2>{historyDayLabel(day)}</h2>
              <span>
                {count} · {pesos(total)}
              </span>
            </header>
            {orders.map((order) => (
              <SaleTile key={order.orderId} order={order} />
            ))}
          </section>
        );
      })}
      <p className="owner-footnote">
        Solo lectura · últimos 7 días. Reimprimir o WhatsApp siguen en la caja.
      </p>
    </div>
  );
}

function SaleTile({ order }: { order: OwnerOrderSummary }) {
  const [open, setOpen] = useState(false);
  const canExpand = order.tipCents > 0 || order.paymentMethod === "split";
  const pay = paymentLabel(order.paymentMethod);

  return (
    <article className="owner-card owner-sale">
      <button
        type="button"
        className="owner-sale-head"
        onClick={() => canExpand && setOpen((v) => !v)}
        disabled={!canExpand}
      >
        <span className="owner-sale-icon">{paymentIcon(order.paymentMethod)}</span>
        <span className="owner-sale-copy">
          <strong>{order.displayName}</strong>
          <span className="owner-muted">
            {pay} · {formatTimeAmPmEs(order.closedAt)}
            {order.waiterName ? ` · ${order.waiterName}` : ""}
          </span>
        </span>
        <strong className="owner-sale-amount">{pesos(order.salesCents)}</strong>
        {canExpand && (
          <span className={`owner-chevron${open ? " is-open" : ""}`}>
            <IconChevron />
          </span>
        )}
      </button>
      {open && (
        <div className="owner-cut-body">
          {order.tipCents > 0 && <Row label="Propina" value={pesos(order.tipCents)} />}
          {order.paymentMethod === "split" && (
            <>
              {order.paidCash > 0 && <Row label="Efectivo" value={pesos(order.paidCash)} />}
              {order.paidCard > 0 && <Row label="Tarjeta" value={pesos(order.paidCard)} />}
              {order.paidTransfer > 0 && (
                <Row label="Transferencia" value={pesos(order.paidTransfer)} />
              )}
            </>
          )}
          <Row label="Total venta" value={pesos(order.salesCents)} bold />
        </div>
      )}
    </article>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className={`owner-row${bold ? " is-bold" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function paymentIcon(method: string) {
  if (method === "card") return <IconCard />;
  if (method === "transfer") return <IconTransfer />;
  return <IconCash />;
}
