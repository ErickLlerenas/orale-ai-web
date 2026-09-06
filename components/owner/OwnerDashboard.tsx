"use client";

import { useMemo, useState } from "react";
import { locationLabel, viewFor } from "@/lib/owner/parse";
import {
  cutPeriodNote,
  dayTimeLabel,
  ownerDayKey,
  pesos,
  relativeTimeEs,
  updatedAgoLabel,
} from "@/lib/owner/format";
import {
  arqueoBadge,
  expectedCashCents,
  summarizeOwnerDashboard,
  totalSalesCents,
  vsYesterdayLabel,
  waiterSalesFromOrders,
} from "@/lib/owner/summary";
import type {
  OwnerCajaSnapshot,
  OwnerCashMovement,
  OwnerCutSummary,
  OwnerLocation,
  OwnerMetricsBundle,
  OwnerWaiterSales,
} from "@/lib/owner/types";
import {
  IconAlert,
  IconCard,
  IconCash,
  IconCheck,
  IconChevron,
  IconHistory,
  IconIn,
  IconInsights,
  IconOut,
  IconPiggy,
  IconReceipt,
  IconTransfer,
} from "./icons";

type Props = {
  bundle: OwnerMetricsBundle;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  historyHref: string;
};

export default function OwnerDashboard({
  bundle,
  selectedId,
  onSelect,
  historyHref,
}: Props) {
  const view = viewFor(bundle, selectedId);
  const empty = view.days.length === 0 && !view.caja && view.orders.length === 0;
  const summary = summarizeOwnerDashboard(view, ownerDayKey());
  const waiters = waiterSalesFromOrders(view.orders);
  const several = bundle.locations.length > 1;

  const cajaBlocks = useMemo(() => {
    if (selectedId == null && several) {
      return bundle.locations
        .filter((location) => location.caja)
        .map((location) => ({ loc: location, caja: location.caja! }));
    }
    if (summary.caja) return [{ loc: null as OwnerLocation | null, caja: summary.caja }];
    return [];
  }, [bundle.locations, selectedId, several, summary.caja]);

  if (empty) return <EmptyBody />;

  return (
    <div className="owner-page">
      {several ? (
        <div className="owner-chips" role="tablist" aria-label="Sucursales">
          <button
            type="button"
            className={`owner-chip${selectedId == null ? " is-on" : ""}`}
            onClick={() => onSelect(null)}
          >
            Todas
          </button>
          {bundle.locations.map((location) => (
            <button
              key={location.businessId}
              type="button"
              className={`owner-chip${selectedId === location.businessId ? " is-on" : ""}`}
              onClick={() => onSelect(location.businessId)}
            >
              {locationLabel(location)}
            </button>
          ))}
        </div>
      ) : (
        summary.bizName && <p className="owner-biz">{summary.bizName}</p>
      )}

      <div className="owner-grid">
        <div className="owner-primary">
          <PeriodSalesCard summary={summary} historyHref={historyHref} />
          {waiters.length > 0 && <WaitersCard waiters={waiters} />}
        </div>
        {cajaBlocks.map((block) => (
          <div key={block.loc?.businessId ?? "caja"} className="owner-caja-col">
            <CashCard
              caja={block.caja}
              title={block.loc ? `Efectivo · ${locationLabel(block.loc)}` : undefined}
            />
            <h2>
              {block.loc ? `Cortes · ${locationLabel(block.loc)}` : "Cortes anteriores"}
            </h2>
            {block.caja.cuts.length === 0 ? (
              <p className="owner-muted">Aún no hay cortes.</p>
            ) : (
              block.caja.cuts.map((cut, index) => (
                <CutTile
                  key={cut.cutId}
                  cut={cut}
                  periodStart={
                    index + 1 < block.caja.cuts.length
                      ? block.caja.cuts[index + 1].cutAt
                      : null
                  }
                />
              ))
            )}
          </div>
        ))}
      </div>

      <p className="owner-footnote">
        {summary.syncedAt ? `${updatedAgoLabel(summary.syncedAt)}. ` : ""}
        Solo lectura. Cobrar, entradas y cortes se hacen en la caja del local.
        Los números llegan cuando esa caja tiene internet. Toca Actualizar para
        refrescar.
      </p>
    </div>
  );
}

