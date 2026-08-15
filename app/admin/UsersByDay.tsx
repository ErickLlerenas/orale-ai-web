"use client";

import { useMemo, useState } from "react";
import {
  daysInMonth,
  dayLabel,
  fechaHora,
  planPill,
  platformChip,
  userTenure,
  type AiUsageRow,
  type Ping,
} from "@/lib/metrics";

/// Tabla de usuarios del mes, un día a la vez.
export default function UsersByDay({
  pings,
  month,
  today,
  aiByInstall,
  waiterInstalls,
}: {
  pings: Ping[];
  month: string;
  today: string;
  aiByInstall: Record<string, AiUsageRow>;
  waiterInstalls: string[];
}) {
  const days = daysInMonth(month, month === today.slice(0, 7) ? today : undefined);
  const waiters = useMemo(() => new Set(waiterInstalls), [waiterInstalls]);
  const [day, setDay] = useState(() => days[days.length - 1] ?? "");

  const idx = days.indexOf(day);
  const dayPings = pings
    .filter((p) => p.ping_date === day)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <div className="panel">
      <div className="users-head">
        <div>
          <h2>Usuarios ({dayPings.length})</h2>
          <p className="muted">
            Quienes abrieron la app el {day ? dayLabel(day) : "—"}.
          </p>
        </div>
        <div className="day-pager">
          <button
            type="button"
            className="day-pager-btn"
            disabled={idx <= 0}
            onClick={() => setDay(days[idx - 1])}
            aria-label="Día anterior"
          >
            ‹
          </button>
          <select
            className="month-select day-select"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            aria-label="Seleccionar día"
          >
            {days.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="day-pager-btn"
            disabled={idx < 0 || idx >= days.length - 1}
            onClick={() => setDay(days[idx + 1])}
            aria-label="Día siguiente"
          >
            ›
          </button>
        </div>
      </div>
      {dayPings.length === 0 ? (
        <p className="muted">Nadie abrió la app este día.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cuenta</th>
                <th>Última visita</th>
                <th>Antigüedad</th>
                <th>Plataforma</th>
                <th>Versión</th>
                <th>Productos</th>
                <th>Órdenes</th>
                <th>IA (mes)</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {dayPings.map((p) => {
                const u = aiByInstall[p.install_id];
                const tenure = userTenure(p.days_since_install);
                const platform = platformChip(p.platform);
                const pill = planPill(p.plan, p.subscription_status);
                const isWaiter =
                  p.is_caja === false ||
                  (p.is_caja == null && waiters.has(p.install_id));
                const inherited = p.inherited_access === true;
                const hasPaidAccess = p.subscription_active || inherited;
                return (
                  <tr key={p.install_id}>
                    <td title={p.install_id}>{p.install_id.slice(0, 8)}</td>
                    <td title={p.account_key ?? "Sin cuenta (gratis)"}>
                      {p.account_key ? p.account_key.slice(0, 8) : "—"}
                    </td>
                    <td title={p.ping_date}>{fechaHora(p.updated_at)}</td>
                    <td title={`${p.days_since_install} días desde la descarga`}>
                      <span className={tenure.className}>{tenure.label}</span>
                    </td>
                    <td>
                      <span className={platform.className}>{platform.label}</span>
                    </td>
                    <td>{p.app_version ?? "—"}</td>
                    <td>{p.product_count}</td>
                    <td title="Órdenes cerradas acumuladas">
                      {(p.orders_total ?? 0) > 25 ? (
                        <span
                          className={`pill ${hasPaidAccess ? "sub" : "danger"}`}
                          title={
                            p.subscription_active
                              ? "Mucho uso y con suscripción"
                              : inherited
                                ? "Mucho uso con acceso heredado"
                                : "Mucho uso sin suscripción"
                          }
                        >
                          {p.orders_total}
                        </span>
                      ) : (
                        (p.orders_total ?? 0)
                      )}
                    </td>
                    <td
                      title={
                        u
                          ? `Hoy: ${u.today} · Último uso: ${u.lastDate}`
                          : "Sin uso de IA"
                      }
                    >
                      {u ? u.total : "—"}
                    </td>
                    <td>
                      {p.subscription_active ? (
                        <span
                          className={pill.className}
                          title={`${pill.title} · Suscrito el ${
                            p.subscribed_at ?? "—"
                          }`}
                        >
                          {pill.label}
                        </span>
                      ) : inherited ? (
                        <span
                          className="pill heredado"
                          title="Acceso heredado (mudanza / Google). No compró en este aparato."
                        >
                          Heredado
                        </span>
                      ) : isWaiter ? (
                        <span
                          className="pill mesero"
                          title="Entró con código de mesero (no suscribe)"
                        >
                          Mesero
                        </span>
                      ) : (
                        <span className="pill off">Sin suscripción</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
