import {
  PLATFORMS,
  dayRange,
  downloadsByPlatform,
  downloadsDaily,
  firstSubscriptions,
  mxDay,
  pct,
  planMix,
  type DayRow,
  type Install,
  type PingRow,
  type RcGrowth,
  type monthWindow,
  type revenueCatOverview,
} from "@/lib/admin";
import {
  countSubs,
  memo,
  storeNewSubs,
  subsOnDay,
  type CancelReason,
  type PlanChurnRow,
} from "@/lib/admin-data";
import type { adminClient } from "@/lib/supabase";
import s from "./admin.module.css";

/// Tarjetas de /admin: descargas y suscripciones del mes,
/// suscripciones (RevenueCat) y la meta de 1,000. Los colores salen de las
/// variables de cada página.

type Db = ReturnType<typeof adminClient>;
type Rc = Awaited<ReturnType<typeof revenueCatOverview>>;
type Month = ReturnType<typeof monthWindow>;

export const PLATFORM_LABEL: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  windows: "Windows",
};
const PLATFORM_COLOR: Record<string, string> = {
  android: "var(--android)",
  ios: "var(--ios)",
  windows: "var(--windows)",
};


export const GOAL = 1000;

/// Nombres en español de las métricas de RevenueCat que más importan. Las
/// activas ya salen en la meta.
const RC_LABEL: Record<string, string> = {
  active_trials: "En prueba gratis",
  mrr: "Ingreso mensual (MRR)",
};
const RC_ORDER = Object.keys(RC_LABEL);

export const PLAN_INFO = [
  { key: "monthly", label: "Mensual", color: "var(--orange)" },
  { key: "yearly", label: "Anual", color: "var(--orange-2)" },
  { key: "pro_monthly", label: "Pro mensual", color: "var(--amber)" },
  { key: "pro_yearly", label: "Pro anual", color: "#fde68a" },
];

