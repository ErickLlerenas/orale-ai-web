import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { adminClient, fetchAll, fetchAllParallel } from "@/lib/supabase";
import {
  PING_COLUMNS,
  FREE_ORDER_LIMIT,
  PLATFORMS,
  activeSeries,
  dayPulse,
  downloadsByPlatform,
  dayRange,
  downloadsDaily,
  fillAccountKeys,
  firstSubscriptions,
  cmpVersion,
  newestVersion,
  avgWeeklySubs,
  menuPaths,
  mxDay,
  newOwners,
  pct,
  recentLost,
  atRisk,
  type RiskAccount,
  planMix,
  retention,
  revenueCatOverview,
  toInstalls,
  versions,
  weekly,
  type Count,
  type DayRow,
  type Install,
  type LostAccount,
  type PingRow,
  type RetRow,
  type WeekRow,
} from "@/lib/admin";
import s from "./admin.module.css";
import Users, { type RiskUser, type UserRow } from "./Users";
import {
  enrichSubscriberTenure,
  revenueCatSub,
  stripeSub,
  type NewSub,
  type BillingAlias,
  type StoreEvent,
  type StripeSub,
} from "@/lib/admin-subscribers";
import { tenureLabel } from "@/lib/admin-tenure";

export const metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GOAL = 1000;
/// Desde cuándo corre la tabla de líneas en sombra (C2) en prod.
const C2_SINCE = "2026-10-14T05:39:28Z";
/// Primera versión de la app con el sync nuevo (C4). C5 solo se prende en
/// negocios donde todos sus aparatos ya la tienen.
const C4_APP = "3.0.96";
/// Corte de los pagos viejos (secreto PRO_LEGACY_UNTIL; se movió del 4 al 11
/// nov para verificar antes a Don Gus y SHOTERIA). Regla: 90% verificados.
const LEGACY_CUTOFF = "2026-11-11";
const PLATFORM_LABEL: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  windows: "Windows",
};
const PLATFORM_COLOR: Record<string, string> = {
  android: "var(--android)",
  ios: "var(--ios)",
  windows: "var(--windows)",
};
/// Nombres en español de las métricas de RevenueCat que más importan.
const RC_LABEL: Record<string, string> = {
  active_subscriptions: "Suscripciones activas",
  active_trials: "En prueba gratis",
  mrr: "Ingreso mensual (MRR)",
  new_customers: "Nuevos en 28 días",
};
const RC_ORDER = Object.keys(RC_LABEL);

