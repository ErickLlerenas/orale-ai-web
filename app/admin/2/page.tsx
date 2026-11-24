import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { adminClient } from "@/lib/supabase";
import {
  PLATFORMS,
  dayPlus,
  dayPulse,
  dayRange,
  downloadsDaily,
  firstSubscriptions,
  monthWindow,
  mxDay,
  newOwners,
  pct,
  revenueCatGrowth,
  revenueCatOverview,
  revenueCatPlans,
  revenueCatWeeks,
  type DayRow,
  type RcGrowth,
  type RcPlans,
  type RcWeek,
} from "@/lib/admin";
import {
  cancelReasons,
  countSubs,
  memo,
  pendingSupport,
  storeNewSubs,
  subsOnDay,
  trialConversion,
  usageHistory,
} from "@/lib/admin-data";
import { GOAL, appActive, pace, shortDay } from "../cards";
import s from "./panel2.module.css";

export const metadata = { title: "Panel 2", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";
export const revalidate = 0;

/// Panel 2: los mismos datos que /admin, ordenados por ventana de tiempo.
/// Cada tarjeta dice de cuándo son sus números y no mezcla dos ventanas:
/// ahora mismo, hoy (o ayer), los últimos 30 días y semanas cerradas.
type Params = { dia?: string };

/// Cuántas semanas cerradas se ven en la tendencia.
const WEEKS = 8;
/// Alto de la barra más grande de las semanas y del número junto a cada barra.
const BAR_PX = 80;
const LABEL_PX = 18;

/// El color de cada ventana, en el punto junto a su nombre.
const TONE = {
  now: "var(--peach)",
  day: "var(--sky)",
  days30: "var(--amber)",
  weeks: "var(--lilac)",
};

const n = (x: number) => Math.round(x).toLocaleString("es-MX");
const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${n(Math.abs(x))}`;
const range = (from: string, to: string) => `${shortDay(from)} – ${shortDay(to)}`;

export default async function Panel2({ searchParams = {} }: { searchParams?: Params }) {
  noStore();
  const today = mxDay(0);
  const isToday = searchParams.dia !== "ayer";
  const day = isToday ? today : dayPlus(today, -1);
  // Los últimos 30 días incluyen hoy: los mismos que la Meta de /admin.
  const from30 = dayPlus(today, -29);
  // Las altas de la tienda desde lo que pida más atrás (así /admin y este
  // panel comparten la misma lectura casi siempre).
  const { prevStart } = monthWindow(today, today.slice(0, 7));
  const subsFrom = prevStart < from30 ? prevStart : from30;
  const supabase = adminClient();
  const [pings, storeSubs, rc, rhythm, plans, weeks, trials, reasons, support] = await Promise.all([
    usageHistory(supabase),
    memo(`subs:${subsFrom}`, () => storeNewSubs(supabase, subsFrom)),
    memo("rc", revenueCatOverview),
    memo(`ritmo:${today}`, () => revenueCatGrowth(from30, today)),
    memo(`planes:${today}`, () => revenueCatPlans(from30, today)),
    memo(`semanas:${today}`, () => revenueCatWeeks(WEEKS, today)),
    memo(`pruebas:${from30}`, () => trialConversion(supabase, from30)),
    memo(`motivos:${from30}`, () => cancelReasons(supabase, from30)),
    // Sin memo: lo que se acaba de revisar en /admin no debe volver a salir.
    pendingSupport(supabase),
  ]);
  const { rows, installs, error } = pings;

  // Hoy (o ayer): igual que la primera tarjeta de /admin.
  const subsList = firstSubscriptions(rows);
  const subsOn = subsOnDay(storeSubs, subsList);
  const daySubs = subsOn(day);
  const converted = storeSubs.filter((x) => x.day === day && x.kind === "converted").length;
  const trialsDay = daySubs.filter((x) => x.kind === "trial").length;
  const direct = daySubs.length - trialsDay;
  const downloads = dayPulse(rows, installs, subsList, day).downloads.total;
  const owners = newOwners(installs, day, day).length;

  // Ahora mismo (RevenueCat).
  const metric = (id: string) => (rc.ok ? rc.metrics.find((m) => m.id === id)?.value : undefined);
  const active = metric("active_subscriptions") ?? appActive(rows);

  const problems = support.people.reduce((a, p) => a + p.cases.filter((c) => !c.isIdea).length, 0);
  const updated = new Date(pings.at).toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <header className={s.top}>
          <img className={s.logo} src="/logo.png" alt="Órale AI" />
          <div className={s.topText}>
            <h1 className={s.title}>Panel 2</h1>
            <p className={s.subtitle}>Actualizado a las {updated}</p>
          </div>
          <Link href="/admin" className={s.other}>
            Panel 1
          </Link>
        </header>

        {error ? <p className={s.error}>No se pudo leer usage_pings: {error}</p> : null}
        {!rc.ok ? <p className={s.error}>Sin RevenueCat: {rc.reason}</p> : null}

        <Now active={active} inTrial={metric("active_trials")} mrr={metric("mrr")} fromRc={rc.ok} />

        <Card
          tone={TONE.day}
          when={isToday ? `Hoy · ${shortDay(day)}, hasta las ${updated}` : `Ayer · ${shortDay(day)}, día completo`}
          title={isToday ? "¿Qué pasó hoy?" : "¿Qué pasó ayer?"}
          aside={
            <nav className={s.switch} aria-label="Día">
              <Link href="/admin/2" className={isToday ? s.on : s.off} aria-current={isToday ? "page" : undefined}>
                Hoy
              </Link>
              <Link href="/admin/2?dia=ayer" className={isToday ? s.off : s.on} aria-current={isToday ? undefined : "page"}>
                Ayer
              </Link>
            </nav>
          }
        >
          <div className={s.stats}>
            <Stat label="Descargas" value={downloads} sub={`${owners} dueños · ${downloads - owners} meseros`} />
            <Stat label="Empezaron prueba" value={trialsDay} sub="7 días gratis" color="var(--amber)" />
            <Stat
              label="Pagaron"
              value={converted + direct}
              sub={`${converted} pruebas cobradas · ${direct} sin prueba`}
              color="var(--mint)"
            />
          </div>
          <p className={s.foot}>
            Quién fue cada uno, en el <Link href="/admin">panel 1</Link>.
          </p>
        </Card>

        <Growth rhythm={rhythm} when={`Últimos 30 días · ${range(from30, today)}`} />

        <Card tone={TONE.days30} when={`Últimos 30 días · ${range(from30, today)}`} title="¿Cuántos llegan?">
          <DayBars title="Descargas" days={downloadsDaily(installs, from30, today)} today={today} />
          <DayBars
            title="Empezaron prueba o pagaron"
            days={dayRange(from30, today).map((d) => ({ day: d, ...countSubs(subsOn(d)) }))}
            today={today}
          />
          <p className={s.sub} style={{ marginTop: 14 }}>
            De las pruebas de estos días que ya terminaron, se cobró el{" "}
            <b className={s.ink}>{pct(trials.converted, trials.done)}</b> ({trials.converted} de {trials.done}).
          </p>
        </Card>

        <Leaving
          plans={plans}
          reasons={reasons.list.map((x) => x.reason)}
          when={`Últimos 30 días · ${range(from30, today)}`}
        />

        <Weeks weeks={weeks} />

        {problems ? (
          <Link href="/admin#soporte" className={s.support}>
            <span>
              <b>{problems}</b> {problems === 1 ? "caso de soporte sin revisar" : "casos de soporte sin revisar"}
            </span>
            <span className={s.supportGo}>Contestar en el panel 1 →</span>
          </Link>
        ) : null}
      </div>
    </main>
  );
}

/// Una tarjeta: de cuándo son sus números (con el punto de color de esa
/// ventana), una pregunta y su respuesta.
function Card({
  tone,
  when,
  title,
  aside,
  children,
}: {
  tone: string;
  when: string;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={s.card}>
      <div className={s.head}>
        <div>
          <p className={s.when}>
            <i style={{ background: tone }} />
            {when}
          </p>
          <h2 className={s.h2}>{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={s.stat}>
      <p className={s.label}>{label}</p>
      <p className={s.value} style={color ? { color } : undefined}>
        {typeof value === "number" ? n(value) : value}
      </p>
      {sub ? <p className={s.sub}>{sub}</p> : null}
    </div>
  );
}

/// Ahora mismo: cuántos pagan, qué tanto falta para la meta, cuántos están
/// en prueba y cuánto entra al mes.
function Now({
  active,
  inTrial,
  mrr,
  fromRc,
}: {
  active: number;
  inTrial?: number;
  mrr?: number;
  fromRc: boolean;
}) {
  const share = Math.min(1, active / GOAL);
  return (
    <Card tone={TONE.now} when={`Ahora mismo · ${fromRc ? "RevenueCat" : "según la app"}`} title="¿Cuántos clientes pagan?">
      <div className={s.hero}>
        <p className={s.big}>{n(active)}</p>
        <p className={s.heroSide}>
          <b>{pct(active, GOAL)}</b> de la meta de {n(GOAL)}
          <br />
          faltan {n(Math.max(0, GOAL - active))}
        </p>
      </div>
      <div className={s.track} aria-hidden>
        <div className={s.fill} style={{ width: `${share * 100}%` }} />
      </div>
      <div className={s.pair}>
        <Stat label="En prueba gratis" value={inTrial ?? "—"} sub="todavía no pagan" />
        <Stat
          label="Ingreso al mes (MRR)"
          value={mrr != null ? `$${n(mrr)}` : "—"}
          sub="lo que suman las suscripciones"
        />
      </div>
    </Card>
  );
}

/// Los últimos 30 días según RevenueCat: cuántos entraron y se fueron, qué
/// tanto se va y a dónde lleva ese ritmo (el techo).
function Growth({ rhythm, when }: { rhythm: RcGrowth; when: string }) {
  if (!rhythm.ok) {
    return (
      <Card tone={TONE.days30} when={when} title="¿Estás creciendo?">
        <p className={s.error}>Sin RevenueCat: {rhythm.reason}</p>
      </Card>
    );
  }
  const p = pace(rhythm);
  const entered = rhythm.added + rhythm.back;
  const churn = Math.round(p.churnRate * 100);
  const inMonth = Math.round(p.inMonth);
  // Moviendo una sola cosa: que entren más con las bajas de hoy, o que se
  // vayan menos con lo que entra hoy (lo mismo que la Meta de /admin).
  const needIn = Math.ceil(GOAL * p.churnRate);
  const needChurn = Math.floor((inMonth / GOAL) * 100);
  return (
    <Card tone={TONE.days30} when={when} title="¿Estás creciendo?">
      <div className={s.stats}>
        <Stat label="Entraron" value={signed(entered)} sub={`${n(rhythm.added)} nuevos · ${n(rhythm.back)} regresaron`} color="var(--mint)" />
        <Stat label="Se fueron" value={signed(-rhythm.churned)} sub={`el ${churn}% de los ${n(rhythm.start)} que había`} color="var(--rose)" />
        <Stat
          label={entered >= rhythm.churned ? "Ganaste" : "Perdiste"}
          value={signed(entered - rhythm.churned)}
          sub={`de ${n(rhythm.start)} a ${n(rhythm.now)}`}
        />
      </div>
      {p.ceiling != null ? (
        <div className={s.ceiling}>
          <p className={s.ceilingHead}>
            Techo <b>~{n(p.ceiling)}</b>
          </p>
          <p className={s.sub}>
            Si sigue así, con ~{n(p.ceiling)} clientes el {churn}% que se va ya son {inMonth} al mes: entra
            lo mismo que se va y dejas de crecer.
          </p>
          <p className={s.label} style={{ marginTop: 14 }}>
            Para llegar a {n(GOAL)} basta con una:
          </p>
          <ul className={s.paths}>
            <li>
              <span>Que entren al mes</span>
              <b>{n(needIn)}</b>
              <small>hoy {inMonth}</small>
            </li>
            <li>
              <span>Que se vaya al mes</span>
              <b>{needChurn}%</b>
              <small>hoy {churn}%</small>
            </li>
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

const PLATFORM_LABEL: Record<string, string> = { android: "Android", ios: "iPhone", windows: "Windows" };

/// Las gráficas por día del panel 1, pero con los últimos 30 días en vez del
/// mes: siempre llenas y con la misma ventana que el resto de la sección.
/// Barras por tienda, la de hoy más tenue (va a medias) y la línea punteada
/// del promedio de los días ya cerrados.
function DayBars({ title, days, today }: { title: string; days: DayRow[]; today: string }) {
  const total = days.reduce((a, d) => a + d.total, 0);
  const closed = days.filter((d) => d.day < today);
  const avg = closed.reduce((a, d) => a + d.total, 0) / Math.max(1, closed.length);
  const max = Math.max(1, ...days.map((d) => d.total));
  // Abajo el domingo de cada semana (las mismas semanas de «¿Va mejorando?»),
  // menos el que queda pegado a «hoy».
  const tick = (d: string) =>
    d === today
      ? "hoy"
      : new Date(`${d}T12:00:00Z`).getUTCDay() === 0 && d < dayPlus(today, -2)
        ? shortDay(d)
        : "";
  return (
    <div className={s.chart}>
      <div className={s.chartHead}>
        <p className={s.label}>{title}</p>
        <p className={s.chartTotal}>
          <b>{n(total)}</b>
          <span>~{avg < 10 ? avg.toFixed(1) : n(avg)} al día</span>
        </p>
      </div>
      <p className={s.legend}>
        {PLATFORMS.map((p) => (
          <span key={p}>
            <i style={{ background: `var(--${p})` }} />
            {PLATFORM_LABEL[p]} <b className={s.ink}>{n(days.reduce((a, d) => a + (d.byPlatform[p] ?? 0), 0))}</b>
          </span>
        ))}
      </p>
      <div className={s.dayArea}>
        {closed.length ? <i className={s.avg} style={{ bottom: `${(avg / max) * 100}%` }} /> : null}
        {days.map((d) => (
          <div
            key={d.day}
            className={s.dayBar}
            title={`${shortDay(d.day)}: ${d.total} · ${PLATFORMS.map((p) => `${PLATFORM_LABEL[p]} ${d.byPlatform[p] ?? 0}`).join(" · ")}`}
          >
            <div
              className={s.dayStack}
              style={{ height: `${(d.total / max) * 100}%`, opacity: d.day === today ? 0.45 : 1 }}
            >
              {PLATFORMS.map((p) =>
                d.byPlatform[p] ? <div key={p} style={{ flex: d.byPlatform[p], background: `var(--${p})` }} /> : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <div className={s.dayAxis}>
        {days.map((d) => (
          <span key={d.day} className={d.day === today ? s.axisToday : undefined}>
            {tick(d.day)}
          </span>
        ))}
      </div>
    </div>
  );
}

/// Solo los mensuales: en 30 días casi ningún anual llega a renovar, y su 0%
/// se leía como que los anuales no se van.
const PLANS = [
  { key: "monthly", label: "Mensual" },
  { key: "pro_monthly", label: "Pro mensual" },
];

const CANCEL_REASON: Record<string, string> = {
  too_expensive: "Por el precio",
  low_use: "Ya no la uso tanto",
  missing: "Me faltó una función",
  closed: "Cerré el negocio",
  other: "Otro",
};

/// Bajas de los planes mensuales (RevenueCat) y lo que dijeron en la encuesta
/// al cancelar, los dos en los mismos 30 días.
function Leaving({ plans, reasons, when }: { plans: RcPlans; reasons: string[]; when: string }) {
  const list = plans.ok
    ? PLANS.flatMap((p) => {
        const r = plans.churn[p.key];
        return r?.start ? [{ ...r, ...p }] : [];
      })
    : [];
  const counts = Object.entries(
    reasons.reduce<Record<string, number>>((a, r) => ({ ...a, [r]: (a[r] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);
  return (
    <Card tone={TONE.days30} when={when} title="¿Quién se va?">
      {!plans.ok ? <p className={s.error}>Sin RevenueCat: {plans.reason}</p> : null}
      <div className={s.bars}>
        {list.map((r) => {
          const share = r.churned / r.start;
          return (
            <div key={r.key} className={s.barRow}>
              <span className={s.barLabel}>{r.label}</span>
              <div className={s.barTrack}>
                <div className={s.barFill} style={{ width: `${Math.max(2, Math.min(1, share) * 100)}%` }} />
              </div>
              <span className={s.barNum}>
                <b>{pct(r.churned, r.start)}</b>
                <small>
                  {n(r.churned)} de {n(r.start)}
                </small>
              </span>
            </div>
          );
        })}
      </div>
      <p className={s.sub} style={{ marginTop: 10 }}>
        Los anuales no salen: en 30 días casi ninguno llega a renovar.
      </p>
      {counts.length ? (
        <div className={s.reasons}>
          <p className={s.label}>Por qué, según los {reasons.length} que contestaron al cancelar</p>
          <p className={s.chips}>
            {counts.map(([reason, k]) => (
              <span key={reason}>
                {CANCEL_REASON[reason] ?? reason} <b>{k}</b>
              </span>
            ))}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

/// Altas contra bajas por semana cerrada: lo más claro para ver si va
/// mejorando. Arriba las que entraron, abajo las que se fueron.
function Weeks({ weeks }: { weeks: Awaited<ReturnType<typeof revenueCatWeeks>> }) {
  const list: RcWeek[] = weeks.ok ? weeks.weeks : [];
  const when = list.length
    ? `Últimas ${list.length} semanas cerradas · ${range(list[0].start, list[list.length - 1].end)}`
    : `Últimas ${WEEKS} semanas cerradas`;
  // Arriba y abajo con la misma escala en pixeles: así una barra de 20 mide
  // lo mismo entrando que saliendo. Cada lado mide lo que pide su barra más alta.
  const max = Math.max(1, ...list.flatMap((w) => [w.entered, w.churned]));
  const px = (v: number) => Math.round((Math.max(0, v) / max) * BAR_PX);
  const upPx = Math.max(...list.map((w) => px(w.entered)), 0) + LABEL_PX;
  const downPx = Math.max(...list.map((w) => px(w.churned)), 0) + LABEL_PX;
  const net = (part: RcWeek[]) => part.reduce((a, w) => a + w.entered - w.churned, 0);
  const half = Math.floor(list.length / 2);
  return (
    <Card tone={TONE.weeks} when={when} title="¿Va mejorando?">
      {!weeks.ok ? <p className={s.error}>Sin RevenueCat: {weeks.reason}</p> : null}
      {list.length ? (
        <>
          <p className={s.legend}>
            <span>
              <i style={{ background: "var(--mint)" }} />
              entraron
            </span>
            <span>
              <i style={{ background: "var(--rose)" }} />
              se fueron
            </span>
            <span className={s.legendNote}>de domingo a sábado, como RevenueCat; la semana en curso no sale</span>
          </p>
          <div className={s.weeks}>
            {list.map((w) => {
              const d = w.entered - w.churned;
              return (
                <div
                  key={w.start}
                  className={s.week}
                  title={`${range(w.start, w.end)}: entraron ${w.entered}, se fueron ${w.churned}`}
                >
                  <div className={s.up} style={{ height: upPx }}>
                    <span>{w.entered}</span>
                    <i style={{ height: px(w.entered) }} />
                  </div>
                  <div className={s.down} style={{ height: downPx }}>
                    <i style={{ height: px(w.churned) }} />
                    <span>{w.churned}</span>
                  </div>
                  <b className={d > 0 ? s.good : d < 0 ? s.bad : undefined}>{signed(d)}</b>
                  <small>{shortDay(w.start)}</small>
                </div>
              );
            })}
          </div>
          {half ? (
            <p className={s.sub} style={{ marginTop: 12 }}>
              Las últimas {list.length - half} semanas: <b className={s.ink}>{signed(net(list.slice(half)))}</b> clientes ·
              las {half} de antes: <b className={s.ink}>{signed(net(list.slice(0, half)))}</b>
            </p>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
