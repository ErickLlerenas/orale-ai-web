"use client";

import { useState } from "react";
import s from "./admin2.module.css";

export type UserRow = {
  day: string;
  id: string;
  name: string | null;
  waiter: boolean;
  time: string;
  /** Para ordenar: la hora de la última visita (ISO). */
  at: string;
  tenure: number | null;
  platform: string | null;
  version: string | null;
  /** green / gray / yellow / red, según qué tan vieja es. */
  versionTone: string;
  products: number;
  orders: number;
  plan: string | null;
  active: boolean;
  inherited: boolean;
  /** Pantalla de la bienvenida a la que llegó (1–7), si la app la reporta. */
  stage: number | null;
  menuPath: string | null;
};

export type RiskUser = {
  id: string;
  /** Días desde que empezó a usar la app. */
  tenure: number;
  name: string | null;
  platform: string | null;
  plan: string | null;
  version: string | null;
  versionTone: string;
  quietDays: number;
  avgDaily: number;
  activeDays: number;
};

const PLATFORM: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  windows: "Windows",
  mac: "Mac",
};
const PLAN: Record<string, string> = {
  monthly: "Mensual",
  yearly: "Anual",
  pro_monthly: "Pro mensual",
  pro_yearly: "Pro anual",
};
const PLAN_COLOR: Record<string, string> = {
  monthly: "var(--orange)",
  yearly: "var(--orange-2)",
  pro_monthly: "var(--amber)",
  pro_yearly: "#fde68a",
};

const STEPS = [
  "Solo abrió",
  "Puso el nombre",
  "Creó su PIN",
  "Terminó la bienvenida",
  "Tiene menú",
  "Ya vendió",
];
const MENU_PATH: Record<string, string> = {
  ai_saved: "con IA",
  sample: "de ejemplo",
  photo_opened: "abrió la IA",
  skipped: "se lo saltó",
};

/// Hasta qué paso llegó: 1 = solo abrió … 6 = ya vendió.
function stepOf(r: UserRow) {
  if (r.orders > 0) return 6;
  if (r.products > 0) return 5;
  const st = r.stage ?? 0;
  if (st >= 7) return 4;
  if (st >= 6) return 3;
  if (st >= 2) return 2;
  return 1;
}

function Progress({ r }: { r: UserRow }) {
  const step = stepOf(r);
  const tone = step === 6 ? s.dotGood : step >= 4 ? s.dotMid : s.dotLow;
  const extra =
    step === 5 && r.menuPath && MENU_PATH[r.menuPath]
      ? ` ${MENU_PATH[r.menuPath]}`
      : step === 6
        ? ` (${r.orders})`
        : "";
  return (
    <span className={s.uSteps} title={STEPS[step - 1]}>
      <span className={s.uDots}>
        {STEPS.map((_, i) => (
          <span key={i} className={i < step ? tone : s.dotOff} />
        ))}
      </span>
      {STEPS[step - 1]}
      {extra}
    </span>
  );
}

function tenureLabel(d: number | null) {
  if (d == null) return "—";
  if (d < 1) return "hoy";
  if (d < 30) return `${d} ${d === 1 ? "día" : "días"}`;
  const m = Math.floor(d / 30);
  return `${m} ${m === 1 ? "mes" : "meses"}`;
}