function PeriodSalesCard({
  summary,
  historyHref,
}: {
  summary: ReturnType<typeof summarizeOwnerDashboard>;
  historyHref: string;
}) {
  const caja = summary.caja;
  const periodLabel = !caja
    ? "Hoy"
    : caja.periodStart
      ? `Desde el último corte · ${dayTimeLabel(caja.periodStart)}`
      : "Desde el inicio";
  const total = caja ? totalSalesCents(caja) : (summary.today?.totalCents ?? 0);
  const orders = caja?.orderCount ?? summary.today?.orderCount ?? 0;
  const cash = caja?.cashSalesCents ?? summary.today?.cashCents ?? 0;
  const card = caja?.cardSalesCents ?? summary.today?.cardCents ?? 0;
  const transfer = caja?.transferSalesCents ?? summary.today?.transferCents ?? 0;
  const vs = summary.vsYesterdayCents;
  const vsTone =
    vs == null ? null : vs > 0 ? "up" : vs < 0 ? "down" : "flat";

  return (
    <section className="owner-card">
      <div className="owner-card-pad">
        <p className="owner-kicker">{periodLabel}</p>
        <p className="owner-hero-money">{pesos(total)}</p>
        <p className="owner-muted">
          {orders === 0
            ? "Sin ventas en este periodo"
            : `${orders} ${orders === 1 ? "venta" : "ventas"}`}
        </p>
        {summary.lastSale && (
          <p className="owner-pulse">
            Última venta · {relativeTimeEs(summary.lastSale.closedAt)} ·{" "}
            {summary.lastSale.displayName}
            {summary.lastSale.waiterName ? ` · ${summary.lastSale.waiterName}` : ""}{" "}
            · {pesos(summary.lastSale.salesCents)}
          </p>
        )}
        <div className="owner-breakdown">
          <Breakdown icon={<IconCash />} label="Efectivo" value={cash} />
          <Breakdown icon={<IconCard />} label="Tarjeta" value={card} />
          <Breakdown icon={<IconTransfer />} label="Transferencia" value={transfer} />
          {summary.avgTicketCents > 0 && (
            <div className="owner-row">
              <span>Ticket promedio</span>
              <strong>{pesos(summary.avgTicketCents)}</strong>
            </div>
          )}
          {summary.tipCents > 0 && (
            <div className="owner-row">
              <span>Propinas</span>
              <strong>{pesos(summary.tipCents)}</strong>
            </div>
          )}
          {summary.weekOrderCount > 0 && (
            <div className="owner-row">
              <span>Esta semana</span>
              <strong>
                {pesos(summary.weekTotalCents)}
                <span className="owner-muted">
                  {" "}
                  · {summary.weekOrderCount}{" "}
                  {summary.weekOrderCount === 1 ? "venta" : "ventas"}
                </span>
              </strong>
            </div>
          )}
          {vsTone && (
            <div className={`owner-row owner-vs is-${vsTone}`}>
              <span>Hoy vs ayer</span>
              <strong>{vsYesterdayLabel(vs!)}</strong>
            </div>
          )}
        </div>
      </div>
      <a className="owner-card-link" href={historyHref}>
        <span className="owner-card-link-icon">
          <IconHistory />
        </span>
        Ver historial de ventas
        <IconChevron />
      </a>
    </section>
  );
}

function Breakdown({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="owner-row">
      <span className="owner-row-icon">{icon}</span>
      <span>{label}</span>
      <strong>{pesos(value)}</strong>
    </div>
  );
}

function WaitersCard({ waiters }: { waiters: OwnerWaiterSales[] }) {
  return (
    <section className="owner-card owner-card-pad">
      <h3>Ventas por mesero</h3>
      {waiters.map((waiter) => (
        <div key={waiter.name} className="owner-row">
          <span className="owner-strong">{waiter.name}</span>
          <span className="owner-muted">
            {waiter.orderCount} · {pesos(waiter.totalCents)}
          </span>
        </div>
      ))}
    </section>
  );
}

function CashCard({ caja, title }: { caja: OwnerCajaSnapshot; title?: string }) {
  return (
    <section className="owner-card owner-card-pad">
      <p className="owner-kicker">{title ?? "Efectivo en caja"}</p>
      <p className="owner-cash-money">{pesos(expectedCashCents(caja))}</p>
      <div className="owner-row owner-row-soft">
        <span className="owner-row-icon">
          <IconPiggy />
        </span>
        <span>Fondo inicial: {pesos(caja.openingCashCents)}</span>
      </div>
      {caja.cashSalesCents > 0 && (
        <div className="owner-row owner-row-soft">
          <span>Ventas en efectivo</span>
          <strong>{pesos(caja.cashSalesCents)}</strong>
        </div>
      )}
      {caja.cashTipsCents > 0 && (
        <div className="owner-row owner-row-soft">
          <span>Propinas en efectivo</span>
          <strong>{pesos(caja.cashTipsCents)}</strong>
        </div>
      )}
      <div className="owner-flow">
        <span className="is-in">
          <IconIn /> {pesos(caja.incomeCents)}
        </span>
        <span className="is-out">
          <IconOut /> {pesos(caja.expenseCents)}
        </span>
      </div>
      {caja.movements.length > 0 && (
        <>
          <h3>Movimientos del turno</h3>
          {caja.movements.map((movement) => (
            <MovementRow key={movement.movementId} movement={movement} />
          ))}
        </>
      )}
    </section>
  );
}

