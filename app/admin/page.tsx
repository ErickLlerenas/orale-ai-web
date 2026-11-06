import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { adminClient } from "@/lib/supabase";
import {
  cmpVersion,
  dayPlus,
  dayPulse,
  firstSubscriptions,
  journeySteps,
  monthWindow,
  mxDay,
  newOwners,
  pct,
  PLATFORMS,
  revenueCatGrowth,
  revenueCatOverview,
  type Install,
  type PingRow,
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
  pendingSupport,
  storeNewSubs,
  trialConversion,
  type SupportCase,
  type SupportPerson,
  type SupportReply,
  subsOnDay,
  usageHistory,
} from "@/lib/admin-data";
import { GOAL, MonthNumbers, PlanChurn, RcCard, appActive, pace } from "./cards";
import { markSupportReviewed, replySupport } from "./actions";
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
  const [churn, reasons, growth, rhythm, weekAgo, trialStats, support] = await Promise.all([
    memo(`churn:${month.start}`, () => planChurn(supabase, month.start)),
    memo(`motivos:${month.start}`, () => cancelReasons(supabase, month.start)),
    memo(`crece:${month.start}:${today}`, () => revenueCatGrowth(month.start, today)),
    // El ritmo sale de 30 días corridos: no depende de en qué día del mes vas.
    memo(`ritmo:${today}`, () => revenueCatGrowth(dayPlus(today, -29), today)),
    // El mismo ritmo una semana antes, para ver hacia dónde se mueve el techo.
    memo(`ritmo:${dayPlus(today, -7)}`, () =>
      revenueCatGrowth(dayPlus(today, -36), dayPlus(today, -7)),
    ),
    memo("pruebas", () => trialConversion(supabase)),
    // Sin memo: lo que se acaba de marcar como revisado no debe volver a salir.
    pendingSupport(supabase),
  ]);
  const { rows, installs, error } = pings;
  const subsList = firstSubscriptions(rows);
  const subsOn = subsOnDay(storeSubs, subsList);
  const daySubs = subsOn(day);
  // Las pruebas que la tienda cobró ese día vienen aparte de las altas.
  const converted = storeSubs.filter((x) => x.day === day && x.kind === "converted");
  const trials = daySubs.filter((x) => x.kind === "trial").length;
  const direct = daySubs.length - trials;
  const pulse = dayPulse(rows, installs, subsList, day);
  const downloads = pulse.downloads.total;
  const owners = newOwners(installs, day, day).length;
  const { list, names } = await memo(`new:subs:${day}`, () =>
    whoSubscribed(supabase, [...daySubs, ...converted], rows),
  );
  // Los aparatos que empezaron prueba ese día, para el último paso del embudo.
  const trialInstalls = new Set(
    list.filter((x) => x.kind === "trial").flatMap((x) => x.installIds ?? []),
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
          <div className={s.stats}>
            <Stat label="Descargas" value={downloads} tone="var(--peach)">
              <p className={s.plats}>
                {PLATFORMS.map((p) => (
                  <span key={p}>
                    <i className={s.dot} style={{ background: `var(--${p})` }} />
                    {PLATFORM_LABEL[p]} <b>{pulse.downloads.byPlatform[p]}</b>
                  </span>
                ))}
              </p>
              <p className={s.detail}>
                <b>{owners}</b> dueños · <b>{downloads - owners}</b> meseros
              </p>
            </Stat>
            <Stat label="Empezaron prueba" value={trials} tone="var(--amber)">
              <p className={s.detail}>Gratis 7 días; se cobra si no cancelan</p>
            </Stat>
            <Stat label="Pagaron" value={converted.length + direct} tone="var(--mint)">
              <p className={s.detail}>
                <b>{converted.length}</b> pruebas cobradas · <b>{direct}</b> sin prueba
              </p>
            </Stat>
          </div>
          <SubsList list={list} names={names} />
        </section>

        <Funnel
          id="embudo"
          title={`Embudo de ${isToday ? "hoy" : "ayer"}`}
          installs={installs}
          day={day}
          version={searchParams.v}
          trialInstalls={trialInstalls}
          href={(v) => link({ v }, "embudo")}
        />

        <RcCard rc={rc} rows={rows} month={month} />

        <Goal
          active={
            (rc.ok ? rc.metrics.find((m) => m.id === "active_subscriptions")?.value : undefined) ??
            appActive(rows)
          }
          growth={growth}
          rhythm={rhythm}
          weekAgo={weekAgo}
          inTrial={rc.ok ? rc.metrics.find((m) => m.id === "active_trials")?.value : undefined}
          trials={trialStats}
          monthName={month.name}
        />

        <PlanChurn
          rows={churn}
          monthName={month.name}
          reasons={reasons}
          monthChurn={rhythm.ok ? Math.round(pace(rhythm).churnRate * 100) : undefined}
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

        <Support {...support} />
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

/// Cuántos de cada lista se ven sin desplegar: tres renglones de dos.
const SUBS_SHOWN = 6;

/// Quién empezó prueba y quién pagó, a todo el ancho y en dos columnas para
/// que la tarjeta no se estire: con muchas altas, el resto se despliega.
function SubsList({ list, names }: { list: NewSub[]; names: Map<string, string> }) {
  const groups = [
    { title: "Empezaron prueba", rows: list.filter((x) => x.kind === "trial") },
    { title: "Pagaron", rows: list.filter((x) => x.kind !== "trial") },
  ].filter((g) => g.rows.length);
  if (!groups.length) return null;
  const row = (x: NewSub) => <SubsRow key={`${x.key}-${x.kind ?? ""}`} x={x} name={names.get(x.key)} />;
  return (
    <div className={s.subsWrap}>
      {groups.map((g) => (
        <div key={g.title}>
          <p className={s.subsTitle}>
            {g.title} · {g.rows.length}
          </p>
          <ul className={s.subs}>{g.rows.slice(0, SUBS_SHOWN).map(row)}</ul>
          {g.rows.length > SUBS_SHOWN ? (
            <details className={s.subsMore}>
              <summary>Ver {g.rows.length - SUBS_SHOWN} más</summary>
              <ul className={s.subs}>{g.rows.slice(SUBS_SHOWN).map(row)}</ul>
            </details>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/// Un alta: el plan, el negocio y desde cuándo usa la app (verde si llegó
/// ese día).
function SubsRow({ x, name }: { x: NewSub; name?: string }) {
  const plan = PLANS.find((p) => p.key === x.plan);
  const store = PLATFORM_LABEL[x.platform ?? ""] ?? x.platform;
  return (
    <li
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
  trialInstalls,
  href,
}: {
  id: string;
  title: string;
  installs: Install[];
  day: string;
  version?: string;
  /** Aparatos que empezaron prueba ese día (de la tienda). */
  trialInstalls: Set<string>;
  /** El link para ver otra versión (sin versión = todas). */
  href: (version?: string) => string;
}) {
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

  const steps = [
    ...journeySteps(list).filter((st) => !st.later),
    // Desde la 3.0.114 la prueba se ofrece al cobrar la primera venta. Solo
    // cuentan las de quien descargó ese día; las demás salen arriba.
    { label: "Empezaron prueba", n: list.filter((i) => trialInstalls.has(i.id)).length },
  ];
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
        Solo los dueños que descargaron {day === mxDay(0) ? "hoy" : "ese día"}: hasta dónde llegaron ese mismo día.
        {noData ? ` ${noData} con versión vieja no mandan los pasos y no salen.` : ""}
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
/// de los últimos 30 días (RevenueCat) y qué tendría que cambiar para llegar.
function Goal({
  active,
  growth,
  rhythm,
  weekAgo,
  inTrial,
  trials,
  monthName,
}: {
  active: number;
  /** Lo que ha pasado en el mes en curso. */
  growth: RcGrowth;
  /** Los últimos 30 días corridos. */
  rhythm: RcGrowth;
  /** Los 30 días que terminaron hace una semana. */
  weekAgo: RcGrowth;
  /** Pruebas gratis corriendo hoy (RevenueCat). */
  inTrial?: number;
  /** De las pruebas que ya terminaron, cuántas se cobraron. */
  trials: { done: number; converted: number };
  monthName: string;
}) {
  const p = rhythm.ok ? pace(rhythm) : null;
  const ceiling = p?.ceiling ?? null;
  const ceilingBefore = weekAgo.ok ? pace(weekAgo).ceiling : null;
  const payShare = trials.done ? trials.converted / trials.done : null;
  const stuck = ceiling != null && ceiling < GOAL;
  // Conteos reales del mes (RevenueCat); el ritmo de 30 días solo da el techo.
  const entered = growth.ok ? growth.added + growth.back : 0;
  const net = growth.ok ? growth.now - growth.start : 0;
  const top = Math.max(GOAL, ceiling ?? 0);
  const at = (n: number) => `${Math.min(100, (n / top) * 100)}%`;
  const churn = p ? Math.round(p.churnRate * 100) : 0;
  const inMonth = p ? Math.round(p.inMonth) : 0;
  const outMonth = p ? Math.round(p.outMonth) : 0;
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
              <span>Al ritmo de los últimos 30 días</span>
              <b className={stuck ? s.toneBad : s.toneGood}>
                {stuck ? `te quedas en ~${ceiling!.toLocaleString("es-MX")}` : "sí llegas"}
              </b>
              {ceilingBefore != null ? (
                <span>Hace una semana: ~{ceilingBefore.toLocaleString("es-MX")}</span>
              ) : null}
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
          {ceiling != null ? (
            <p className={s.goalHint} style={{ textAlign: "center" }}>
              ¿Por qué el techo es ~{ceiling.toLocaleString("es-MX")}? En los últimos 30 días entraron{" "}
              {inMonth} y se fueron {outMonth}, el {churn}% de tus clientes. Si sigue así, con ~
              {ceiling.toLocaleString("es-MX")} clientes ese {churn}% ya son {inMonth} bajas al mes:
              entra lo mismo que se va y dejas de crecer.
            </p>
          ) : null}

          {inTrial != null && payShare != null ? (
            <>
              <p className={s.optionsTitle}>Lo que viene: las pruebas gratis</p>
              <div className={`${s.flow} ${s.flowTrials}`}>
                <div>
                  <b>{inTrial}</b>
                  <span>en prueba hoy</span>
                </div>
                <i>×</i>
                <div>
                  <b>{pct(trials.converted, trials.done)}</b>
                  <span>de las pruebas se cobra</span>
                </div>
                <i>≈</i>
                <div>
                  <b className={s.toneGood}>~{Math.round(inTrial * payShare)}</b>
                  <span>entrarían en 7 días</span>
                </div>
              </div>
              <p className={s.goalHint} style={{ textAlign: "center" }}>
                Desde el 24 oct terminaron {trials.done} pruebas y {trials.converted} se cobraron.
                Aún no cuentan en «entraron» ni en el techo.
              </p>
            </>
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
        <div className={s.error}>
          Sin RevenueCat: {growth.ok ? (rhythm.ok ? "" : rhythm.reason) : growth.reason}
        </div>
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

/// Lo que el chat de soporte no pudo resolver, al final del panel, y las ideas plegadas
/// aparte: cada persona con su caso más reciente y «Revisado» para quitarla.
/// Sin pendientes no se enseña.
function Support({
  people,
  replies,
  names,
  error,
}: Awaited<ReturnType<typeof pendingSupport>>) {
  if (error) return <div className={s.error}>No se pudo leer soporte: {error}</div>;
  if (!people.length && !replies.length) return null;
  const only = (isIdea: boolean) =>
    people
      .map((p) => ({ ...p, cases: p.cases.filter((c) => c.isIdea === isIdea) }))
      .filter((p) => p.cases.length);
  const problems = only(false);
  const ideas = only(true);
  const total = problems.reduce((a, p) => a + p.cases.length, 0);
  const ideaCount = ideas.reduce((a, p) => a + p.cases.length, 0);
  const pending = new Set(people.map((p) => p.installId));
  // Lo contestado de quien ya no tiene casos pendientes, para ver si ya lo leyó.
  const answered = replies.filter((r) => !pending.has(r.installId));
  return (
    <section className={s.card2} id="soporte">
      <h2 className={s.h2}>Soporte sin revisar</h2>
      <p className={s.subtitle}>
        {problems.length
          ? `${total} ${total === 1 ? "caso" : "casos"} de ${problems.length} ${problems.length === 1 ? "persona" : "personas"} que el chat no pudo resolver.`
          : "Nada pendiente."}{" "}
        Lo que contestes le llega en su chat de la app (con la 3.0.112 o más nueva).
      </p>
      <ul className={s.support}>
        {problems.map((p) => (
          <SupportPersonRow key={p.installId} p={p} names={names} replies={replies} />
        ))}
      </ul>
      {ideas.length ? (
        <details className={s.supportMore}>
          <summary>Ideas · {ideaCount} · el chat ya les contestó, no hace falta responder</summary>
          <ul className={s.support}>
            {ideas.map((p) => (
              <SupportPersonRow key={p.installId} p={p} names={names} replies={replies} />
            ))}
          </ul>
        </details>
      ) : null}
      {answered.length ? (
        <details className={s.supportMore}>
          <summary>Ya contestados (últimos 14 días) · {answered.length}</summary>
          <ul className={s.support}>
            {answered.map((r) => (
              <li key={r.id} className={s.supportRow}>
                <div className={s.supportHead}>
                  <span className={s.subsName}>{names.get(r.installId) ?? "Sin nombre"}</span>
                </div>
                <SupportReplyText r={r} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function SupportPersonRow({
  p,
  names,
  replies,
}: {
  p: SupportPerson;
  names: Map<string, string>;
  replies: SupportReply[];
}) {
  const [last, ...older] = p.cases;
  const meta = [PLATFORM_LABEL[last.platform ?? ""] ?? last.platform, last.version, whenMx(last.at)]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className={s.supportRow}>
      <div className={s.supportHead}>
        <span className={s.subsName}>{names.get(p.installId) ?? "Sin nombre"}</span>
        <span className={s.subsStore}>{meta}</span>
        <form action={markSupportReviewed} className={s.supportForm}>
          {p.cases.map((c) => (
            <input key={c.id} type="hidden" name="id" value={c.id} />
          ))}
          <button type="submit" className={s.supportDone}>
            Revisado
          </button>
        </form>
      </div>
      <SupportCaseText c={last} />
      {older.length ? (
        <details className={s.supportMore}>
          <summary>
            {older.length} {older.length === 1 ? "caso más" : "casos más"}
          </summary>
          {older.map((c) => (
            <SupportCaseText key={c.id} c={c} when />
          ))}
        </details>
      ) : null}
      {replies
        .filter((r) => r.installId === p.installId)
        .map((r) => (
          <SupportReplyText key={r.id} r={r} />
        ))}
      {p.installId !== "sin aparato" ? (
        <form action={replySupport} className={s.supportReply}>
          <input type="hidden" name="requestId" value={last.id} />
          {p.cases.map((c) => (
            <input key={c.id} type="hidden" name="id" value={c.id} />
          ))}
          <textarea
            name="reply"
            required
            maxLength={2000}
            rows={2}
            placeholder="Escríbele aquí. Le llega en su chat de la app."
            className={s.supportInput}
          />
          <button type="submit" className={s.supportDone}>
            Contestar
          </button>
        </form>
      ) : null}
    </li>
  );
}

function SupportReplyText({ r }: { r: SupportReply }) {
  return (
    <div className={s.supportSent}>
      <p className={s.supportDetail}>
        <span className={s.subsStore}>
          Tú · {whenMx(r.at)} · {r.seen ? "ya la vio ✓" : "aún no la ve"}
        </span>
        <br />
        {r.body}
      </p>
    </div>
  );
}

function SupportCaseText({ c, when = false }: { c: SupportCase; when?: boolean }) {
  // El chat suele poner de título el principio del mismo mensaje: se lee una vez.
  const repeats = !!c.detail && c.detail.startsWith(c.title.replace(/[.…\s]+$/, ""));
  return (
    <div className={s.supportCase}>
      <p className={s.supportTitle}>
        {when ? <span className={s.subsStore}>{whenMx(c.at)} · </span> : null}
        {repeats ? c.detail : c.title}
      </p>
      {c.detail && !repeats ? <p className={s.supportDetail}>{c.detail}</p> : null}
    </div>
  );
}

/// «28 oct, 9:14 p.m.» en hora de México.
function whenMx(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
