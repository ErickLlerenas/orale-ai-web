import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { adminClient } from "@/lib/supabase";
import {
  cmpVersion,
  dayPlus,
  dayPulse,
  firstSubscriptions,
  journeySteps,
  LOW_USE_WEEK,
  lowUseWeeks,
  monthWindow,
  mxDay,
  newOwners,
  pct,
  revenueCatGrowth,
  revenueCatOverview,
  type Install,
  type PingRow,
  type LowUseWeek,
  type RcGrowth,
} from "@/lib/admin";
import {
  enrichSubscriberTenure,
  type BillingAlias,
  type InstallPurchase,
  type NewSub,
} from "@/lib/admin-subscribers";
import { tenureLabel } from "@/lib/admin-tenure";
import { fetchAll } from "@/lib/supabase";
import {
  businessNames,
  cancelReasons,
  chunks,
  planChurn,
  memo,
  storeNewSubs,
  subsOnDay,
  usageHistory,
} from "@/lib/admin-data";
import { GOAL, MonthNumbers, PlanChurn, RcCard, appActive, pace, shortDay } from "./cards";
import s from "./new.module.css";

export const metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";
export const revalidate = 0;

/// Panel nuevo. Se arma poco a poco: por ahora solo un día, hoy o ayer
/// (?dia=ayer). El embudo se puede ver por versión (?v=3.0.110).
type Params = { dia?: string; v?: string };

export default async function NewAdmin({ searchParams = {} }: { searchParams?: Params }) {
  noStore();
  const today = mxDay(0);
  const isToday = searchParams.dia !== "ayer";
  const day = isToday ? today : dayPlus(today, -1);
  // Cambia solo lo que se toca y deja lo demás como está.
  const link = (patch: Params, hash: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...searchParams, ...patch })) if (v) q.set(k, v);
    const qs = q.toString();
    return `/admin${qs ? `?${qs}` : ""}#${hash}`;
  };
  const supabase = adminClient();
  // El mes en curso contra los mismos días del anterior (igual que /admin).
  const month = monthWindow(today, today.slice(0, 7));
  const [pings, storeSubs, rc] = await Promise.all([
    usageHistory(supabase),
    memo(`subs:${month.prevStart}`, () => storeNewSubs(supabase, month.prevStart)),
    memo("rc", revenueCatOverview),
  ]);
  const [churn, reasons, growth] = await Promise.all([
    memo(`churn:${month.start}`, () => planChurn(supabase, month.start)),
    memo(`motivos:${month.start}`, () => cancelReasons(supabase, month.start)),
    memo(`crece:${month.start}:${today}`, () => revenueCatGrowth(month.start, today)),
  ]);
  const { rows, installs, error } = pings;
  const subsList = firstSubscriptions(rows);
  const subsOn = subsOnDay(storeSubs, subsList);
  const daySubs = subsOn(day);
  const pulse = dayPulse(rows, installs, subsList, day);
  const downloads = pulse.downloads.total;
  const owners = newOwners(installs, day, day).length;
  const { list, names } = await memo(`new:subs:${day}`, () =>
    whoSubscribed(supabase, daySubs, rows),
  );
  const updated = new Date(pings.at).toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <header className={s.top}>
          <img className={s.logo} src="/logo.png" alt="Órale AI" />
          <div>
            <h1 className={s.title}>Panel</h1>
            <p className={s.subtitle}>Actualizado a las {updated}</p>
          </div>
        </header>

        {error ? <div className={s.error}>No se pudo leer usage_pings: {error}</div> : null}

        <nav className={s.switch} aria-label="Día">
          <Link href={link({ dia: undefined, v: undefined }, "")} className={isToday ? s.switchOn : s.switchOff} aria-current={isToday ? "page" : undefined}>
            Hoy
          </Link>
          <Link href={link({ dia: "ayer", v: undefined }, "")} className={isToday ? s.switchOff : s.switchOn} aria-current={isToday ? undefined : "page"}>
            Ayer
          </Link>
        </nav>

        <section className={s.card}>
          <Stat label="Descargas" value={downloads} tone="var(--peach)">
            <p className={s.detail}>
              <b>{owners}</b> dueños · <b>{downloads - owners}</b> meseros
            </p>
          </Stat>
          <Stat label="Abrieron la app" value={pulse.opened.total} tone="var(--sky)" />
          <Stat label="Se suscribieron" value={daySubs.length} tone="var(--amber)">
            <SubsList list={list} names={names} />
          </Stat>
        </section>

        <Funnel
          id="embudo"
          title={`Embudo de ${isToday ? "hoy" : "ayer"}`}
          installs={installs}
          day={day}
          version={searchParams.v}
          href={(v) => link({ v }, "embudo")}
        />

        <RcCard rc={rc} rows={rows} month={month} />

        <Goal
          active={
            (rc.ok ? rc.metrics.find((m) => m.id === "active_subscriptions")?.value : undefined) ??
            appActive(rows)
          }
          growth={growth}
          monthName={month.name}
        />

        <LowUse weeks={lowUseWeeks(rows, dayPlus(today, -1))} />

        <PlanChurn
          rows={churn}
          monthName={month.name}
          reasons={reasons}
          monthChurn={growth.ok ? Math.round(pace(growth).churnRate * 100) : undefined}
        />

        <div className={s.stack}>
          <MonthNumbers
            supabase={supabase}
            installs={installs}
            subsList={subsList}
            month={month}
            today={today}
          />
        </div>

      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: number;
  /** Color del número. */
  tone: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={s.stat}>
      <p className={s.label}>{label}</p>
      <p className={s.value} style={{ color: tone }}>
        {value.toLocaleString("es-MX")}
      </p>
      {children}
    </div>
  );
}