function yesterdayOf(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function dayTitle(day: string, today: string) {
  if (day === today) return "Hoy";
  if (day === yesterdayOf(today)) return "Ayer";
  const t = new Date(`${day}T12:00:00Z`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function PlanPill({ plan, active, inherited }: { plan: string | null; active: boolean; inherited: boolean }) {
  if (active && plan && PLAN[plan]) {
    return (
      <span className={s.uPlan} style={{ ["--plan" as string]: PLAN_COLOR[plan] }}>
        {PLAN[plan]}
      </span>
    );
  }
  if (inherited) return <span className={s.uMuted}>Heredado</span>;
  return <span className={s.uMuted}>Gratis</span>;
}

function Version({ v, tone }: { v: string | null; tone: string }) {
  return <span className={s[`uVer_${tone}`] ?? s.uVer_gray}>{v ?? "—"}</span>;
}

/// Quién usó la app cada día (caja y meseros), y quién está en riesgo.
export default function Users({
  days,
  today,
  rows,
  risk,
}: {
  days: string[];
  today: string;
  rows: UserRow[];
  risk: RiskUser[];
}) {
  const [tab, setTab] = useState<"day" | "risk">("day");
  const [onlyNew, setOnlyNew] = useState(false);
  const [day, setDay] = useState(days[days.length - 1]);
  const idx = days.indexOf(day);
  const all = rows
    .filter((r) => r.day === day)
    .sort((a, b) => b.at.localeCompare(a.at));
  const newCount = all.filter((r) => r.tenure === 0 && !r.waiter).length;
  const list = onlyNew
    ? all.filter((r) => r.tenure === 0 && !r.waiter)
    : all;
  const waiters = all.filter((r) => r.waiter).length;
  const versions = new Map<string, number>();
  for (const r of all) {
    if (r.version) versions.set(r.version, (versions.get(r.version) ?? 0) + 1);
  }
  const toneOf = new Map(all.map((r) => [r.version ?? "", r.versionTone]));
  const topVersions = [...versions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <section className={s.card} id="usuarios">
      <div className={s.uHead}>
        <div>
          <p className={s.eyebrow}>Usuarios</p>
          <div className={s.uTabs}>
            <button
              type="button"
              className={tab === "day" ? s.uTabOn : s.uTab}
              onClick={() => setTab("day")}
            >
              Por día
            </button>
            <button
              type="button"
              className={tab === "risk" ? s.uTabOn : s.uTab}
              onClick={() => setTab("risk")}
            >
              Podrían cancelar ({risk.length})
            </button>
          </div>
        </div>
        {tab === "day" ? (
          <div className={s.uPager}>
            <button
              type="button"
              disabled={idx <= 0}
              onClick={() => setDay(days[idx - 1])}
              aria-label="Día anterior"
            >
              ‹
            </button>
            <span>{dayTitle(day, today)}</span>
            <button
              type="button"
              disabled={idx >= days.length - 1}
              onClick={() => setDay(days[idx + 1])}
              aria-label="Día siguiente"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      {tab === "day" ? (
        <>
          <div className={s.uBar}>
            <div className={s.uStats}>
              <div className={s.uStat}>
                <b>{all.length}</b>
                <span>abrieron la app</span>
              </div>
              <div className={s.uStat}>
                <b>{newCount}</b>
                <span>nuevos</span>
              </div>
              <div className={s.uStat}>
                <b>{waiters}</b>
                <span>meseros</span>
              </div>
              <div className={s.uStatVer}>
                <span>Versiones</span>
                <div>
                  {topVersions.map(([v, n]) => (
                    <span key={v} className={s.uVerChip}>
                      <Version v={v} tone={toneOf.get(v) ?? "gray"} />
                      <b>{n}</b>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              className={onlyNew ? s.uTabOn : s.uTab}
              onClick={() => setOnlyNew(!onlyNew)}
            >
              Solo nuevos ({newCount})
            </button>
          </div>
          <div className={s.uWrap}>
            <table className={s.uTable}>
              <thead>
                <tr>
                  <th>Negocio</th>
                  <th>Última visita</th>
                  <th>Antigüedad</th>
                  <th>Avance</th>
                  <th>Plataforma</th>
                  <th>Versión</th>
                  <th>Productos</th>
                  <th>Órdenes</th>
                  <th>Plan</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const hot = r.orders > 25 && !r.active && !r.inherited;
                  return (
                    <tr
                      key={r.id}
                      className={r.tenure === 0 && !r.waiter ? s.uRowNew : undefined}
                    >
                      <td>
                        {r.name ?? <span className={s.uMuted}>{r.id.slice(0, 8)}</span>}
                        {r.waiter ? <span className={s.uRole}>mesero</span> : null}
                      </td>
                      <td>{r.time}</td>
                      <td>
                        {r.tenure === 0 ? (
                          <span className={s.uNew}>Nuevo</span>
                        ) : r.tenure != null && r.tenure < 7 ? (
                          <span className={s.uNewSoft}>{tenureLabel(r.tenure)}</span>
                        ) : (
                          tenureLabel(r.tenure)
                        )}
                      </td>
                      <td>
                        {r.waiter ? (
                          <span className={s.uMuted}>Mesero · usa el menú de la caja</span>
                        ) : (
                          <Progress r={r} />
                        )}
                      </td>
                      <td>{r.platform ? PLATFORM[r.platform] ?? r.platform : "—"}</td>
                      <td>
                        <Version v={r.version} tone={r.versionTone} />
                      </td>
                      <td>{r.products}</td>
                      <td>
                        {hot ? (
                          <span className={s.uHot} title="Mucho uso sin suscripción">
                            {r.orders}
                          </span>
                        ) : (
                          r.orders
                        )}
                      </td>
                      <td>
                        <PlanPill plan={r.plan} active={r.active} inherited={r.inherited} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <p className={s.note}>
            Clientes que pagan y abrían la app casi diario, pero llevan de 3 a 6
            días sin abrirla. Casi siempre es lo que pasa antes de cancelar.
          </p>
          <div className={s.uWrap}>
            <table className={s.uTable}>
              <thead>
                <tr>
                  <th>Negocio</th>
                  <th>Sin abrir</th>
                  <th>Antigüedad</th>
                  <th>Vendía al día</th>
                  <th>Abría (de 14 días)</th>
                  <th>Plataforma</th>
                  <th>Versión</th>
                  <th>Plan</th>
                </tr>
              </thead>
              <tbody>
                {risk.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name ?? <span className={s.uMuted}>{r.id.slice(0, 8)}</span>}</td>
                    <td>
                      <span className={r.quietDays >= 5 ? s.uHot : undefined}>
                        {r.quietDays} días
                      </span>
                    </td>
                    <td>{tenureLabel(r.tenure)}</td>
                    <td>~{r.avgDaily}</td>
                    <td>{r.activeDays}</td>
                    <td>{r.platform ? PLATFORM[r.platform] ?? r.platform : "—"}</td>
                    <td>
                      <Version v={r.version} tone={r.versionTone} />
                    </td>
                    <td>
                      <PlanPill plan={r.plan} active inherited={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