export default async function Admin() {
  noStore();
  const today = mxDay(0);

  const supabase = adminClient();
  // Todo el historial de uso, en páginas que se piden a la vez (antes iban
  // una tras otra y era lo que más tardaba).
  const { count: pingCount } = await supabase
    .from("usage_pings")
    .select("install_id", { count: "exact", head: true });
  const [pingsRes, rc, health] = await Promise.all([
    fetchAllParallel<PingRow>(
      () =>
        supabase
          .from("usage_pings")
          .select(PING_COLUMNS)
          .order("ping_date")
          .order("install_id"),
      pingCount ?? 0,
    ),
    revenueCatOverview(),
    migrationHealth(supabase),
  ]);
  const rows = fillAccountKeys(pingsRes.data);
  const installs = toInstalls(rows);
  // El camino de un negocio nuevo: dueños que llegaron en los últimos 30
  // días (sin hoy), todas las plataformas, apps que reportan la bienvenida.
  const journeyFrom = mxDay(30);
  const journeyTo = mxDay(1);
  const journeyCohort = newOwners(installs, journeyFrom, journeyTo).filter(
    (i) => i.stage != null,
  );
  const journey = journeySteps(journeyCohort);
  // La bienvenida se reporta desde la 3.0.93: el periodo real empieza con el
  // primer negocio que la reportó, no hace 30 días.
  const journeyStart = journeyCohort.reduce(
    (m, i) => (i.firstDay < m ? i.firstDay : m),
    journeyTo,
  );
  const journeyPaths = menuPaths(journeyCohort);
  const weeks = weekly(installs, rows, 8, today);
  const vers = versions(rows, mxDay(7));
  const newest = newestVersion(rows, mxDay(7));

  // Hoy y ayer.
  const subsList = firstSubscriptions(rows);
  // Quién se suscribió hoy y ayer. Desde que hay webhook, de la tienda
  // (RevenueCat + Stripe); antes, de lo que reporta la app.
  // Mes en curso (se reinicia el día 1) y los mismos días del mes pasado.
  const month = monthWindow(today);
  // Lo que solo depende del historial va todo a la vez.
  const userDays = dayRange(mxDay(13), today);
  const recent = rows.filter((r) => r.ping_date >= userDays[0]);
  const accountInstalls = new Map<string, Set<string>>();
  for (const r of recent) {
    const k = r.account_key ?? r.install_id;
    if (!accountInstalls.has(k)) accountInstalls.set(k, new Set());
    accountInstalls.get(k)!.add(r.install_id);
  }
  const [storeSubs, risk, userNames, cancels] = await Promise.all([
    storeNewSubs(supabase, month.start < mxDay(1) ? month.start : mxDay(1)),
    withoutActiveBusinesses(supabase, atRisk(rows, today), rows, mxDay(1)),
    businessNames(
      supabase,
      [...accountInstalls].map(([key, ids]) => ({
        key,
        installIds: [...ids],
      })),
    ),
    cancelSurvey(supabase),
  ]);
  const subsOn = (day: string): NewSub[] =>
    day >= STORE_SINCE
      ? storeSubs.filter((x) => x.day === day && x.kind !== "converted")
      : subsList.filter((x) => x.day === day);
  const convertedOn = (day: string) =>
    storeSubs.filter((x) => x.day === day && x.kind === "converted");
  const newSubs = [
    ...subsOn(today), ...subsOn(mxDay(1)),
    ...convertedOn(today), ...convertedOn(mxDay(1)),
  ];
  const customerIds = [...new Set(newSubs.flatMap((x) => x.customerIds ?? []))];
  const aliases = customerIds.length ? await fetchAll<BillingAlias>(
    supabase.from("billing_purchase_aliases").select("key_hash, customer_id")
      .in("customer_id", customerIds).order("key_hash"),
  ) : { data: [] as BillingAlias[], error: null };
  const detailedSubs = enrichSubscriberTenure(newSubs, rows, aliases.data);
  const [newSubNames, riskNames] = await Promise.all([
    businessNames(
      supabase,
      detailedSubs.map((x) => ({ key: x.key, installIds: x.installIds ?? [] })),
    ),
    businessNames(supabase, risk),
  ]);
  const pulse = {
    today: dayPulse(rows, installs, subsList, today),
    yesterday: dayPulse(rows, installs, subsList, mxDay(1)),
  };
  pulse.today.subscribed = countSubs(subsOn(today));
  pulse.yesterday.subscribed = countSubs(subsOn(mxDay(1)));
  // Descargas del mes contra los mismos días del mes pasado.
  const dlDays = downloadsDaily(installs, month.start, month.end);
  const dlNow = downloadsByPlatform(installs, month.start, today);
  const dlPrev = downloadsByPlatform(installs, month.prevStart, month.prevTo);
  // Suscripciones del mes (misma fuente que «Se suscribieron»).
  const subDays: DayRow[] = dayRange(month.start, month.end).map((day) => ({
    day,
    ...countSubs(day <= today ? subsOn(day) : []),
  }));
  const subsMonth = dayRange(month.start, today).flatMap((d) => subsOn(d));
  const subsPrevTotal = dayRange(month.prevStart, month.prevTo).reduce(
    (a, d) => a + subsOn(d).length,
    0,
  );
  const dlTotal = dlNow.reduce((a, p) => a + p.total, 0);
  const dlPrevTotal = dlPrev.reduce((a, p) => a + p.total, 0);
  const cutoffDays = Math.round(
    (Date.parse(LEGACY_CUTOFF) - Date.parse(today)) / 86_400_000,
  );

  const metric = (id: string) =>
    rc.ok ? rc.metrics.find((m) => m.id === id) : undefined;
  // Sin RevenueCat: los que hoy tienen plan según la app (aproximado).
  const appActive = new Set(
    rows
      .filter((r) => r.ping_date >= mxDay(7) && r.subscription_active)
      .map((r) => r.account_key ?? r.install_id),
  ).size;
  const active = metric("active_subscriptions")?.value ?? appActive;
  const perWeek = avgWeeklySubs(weeks);
  // Crecimiento NETO (entran menos las que se van), de las activas que ve la
  // app semana a semana. Es lo que de verdad acerca a la meta.
  const series = activeSeries(rows, today, 8);
  const plans = planMix(rows, mxDay(7));
  // Quién se queda: pagaban hace 8–6 semanas, ¿siguen con plan los últimos 10 días?
  const ret = retention(rows, mxDay(56), mxDay(43), mxDay(9));
  // Usuarios de los últimos 14 días (uno por aparato y día) y «podrían
  // cancelar»: ya se pidieron arriba, junto con lo demás.
  // La versión «más nueva» es la publicada: la más alta que ya usan al menos
  // 10 aparatos (las de prueba no cuentan).
  const newestV =
    versions(rows, mxDay(7))
      .filter((v) => v.total >= 10 && v.version !== "sin versión")
      .map((v) => v.version)
      .sort((a, b) => cmpVersion(b, a))[0] ?? null;
  const versionTone = (v: string | null) => {
    if (!v || !newestV) return "gray";
    const gap = versionGap(v, newestV);
    return gap === 0 ? "green" : gap <= 3 ? "gray" : gap <= 8 ? "yellow" : "red";
  };
  const openedDays = new Map<string, number>();
  for (const r of rows) {
    openedDays.set(r.install_id, (openedDays.get(r.install_id) ?? 0) + 1);
  }
  const userRows: UserRow[] = recent.map((r) => ({
    daysOpened: openedDays.get(r.install_id) ?? 1,
    day: r.ping_date,
    id: r.install_id,
    name: userNames.get(r.account_key ?? r.install_id) ?? null,
    waiter: r.is_caja === false,
    time: r.updated_at
      ? new Date(r.updated_at).toLocaleTimeString("es-MX", {
          timeZone: "America/Mexico_City",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    at: r.updated_at ?? "",
    tenure: r.days_since_install,
    platform: r.platform,
    version: r.app_version,
    versionTone: versionTone(r.app_version),
    products: r.product_count ?? 0,
    orders: r.orders_total ?? 0,
    plan: r.plan,
    active: r.subscription_active === true,
    inherited: r.inherited_access === true,
    stage: r.onboarding_stage,
    menuPath: r.menu_path,
  }));
  // Antigüedad: desde el primer día que vimos cualquiera de sus aparatos.
  const firstSeen = new Map(installs.map((i) => [i.id, i.firstDay]));
  const daysSince = (day: string) =>
    Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
  const riskUsers: RiskUser[] = risk.slice(0, 40).map((r) => ({
    tenure: daysSince(
      r.installIds
        .map((id) => firstSeen.get(id) ?? today)
        .reduce((a, b) => (b < a ? b : a), today),
    ),
    id: r.key,
    name: riskNames.get(r.key) ?? null,
    platform: r.platform,
    plan: r.plan,
    version: r.version,
    versionTone: versionTone(r.version),
    quietDays: r.quietDays,
    avgDaily: r.avgDaily,
    activeDays: r.activeDays,
  }));
  const netPerWeek =
    (series[series.length - 1].n - series[0].n) / (series.length - 1);
  // Mismo periodo para entradas y neto, si no las salidas salen chuecas.
  const inPerWeek = avgWeeklySubs(weeks, 7);
  const leavingPerWeek = Math.max(0, inPerWeek - netPerWeek);
  const weeksLeft =
    netPerWeek > 0 ? Math.ceil(Math.max(0, GOAL - active) / netPerWeek) : null;

  const updated = new Date().toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <header className={s.top}>
          <div className={s.brand}>
            <div className={s.logo}>Ó</div>
            <div>
              <h1 className={s.title}>Órale AI · Panel</h1>
              <p className={s.subtitle}>Actualizado a las {updated}</p>
            </div>
          </div>
        </header>


        {pingsRes.error ? (
          <div className={s.error}>
            No se pudo leer usage_pings: {pingsRes.error.message}
          </div>
        ) : null}

        {/* 0. Hoy y ayer */}
        <section className={s.pulse} id="hoy">
          <PulseTile
            label="Descargas"
            tone="orange"
            now={pulse.today.downloads}
            before={pulse.yesterday.downloads}
            hint={`+${pulse.today.reinstalled} reinstalaron`}
          />
          <PulseTile
            label="Se suscribieron"
            tone="amber"
            now={pulse.today.subscribed}
            before={pulse.yesterday.subscribed}
            hint={today >= STORE_SINCE ? "según la tienda" : "según la app"}
          />
          <PulseTile
            label="Abrieron la app"
            tone="blue"
            now={pulse.today.opened}
            before={pulse.yesterday.opened}
          />
          <PulseTile
            label="Cobrando"
            tone="green"
            now={pulse.today.selling}
            before={pulse.yesterday.selling}
          />
        </section>

        <NewSubs
          days={[
            { title: "Hoy", day: today },
            { title: "Ayer", day: mxDay(1) },
          ].map((d) => ({
            ...d,
            list: detailedSubs.filter((x) => x.day === d.day && x.kind !== "converted"),
            converted: detailedSubs.filter((x) => x.day === d.day && x.kind === "converted"),
            store: d.day >= STORE_SINCE,
          }))}
          names={newSubNames}
        />

        {/* 1. Meta y suscripciones */}
        <section className={`${s.card} ${s.hero}`} id="meta">
          <div className={s.goal}>
            <p className={s.eyebrow}>Meta</p>
            <Ring value={active} goal={GOAL} />
            <div className={s.goalLine}>
              Faltan{" "}
              <strong>
                {Math.max(0, GOAL - active).toLocaleString("es-MX")}
              </strong>{" "}
              ·{" "}
              {weeksLeft != null ? (
                <>
                  a este ritmo, <strong>{humanWeeks(weeksLeft)}</strong>
                </>
              ) : (
                <strong>no estás creciendo neto</strong>
              )}
            </div>
            <div className={s.flow}>
              <span>
                <b className={s.flowIn}>+{inPerWeek.toFixed(0)}</b> entran
              </span>
              <span>
                <b className={s.flowOut}>−{leavingPerWeek.toFixed(0)}</b> se van
              </span>
              <span>
                <b>
                  {netPerWeek >= 0 ? "+" : ""}
                  {netPerWeek.toFixed(1)}
                </b>{" "}
                crecimiento real
              </span>
              <span className={s.flowUnit}>por semana</span>
            </div>
            <Sparkline points={series} />
            <p className={s.note}>
              Clientes con plan activo cada semana (últimas 8). Ya se descuentan
              los que cancelaron.
            </p>
          </div>
          <div className={s.heroSide}>
            <p className={s.eyebrow}>Suscripciones</p>
            <h2 className={s.h2}>
              {rc.ok ? "Según RevenueCat" : "Según la app"}
              {rc.ok ? null : <span className={s.badge}>aproximado</span>}
            </h2>
            <div className={s.heroTiles}>
              {rc.ok ? (
                RC_ORDER.map((id) => metric(id))
                  .filter((m): m is NonNullable<typeof m> => !!m)
                  .map((m) => ({
                    key: m.id,
                    value: formatMetric(m.value, m.unit),
                    label: RC_LABEL[m.id] ?? m.name,
                  }))
                  .map((t) => (
                    <div className={s.tile} key={t.key}>
                      <div className={s.tileValue}>{t.value}</div>
                      <div className={s.tileLabel}>{t.label}</div>
                    </div>
                  ))
              ) : (
                <>
                  <div className={s.tile}>
                    <div className={s.tileValue}>{appActive}</div>
                    <div className={s.tileLabel}>Con plan activo (7 días)</div>
                  </div>
                  <div className={s.tile}>
                    <div className={s.tileValue}>{perWeek.toFixed(1)}</div>
                    <div className={s.tileLabel}>Nuevas por semana</div>
                  </div>
                </>
              )}
            </div>
            <Plans counts={plans} />
            {rc.ok ? null : (
              <div className={s.warn}>
                Sin RevenueCat: {rc.reason} Con la llave aquí salen activas,
                pruebas, MRR e ingresos reales.
              </div>
            )}
          </div>
        </section>

        {/* 1b. Descargas */}
        <section className={s.card} id="descargas">
          <div className={s.cardHead}>
            <div>
              <p className={s.eyebrow}>Descargas · {month.name}</p>
              <h2 className={s.h2}>
                {dlTotal.toLocaleString("es-MX")}{" "}
                <Delta now={dlTotal} before={dlPrevTotal} />
              </h2>
              <p className={s.note}>
                Aparatos que abrieron la app por primera vez (dueños y meseros).
                No cuenta reinstalaciones ni cambios de celular. La flecha
                compara con los mismos días de {month.prevName}.
              </p>
            </div>
            <Legend subs={false} />
          </div>
          <div className={s.platTiles}>
            {dlNow.map((p, i) => {
              return (
                <div className={s.platTile} key={p.platform}>
                  <div className={s.platHead}>
                    <span
                      className={s.dot}
                      style={{ background: PLATFORM_COLOR[p.platform] }}
                    />
                    {PLATFORM_LABEL[p.platform]}
                    <Delta now={p.total} before={dlPrev[i].total} />
                  </div>
                  <div className={s.platValue}>
                    {p.total.toLocaleString("es-MX")}
                  </div>
                  <div className={s.platSub}>
                    {pct(p.total, dlTotal)} del total · {p.owners} dueños ·{" "}
                    {p.waiters} meseros
                  </div>
                </div>
              );
            })}
          </div>
          <DailyBars days={dlDays} today={today} />
        </section>

        {/* 1c. Suscripciones del mes */}
        <section className={s.card} id="suscripciones-mes">
          <div className={s.cardHead}>
            <div>
              <p className={s.eyebrow}>Suscripciones · {month.name}</p>
              <h2 className={s.h2}>
                {subsMonth.length.toLocaleString("es-MX")}{" "}
                <Delta now={subsMonth.length} before={subsPrevTotal} />
              </h2>
              <p className={s.note}>
                Clientes que se suscribieron por primera vez. Desde el 24 de
                octubre sale de la tienda (RevenueCat y Stripe); antes, de la
                app. La flecha compara con los mismos días de{" "}
                {month.prevName}.
              </p>
            </div>
            <Legend subs={false} />
          </div>
          <div className={s.subsChips} style={{ marginBottom: 12 }}>
            {PLAN_INFO.map((p) => {
              const n = subsMonth.filter((x) => x.plan === p.key).length;
              return n ? (
                <span key={p.key} className={s.subsChip}>
                  <span className={s.dot} style={{ background: p.color }} />
                  {n} {p.label}
                </span>
              ) : null;
            })}
          </div>
          <DailyBars days={subDays} today={today} />
        </section>

        {/* 2. Dónde se va la gente */}
        <Journey
          steps={journey}
          paths={journeyPaths}
          from={journeyStart}
          to={journeyTo}
        />

        {/* 2c. Quién se queda */}
        <section className={s.card} id="retencion">
          <div className={s.cardHead}>
            <div>
              <p className={s.eyebrow}>Retención</p>
              <h2 className={s.h2}>¿Quién se queda?</h2>
              <p className={s.note}>
                De los {ret.total.n} clientes que pagaban hace 2 meses, ¿cuántos
                ya dejaron de usar la app con su plan? Entre más rojo, más se
                van.
              </p>
            </div>
            <div className={s.retTotal}>
              <span className={s.retTotalN}>
                {pct(ret.total.gone, ret.total.n)}
              </span>
              <span className={s.retTotalL}>se fue (promedio)</span>
            </div>
          </div>
          <div className={s.retGrid}>
            {/* El plan primero: es el que más dice (p. ej. Pro mensual). */}
            {[...ret.groups]
              .sort(
                (a, b) =>
                  Number(b.title.includes("plan")) -
                  Number(a.title.includes("plan")),
              )
              .map((g) => (
                <RetGroup key={g.title} title={g.title} rows={g.rows} />
              ))}
          </div>
        </section>

        {/* 2d. Por qué se van */}
        <Cancellations data={cancels} />

        {/* 2c. Usuarios (y en riesgo) */}
        <Users days={userDays} today={today} rows={userRows} risk={riskUsers} />


        {/* 4. Migración */}
        <section className={s.card} id="migracion">
          <div className={s.cardHead}>
            <div>
              <p className={s.eyebrow}>Migración</p>
              <h2 className={s.h2}>
                {health.mismatches === 0 &&
                health.proVerifiedPct >= 90 &&
                health.rcRemoves === 0
                  ? `Vamos en ${health.syncV2 === null ? "C4" : "C5"} · todo en verde`
                  : `Vamos en ${health.syncV2 === null ? "C4" : "C5"} · hay algo que revisar`}
              </h2>
            </div>
          </div>
          <Stepper
            steps={[
              {
                id: "C1",
                name: "Líneas canceladas no regresan",
                state: "done",
              },
              {
                id: "C2",
                name: "Tabla de líneas en sombra",
                state: "done",
                sub: health.mismatches === 0 ? "0 diferencias" : undefined,
              },
              {
                id: "C3",
                name: "order-ops y order-changes",
                state: "done",
                sub: "en prod, sin usarse",
              },
              {
                id: "C4",
                name: `Interruptor + app ${C4_APP}`,
                state: health.syncV2 === null ? "now" : "done",
                sub: health.syncV2 === null ? "falta el servidor" : "listo",
              },
              {
                id: "C5",
                name: "Prender negocio por negocio",
                state: health.syncV2 ? "now" : "next",
                sub: `${health.ready.businesses} de ${health.proWithOrders} listos`,
              },
              {
                id: "C6",
                name: "Limpieza",
                state: "next",
                sub: "cuando <5% use versiones viejas",
              },
            ]}
          />

          <div className={s.readyGrid}>
            <div className={s.readyCard}>
              <p className={s.funnelTitle}>Listos para el sync nuevo (C5)</p>
              <div className={s.readyBig}>
                {health.ready.businesses}
                <span> de {health.proWithOrders} negocios</span>
              </div>
              <p className={s.note} style={{ margin: "4px 0 12px" }}>
                Negocios Pro donde la caja y todos los meseros ya actualizaron a
                la {C4_APP}. Solo a esos se les puede prender el sync nuevo.
              </p>
              {PLATFORMS.map((p) => {
                const r = health.ready.byPlatform[p] ?? { on: 0, total: 0 };
                return (
                  <div className={s.readyRow} key={p}>
                    <span className={s.barName}>{PLATFORM_LABEL[p]}</span>
                    <div className={s.readyTrack}>
                      <div
                        className={s.readyFill}
                        style={{
                          width: `${r.total ? (r.on / r.total) * 100 : 0}%`,
                          background: PLATFORM_COLOR[p],
                        }}
                      />
                    </div>
                    <span className={s.barN}>
                      {r.on}/{r.total}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className={s.readyCard}>
              <p className={s.funnelTitle}>Corte de pagos viejos</p>
              <div className={s.readyBig}>
                {cutoffDays > 0 ? cutoffDays : 0}
                <span>
                  {" "}
                  {cutoffDays === 1 ? "día" : "días"} ·{" "}
                  {shortDay(LEGACY_CUTOFF)}
                </span>
              </div>
              <p className={s.note} style={{ margin: "4px 0 12px" }}>
                Ese día se apaga la forma vieja de validar pagos. Se hace si al
                menos 90% de los Pro ya están verificados.
              </p>
              <div className={s.readyTrack} style={{ height: 12 }}>
                <div
                  className={s.readyFill}
                  style={{
                    width: `${Math.min(100, health.proVerifiedPct)}%`,
                    background:
                      health.proVerifiedPct >= 90
                        ? "var(--green)"
                        : "var(--amber)",
                  }}
                />
                <div className={s.readyMark} style={{ left: "90%" }} />
              </div>
              <p className={s.platSub} style={{ marginTop: 8 }}>
                {Math.round(health.proVerifiedPct)}% verificados ·{" "}
                {health.proVerifiedPct >= 90
                  ? "se mantiene el corte"
                  : "habría que moverlo"}
              </p>
            </div>
          </div>

          <div className={s.health}>
            <Check
              state={
                health.mismatches === null
                  ? "idle"
                  : health.mismatches === 0
                    ? "ok"
                    : "bad"
              }
              value={health.mismatches ?? "—"}
              label="Comandas que no cuadran entre la tabla vieja y la nueva (C2). Debe ser 0."
            />
            <Check
              state={health.proVerifiedPct >= 90 ? "ok" : "bad"}
              value={pct(health.proVerified, health.proWithOrders)}
              label={`Negocios Pro verificados: ${health.proVerified} de ${health.proWithOrders} que tuvieron comandas esta semana${health.unverified.some((b) => b.bridgeUntil) ? ` (${health.unverified.filter((b) => b.bridgeUntil).length} con puente)` : ""}. Mínimo 90%.`}
            />
            <Check
              state={health.rcRemoves === 0 ? "ok" : "bad"}
              value={health.rcRemoves}
              label={`Clientes a los que RevenueCat les quitaría el plan por error. Debe ser 0. (${health.rcMatch} coinciden, en ${health.rcBetter} RevenueCat da más, ${health.rcErrors} no se pudieron revisar)`}
            />
            <Check
              state={health.syncV2 ? "ok" : "idle"}
              value={health.syncV2 ?? "—"}
              label={`Negocios con el sync nuevo prendido (C5). ${health.orderOps.toLocaleString("es-MX")} acciones mandadas por el sync nuevo.`}
            />
          </div>
          {health.unverified.some((b) => b.bridgeUntil) ? (
            <>
              <p className={s.funnelTitle} style={{ marginTop: 22 }}>
                Con puente hasta el{" "}
                {shortDay(
                  health.unverified.find((b) => b.bridgeUntil)!.bridgeUntil!,
                )}{" "}
                · {health.unverified.filter((b) => b.bridgeUntil).length}
              </p>
              <p className={s.note} style={{ marginTop: -4, marginBottom: 10 }}>
                Su caja no manda comprobante (versión vieja o plan heredado de
                otro aparato), así que se verificaron a mano por un tiempo. En
                cuanto actualicen la caja se verifican solos; si no, ese día se
                les apagan los meseros.
              </p>
              <div className={s.bizList}>
                {health.unverified
                  .filter((b) => b.bridgeUntil)
                  .map((b) => (
                    <Biz key={b.name} biz={b} newest={newest} today={today} />
                  ))}
              </div>
            </>
          ) : null}
          {health.unverified.some((b) => !b.bridgeUntil) ? (
            <>
              <p className={s.funnelTitle} style={{ marginTop: 22 }}>
                Pro que todavía no se verifican ·{" "}
                {health.unverified.filter((b) => !b.bridgeUntil).length}
              </p>
              <p className={s.note} style={{ marginTop: -4, marginBottom: 10 }}>
                La pastilla es la versión de su caja. Verde: la más nueva (
                {newest ?? "—"}) · Gris: reciente · Amarillo: vieja · Rojo: muy
                vieja, pídeles que actualicen.
              </p>
              <div className={s.bizList}>
                {health.unverified
                  .filter((b) => !b.bridgeUntil)
                  .map((b) => (
                    <Biz key={b.name} biz={b} newest={newest} today={today} />
                  ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

type UnverifiedBiz = {
  name: string;
  /** Verificado a mano hasta esta fecha (puente), o null. */
  bridgeUntil: string | null;
  caja: { platform: string; version: string; seen: string } | null;
  waiters: { version: string }[];
};

function Biz({
  biz,
  newest,
  today,
}: {
  biz: UnverifiedBiz;
  newest: string | null;
  today: string;
}) {
  // Qué tan atrás va: 0 = la más nueva, hasta 5 = reciente, hasta 20 =
  // vieja, más = muy vieja (hay que pedirle que actualice).
  const tone = (v: string) => {
    if (!newest) return s.verMid;
    const gap = versionGap(v, newest);
    return gap <= 0
      ? s.ver
      : gap <= 5
        ? s.verMid
        : gap <= 20
          ? s.verOld
          : s.verBad;
  };
  const oldest = biz.waiters.map((w) => w.version).sort(cmpVersion)[0];
  return (
    <div className={s.biz}>
      <div className={s.bizIcon} aria-hidden>
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10" />
          <path d="M17 21V3c-2.2 0-3.5 2.5-3.5 6v4.5H17" />
        </svg>
      </div>
      <div className={s.bizBody}>
        <div className={s.bizName}>{biz.name}</div>
        <div className={s.bizMeta}>
          {biz.waiters.length === 0
            ? "Sin meseros"
            : `${biz.waiters.length} ${biz.waiters.length === 1 ? "mesero" : "meseros"}` +
              (oldest ? ` · el más viejo en ${oldest}` : "")}
        </div>
      </div>
      {biz.caja ? (
        <div className={s.bizRight}>
          <span className={tone(biz.caja.version)}>
            {PLATFORM_LABEL[biz.caja.platform] ?? biz.caja.platform}{" "}
            {biz.caja.version}
          </span>
          <span className={s.bizSeen}>caja · {ago(biz.caja.seen, today)}</span>
        </div>
      ) : (
        <div className={s.bizRight}>
          <span className={s.verBad}>sin caja</span>
        </div>
      )}
    </div>
  );
}

/// Cuántas versiones de diferencia hay (3.0.82 vs 3.0.96 = 14).
function versionGap(v: string, newest: string) {
  const [a1, a2, a3] = v.split(".").map((x) => parseInt(x, 10) || 0);
  const [b1, b2, b3] = newest.split(".").map((x) => parseInt(x, 10) || 0);
  if (a1 !== b1 || a2 !== b2) return cmpVersion(v, newest) < 0 ? 999 : 0;
  return b3 - a3;
}

/// «hoy», «ayer», «hace 5 días».
function ago(day: string, today: string) {
  const d = Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`;
}

const TONE: Record<string, string> = {
  orange: "var(--orange-2)",
  amber: "var(--amber)",
  blue: "var(--ios)",
  green: "var(--green)",
};

function PulseTile({
  label,
  tone,
  now,
  before,
  hint,
}: {
  label: string;
  tone: string;
  now: Count;
  before: Count;
  hint?: string;
}) {
  return (
    <div className={s.pulseTile} style={{ ["--tone" as string]: TONE[tone] }}>
      <div className={s.pulseLabel}>
        <span className={s.pulseDot} />
        {label}
        {hint ? <span className={s.pulseHint}>{hint}</span> : null}
      </div>
      <div className={s.pulseRow}>
        <div>
          <div className={s.pulseWhen}>Hoy</div>
          <div className={s.pulseNow}>{now.total.toLocaleString("es-MX")}</div>
        </div>
        <div className={s.pulseBefore}>
          <div className={s.pulseWhen}>Ayer</div>
          <div className={s.pulseYesterday}>
            {before.total.toLocaleString("es-MX")}
          </div>
        </div>
      </div>
      <PlatformSplit c={now} />
    </div>
  );
}

/// Quién se suscribió hoy y ayer, con la misma antigüedad de Usuarios.
function NewSubs({
  days,
  names,
}: {
  days: {
    title: string;
    day: string;
    list: NewSub[];
    converted: NewSub[];
    store: boolean;
  }[];
  names: Map<string, string>;
}) {
  const row = (x: NewSub, tag?: string) => {
    const info = PLAN_INFO.find((p) => p.key === x.plan);
    return (
      <div key={`${x.key}-${x.kind ?? ""}`} className={s.subsRow}>
        <span
          className={s.subsPlan}
          style={{ ["--plan" as string]: info?.color ?? "var(--mute)" }}
        >
          {x.label ?? info?.label ?? "Plan sin dato"}
        </span>
        <span className={s.subsName}>
          {x.platform ? PLATFORM_LABEL[x.platform] ?? x.platform : ""}
          {names.get(x.key) ? ` · ${names.get(x.key)}` : ""}
        </span>
        {tag ? <span className={s.subsMeta}>{tag}</span> : null}
        <span className={s.subsTenure}>
          Antigüedad: {x.tenure === 0 ? "Nuevo" : x.tenure != null ? tenureLabel(x.tenure) : x.matchedInstallId ? "Sin dato" : "Sin vínculo con dispositivo"}
        </span>
      </div>
    );
  };
  return (
    <section className={`${s.card} ${s.subsCard}`}>
      <p className={s.eyebrow}>
        Nuevos suscriptores ·{" "}
        {days.every((d) => d.store)
          ? "según la tienda"
          : days.some((d) => d.store)
            ? "hoy según la tienda, ayer según la app"
            : "según la app"}
      </p>
      <div className={s.subsCols}>
        {days.map((d) => {
          const counts = new Map<string, number>();
          for (const x of d.list) {
            const k = x.plan ?? "?";
            counts.set(k, (counts.get(k) ?? 0) + 1);
          }
          return (
            <div key={d.day} className={s.subsCol}>
              <div className={s.subsHead}>
                <span className={s.subsWhen}>{d.title}</span>
                <span className={s.subsChips}>
                  {PLAN_INFO.filter((p) => counts.get(p.key)).map((p) => (
                    <span key={p.key} className={s.subsChip}>
                      <span
                        className={s.dot}
                        style={{ background: p.color }}
                      />
                      {counts.get(p.key)} {p.label}
                    </span>
                  ))}
                  {counts.get("?") ? (
                    <span className={s.subsChip}>
                      {counts.get("?")} sin dato
                    </span>
                  ) : null}
                </span>
              </div>
              {d.list.length === 0 ? (
                <span className={s.note} style={{ margin: 0 }}>
                  Nadie todavía
                </span>
              ) : null}
              {d.list.map((x) => row(x, x.kind === "paid" ? "Pagó" : undefined))}
              {d.converted.length ? (
                <>
                  <span className={s.subsWhen} style={{ marginTop: 6 }}>
                    Pagaron al terminar su prueba
                  </span>
                  {d.converted.map((x) => row(x, "Pagó"))}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/// Barrita apilada por plataforma con los números abajo.
function PlatformSplit({ c }: { c: Count }) {
  return (
    <div>
      <div className={s.splitBar}>
        {PLATFORMS.map((p) =>
          c.byPlatform[p] ? (
            <div
              key={p}
              style={{ flex: c.byPlatform[p], background: PLATFORM_COLOR[p] }}
            />
          ) : null,
        )}
      </div>
      <div className={s.splitNums}>
        {PLATFORMS.map((p) => (
          <span key={p}>
            <span className={s.dot} style={{ background: PLATFORM_COLOR[p] }} />
            {c.byPlatform[p] ?? 0}
          </span>
        ))}
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

function DailyBars({ days, today }: { days: DayRow[]; today: string }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  // Promedio de los días ya terminados (hoy va a la mitad; los que faltan
  // del mes todavía no pasan).
  const done = days.filter((d) => d.day < today);
  const avg = done.reduce((a, d) => a + d.total, 0) / Math.max(1, done.length);
  return (
    <div className={s.daysWrap}>
      <div
        className={s.avgLine}
        style={{ bottom: `${22 + (avg / max) * 150}px` }}
      >
        <span>promedio {avg.toFixed(0)}/día</span>
      </div>
      <div
        className={s.days}
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        {days.map((d) => {
          const dow = new Date(`${d.day}T12:00:00Z`).getUTCDay();
          return (
            <div
              className={s.day}
              key={d.day}
              title={`${shortDay(d.day)}: ${d.total} · ${PLATFORMS.map((p) => `${PLATFORM_LABEL[p]} ${d.byPlatform[p]}`).join(" · ")}`}
            >
              <span className={s.dayN}>{d.total || ""}</span>
              <div
                className={s.dayStack}
                style={{
                  height: `${(d.total / max) * 150}px`,
                  opacity: d.day === today ? 0.55 : 1,
                }}
              >
                {PLATFORMS.map((p) => (
                  <div
                    key={p}
                    style={{
                      flex: d.byPlatform[p],
                      background: PLATFORM_COLOR[p],
                    }}
                  />
                ))}
              </div>
              <span
                className={
                  dow === 0 || dow === 6 ? s.dayLabelWeekend : s.dayLabel
                }
                style={d.day > today ? { opacity: 0.35 } : undefined}
              >
                {d.day === today ? "hoy" : Number(d.day.slice(8))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stepper({
  steps,
}: {
  steps: {
    id: string;
    name: string;
    state: "done" | "now" | "next";
    sub?: string;
  }[];
}) {
  return (
    <ol className={s.stepper}>
      {steps.map((st) => (
        <li
          key={st.id}
          className={
            st.state === "done"
              ? s.stDone
              : st.state === "now"
                ? s.stNow
                : s.stNext
          }
        >
          <span className={s.stDot}>{st.state === "done" ? "✓" : st.id}</span>
          <span className={s.stName}>
            <b>{st.id}</b> {st.name}
          </span>
          {st.sub ? <span className={s.stSub}>{st.sub}</span> : null}
        </li>
      ))}
    </ol>
  );
}

/// 116 semanas → «unos 2.2 años»; 20 → «unos 5 meses».
function humanWeeks(w: number) {
  if (w > 78) return `unos ${(w / 52).toFixed(1)} años`;
  if (w > 10) return `unos ${Math.round(w / 4.35)} meses`;
  return `unas ${w} semanas`;
}

function Sparkline({ points }: { points: { day: string; n: number }[] }) {
  const w = 260;
  const h = 56;
  const min = Math.min(...points.map((p) => p.n));
  const max = Math.max(...points.map((p) => p.n));
  const span = Math.max(1, max - min);
  const xy = points.map((p, i) => [
    (i / (points.length - 1)) * (w - 8) + 4,
    h - 6 - ((p.n - min) / span) * (h - 16),
  ]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = xy[xy.length - 1];
  return (
    <svg
      className={s.spark}
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      aria-label="Suscripciones activas por semana"
    >
      <polyline
        points={`4,${h} ${line} ${w - 4},${h}`}
        fill="rgba(245,185,66,0.12)"
        stroke="none"
      />
      <polyline
        points={line}
        fill="none"
        stroke="var(--amber)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {xy.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === xy.length - 1 ? 3.5 : 2}
          fill="var(--amber)"
        >
          <title>{`${points[i].day}: ${points[i].n}`}</title>
        </circle>
      ))}
      <text
        x={last[0] - 4}
        y={Math.max(10, last[1] - 8)}
        textAnchor="end"
        fontSize="11"
        fontWeight="700"
        fill="var(--ink)"
      >
        {points[points.length - 1].n}
      </text>
      <text
        x={8}
        y={Math.max(10, xy[0][1] - 8)}
        fontSize="11"
        fill="var(--mute)"
      >
        {points[0].n}
      </text>
    </svg>
  );
}

const PLAN_INFO = [
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

/// Lista con los primeros [first] a la vista y el resto en «Ver más».
function ShowMore({ first, items }: { first: number; items: JSX.Element[] }) {
  return (
    <div className={s.bizList}>
      {items.slice(0, first)}
      {items.length > first ? (
        <details className={s.more}>
          <summary>Ver los otros {items.length - first}</summary>
          <div className={s.bizList}>{items.slice(first)}</div>
        </details>
      ) : null}
    </div>
  );
}

/// Bajas por plan contra cuántos tienen ese plan hoy: qué plan sangra más.
function LostByPlan({
  lost,
  active,
}: {
  lost: LostAccount[];
  active: Record<string, number>;
}) {
  const rows = PLAN_INFO.map((p) => {
    const n = lost.filter((l) => l.plan === p.key).length;
    const base = n + (active[p.key] ?? 0);
    return { ...p, n, rate: base ? n / base : 0 };
  }).filter((r) => r.n > 0);
  const worst = Math.max(...rows.map((r) => r.rate));
  return (
    <div className={s.lostPlans}>
      {rows.map((r) => (
        <div
          key={r.key}
          className={r.rate === worst && rows.length > 1 ? s.lostPlanBad : s.lostPlan}
        >
          <span className={s.dot} style={{ background: r.color }} />
          <b>{r.label}</b>
          <span>
            {r.n} se fueron · {Math.round(r.rate * 100)}% de ese plan
          </span>
        </div>
      ))}
    </div>
  );
}

/// Un grupo de «¿Quién se queda?»: por cada fila, qué parte se fue. La
/// barra se llena con lo que se fue y se pone más roja entre más alto.
function RetGroup({ title, rows }: { title: string; rows: RetRow[] }) {
  return (
    <div className={s.retCard}>
      <p className={s.funnelTitle}>{title}</p>
      {rows.map((r) => {
        const gone = r.n ? r.gone / r.n : 0;
        const color = `color-mix(in srgb, #dc2626 ${Math.min(100, Math.round(gone * 140))}%, #fdba74)`;
        return (
          <div className={s.rRow} key={r.label}>
            <div className={s.rLabel}>
              <span>{r.label}</span>
              <small>{r.n} clientes</small>
            </div>
            <div className={s.rTrack}>
              <div
                className={s.rFill}
                style={{ width: `${Math.max(2, gone * 100)}%`, background: color }}
              />
            </div>
            <div className={s.rPct} style={{ color }}>
              {pct(r.gone, r.n)}
              <small>se fue</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PRODUCT_LABEL: Record<string, string> = {
  orale_monthly: "Mensual",
  orale_yearly: "Anual",
  orale_pro_monthly: "Pro mensual",
  orale_pro_yearly: "Pro anual",
  orale_monthly_99: "Mensual $99",
  orale_pro_monthly_199: "Pro mensual $199",
  monthly: "Mensual",
  yearly: "Anual",
  pro_monthly: "Pro mensual",
  pro_yearly: "Pro anual",
};
const productLabel = (p: string | null) =>
  (p && PRODUCT_LABEL[p]) ?? p ?? "Plan";
const storeLabel = (s: string | null) =>
  s === "APP_STORE" || s === "ios"
    ? "iPhone"
    : s === "PLAY_STORE" || s === "android"
      ? "Android"
      : s === "STRIPE" || s === "windows"
        ? "Web / Windows"
        : (s ?? "—");
const storeIcon = (s: string | null) =>
  s === "APP_STORE" ? "🍎" : s === "PLAY_STORE" ? "🤖" : "💳";

function RiskRow({ risk, name }: { risk: RiskAccount; name: string | null }) {
  return (
    <div className={s.biz}>
      <div className={s.bizIcon} aria-hidden>
        {name ? "🍽️" : "👤"}
      </div>
      <div className={s.bizBody}>
        <div className={s.bizName}>
          {name ??
            `${PLATFORM_LABEL[risk.platform ?? ""] ?? "—"} · cuenta ${risk.key.slice(0, 8)}`}
        </div>
        <div className={s.bizMeta}>
          {productLabel(risk.plan)} · vendía ~{risk.avgDaily} al día · abría{" "}
          {risk.activeDays} de 14 días · {risk.version ?? "—"}
        </div>
      </div>
      <div className={s.bizRight}>
        <span className={risk.quietDays >= 5 ? s.verBad : s.verMid}>
          {risk.quietDays} días sin abrir
        </span>
        <span className={s.bizSeen}>sigue pagando</span>
      </div>
    </div>
  );
}

function LostRow({
  lost,
  name,
  today,
}: {
  lost: LostAccount;
  name: string | null;
  today: string;
}) {
  const days =
    Math.round(
      (Date.parse(lost.lastPaid) - Date.parse(lost.firstPaid)) / 86_400_000,
    ) + 1;
  return (
    <div className={s.biz}>
      <div className={s.bizIcon} aria-hidden>
        {name ? "🍽️" : "👤"}
      </div>
      <div className={s.bizBody}>
        <div className={s.bizName}>
          {name ??
            `${PLATFORM_LABEL[lost.platform ?? ""] ?? "—"} · cuenta ${lost.key.slice(0, 8)}`}
        </div>
        <div className={s.bizMeta}>
          {productLabel(lost.plan)} · con plan {days}{" "}
          {days === 1 ? "día" : "días"} · {lost.recentSales} ventas en sus
          últimas 2 semanas · {lost.version ?? "—"}
        </div>
      </div>
      <div className={s.bizRight}>
        <span className={lost.stillOpens ? s.verBad : s.verMid}>
          {lost.stillOpens ? "Abre la app sin plan" : "Ya no abre la app"}
        </span>
        <span className={s.bizSeen}>
          último día con plan: {ago(lost.lastPaid, today)}
        </span>
      </div>
    </div>
  );
}

/// Qué pasó, en palabras, según el tipo y motivo de RevenueCat.
function churnWhat(
  type: string,
  reason: string | null,
): { what: string; tone: "bad" | "warn" } {
  if (type === "BILLING_ISSUE" || reason === "BILLING_ERROR") {
    return { what: "Le falló el cobro", tone: "warn" };
  }
  if (reason === "CUSTOMER_SUPPORT") return { what: "Reembolso", tone: "bad" };
  if (reason === "PRICE_INCREASE") {
    return { what: "No aceptó el precio nuevo", tone: "bad" };
  }
  if (type === "EXPIRATION")
    return { what: "Se le acabó el plan", tone: "bad" };
  return { what: "Canceló la renovación", tone: "bad" };
}

/// Nombre del negocio para los Pro: aparato de la caja → negocio. Los Básicos
/// no lo mandan, así que no salen aquí.
/// Quita de «en riesgo» a quien sí sigue usando la app con otro aparato o
/// cuenta del mismo negocio (cambió de celular, otra caja, etc.): si cualquier
/// aparato del negocio abrió la app desde [since], no está en riesgo.
async function withoutActiveBusinesses(
  supabase: ReturnType<typeof adminClient>,
  risk: RiskAccount[],
  rows: PingRow[],
  since: string,
) {
  const ids = [...new Set(risk.flatMap((r) => r.installIds))];
  if (!ids.length) return risk;
  const bizOf = new Map<string, string>();
  for (const part of chunks(ids)) {
    const r = await supabase
      .from("business_devices")
      .select("install_id, business_id")
      .in("install_id", part);
    for (const d of (r.data ?? []) as {
      install_id: string;
      business_id: string;
    }[]) {
      bizOf.set(d.install_id, d.business_id);
    }
  }
  const bizIds = [...new Set(bizOf.values())];
  if (!bizIds.length) return risk;
  const devices = new Map<string, string[]>();
  for (const part of chunks(bizIds)) {
    const r = await supabase
      .from("business_devices")
      .select("install_id, business_id")
      .in("business_id", part);
    for (const d of (r.data ?? []) as {
      install_id: string;
      business_id: string;
    }[]) {
      devices.set(d.business_id, [
        ...(devices.get(d.business_id) ?? []),
        d.install_id,
      ]);
    }
  }
  const recent = new Set(
    rows.filter((r) => r.ping_date >= since).map((r) => r.install_id),
  );
  return risk.filter((r) => {
    const biz = r.installIds.map((i) => bizOf.get(i)).find(Boolean);
    if (!biz) return true;
    return !(devices.get(biz) ?? []).some((i) => recent.has(i));
  });
}

/// «¿Por qué te vas?» de los últimos 30 días: antes de cancelar (Administrar
/// suscripción › Cancelar, desde la 3.0.102) y después (abrió la app ya
/// cancelada). La tabla no se lee desde la app: solo con service role.
type CancelRow = {
  id: string;
  install_id: string;
  product_id: string;
  reason: string;
  detail: string | null;
  offer_shown: boolean;
  offer_accepted: boolean;
  moment: "before" | "after";
  went_to_store: boolean;
  created_at: string;
};

async function cancelSurvey(supabase: ReturnType<typeof adminClient>) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const r = await supabase
    .from("cancel_survey_answers")
    .select(
      "id, install_id, product_id, reason, detail, offer_shown, offer_accepted, moment, went_to_store, created_at",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (r.error) return null;
  // Una respuesta por aparato: la más reciente. Si contestó dos veces (por
  // ejemplo, reinició la app y volvió a entrar), es la misma persona.
  const seen = new Set<string>();
  const rows = ((r.data ?? []) as CancelRow[]).filter((x) => {
    if (seen.has(x.install_id)) return false;
    seen.add(x.install_id);
    return true;
  });
  // Abrir la tienda no es cancelar: las cancelaciones de verdad las avisa la
  // tienda (RevenueCat), sin contar pruebas ni fallas de cobro.
  const ev = await supabase
    .from("revenuecat_events")
    .select("app_user_id, environment")
    .eq("type", "CANCELLATION")
    .eq("cancel_reason", "UNSUBSCRIBE")
    .gte("event_at", since)
    .limit(1000);
  const storeCancels = ev.error
    ? null
    : new Set(
        ((ev.data ?? []) as { app_user_id: string | null; environment: string | null }[])
          .filter((e) => e.environment !== "SANDBOX")
          .map((e) => e.app_user_id ?? ""),
      ).size;
  const names = await businessNames(
    supabase,
    rows.map((x) => ({ key: x.install_id, installIds: [x.install_id] })),
  );
  return { rows, names, storeCancels };
}

/// Qué pasó con cada respuesta, en una palabra.
function cancelOutcome(r: CancelRow): { text: string; tone: "good" | "bad" | "mid" } {
  if (r.offer_accepted) return { text: "Aceptó la oferta", tone: "good" };
  if (r.moment === "after") return { text: "Ya había cancelado", tone: "mid" };
  if (r.went_to_store) return { text: "Abrió la tienda", tone: "bad" };
  return { text: "Se quedó", tone: "good" };
}

function Cancellations({
  data,
}: {
  data: Awaited<ReturnType<typeof cancelSurvey>>;
}) {
  if (!data) {
    return (
      <section className={s.card} id="cancelaciones">
        <p className={s.eyebrow}>Cancelaciones</p>
        <h2 className={s.h2}>¿Por qué se van?</h2>
        <p className={s.error} style={{ marginTop: 12 }}>
          No se pudieron leer las respuestas.
        </p>
      </section>
    );
  }
  const { rows, names, storeCancels } = data;
  const before = rows.filter((r) => r.moment === "before");
  const after = rows.filter((r) => r.moment === "after");
  const stayed = before.filter((r) => !r.went_to_store);
  const shown = rows.filter((r) => r.offer_shown);
  const accepted = rows.filter((r) => r.offer_accepted);
  const reasons = Object.keys(CANCEL_REASON).map((code) => ({
    code,
    before: before.filter((r) => r.reason === code).length,
    after: after.filter((r) => r.reason === code).length,
  }));
  const maxReason = Math.max(1, ...reasons.map((x) => x.before + x.after));
  const when = (iso: string) =>
    new Date(iso).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const toneStyle = {
    good: s.ver,
    mid: s.verMid,
    bad: s.verBad,
  } as const;
  return (
    <section className={s.card} id="cancelaciones">
      <div className={s.cardHead}>
        <div>
          <p className={s.eyebrow}>Cancelaciones · últimos 30 días</p>
          <h2 className={s.h2}>¿Por qué se van?</h2>
          <p className={s.note}>
            Una respuesta por aparato (la más reciente). «Antes»: tocó Cancelar
            en la app (desde la 3.0.102) y le preguntamos antes de mandarlo a la
            tienda. «Después»: canceló directo en la tienda y contestó al volver
            a abrir la app. Abrir la tienda no es cancelar: las cancelaciones de
            verdad las dice la tienda.
          </p>
        </div>
      </div>
      <div className={s.tiles}>
        <div className={s.tile}>
          <div className={s.tileValue}>{before.length}</div>
          <div className={s.tileLabel}>Tocaron Cancelar en la app</div>
        </div>
        <div className={s.tile}>
          <div className={s.tileValue}>
            {stayed.length}
            {before.length ? (
              <span className={s.tileLabel}> · {pct(stayed.length, before.length)}</span>
            ) : null}
          </div>
          <div className={s.tileLabel}>Se quedaron (no abrieron la tienda)</div>
        </div>
        <div className={s.tile}>
          <div className={s.tileValue}>
            {accepted.length}
            <span className={s.tileLabel}> de {shown.length}</span>
          </div>
          <div className={s.tileLabel}>Aceptaron el precio de oferta</div>
        </div>
        <div className={s.tile}>
          <div className={s.tileValue}>
            {storeCancels ?? "—"}
          </div>
          <div className={s.tileLabel}>
            Cancelaron de verdad (según Apple y Google)
          </div>
        </div>
      </div>

      <p className={s.funnelTitle} style={{ marginTop: 22 }}>
        Motivos
      </p>
      <div className={s.bars}>
        {reasons.map((x) => (
          <div className={s.bar} key={x.code} style={{ gridTemplateColumns: "150px 1fr 64px" }}>
            <span className={s.barName}>{CANCEL_REASON[x.code]}</span>
            <div
              className={s.barTrack}
              style={{ width: `${((x.before + x.after) / maxReason) * 100}%` }}
            >
              <div style={{ background: "var(--orange)", flex: x.before }} />
              <div style={{ background: "var(--soft)", flex: x.after }} />
            </div>
            <span className={s.barN}>{x.before + x.after}</span>
          </div>
        ))}
      </div>
      <div className={s.legend} style={{ marginTop: 10 }}>
        <span>
          <i className={s.dot} style={{ background: "var(--orange)" }} /> Antes
          de cancelar
        </span>
        <span>
          <i className={s.dot} style={{ background: "var(--soft)" }} /> Después
        </span>
      </div>

      {rows.length ? (
        <>
          <p className={s.funnelTitle} style={{ marginTop: 22 }}>
            Las más recientes
          </p>
          <div className={s.bizList}>
            {rows.slice(0, 15).map((r) => {
              const o = cancelOutcome(r);
              return (
                <div className={s.biz} key={r.id}>
                  <div className={s.bizBody}>
                    <div className={s.bizName}>
                      {names.get(r.install_id) ?? "Sin nombre"} ·{" "}
                      {CANCEL_REASON[r.reason] ?? r.reason}
                    </div>
                    <div className={s.bizMeta}>
                      {productLabel(r.product_id)} ·{" "}
                      {r.moment === "before" ? "antes" : "después"} ·{" "}
                      {when(r.created_at)}
                      {r.detail ? <> · «{r.detail}»</> : null}
                    </div>
                  </div>
                  <div className={s.bizRight}>
                    <span className={toneStyle[o.tone]}>{o.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className={s.note} style={{ marginTop: 16 }}>
          Todavía no hay respuestas en los últimos 30 días.
        </p>
      )}
    </section>
  );
}

async function businessNames(
  supabase: ReturnType<typeof adminClient>,
  accounts: { key: string; installIds: string[] }[],
) {
  const names = new Map<string, string>();
  const installToKey = new Map<string, string>();
  for (const l of accounts)
    for (const i of l.installIds) installToKey.set(i, l.key);
  const installIds = [...installToKey.keys()];
  const bizByInstall = new Map<string, string>();
  for (let i = 0; i < installIds.length; i += 150) {
    const r = await supabase
      .from("business_devices")
      .select("install_id, business_id")
      .eq("role", "owner")
      .in("install_id", installIds.slice(i, i + 150));
    for (const d of (r.data ?? []) as {
      install_id: string;
      business_id: string;
    }[]) {
      bizByInstall.set(d.install_id, d.business_id);
    }
  }
  const bizIds = [...new Set(bizByInstall.values())];
  const bizName = new Map<string, string>();
  if (bizIds.length) {
    const r = await supabase
      .from("businesses")
      .select("id, name")
      .in("id", bizIds);
    for (const b of (r.data ?? []) as { id: string; name: string }[]) {
      bizName.set(b.id, b.name);
    }
  }
  for (const [install, biz] of bizByInstall) {
    const key = installToKey.get(install);
    const name = bizName.get(biz);
    if (key && name && !names.has(key)) names.set(key, name);
  }
  return names;
}

/// Desde este día (México) los nuevos suscriptores salen de la tienda: el
/// webhook de RevenueCat empezó la noche del 23 de octubre de 2026.
const STORE_SINCE = "2026-10-24";

/// Altas de la tienda desde [fromDay]: compras nuevas y pruebas que se
/// cobraron (RevenueCat, iPhone/Android) y suscripciones de Windows (Stripe).
async function storeNewSubs(
  supabase: ReturnType<typeof adminClient>,
  fromDay: string,
): Promise<NewSub[]> {
  const since = new Date(`${fromDay}T00:00:00-06:00`).toISOString();
  const out: NewSub[] = [];
  const [rc, st] = await Promise.all([
    fetchAll<StoreEvent>(
      supabase.from("revenuecat_events")
        .select("id, type, store, product_id, period_type, event_at, original_transaction_id, app_user_id, original_app_user_id, raw")
        .eq("environment", "PRODUCTION")
        .in("type", ["INITIAL_PURCHASE", "RENEWAL"])
        .gte("event_at", since)
        .order("event_at").order("id"),
    ),
    fetchAll<StripeSub>(
      supabase.from("subscriptions")
        .select("user_id, plan, subscribed_at")
        .gte("subscribed_at", fromDay)
        .order("user_id"),
    ),
  ]);
  for (const event of rc.data) {
    const sub = revenueCatSub(event);
    if (!sub) continue;
    const product = (event.product_id ?? "").split(":")[0];
    out.push({ ...sub, label: PRODUCT_LABEL[product] });
  }
  for (const row of st.data) {
    const sub = stripeSub(row);
    if (sub) out.push(sub);
  }
  return out;
}

function countSubs(list: NewSub[]): Count {
  const byPlatform: Record<string, number> = {};
  for (const p of PLATFORMS) byPlatform[p] = 0;
  for (const x of list) {
    if (x.platform) byPlatform[x.platform] = (byPlatform[x.platform] ?? 0) + 1;
  }
  return { total: list.length, byPlatform };
}

type CancelAnswer = {
  id: string;
  reason: string;
  detail: string | null;
  product: string;
  offerShown: boolean;
  offerAccepted: boolean;
  businessName: string | null;
  at: string;
};

const CANCEL_REASON: Record<string, string> = {
  too_expensive: "Por el precio",
  low_use: "Ya no la uso tanto",
  missing: "Me faltó una función",
  closed: "Cerré el negocio",
  other: "Otro",
};

async function churnDetails(
  supabase: ReturnType<typeof adminClient>,
  lost: LostAccount[],
) {
  const names = await businessNames(supabase, lost);

  // Avisos de RevenueCat. Antes de conectar el webhook la tabla no existe.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const ev = await supabase
    .from("revenuecat_events")
    .select(
      "id, type, app_user_id, product_id, store, cancel_reason, original_transaction_id, event_at, expiration_at, environment",
    )
    .in("type", ["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"])
    .gte("event_at", since)
    .order("event_at", { ascending: false })
    .limit(60);
  let events:
    | {
        id: string;
        who: string;
        businessName: string | null;
        product: string | null;
        store: string | null;
        what: string;
        tone: "bad" | "warn";
        when: string;
        expiresAt: string | null;
      }[]
    | null = null;
  if (!ev.error) {
    const rows = (
      (ev.data ?? []) as {
        id: string;
        type: string;
        app_user_id: string | null;
        product_id: string | null;
        store: string | null;
        cancel_reason: string | null;
        original_transaction_id: string | null;
        event_at: string | null;
        expiration_at: string | null;
        environment: string | null;
      }[]
    ).filter((e) => e.environment !== "SANDBOX");
    // Pro en iPhone: la llave de cobro del negocio lleva la transacción original.
    const keys = rows
      .map((e) => e.original_transaction_id)
      .filter((x): x is string => !!x)
      .map((id) => `apple:Production:${id}`);
    const proName = new Map<string, string>();
    if (keys.length) {
      const r = await supabase
        .from("businesses")
        .select("name, pro_billing_key")
        .in("pro_billing_key", keys);
      for (const b of (r.data ?? []) as {
        name: string;
        pro_billing_key: string;
      }[]) {
        proName.set(b.pro_billing_key.split(":")[2] ?? "", b.name);
      }
    }
    events = rows.map((e) => {
      const w = churnWhat(e.type, e.cancel_reason);
      return {
        id: e.id,
        who: (e.app_user_id ?? "").replace("orale_purchase_", "").slice(0, 8),
        businessName: e.original_transaction_id
          ? (proName.get(e.original_transaction_id) ?? null)
          : null,
        product: e.product_id,
        store: e.store,
        what: w.what,
        tone: w.tone,
        when: e.event_at
          ? new Date(e.event_at).toLocaleString("es-MX", {
              timeZone: "America/Mexico_City",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
        expiresAt: e.expiration_at,
      };
    });
  }
  // «¿Por qué te vas?» de la app. Antes del deploy la tabla no existe.
  const ans = await supabase
    .from("cancel_survey_answers")
    .select(
      "id, install_id, product_id, reason, detail, offer_shown, offer_accepted, created_at",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(80);
  let answers: CancelAnswer[] | null = null;
  if (!ans.error) {
    const rows = (ans.data ?? []) as {
      id: string;
      install_id: string;
      product_id: string;
      reason: string;
      detail: string | null;
      offer_shown: boolean;
      offer_accepted: boolean;
      created_at: string;
    }[];
    const biz = await businessNames(
      supabase,
      rows.map((r) => ({ key: r.install_id, installIds: [r.install_id] })),
    );
    answers = rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      detail: r.detail,
      product: r.product_id,
      offerShown: r.offer_shown,
      offerAccepted: r.offer_accepted,
      businessName: biz.get(r.install_id) ?? null,
      at: r.created_at,
    }));
  }
  return { names, events, answers };
}

function Ring({ value, goal }: { value: number; goal: number }) {
  const r = 90;
  const c = 2 * Math.PI * r;
  const share = Math.min(1, value / goal);
  return (
    <div className={s.ring}>
      <svg viewBox="0 0 210 210" width="210" height="210" aria-hidden>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f15a29" />
            <stop offset="100%" stopColor="#f5b942" />
          </linearGradient>
        </defs>
        <circle
          cx="105"
          cy="105"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="14"
        />
        <circle
          cx="105"
          cy="105"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${share * c} ${c}`}
          transform="rotate(-90 105 105)"
        />
      </svg>
      <div className={s.ringCenter}>
        <div className={s.ringValue}>{value.toLocaleString("es-MX")}</div>
        <div className={s.ringLabel}>
          de {goal.toLocaleString("es-MX")} · {pct(value, goal)}
        </div>
      </div>
    </div>
  );
}

function Legend({ subs = true }: { subs?: boolean }) {
  return (
    <div className={s.legend}>
      {PLATFORMS.map((p) => (
        <span key={p}>
          <span className={s.dot} style={{ background: PLATFORM_COLOR[p] }} />
          {PLATFORM_LABEL[p]}
        </span>
      ))}
      {subs ? (
        <span>
          <span className={s.dot} style={{ background: "var(--amber)" }} />
          Suscripciones
        </span>
      ) : null}
    </div>
  );
}

function Weeks({ weeks }: { weeks: WeekRow[] }) {
  const totals = weeks.map((w) =>
    Object.values(w.installs).reduce((a, b) => a + b, 0),
  );
  const max = Math.max(1, ...totals);
  return (
    <div className={s.weeks}>
      {weeks.map((w, i) => {
        const subs = Object.values(w.subs).reduce((a, b) => a + b, 0);
        return (
          <div className={s.week} key={w.week}>
            <span className={s.weekSubs}>{subs}</span>
            <span className={s.weekTotal}>{totals[i]}</span>
            <div
              className={s.stack}
              style={{ height: `${(totals[i] / max) * 140}px` }}
            >
              {PLATFORMS.map((p) => (
                <div
                  key={p}
                  style={{
                    background: PLATFORM_COLOR[p],
                    flex: w.installs[p] || 0,
                    opacity: i === weeks.length - 1 ? 0.55 : 0.9,
                  }}
                />
              ))}
            </div>
            <span className={s.weekLabel}>
              {i === weeks.length - 1
                ? "esta"
                : w.week.slice(5).replace("-", "/")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Versions({
  list,
}: {
  list: {
    version: string;
    total: number;
    byPlatform: Record<string, number>;
  }[];
}) {
  const max = Math.max(1, ...list.map((v) => v.total));
  return (
    <div className={s.bars}>
      {list.map((v) => (
        <div className={s.bar} key={v.version}>
          <span className={s.barName}>{v.version}</span>
          <div
            className={s.barTrack}
            style={{ width: `${(v.total / max) * 100}%` }}
          >
            {PLATFORMS.map((p) => (
              <div
                key={p}
                style={{
                  background: PLATFORM_COLOR[p],
                  flex: v.byPlatform[p] ?? 0,
                }}
              />
            ))}
          </div>
          <span className={s.barN}>{v.total}</span>
        </div>
      ))}
    </div>
  );
}

function Check({
  state,
  value,
  label,
}: {
  state: "ok" | "bad" | "idle";
  value: number | string;
  label: string;
}) {
  const light =
    state === "ok" ? s.lightOk : state === "bad" ? s.lightBad : s.lightIdle;
  return (
    <div className={s.check}>
      <span className={light} />
      <div>
        <div className={s.checkValue}>{value}</div>
        <div className={s.checkLabel}>{label}</div>
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

async function migrationHealth(supabase: ReturnType<typeof adminClient>) {
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [mm, active, parity, ops, v2] = await Promise.all([
    supabase.rpc("shared_order_lines_mismatches", { p_since: C2_SINCE }),
    fetchAll<{ business_id: string }>(
      supabase
        .from("shared_orders")
        .select("business_id")
        .gte("updated_at", since7)
        .order("id"),
    ),
    supabase.from("revenuecat_parity").select("outcome"),
    supabase.from("order_ops").select("op_id", { count: "exact", head: true }),
    // Existe desde el deploy de C4; antes la consulta falla y se muestra «—».
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("sync_v2", true),
  ]);
  const ids = [...new Set(active.data.map((r) => r.business_id))];
  const businesses = ids.length
    ? await supabase
        .from("businesses")
        .select("id, name, pro_verified_at, pro_billing_key, pro_paid_until")
        .in("id", ids)
    : { data: [] };
  type Row = {
    id: string;
    name: string;
    pro_verified_at: string | null;
    pro_billing_key: string | null;
    pro_paid_until: string | null;
  };
  const list = (businesses.data ?? []) as Row[];
  const verified = list.filter((b) => b.pro_verified_at).length;
  const ready = await c5Readiness(supabase, ids);
  // Puente: verificados a mano por un tiempo porque su caja no manda
  // comprobante (versión vieja o plan heredado). Cuentan como verificados
  // para el corte, pero se listan para no olvidarlos.
  const isBridge = (b: Row) =>
    (b.pro_billing_key ?? "").startsWith("manual:puente");
  const unv = list.filter((b) => !b.pro_verified_at || isBridge(b));
  const devs = unv.length
    ? await supabase
        .from("business_devices")
        .select("business_id, install_id, role")
        .in(
          "business_id",
          unv.map((b) => b.id),
        )
    : { data: [] };
  const devList = (devs.data ?? []) as {
    business_id: string;
    install_id: string | null;
    role: string;
  }[];
  const installIds = devList
    .map((d) => d.install_id)
    .filter((x): x is string => !!x);
  const usage = installIds.length
    ? await supabase
        .from("latest_usage")
        .select("install_id, platform, app_version, ping_date")
        .in("install_id", installIds)
    : { data: [] };
  const byInstall = new Map(
    (
      (usage.data ?? []) as {
        install_id: string;
        platform: string | null;
        app_version: string | null;
        ping_date: string;
      }[]
    ).map((u) => [u.install_id, u]),
  );
  const unverified: UnverifiedBiz[] = unv.map((b) => {
    const mine = devList.filter((d) => d.business_id === b.id);
    const cajaUsage = mine
      .filter((d) => d.role === "owner")
      .map((d) => (d.install_id ? byInstall.get(d.install_id) : undefined))
      .filter((u): u is NonNullable<typeof u> => !!u?.app_version)
      .sort((x, y) => y.ping_date.localeCompare(x.ping_date))[0];
    return {
      name: b.name,
      bridgeUntil:
        isBridge(b) && b.pro_paid_until ? b.pro_paid_until.slice(0, 10) : null,
      caja: cajaUsage
        ? {
            platform: cajaUsage.platform ?? "?",
            version: cajaUsage.app_version!,
            seen: cajaUsage.ping_date,
          }
        : null,
      waiters: mine
        .filter((d) => d.role !== "owner")
        .map((d) => (d.install_id ? byInstall.get(d.install_id) : undefined))
        .filter((u): u is NonNullable<typeof u> => !!u?.app_version)
        .map((u) => ({ version: u.app_version! })),
    };
  });
  const outcomes = (parity.data ?? []) as { outcome: string }[];
  const count = (o: string) => outcomes.filter((r) => r.outcome === o).length;
  return {
    mismatches: mm.error ? null : ((mm.data as unknown[] | null)?.length ?? 0),
    proWithOrders: list.length,
    proVerified: verified,
    proVerifiedPct: list.length ? (verified / list.length) * 100 : 100,
    unverified,
    ready,
    rcMatch: count("match"),
    rcBetter: count("rc_better"),
    rcErrors: count("rc_error"),
    // Cualquier otro resultado (p. ej. RevenueCat quitaría acceso) es alarma.
    rcRemoves: outcomes.filter(
      (r) => !["match", "rc_better", "rc_error"].includes(r.outcome),
    ).length,
    orderOps: ops.count ?? 0,
    syncV2: v2.error ? null : (v2.count ?? 0),
  };
}

/// «2026-10-15» → «15 oct».
type JourneyStep = {
  label: string;
  n: number;
  hint?: string;
  /** Necesita días: los que llegaron hace poco todavía no alcanzan. */
  later?: boolean;
};

/// El camino de un dueño nuevo: la bienvenida pantalla por pantalla, el
/// menú, la primera venta y, aparte, lo que necesita tiempo.
function journeySteps(list: Install[]): JourneyStep[] {
  const c = (f: (i: Install) => boolean) => list.filter(f).length;
  return [
    { label: "Abrieron la app", n: list.length },
    {
      label: "Pusieron el nombre del negocio",
      n: c((i) => (i.stage ?? 0) >= 2),
      hint: "pantalla 1",
    },
    {
      label: "Crearon su PIN",
      n: c((i) => (i.stage ?? 0) >= 6),
      hint: "pantallas 2 a 5",
    },
    {
      label: "Terminaron la bienvenida",
      n: c((i) => (i.stage ?? 0) >= 7),
    },
    {
      label: "Tienen menú",
      n: c((i) => i.products > 0),
      hint: "IA, a mano o ejemplo",
    },
    { label: "Primera venta", n: c((i) => i.orders > 0) },
    {
      label: `${FREE_ORDER_LIMIT} ventas`,
      n: c((i) => i.orders >= FREE_ORDER_LIMIT),
      hint: "aquí se les pide pagar",
      later: true,
    },
    { label: "Se suscribieron", n: c((i) => i.subscribed), later: true },
  ];
}

/// ¿Dónde se va la gente? De cada 100 que abren la app, cuántos llegan a
/// cada paso. En rojo, el paso donde se pierde más gente (de los que no
/// necesitan tiempo). Abajo, cómo hicieron su menú y cuántos vendieron.
function Journey({
  steps,
  paths,
  from,
  to,
}: {
  steps: JourneyStep[];
  paths: ReturnType<typeof menuPaths>;
  from: string;
  to: string;
}) {
  const top = Math.max(1, steps[0]?.n ?? 1);
  const per100 = (n: number) => Math.round((n / top) * 100);
  // Los dos pasos donde se pierde más gente (de cada 100), sin contar lo
  // que necesita días.
  const drops = steps
    .map((st, i) => ({
      i,
      lost: i > 0 && !st.later ? per100(steps[i - 1].n) - per100(st.n) : 0,
      ofArrived:
        i > 0 && steps[i - 1].n ? 1 - st.n / steps[i - 1].n : 0,
    }))
    // El primer paso no cuenta: quien se va sin poner ni el nombre del
    // negocio casi siempre solo estaba viendo (curiosos), no se atoró.
    .filter((d) => d.lost > 0 && d.i >= 2)
    .sort((a, b) => b.lost - a.lost)
    .slice(0, 1);
  const worstSet = new Set(drops.map((d) => d.i));
  const row = (st: JourneyStep, i: number) => {
    const bad = worstSet.has(i);
    // Lo que necesita días se compara contra todos los nuevos: «10 ventas» y
    // «se suscribieron» no son el mismo grupo (hay quien paga antes).
    const ofPrev = st.later
      ? st.n / top
      : i > 0 && steps[i - 1].n
        ? st.n / steps[i - 1].n
        : 1;
    const width = Math.max(6, per100(st.n));
    return (
      <div key={st.label} className={s.fRow}>
        <div className={s.fLabel}>
          <b>{st.label}</b>
          {st.hint ? <span>{st.hint}</span> : null}
        </div>
        <div className={s.fTrack}>
          <div
            className={st.later ? s.fBarLater : s.fBar}
            style={{
              width: `${width}%`,
              // Color sólido: más rojo mientras más gente se pierde en este
              // paso (la primera pantalla no cuenta: son curiosos).
              background: st.later
                ? undefined
                : `color-mix(in srgb, #dc2626 ${i >= 2 ? Math.min(100, Math.round((1 - ofPrev) * 200)) : 0}%, #fdba74)`,
            }}
          >
            {st.n.toLocaleString("es-MX")}
          </div>
        </div>
        <div className={bad ? s.fPctBad : s.fPct}>
          {i === 0 ? (
            <span className={s.fPctNote}>negocios nuevos</span>
          ) : (
            <>
              {Math.round(ofPrev * 100)}%
              <span className={s.fPctNote}>
                {i === 1
                  ? "siguió (el resto: curiosos)"
                  : st.later
                    ? "de todos los nuevos"
                    : "del paso anterior"}
              </span>
            </>
          )}
        </div>
      </div>
    );
  };
  const now = steps.filter((st) => !st.later);
  const later = steps.filter((st) => st.later);
  const shownPaths = paths.filter(
    (p) => p.label !== "Sin dato (no llegaron)" && p.n > 0,
  );
  return (
    <section className={s.card} id="cuello">
      <p className={s.eyebrow}>Negocios nuevos</p>
      <h2 className={s.h2}>¿Dónde se va la gente?</h2>
      <p className={s.note}>
        Negocios nuevos del {shortDay(from)} al {shortDay(to)} (app 3.0.93 o
        más nueva). El % es cuántos pasaron del paso anterior.
      </p>
      <div className={s.funnel}>
        {now.map((st, i) => row(st, i))}
        <p className={s.fDivider}>
          Necesitan unos días · los que llegaron hace poco todavía no alcanzan
        </p>
        {later.map((st) => row(st, steps.indexOf(st)))}
      </div>
      {shownPaths.length ? (
        <>
          <p className={s.funnelTitle} style={{ marginTop: 18 }}>
            ¿Cómo hicieron su menú?
          </p>
          <table className={s.mTable}>
            <thead>
              <tr>
                <th />
                <th>Negocios</th>
                <th>Tienen menú</th>
                <th>Ya vendieron</th>
                <th>Ya pagan</th>
              </tr>
            </thead>
            <tbody>
              {shownPaths.map((p) => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  <td>{p.n}</td>
                  <td>{pct(p.withMenu, p.n)}</td>
                  <td>
                    <b>{pct(p.sold, p.n)}</b>
                  </td>
                  <td>{pct(p.subscribed, p.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}

/// Mes en curso de [today] (México) y los mismos días del mes anterior.
function monthWindow(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const iso = (yy: number, mm: number, dd: number) =>
    `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const lastDay = (yy: number, mm: number) =>
    new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const name = (yy: number, mm: number) =>
    new Date(Date.UTC(yy, mm - 1, 15)).toLocaleDateString("es-MX", {
      month: "long",
      timeZone: "UTC",
    });
  return {
    start: iso(y, m, 1),
    end: iso(y, m, lastDay(y, m)),
    prevStart: iso(py, pm, 1),
    prevTo: iso(py, pm, Math.min(d, lastDay(py, pm))),
    name: name(y, m),
    prevName: name(py, pm),
  };
}

function shortDay(day: string) {
  const months = "ene feb mar abr may jun jul ago sep oct nov dic".split(" ");
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${months[m - 1]}`;
}

/// Separa una lista larga para no armar URLs gigantes en los filtros `in`.
function chunks<T>(list: T[], size = 150): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/// Cuántos negocios Pro activos tienen TODOS sus aparatos (vistos en 14
/// días) en la versión con el sync nuevo, y cuántos aparatos por plataforma.
async function c5Readiness(
  supabase: ReturnType<typeof adminClient>,
  businessIds: string[],
) {
  const devices: { business_id: string; install_id: string | null }[] = [];
  for (const part of chunks(businessIds)) {
    const r = await supabase
      .from("business_devices")
      .select("business_id, install_id")
      .in("business_id", part);
    devices.push(...((r.data ?? []) as typeof devices));
  }
  const installIds = [
    ...new Set(
      devices.map((d) => d.install_id).filter((x): x is string => !!x),
    ),
  ];
  const usage = new Map<
    string,
    { platform: string | null; app_version: string | null; ping_date: string }
  >();
  for (const part of chunks(installIds)) {
    const r = await supabase
      .from("latest_usage")
      .select("install_id, platform, app_version, ping_date")
      .in("install_id", part);
    for (const u of (r.data ?? []) as {
      install_id: string;
      platform: string | null;
      app_version: string | null;
      ping_date: string;
    }[]) {
      usage.set(u.install_id, u);
    }
  }
  const since = mxDay(14);
  const byPlatform: Record<string, { on: number; total: number }> = {};
  const counted = new Set<string>();
  const perBiz = new Map<string, { active: number; on: number }>();
  for (const d of devices) {
    const u = d.install_id ? usage.get(d.install_id) : undefined;
    if (!u || u.ping_date < since || !u.app_version) continue;
    const on = cmpVersion(u.app_version, C4_APP) >= 0;
    const b = perBiz.get(d.business_id) ?? { active: 0, on: 0 };
    b.active++;
    if (on) b.on++;
    perBiz.set(d.business_id, b);
    if (counted.has(d.install_id!)) continue;
    counted.add(d.install_id!);
    const p = u.platform ?? "?";
    byPlatform[p] ??= { on: 0, total: 0 };
    byPlatform[p].total++;
    if (on) byPlatform[p].on++;
  }
  const businesses = [...perBiz.values()].filter(
    (b) => b.active > 0 && b.on === b.active,
  ).length;
  return { businesses, byPlatform };
}