/// Las altas del día con el negocio y los días que lleva usando la app (de
/// la compra al aparato, igual que «Nuevos suscriptores» del panel).
async function whoSubscribed(supabase: ReturnType<typeof adminClient>, subs: NewSub[], rows: PingRow[]) {
  const customerIds = [...new Set(subs.flatMap((x) => x.customerIds ?? []))];
  const aliases = customerIds.length
    ? await fetchAll<BillingAlias>(
        supabase
          .from("billing_purchase_aliases")
          .select("key_hash, customer_id")
          .in("customer_id", customerIds)
          .order("key_hash"),
      )
    : { data: [] as BillingAlias[] };
  const purchaseIds = customerIds.filter((id) => id.startsWith("orale_purchase_"));
  const purchases = (await Promise.all(
    chunks(purchaseIds).map((part) =>
      supabase.from("install_profiles").select("install_id, purchase_id").in("purchase_id", part),
    ),
  )).flatMap((r) => (r.data ?? []) as InstallPurchase[]);
  const list = enrichSubscriberTenure(subs, rows, aliases.data, purchases);
  const names = await businessNames(
    supabase,
    list.map((x) => ({ key: x.key, installIds: x.installIds ?? [] })),
  );
  return { list, names };
}

/// Quién se suscribió, como «Nuevos suscriptores» de /admin: el plan, el
/// negocio y desde cuándo usa la app (verde si llegó ese día).
function SubsList({ list, names }: { list: NewSub[]; names: Map<string, string> }) {
  if (!list.length) return null;
  return (
    <ul className={s.subs}>
      {list.map((x) => {
        const plan = PLANS.find((p) => p.key === x.plan);
        const store = PLATFORM_LABEL[x.platform ?? ""] ?? x.platform;
        const name = names.get(x.key);
        return (
          <li
            key={`${x.key}-${x.kind ?? ""}`}
            className={x.canceled ? `${s.subsRow} ${s.subsCanceled}` : s.subsRow}
            title={x.canceled ? "Canceló" : undefined}
          >
            <span className={s.subsPlan} style={{ ["--plan" as string]: plan?.color ?? "var(--mute)" }}>
              {x.label ?? plan?.label ?? "Plan sin dato"}
            </span>
            <span className={s.subsName}>{name ?? store}</span>
            {name && store ? <span className={s.subsStore}>{store}</span> : null}
            <span
              className={
                x.tenure == null
                  ? s.ageUnknown
                  : x.tenure === 0
                    ? s.ageNew
                    : x.tenure < 30
                      ? s.ageWeeks
                      : s.ageOld
              }
            >
              {x.tenure == null
                ? "sin identificar"
                : x.tenure === 0 ? "nuevo" : tenureLabel(x.tenure)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/// El orden de colores de /admin (PLAN_INFO), en los tonos de esta vista.
const PLANS = [
  { key: "monthly", label: "Mensual", color: "var(--peach)" },
  { key: "yearly", label: "Anual", color: "var(--peach-2)" },
  { key: "pro_monthly", label: "Pro mensual", color: "var(--amber)" },
  { key: "pro_yearly", label: "Pro anual", color: "var(--sand)" },
];
const PLATFORM_LABEL: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  windows: "Windows",
};

/// La primera pregunta de la bienvenida según la versión con la que llegó:
/// desde 3.0.110 mostrador o mesas (y ya no cambia), en 3.0.108–109 la
/// plática con «¿Cómo te llamas?», antes el nombre del negocio.
function firstQuestion(version: string | null) {
  const v = version ?? "0";
  if (cmpVersion(v, "3.0.110") >= 0) return "Eligieron mostrador o mesas";
  if (cmpVersion(v, "3.0.108") >= 0) return "Dijeron cómo se llaman";
  return "Pusieron el nombre del negocio";
}

/// Cuántos se fueron en ese paso (del anterior): menta con menos de 20%,
/// durazno hasta 40% y coral con más. Tres tonos fijos de la página: las
/// mezclas entre ellos salían color caqui.
function lossColor(share: number) {
  if (share < 0.2) return "var(--mint)";
  if (share < 0.4) return "var(--peach)";
  return "var(--rose)";
}

/// Cuántas versiones se ven sueltas; las demás van juntas en «Anteriores».
const SHOWN_VERSIONS = 3;
const OLDER = "anteriores";

const versionOf = (i: Install) => i.firstVersion?.split("+")[0] ?? null;

/// De las descargas de [day], hasta dónde llegaron los dueños nuevos, todos
/// o solo los de una versión (la que tenían al abrir la app). Solo lo que se
/// hace el mismo día: pagar va en la tarjeta de arriba.
function Funnel({
  id,
  title,
  installs,
  day,
  version,
  href,
}: {
  id: string;
  title: string;
  installs: Install[];
  day: string;
  version?: string;
  /** El link para ver otra versión (sin versión = todas). */
  href: (version?: string) => string;
}) {
  const downloads = installs.filter((i) => i.firstDay === day && !i.inherited).length;
  const all = newOwners(installs, day, day);
  // Antes de 3.0.9x la app no mandaba los pasos de la bienvenida: contarían
  // como si se hubieran ido en la primera pregunta.
  const owners = all.filter((i) => i.stage != null);
  const noData = all.length - owners.length;
  const newest = [...new Set(owners.map(versionOf).filter((v): v is string => !!v))]
    .sort((a, b) => cmpVersion(b, a))
    .slice(0, SHOWN_VERSIONS);
  const group = (i: Install) => {
    const v = versionOf(i);
    return v && newest.includes(v) ? v : OLDER;
  };
  const groups = [...newest, OLDER]
    .map((key) => ({ key, n: owners.filter((i) => group(i) === key).length }))
    .filter((g) => g.n > 0);
  const picked = groups.some((g) => g.key === version) ? version : undefined;
  const list = picked ? owners.filter((i) => group(i) === picked) : owners;

  const steps = journeySteps(list).filter((st) => !st.later);
  const questions = new Set(list.map((i) => firstQuestion(versionOf(i))));
  const labels = [
    "Dueños nuevos",
    questions.size === 1 ? [...questions][0] : "Pasaron la primera pregunta",
  ];
  const top = Math.max(1, steps[0].n);

  return (
    <section className={s.card2} id={id}>
      <h2 className={s.h2}>{title}</h2>
      <p className={s.subtitle}>
        {downloads} descargas · {downloads - all.length} meseros · {all.length} dueños nuevos
        {noData ? ` · ${noData} con versión vieja sin pasos de la bienvenida (no salen abajo)` : ""}
      </p>

      {groups.length > 1 ? (
        <nav className={s.versions} aria-label="Versión">
          {[{ key: undefined as string | undefined, n: owners.length }, ...groups].map((g) => (
            <Link
              key={g.key ?? "todas"}
              href={href(g.key)}
              scroll={false}
              className={g.key === picked ? s.vOn : s.vOff}
              aria-current={g.key === picked ? "page" : undefined}
            >
              {g.key == null ? "Todas" : g.key === OLDER ? "Anteriores" : g.key}
              <span>{g.n}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      <ol className={s.funnel}>
        {steps.map((st, k) => {
          const prev = k > 0 ? steps[k - 1].n : st.n;
          const lost = prev - st.n;
          const width = (st.n / top) * 100;
          return (
            <li key={st.label} className={s.fRow}>
              <span className={s.fLabel}>{labels[k] ?? st.label}</span>
              <div className={s.fTrack}>
                <div
                  className={s.fBar}
                  style={{ width: `${Math.max(width, 9)}%`, background: lossColor(prev ? lost / prev : 0) }}
                >
                  {st.n}
                </div>
              </div>
              <span className={s.fNum}>
                {k > 0 ? (
                  <>
                    <b>{pct(st.n, steps[0].n)}</b>
                    <span>{lost > 0 ? `−${lost}` : "sin pérdida"}</span>
                  </>
                ) : (
                  <b>100%</b>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/// La meta de 1,000 contada en orden: dónde estás, a dónde te lleva el ritmo
/// del mes (RevenueCat) y qué tendría que cambiar para llegar.
function Goal({
  active,
  growth,
  monthName,
}: {
  active: number;
  growth: RcGrowth;
  monthName: string;
}) {
  const p = growth.ok ? pace(growth) : null;
  const ceiling = p?.ceiling ?? null;
  const stuck = ceiling != null && ceiling < GOAL;
  // Conteos reales del mes (RevenueCat); el ritmo de 30 días solo da el techo.
  const entered = growth.ok ? growth.added + growth.back : 0;
  const net = growth.ok ? growth.now - growth.start : 0;
  const outShare = growth.ok && growth.start ? Math.round((growth.churned / growth.start) * 100) : 0;
  const oneIn = growth.ok && growth.churned ? Math.round(growth.start / growth.churned) : null;
  const top = Math.max(GOAL, ceiling ?? 0);
  const at = (n: number) => `${Math.min(100, (n / top) * 100)}%`;
  const churn = p ? Math.round(p.churnRate * 100) : 0;
  const inMonth = p ? Math.round(p.inMonth) : 0;
  return (
    <section className={s.goal} id="meta">
      <div className={s.goalHead}>
        <h2 className={s.h2}>Meta · {GOAL.toLocaleString("es-MX")} clientes</h2>
        <span className={s.goalSource}>RevenueCat · {monthName}</span>
      </div>

      <div className={s.goalHero}>
        <GoalRing value={active} goal={GOAL} />
        <div className={s.goalVerdict}>
          {p ? (
            <>
              <span>A este ritmo</span>
              <b className={stuck ? s.toneBad : s.toneGood}>
                {stuck ? `te quedas en ~${ceiling!.toLocaleString("es-MX")}` : "sí llegas"}
              </b>
            </>
          ) : null}
          <p className={s.goalHint}>
            Faltan {Math.max(0, GOAL - active).toLocaleString("es-MX")} para la meta
          </p>
        </div>
      </div>

      <div className={s.track}>
        <div className={s.trackFill} style={{ width: at(active) }} />
        {ceiling != null ? (
          <>
            <i className={s.trackMark} style={{ left: at(ceiling) }} />
            <span className={s.trackLabel} style={{ left: at(ceiling) }}>
              techo ~{ceiling.toLocaleString("es-MX")}
            </span>
          </>
        ) : null}
      </div>
      <div className={s.trackScale}>
        <span>0</span>
        <span>{GOAL.toLocaleString("es-MX")}</span>
      </div>

      {p && growth.ok ? (
        <>
          {/* El mes en conteos reales, una sola unidad: con cuántos empezó,
              cuántos entraron, cuántos se fueron y con cuántos va. */}
          <div className={s.flow}>
            <div>
              <b>{growth.start.toLocaleString("es-MX")}</b>
              <span>al empezar {monthName}</span>
            </div>
            <i>+</i>
            <div>
              <b className={s.toneGood}>{entered}</b>
              <span>entraron</span>
            </div>
            <i>−</i>
            <div>
              <b className={s.toneBad}>{growth.churned}</b>
              <span>se fueron</span>
            </div>
            <i>=</i>
            <div>
              <b>{growth.now.toLocaleString("es-MX")}</b>
              <span>hoy ({net >= 0 ? "+" : ""}{net})</span>
            </div>
          </div>
          <p className={s.goalHint} style={{ textAlign: "center" }}>
            De los {growth.start.toLocaleString("es-MX")} clientes que tenías al empezar{" "}
            {monthName} se fueron {growth.churned}: {outShare}%
            {oneIn ? `, 1 de cada ${oneIn}` : ""}. Los {entered} que entraron ({growth.added} nuevos y{" "}
            {growth.back} que regresaron) son aparte.
          </p>
          {ceiling != null ? (
            <p className={s.goalHint} style={{ textAlign: "center" }}>
              ¿Por qué el techo es ~{ceiling.toLocaleString("es-MX")}? Cada mes entran ~{inMonth}.
              Si se sigue yendo el {churn}% de los clientes que tienes, con ~
              {ceiling.toLocaleString("es-MX")} ese {churn}% ya son {inMonth} bajas al mes: entra lo
              mismo que se va y dejas de crecer.
            </p>
          ) : null}

          <p className={s.optionsTitle}>
            El camino a {GOAL.toLocaleString("es-MX")}: con estas dos, el techo llega a la meta
          </p>
          <div className={s.targets}>
            <Target
              label="Que se vayan menos"
              unit="de bajas al mes"
              suffix="%"
              now={churn}
              goal={Math.round(TARGET_CHURN * 100)}
              max={40}
              lowerIsBetter
            />
            <Target
              label="Que entren más"
              unit="entran al mes"
              now={inMonth}
              goal={Math.round(GOAL * TARGET_CHURN)}
              max={Math.max(200, inMonth)}
            />
          </div>
          <p className={s.goalHint}>
            {Math.round(TARGET_CHURN * 100)}% de bajas es lo que ya tienen hoy los clientes que
            venden 20 veces o más en 2 semanas.
          </p>
        </>
      ) : (
        <div className={s.error}>Sin RevenueCat: {growth.ok ? "" : growth.reason}</div>
      )}
    </section>
  );
}

/// Bajas al mes con las que, entrando GOAL × esto al mes, el techo llega a la
/// meta. 15%: lo que ya tienen los que venden 20+ veces en 2 semanas (29 oct).
const TARGET_CHURN = 0.15;

/// Una meta con su barra: dónde estás, la línea de la meta y cuánto falta.
function Target({
  label,
  unit,
  now,
  goal,
  max,
  lowerIsBetter,
  suffix = "",
}: {
  label: string;
  unit: string;
  /** Lo que va después de cada número («%»). */
  suffix?: string;
  now: number;
  goal: number;
  max: number;
  lowerIsBetter?: boolean;
}) {
  const done = lowerIsBetter ? now <= goal : now >= goal;
  const at = (n: number) => `${Math.min(100, Math.max(0, (n / max) * 100))}%`;
  const gap = Math.abs(goal - now);
  return (
    <div className={s.target}>
      <div className={s.targetHead}>
        <span>{label}</span>
        <b>
          {now}
          {suffix}
          <i>
            {" "}
            → {goal}
            {suffix}
          </i>
        </b>
      </div>
      <div className={s.targetTrack}>
        <div
          className={s.targetFill}
          style={{ width: at(now), background: done ? "var(--mint)" : lowerIsBetter ? "var(--rose)" : "var(--peach)" }}
        />
        <i className={s.targetMark} style={{ left: at(goal) }} />
      </div>
      <small>
        {unit} · {done ? "¡ya llegaste!" : `${lowerIsBetter ? "bajar" : "subir"} ${gap}${suffix === "%" ? " puntos" : suffix}`}
      </small>
    </div>
  );
}

/// El anillo de la meta (el mismo dibujo que /admin), en los tonos de aquí.
function GoalRing({ value, goal }: { value: number; goal: number }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  const share = Math.min(1, value / goal);
  return (
    <div className={s.ring}>
      <svg viewBox="0 0 150 150" width="160" height="160" aria-hidden>
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--card-2)" strokeWidth="12" />
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke="var(--peach)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${share * c} ${c}`}
          transform="rotate(-90 75 75)"
        />
      </svg>
      <div className={s.ringCenter}>
        <b>{pct(value, goal)}</b>
        <span>
          {value.toLocaleString("es-MX")} de {goal.toLocaleString("es-MX")}
        </span>
      </div>
    </div>
  );
}

/// Los que pagan pero casi no venden: son los que más se dan de baja. Es el
/// número a bajar; semana por semana para ver si los cambios ayudan.
function LowUse({ weeks }: { weeks: LowUseWeek[] }) {
  const last = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  if (!last?.paying) return null;
  const share = (w: LowUseWeek) => (w.paying ? w.low / w.paying : 0);
  const diff = prev ? Math.round((share(last) - share(prev)) * 100) : 0;
  const top = Math.max(0.01, ...weeks.map(share));
  return (
    <section className={s.card2} id="venden-poco">
      <div className={s.lowHead}>
        <div>
          <h2 className={s.h2}>Pagan pero venden poco</h2>
          <p className={s.subtitle}>
            {last.low} de {last.paying} clientes que pagan vendieron menos de {LOW_USE_WEEK} veces
            en los últimos 7 días. Son los que más se dan de baja: el número a bajar.
          </p>
        </div>
        <div className={s.lowBig}>
          <b>{pct(last.low, last.paying)}</b>
          {prev ? (
            <span className={diff > 0 ? s.toneBad : diff < 0 ? s.toneGood : undefined}>
              {diff > 0 ? "▲" : diff < 0 ? "▼" : "="} {Math.abs(diff)} pts vs. la semana anterior
            </span>
          ) : null}
        </div>
      </div>
      <div className={s.lowBars}>
        {weeks.map((w) => (
          <div key={w.end} className={s.lowCol} title={`${w.low} de ${w.paying}`}>
            <span>{pct(w.low, w.paying)}</span>
            <div className={s.lowTrack}>
              <div className={s.lowFill} style={{ height: `${(share(w) / top) * 100}%` }} />
            </div>
            <small>{shortDay(w.end)}</small>
          </div>
        ))}
      </div>
      <p className={s.goalHint}>
        Cada barra son los 7 días que terminan ese día. En octubre se fue 60–79% de los que
        vendían poco, contra 18% de los que vendían 100 o más en 2 semanas.
      </p>
    </section>
  );
}