function MovementRow({ movement }: { movement: OwnerCashMovement }) {
  const income = movement.type === "income";
  return (
    <div className="owner-movement">
      <span className={income ? "is-in" : "is-out"}>
        {income ? <IconIn /> : <IconOut />}
      </span>
      <div>
        <p className="owner-strong">{movement.description}</p>
        <p className="owner-muted owner-small">{dayTimeLabel(movement.createdAt)}</p>
      </div>
      <strong className={income ? "is-in" : "is-out"}>
        {income ? "+" : "−"}
        {pesos(movement.amountCents)}
      </strong>
    </div>
  );
}

function CutTile({
  cut,
  periodStart,
}: {
  cut: OwnerCutSummary;
  periodStart: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const badge = arqueoBadge(cut.expectedCashCents, cut.countedCashCents);
  const period = cutPeriodNote(cut.cutAt, periodStart);

  return (
    <article className="owner-card owner-cut">
      <button type="button" className="owner-cut-head" onClick={() => setOpen((v) => !v)}>
        <span className={`owner-cut-badge tone-${badge.tone}`}>
          {badge.tone === "ok" ? <IconCheck /> : badge.tone === "muted" ? <IconReceipt /> : <IconAlert />}
        </span>
        <span className="owner-cut-copy">
          <strong>{dayTimeLabel(cut.cutAt)}</strong>
          <span className={`tone-${badge.tone}`}>
            {badge.label}
            {badge.cashNote ? ` · ${badge.cashNote}` : ""}
          </span>
          {period && <span className="owner-muted owner-small">{period}</span>}
        </span>
        <span className="owner-cut-sales">
          <span className="owner-muted owner-small">Ventas</span>
          <strong>{pesos(cut.salesTotalCents)}</strong>
        </span>
        <span className={`owner-chevron${open ? " is-open" : ""}`}>
          <IconChevron />
        </span>
      </button>
      {open && (
        <div className="owner-cut-body">
          {cut.openingCashCents > 0 && (
            <CutRow label="Fondo inicial" value={pesos(cut.openingCashCents)} />
          )}
          <CutRow label="Ventas" value={pesos(cut.salesTotalCents)} />
          {cut.cashSalesCents > 0 && (
            <CutRow label="Efectivo" value={pesos(cut.cashSalesCents)} sub />
          )}
          {cut.cardSalesCents > 0 && (
            <CutRow label="Tarjeta" value={pesos(cut.cardSalesCents)} sub />
          )}
          {cut.transferSalesCents > 0 && (
            <CutRow label="Transferencia" value={pesos(cut.transferSalesCents)} sub />
          )}
          {cut.cashTipsCents > 0 && (
            <CutRow label="Propinas en efectivo" value={pesos(cut.cashTipsCents)} />
          )}
          {cut.incomeCents > 0 && <CutRow label="Entradas" value={pesos(cut.incomeCents)} />}
          {cut.expenseCents > 0 && <CutRow label="Salidas" value={pesos(cut.expenseCents)} />}
          <CutRow label="Efectivo esperado" value={pesos(cut.expectedCashCents)} />
          {cut.countedCashCents != null && (
            <CutRow label="Contado" value={pesos(cut.countedCashCents)} />
          )}
        </div>
      )}
    </article>
  );
}

function CutRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: boolean;
}) {
  return (
    <div className={`owner-row${sub ? " is-sub" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyBody() {
  return (
    <div className="owner-empty">
      <IconInsights />
      <h2>Aún no hay números aquí</h2>
      <p>
        Primero en la caja del local: Ajustes › Activar Ver mi negocio › entra
        con tu cuenta de Google. Cuando cobres ahí con internet, aquí verás lo
        mismo que en Caja (solo lectura).
      </p>
    </div>
  );
}

export function OwnerStatus({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="owner-empty">
      <p>{message}</p>
      <button type="button" className="btn btn-primary" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}

export function OwnerSpinner() {
  return (
    <div className="owner-empty">
      <div className="owner-spinner" aria-label="Cargando" />
    </div>
  );
}