/// Mezcla de planes: el anual casi no se va, así que vale verlo crecer.
function Plans({ counts }: { counts: Record<string, number> }) {
  const total = PLAN_INFO.reduce((a, p) => a + (counts[p.key] ?? 0), 0);
  if (!total) return null;
  const yearly = (counts.yearly ?? 0) + (counts.pro_yearly ?? 0);
  return (
    <div className={s.plans}>
      <div className={s.plansHead}>
        <span className={s.funnelTitle} style={{ margin: 0 }}>
          Planes de tus clientes
        </span>
        <span className={s.note} style={{ margin: 0 }}>
          {pct(yearly, total)} anual · según la app, 7 días
        </span>
      </div>
      <div className={s.plansBar}>
        {PLAN_INFO.map((p) =>
          counts[p.key] ? (
            <div
              key={p.key}
              style={{ flex: counts[p.key], background: p.color }}
              title={`${p.label}: ${counts[p.key]}`}
            />
          ) : null,
        )}
      </div>
      <div className={s.plansLegend}>
        {PLAN_INFO.map((p) => (
          <span key={p.key}>
            <span className={s.dot} style={{ background: p.color }} />
            {p.label} <b>{counts[p.key] ?? 0}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function formatMetric(value: number, unit?: string, decimals = 0) {
  if (unit === "$" || unit === "USD") {
    return `$${value.toLocaleString("es-MX", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
  return Math.round(value).toLocaleString("es-MX");
}

/// Descargas y suscripciones del mes, contra los mismos días del anterior.
export async function MonthNumbers({
  supabase,
  installs,
  subsList,
  month,
  today,
}: {
  supabase: Db;
  installs: Install[];
  subsList: ReturnType<typeof firstSubscriptions>;
  month: Month;
  today: string;
}) {
  const storeSubs = await memo(`subs:${month.prevStart}`, () =>
    storeNewSubs(supabase, month.prevStart),
  );
  const subsOn = subsOnDay(storeSubs, subsList);
  const dlDays = downloadsDaily(installs, month.start, month.end);
  const dlNow = downloadsByPlatform(installs, month.start, month.to);
  const dlPrev = downloadsByPlatform(installs, month.prevStart, month.prevTo);
  const dlTotal = dlNow.reduce((a, p) => a + p.total, 0);
  const dlPrevTotal = dlPrev.reduce((a, p) => a + p.total, 0);
  const subDays: DayRow[] = dayRange(month.start, month.end).map((day) => ({
    day,
    ...countSubs(day <= today ? subsOn(day) : []),
  }));
  const subsMonth = dayRange(month.start, month.to).flatMap((d) => subsOn(d));
  const subsPrevTotal = dayRange(month.prevStart, month.prevTo).reduce(
    (a, d) => a + subsOn(d).length,
    0,
  );
  const compare = month.current
    ? `vs. los mismos días de ${month.prevName}`
    : `vs. ${month.prevName}`;
  return (
    <div className={s.twoCols}>
      <section className={s.card} id="descargas">
        <p className={s.eyebrow}>Descargas · {month.name}</p>
        <div className={s.monthHead}>
          <span className={s.kpiValue}>{dlTotal.toLocaleString("es-MX")}</span>
          <Delta now={dlTotal} before={dlPrevTotal} />
        </div>
        <p className={s.goalSub}>{compare}</p>
        <div className={s.platChips}>
          {dlNow.map((p) => (
            <span key={p.platform}>
              <i className={s.dot} style={{ background: PLATFORM_COLOR[p.platform] }} />
              {PLATFORM_LABEL[p.platform]} <b>{p.total.toLocaleString("es-MX")}</b>
            </span>
          ))}
        </div>
        <MonthBars days={dlDays} today={today} />
      </section>

      <section className={s.card} id="suscripciones-mes">
        <p className={s.eyebrow}>Suscripciones nuevas · {month.name}</p>
        <div className={s.monthHead}>
          <span className={s.kpiValue}>{subsMonth.length.toLocaleString("es-MX")}</span>
          <Delta now={subsMonth.length} before={subsPrevTotal} />
        </div>
        <p className={s.goalSub}>{compare}</p>
        <div className={s.platChips}>
          {PLATFORMS.map((p) => (
            <span key={p}>
              <i className={s.dot} style={{ background: PLATFORM_COLOR[p] }} />
              {PLATFORM_LABEL[p]}{" "}
              <b>{subsMonth.filter((x) => x.platform === p).length}</b>
            </span>
          ))}
        </div>
        <div className={s.planLine}>
          {PLAN_INFO.map((p) => {
            const n = subsMonth.filter((x) => x.plan === p.key).length;
            return n ? (
              <span key={p.key}>
                {p.label} <b>{n}</b>
              </span>
            ) : null;
          })}
        </div>
        <MonthBars days={subDays} today={today} />
      </section>
    </div>
  );
}

/// Barras por día del mes, apiladas por plataforma y sin números encima: el
/// número del día sale al pasar el mouse; abajo solo cada 5 días.
function MonthBars({ days, today }: { days: DayRow[]; today: string }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const done = days.filter((d) => d.day < today);
  const avg = done.reduce((a, d) => a + d.total, 0) / Math.max(1, done.length);
  return (
    <div className={s.mBars}>
      <div className={s.mBarsArea}>
        <div className={s.mAvg} style={{ bottom: `${(avg / max) * 100}%` }}>
          <span>{avg.toFixed(0)}/día</span>
        </div>
        {days.map((d) => (
          <div
            key={d.day}
            className={s.mBar}
            title={`${shortDay(d.day)}: ${d.total} · ${PLATFORMS.map((p) => `${PLATFORM_LABEL[p]} ${d.byPlatform[p]}`).join(" · ")}`}
          >
            <div
              className={s.mStack}
              style={{
                height: `${(d.total / max) * 100}%`,
                opacity: d.day === today ? 0.55 : 1,
              }}
            >
              {PLATFORMS.map((p) =>
                d.byPlatform[p] ? (
                  <div
                    key={p}
                    style={{ flex: d.byPlatform[p], background: PLATFORM_COLOR[p] }}
                  />
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <div className={s.mAxis}>
        {days.map((d) => {
          const n = Number(d.day.slice(8));
          return (
            <span key={d.day}>
              {d.day === today ? "hoy" : n === 1 || n % 5 === 0 ? n : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const d = Math.round(((now - before) / before) * 100);
  return (
    <span className={d >= 0 ? s.deltaUp : s.deltaDown}>
      {d >= 0 ? "▲" : "▼"} {Math.abs(d)}%
    </span>
  );
}

export function shortDay(day: string) {
  const months = "ene feb mar abr may jun jul ago sep oct nov dic".split(" ");
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${months[m - 1]}`;
}

/// Bajas por plan en el mes, según la tienda: a quién se le venció sin
/// renovar y quién ya apagó la renovación.
export function PlanChurn({
  rows,
  monthName,
  reasons,
}: {
  rows: PlanChurnRow[];
  monthName: string;
  /** La encuesta al cancelar del mes, con el nombre del negocio. */
  reasons?: { list: CancelReason[]; names: Map<string, string> };
}) {
  const list = PLAN_INFO.flatMap((p) => {
    const r = rows.find((x) => x.plan === p.key);
    return r?.n ? [{ ...r, label: p.label }] : [];
  });
  if (!list.length) return null;
  const n = list.reduce((a, r) => a + r.n, 0);
  const gone = list.reduce((a, r) => a + r.gone, 0);
  const leaving = list.reduce((a, r) => a + r.leaving, 0);
  return (
    <section className={s.card} id="bajas">
      <div className={s.cardHead}>
        <div>
          <p className={s.eyebrow}>Bajas por plan · {monthName}</p>
          <h2 className={s.h2}>¿Quién se da de baja?</h2>
          <p className={s.note}>
            Se les venció sin renovar, según la tienda.
            {leaving ? ` Otras ${leaving} ya cancelaron y se van al vencer.` : ""}
          </p>
        </div>
        <div className={s.retTotal}>
          <span className={s.retTotalN}>{pct(gone, n)}</span>
          <span className={s.retTotalL}>se dio de baja</span>
        </div>
      </div>
      <div className={s.retCard}>
        {list.map((r) => {
          const share = r.n ? r.gone / r.n : 0;
          const color = `color-mix(in srgb, var(--ret-bad, #dc2626) ${Math.min(100, Math.round(share * 140))}%, var(--ret-mid, #fdba74))`;
          return (
            <div className={s.rRow} key={r.plan}>
              <div className={s.rLabel}>
                <span>{r.label}</span>
                <small>
                  de {r.n}
                  {r.leaving ? ` · ${r.leaving} ${r.leaving === 1 ? "canceló" : "cancelaron"}` : ""}
                </small>
              </div>
              <div className={s.rTrack}>
                <div className={s.rFill} style={{ width: `${Math.max(2, share * 100)}%`, background: color }} />
              </div>
              <div className={s.rPct} style={{ color }}>
                {pct(r.gone, r.n)}
                <small>{r.gone} se fueron</small>
              </div>
            </div>
          );
        })}
      </div>
      {reasons?.list.length ? <CancelReasons {...reasons} /> : null}
    </section>
  );
}

const CANCEL_REASON: Record<string, string> = {
  too_expensive: "Por el precio",
  low_use: "Ya no la uso tanto",
  missing: "Me faltó una función",
  closed: "Cerré el negocio",
  other: "Otro",
};

/// Quién dijo por qué se va (encuesta al cancelar): el plan, el motivo, lo
/// que escribió y el negocio.
function CancelReasons({ list, names }: { list: CancelReason[]; names: Map<string, string> }) {
  return (
    <div className={s.retCard} style={{ marginTop: 14 }}>
      <p className={s.funnelTitle}>Con motivo · {list.length} contestaron la encuesta al cancelar</p>
      <div className={s.subsCol}>
        {list.map((x) => {
          const plan = PLAN_INFO.find((p) => p.key === x.plan);
          const when = new Date(x.at).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            timeZone: "America/Mexico_City",
          });
          return (
            <div key={x.installId} className={s.subsRow}>
              <span className={s.subsPlan} style={{ ["--plan" as string]: plan?.color ?? "var(--mute)" }}>
                {plan?.label ?? "Plan sin dato"}
              </span>
              <span className={s.subsName}>
                {CANCEL_REASON[x.reason] ?? x.reason}
                {x.detail ? <span className={s.subsMeta}> · «{x.detail}»</span> : null}
              </span>
              <span className={s.subsMeta}>
                {names.get(x.installId) ?? "Sin nombre"} · {when}
                {x.offerAccepted ? " · aceptó la oferta" : x.after ? " · ya había cancelado" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/// El ritmo del mes según RevenueCat, llevado a semanas y a meses de 30 días.
/// Techo: lo que entra al mes ÷ el % que se va al mes (ahí se empatan).
export function pace(g: Extract<RcGrowth, { ok: true }>) {
  const days = Math.max(1, g.days);
  const entered = g.added + g.back;
  const inMonth = (entered / days) * 30;
  const churnRate = g.start ? (g.churned / g.start / days) * 30 : 0;
  return {
    inPerWeek: (entered / days) * 7,
    outPerWeek: (g.churned / days) * 7,
    inMonth,
    churnRate,
    ceiling: churnRate > 0 ? Math.round(inMonth / churnRate) : null,
  };
}

/// Suscripciones activas, pruebas, MRR y la mezcla de planes (RevenueCat).
export function RcCard({ rc, rows, month }: { rc: Rc; rows: PingRow[]; month: Month }) {
  const metric = (id: string) =>
    rc.ok ? rc.metrics.find((m) => m.id === id) : undefined;
  const activeNow = metric("active_subscriptions")?.value ?? appActive(rows);
  const plans = planMix(rows, mxDay(7));
  return (
    <section className={`${s.card} ${s.rcCard}`}>
      <p className={s.eyebrow}>
        Suscripciones · {rc.ok ? "RevenueCat" : "según la app"}
        {month.current ? "" : " · hoy"}
      </p>
      <div className={s.kpis}>
        <div>
          <div className={s.kpiValue}>{activeNow.toLocaleString("es-MX")}</div>
          <div className={s.kpiLabel}>activas</div>
        </div>
        {RC_ORDER.map((id) => metric(id))
          .filter((m): m is NonNullable<typeof m> => !!m)
          .map((m) => (
            <div key={m.id}>
              <div className={s.kpiValue}>{formatMetric(m.value, m.unit)}</div>
              <div className={s.kpiLabel}>{RC_LABEL[m.id] ?? m.name}</div>
            </div>
          ))}
      </div>
      <Plans counts={plans} />
      {!rc.ok ? <div className={s.warn}>Sin RevenueCat: {rc.reason}</div> : null}
    </section>
  );
}

/// Sin RevenueCat: los que hoy tienen plan según la app (aproximado).
export function appActive(rows: PingRow[]) {
  return new Set(
    rows
      .filter((r) => r.ping_date >= mxDay(7) && r.subscription_active)
      .map((r) => r.account_key ?? r.install_id),
  ).size;
}

