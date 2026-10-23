import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { adminClient, fetchAll } from "@/lib/supabase";
import {
  PING_COLUMNS,
  PLATFORMS,
  activationFunnel,
  activeSeries,
  baseOf,
  dayPulse,
  downloadsByPlatform,
  downloadsDaily,
  firstSubscriptions,
  platformConversion,
  cmpVersion,
  newestVersion,
  avgWeeklySubs,
  menuPaths,
  mxDay,
  newOwners,
  onboardingFunnel,
  pct,
  planMix,
  retention,
  revenueCatOverview,
  toInstalls,
  versions,
  weekly,
  worstDrop,
  type Count,
  type DayRow,
  type PingRow,
  type RetRow,
  type Step,
  type WeekRow,
} from "@/lib/admin2";
import s from "./admin2.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GOAL = 1000;
/// Desde cuándo corre la tabla de líneas en sombra (C2) en prod.
const C2_SINCE = "2026-10-14T05:39:28Z";
/// Primera versión de la app con el sync nuevo (C4). C5 solo se prende en
/// negocios donde todos sus aparatos ya la tienen.
const C4_APP = "3.0.96";
/// Corte de los pagos viejos (decidido el 28 oct; regla: 90% verificados).
const LEGACY_CUTOFF = "2026-11-04";
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
  revenue: "Ingresos últimos 28 días",
  new_customers: "Clientes nuevos (28 días)",
};
const RC_ORDER = Object.keys(RC_LABEL);

export default async function Admin2({
  searchParams,
}: {
  searchParams: { days?: string; platform?: string };
}) {
  noStore();
  const days = searchParams.days === "30" ? 30 : 7;
  const platform = PLATFORMS.includes(searchParams.platform as never)
    ? (searchParams.platform as string)
    : "todas";
  const today = mxDay(0);
  // Hoy no cuenta: los aparatos de hoy todavía no tuvieron tiempo de avanzar.
  const from = mxDay(days);
  const to = mxDay(1);

  const supabase = adminClient();
  const [pingsRes, rc, health] = await Promise.all([
    fetchAll<PingRow>(
      supabase
        .from("usage_pings")
        .select(PING_COLUMNS)
        .order("ping_date")
        .order("install_id"),
    ),
    revenueCatOverview(),
    migrationHealth(supabase),
  ]);
  const rows = pingsRes.data;
  const installs = toInstalls(rows);
  const cohortAll = newOwners(installs, from, to);
  const cohort =
    platform === "todas"
      ? cohortAll
      : cohortAll.filter((i) => i.platform === platform);
  const onboarding = onboardingFunnel(cohort);
  const activation = activationFunnel(cohort);
  const paths = menuPaths(cohort);
  const weeks = weekly(installs, rows, 8, today);
  const vers = versions(rows, mxDay(7));
  const worst = worstDrop(onboarding) ?? worstDrop(activation);
  const newest = newestVersion(rows, mxDay(7));

  // Hoy y ayer.
  const subsList = firstSubscriptions(rows);
  const pulse = {
    today: dayPulse(rows, installs, subsList, today),
    yesterday: dayPulse(rows, installs, subsList, mxDay(1)),
  };
  // Descargas: 30 días contra los 30 anteriores.
  const dlDays = downloadsDaily(installs, mxDay(29), today);
  const dlNow = downloadsByPlatform(installs, mxDay(29), today);
  const dlPrev = downloadsByPlatform(installs, mxDay(59), mxDay(30));
  const dlTotal = dlNow.reduce((a, p) => a + p.total, 0);
  const dlPrevTotal = dlPrev.reduce((a, p) => a + p.total, 0);
  // Embudo por plataforma: 30 días para que alcancen a pagar.
  const conv = platformConversion(newOwners(installs, mxDay(30), mxDay(1)));
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
  const netPerWeek =
    (series[series.length - 1].n - series[0].n) / (series.length - 1);
  // Mismo periodo para entradas y neto, si no las salidas salen chuecas.
  const inPerWeek = avgWeeklySubs(weeks, 7);
  const leavingPerWeek = Math.max(0, inPerWeek - netPerWeek);
  const weeksLeft =
    netPerWeek > 0 ? Math.ceil(Math.max(0, GOAL - active) / netPerWeek) : null;

  const href = (q: Record<string, string>) =>
    `/admin2?${new URLSearchParams({ days: String(days), platform, ...q })}`;
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
          <nav className={s.topLinks}>
            <Link href="/admin">Panel de siempre</Link>
          </nav>
        </header>

        <nav className={s.jump}>
          {[
            ["hoy", "Hoy"],
            ["meta", "Meta"],
            ["descargas", "Descargas"],
            ["cuello", "Cuello de botella"],
            ["plataformas", "Plataformas"],
            ["retencion", "Quién se queda"],
            ["migracion", "Migración"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>

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
            hint="según la app"
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
                neto
              </span>
              <span className={s.flowUnit}>por semana</span>
            </div>
            <Sparkline points={series} />
            <p className={s.note}>
              Activas según la app al cierre de cada semana (8 semanas). Ya
              resta cancelaciones y pruebas que no pagaron.
            </p>
          </div>
          <div>
            <p className={s.eyebrow}>Suscripciones</p>
            <h2 className={s.h2}>
              {rc.ok ? "Según RevenueCat" : "Según la app"}
              {rc.ok ? null : <span className={s.badge}>aproximado</span>}
            </h2>
            <div className={s.tiles} style={{ marginTop: 14 }}>
              {rc.ok ? (
                RC_ORDER.map((id) => metric(id))
                  .filter((m): m is NonNullable<typeof m> => !!m)
                  .map((m) => ({
                    key: m.id,
                    value: formatMetric(m.value, m.unit),
                    label: RC_LABEL[m.id] ?? m.name,
                  }))
                  .concat(derivedTiles(metric("mrr"), active, perWeek))
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
              <p className={s.eyebrow}>Descargas · últimos 30 días</p>
              <h2 className={s.h2}>
                {dlTotal.toLocaleString("es-MX")}{" "}
                <Delta now={dlTotal} before={dlPrevTotal} />
              </h2>
              <p className={s.note}>
                Aparatos nuevos (dueños y meseros), sin cambios de aparato.
                Comparado con los 30 días anteriores.
              </p>
            </div>
            <Legend subs={false} />
          </div>
          <div className={s.platTiles}>
            {dlNow.map((p, i) => {
              const c = conv.find((x) => x.platform === p.platform)!;
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
                  <div className={s.platPay}>
                    <strong>{pct(c.paid, c.n)}</strong> de los negocios nuevos
                    pagan
                  </div>
                </div>
              );
            })}
          </div>
          <DailyBars days={dlDays} today={today} />
        </section>

        {/* 2. Dónde se va la gente */}
        <section className={s.card} id="cuello">
          <div className={s.cardHead}>
            <div>
              <p className={s.eyebrow}>Negocios nuevos</p>
              <h2 className={s.h2}>¿Dónde se va la gente?</h2>
              <p className={s.note}>
                {cohort.length} dueños abrieron la app por primera vez del{" "}
                {shortDay(from)} al {shortDay(to)}. Sin meseros ni cambios de
                aparato.
              </p>
            </div>
            <div className={s.pills}>
              <Pill on={days === 7} href={href({ days: "7" })}>
                7 días
              </Pill>
              <Pill on={days === 30} href={href({ days: "30" })}>
                30 días
              </Pill>
              <span className={s.pillGap} />
              {["todas", ...PLATFORMS].map((p) => (
                <Pill key={p} on={platform === p} href={href({ platform: p })}>
                  {p === "todas" ? "Todas" : PLATFORM_LABEL[p]}
                </Pill>
              ))}
            </div>
          </div>

          {worst ? (
            <div className={s.callout}>
              <div className={s.calloutBig}>
                −{Math.round(worst.lostPct * 100)}%
              </div>
              <div className={s.calloutText}>
                Cuello de botella: de «{worst.from.label}» a «{worst.to.label}»
                <span>
                  Se van {worst.lost} de {worst.from.n}. Arreglar este paso es
                  lo que más suscripciones mueve.
                </span>
              </div>
            </div>
          ) : null}

          <div className={s.funnels}>
            <div>
              <p className={s.funnelTitle}>
                Bienvenida · pantalla por pantalla (3.0.89+)
              </p>
              <Funnel steps={onboarding} />
            </div>
            <div>
              <p className={s.funnelTitle}>Activación · todas las versiones</p>
              <Funnel steps={activation} />
            </div>
          </div>

          <div className={s.paths}>
            {paths
              .filter((p) => p.label !== "Sin dato (no llegaron)")
              .map((p) => (
                <div className={s.path} key={p.label}>
                  <div className={s.pathTop}>
                    <span>{p.label}</span>
                    <span className={s.pathN}>{p.n}</span>
                  </div>
                  <div className={s.pathBig}>{pct(p.sold, p.n)}</div>
                  <div className={s.pathSub}>
                    vendieron · {pct(p.withMenu, p.n)} tienen menú ·{" "}
                    {pct(p.subscribed, p.n)} pagaron
                  </div>
                </div>
              ))}
          </div>
        </section>

        {/* 2b. Por plataforma */}
        <section className={s.card} id="plataformas">
          <div className={s.cardHead}>
            <div>
              <p className={s.eyebrow}>Negocios nuevos · últimos 30 días</p>
              <h2 className={s.h2}>¿Qué plataforma convierte mejor?</h2>
              <p className={s.note}>
                De cada 100 dueños nuevos, cuántos llegan a cada paso. Entre más
                intenso el color, mejor.
              </p>
            </div>
          </div>
          <HeatTable rows={conv} />
        </section>

        {/* 2c. Quién se queda */}
        <section className={s.card} id="retencion">
          <div className={s.cardHead}>
            <div>
              <p className={s.eyebrow}>Retención</p>
              <h2 className={s.h2}>¿Quién se queda?</h2>
              <p className={s.note}>
                Cuentas que pagaban del {shortDay(mxDay(56))} al{" "}
                {shortDay(mxDay(43))} ({ret.total.n}) y si siguen usando la app
                con su plan desde el {shortDay(mxDay(9))}. «Se fue» = dejó de
                abrirla con plan; casi siempre termina en cancelación.
              </p>
            </div>
            <div className={s.retTotal}>
              <span className={s.retTotalN}>
                {pct(ret.total.gone, ret.total.n)}
              </span>
              <span className={s.retTotalL}>se fue en 6 semanas</span>
            </div>
          </div>
          <div className={s.retGrid}>
            {ret.groups.map((g) => (
              <RetGroup
                key={g.title}
                title={g.title}
                rows={g.rows}
                avg={ret.total.gone / Math.max(1, ret.total.n)}
              />
            ))}
          </div>
        </section>

        {/* 3. Semanas y versiones */}
        <div className={s.split}>
          <section className={s.card}>
            <div className={s.cardHead}>
              <div>
                <p className={s.eyebrow}>Semana a semana</p>
                <h2 className={s.h2}>Negocios nuevos y suscripciones</h2>
              </div>
              <Legend />
            </div>
            <Weeks weeks={weeks} />
            <p className={s.note}>
              Barras: negocios nuevos por plataforma. Arriba, en amarillo:
              primeras suscripciones según la app (una por cuenta de tienda).
            </p>
          </section>

          <section className={s.card}>
            <div className={s.cardHead}>
              <div>
                <p className={s.eyebrow}>Últimos 7 días</p>
                <h2 className={s.h2}>Versiones en uso</h2>
              </div>
            </div>
            <Versions list={vers} />
          </section>
        </div>

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
                Todos sus aparatos activos (14 días) ya tienen {C4_APP} o más.
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
                <span> {cutoffDays === 1 ? "día" : "días"} · 4 nov</span>
              </div>
              <p className={s.note} style={{ margin: "4px 0 12px" }}>
                Regla: se mantiene si 90% o más de los Pro están verificados.
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
              label="Diferencias en la tabla de líneas (C2). Debe ser 0."
            />
            <Check
              state={health.proVerifiedPct >= 90 ? "ok" : "bad"}
              value={pct(health.proVerified, health.proWithOrders)}
              label={`Pro verificados: ${health.proVerified} de ${health.proWithOrders} con comandas en 7 días. Regla: 90%.`}
            />
            <Check
              state={health.rcRemoves === 0 ? "ok" : "bad"}
              value={health.rcRemoves}
              label={`Casos donde RevenueCat quitaría acceso. ${health.rcMatch} coinciden, ${health.rcBetter} da más, ${health.rcErrors} errores.`}
            />
            <Check
              state={health.syncV2 ? "ok" : "idle"}
              value={health.syncV2 ?? "—"}
              label={`Negocios con el sync nuevo (C5) · ${health.orderOps.toLocaleString("es-MX")} acciones por order-ops.`}
            />
          </div>
          {health.unverified.length > 0 ? (
            <>
              <p className={s.funnelTitle} style={{ marginTop: 22 }}>
                Pro sin verificar · {health.unverified.length}
              </p>
              <p className={s.note} style={{ marginTop: -4, marginBottom: 10 }}>
                Versión de la caja. Verde: la más nueva ({newest ?? "—"}). Gris:
                reciente. Amarillo: vieja. Rojo: muy vieja, pídeles actualizar.
              </p>
              <div className={s.bizList}>
                {health.unverified.map((b) => (
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
  const avg =
    days.slice(0, -1).reduce((a, d) => a + d.total, 0) /
    Math.max(1, days.length - 1);
  return (
    <div className={s.daysWrap}>
      <div
        className={s.avgLine}
        style={{ bottom: `${22 + (avg / max) * 150}px` }}
      >
        <span>promedio {avg.toFixed(0)}/día</span>
      </div>
      <div className={s.days}>
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

function HeatTable({
  rows,
}: {
  rows: {
    platform: string;
    n: number;
    menu: number;
    sold: number;
    limit: number;
    paid: number;
  }[];
}) {
  const cols = [
    { key: "menu", label: "Hicieron menú" },
    { key: "sold", label: "Vendieron" },
    { key: "limit", label: `Llegaron a 10 ventas` },
    { key: "paid", label: "Pagaron" },
  ] as const;
  // Cada columna se colorea contra su mejor plataforma.
  const best = Object.fromEntries(
    cols.map((c) => [
      c.key,
      Math.max(0.0001, ...rows.map((r) => (r.n ? r[c.key] / r.n : 0))),
    ]),
  );
  return (
    <div className={s.heat}>
      <div className={s.heatHead}>
        <span>Plataforma</span>
        <span>Nuevos</span>
        {cols.map((c) => (
          <span key={c.key}>{c.label}</span>
        ))}
      </div>
      {rows.map((r) => (
        <div className={s.heatRow} key={r.platform}>
          <span className={s.heatName}>
            <span
              className={s.dot}
              style={{ background: PLATFORM_COLOR[r.platform] }}
            />
            {PLATFORM_LABEL[r.platform]}
          </span>
          <span className={s.heatN}>{r.n}</span>
          {cols.map((c) => {
            const share = r.n ? r[c.key] / r.n : 0;
            const strength = share / best[c.key];
            return (
              <span
                key={c.key}
                className={s.heatCell}
                style={{
                  background: `rgba(241, 90, 41, ${0.08 + strength * 0.5})`,
                  borderColor:
                    strength === 1 ? "var(--orange-2)" : "transparent",
                }}
                title={`${r[c.key]} de ${r.n}`}
              >
                <strong>{pct(r[c.key], r.n)}</strong>
                <small>{r[c.key]}</small>
              </span>
            );
          })}
        </div>
      ))}
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

/// Una barra por grupo: verde lo que se queda, rojo lo que se va. La raya
/// marca el promedio para ver de un vistazo quién está mejor o peor.
function RetGroup({
  title,
  rows,
  avg,
}: {
  title: string;
  rows: RetRow[];
  avg: number;
}) {
  return (
    <div className={s.retCard}>
      <p className={s.funnelTitle}>{title}</p>
      {rows.map((r) => {
        const gone = r.n ? r.gone / r.n : 0;
        const tone =
          gone <= avg * 0.6
            ? s.retGood
            : gone >= avg * 1.3
              ? s.retBad
              : s.retMid;
        return (
          <div className={s.retRow} key={r.label}>
            <div className={s.retLabel}>
              <span>{r.label}</span>
              <small>{r.n}</small>
            </div>
            <div className={s.retTrack}>
              <div className={s.retStay} style={{ flex: r.n - r.gone }} />
              <div className={s.retGone} style={{ flex: r.gone }} />
              <div className={s.retAvg} style={{ right: `${avg * 100}%` }} />
            </div>
            <span className={tone}>{pct(r.gone, r.n)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Pill({
  on,
  href,
  children,
}: {
  on: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className={on ? s.pillOn : s.pill} href={href}>
      {children}
    </Link>
  );
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

function Funnel({ steps }: { steps: Step[] }) {
  const top = Math.max(1, steps[0]?.n ?? 1);
  const worst = worstDrop(steps);
  return (
    <div className={s.steps}>
      {steps.map((step, i) => {
        const prev = i === 0 ? step.n : baseOf(steps, i).n;
        const kept = prev ? step.n / prev : 0;
        const isWorst = worst?.to === step;
        const firstAfter = step.after && !steps[i - 1]?.after;
        return (
          <div key={step.label}>
            {firstAfter ? (
              <p className={s.afterLabel}>
                De los {baseOf(steps, i).n} que vendieron (una semana es poco
                para pagar; mira 30 días)
              </p>
            ) : null}
            <div className={s.step}>
              <div className={s.track}>
                <div
                  className={isWorst ? s.fillWorst : s.fill}
                  style={{ width: `${Math.max(3, (step.n / top) * 100)}%` }}
                />
                <div className={s.stepText}>
                  <span className={s.stepN}>{step.n}</span>
                  <span>{step.label}</span>
                  {step.hint ? (
                    <span className={s.stepHint}>{step.hint}</span>
                  ) : null}
                </div>
              </div>
              {i === 0 ? (
                <span className={s.conv}>100%</span>
              ) : (
                <span
                  className={
                    step.after
                      ? s.conv
                      : isWorst || kept < 0.6
                        ? s.convBad
                        : kept >= 0.85
                          ? s.convGood
                          : s.conv
                  }
                >
                  {pct(step.n, prev)}
                </span>
              )}
            </div>
          </div>
        );
      })}
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
        .select("id, name, pro_verified_at")
        .in("id", ids)
    : {
        data: [] as {
          id: string;
          name: string;
          pro_verified_at: string | null;
        }[],
      };
  const list = (businesses.data ?? []) as {
    id: string;
    name: string;
    pro_verified_at: string | null;
  }[];
  const verified = list.filter((b) => b.pro_verified_at).length;
  const ready = await c5Readiness(supabase, ids);
  const unv = list.filter((b) => !b.pro_verified_at);
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
function shortDay(day: string) {
  const months = "ene feb mar abr may jun jul ago sep oct nov dic".split(" ");
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${months[m - 1]}`;
}

/// Lo que se puede sacar de RevenueCat sin pedirle más: cuánto deja cada
/// suscriptor y cuánto sería el MRR al llegar a la meta.
function derivedTiles(
  mrr: { value: number; unit?: string } | undefined,
  active: number,
  perWeek: number,
) {
  const tiles = [
    {
      key: "per_week",
      value: perWeek.toFixed(0),
      label: "Nuevas por semana (app, 4 sem.)",
    },
  ];
  if (mrr && active > 0) {
    const each = mrr.value / active;
    tiles.push(
      {
        key: "arpu",
        value: formatMetric(each, mrr.unit, 2),
        label: "Deja cada suscriptor al mes",
      },
      {
        key: "mrr_goal",
        value: formatMetric(each * GOAL, mrr.unit),
        label: `MRR al llegar a ${GOAL.toLocaleString("es-MX")}`,
      },
    );
  }
  return tiles;
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
