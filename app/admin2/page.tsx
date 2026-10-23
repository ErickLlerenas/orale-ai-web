import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { adminClient, fetchAll } from "@/lib/supabase";
import {
  PING_COLUMNS,
  PLATFORMS,
  activationFunnel,
  baseOf,
  avgWeeklySubs,
  menuPaths,
  mxDay,
  newOwners,
  onboardingFunnel,
  pct,
  revenueCatOverview,
  toInstalls,
  versions,
  weekly,
  worstDrop,
  type PingRow,
  type Step,
  type WeekRow,
} from "@/lib/admin2";
import s from "./admin2.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GOAL = 1000;
/// Desde cuándo corre la tabla de líneas en sombra (C2) en prod.
const C2_SINCE = "2026-10-14T05:39:28Z";
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
  const weeksLeft =
    perWeek > 0 ? Math.ceil(Math.max(0, GOAL - active) / perWeek) : null;

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

        {pingsRes.error ? (
          <div className={s.error}>
            No se pudo leer usage_pings: {pingsRes.error.message}
          </div>
        ) : null}

        {/* 1. Meta y suscripciones */}
        <section className={`${s.card} ${s.hero}`}>
          <div className={s.goal}>
            <p className={s.eyebrow}>Meta</p>
            <Ring value={active} goal={GOAL} />
            <div className={s.goalLine}>
              Faltan{" "}
              <strong>
                {Math.max(0, GOAL - active).toLocaleString("es-MX")}
              </strong>
              {weeksLeft != null ? (
                <>
                  {" "}
                  · a <strong>{perWeek.toFixed(0)}</strong> nuevas por semana,
                  unas <strong>{weeksLeft}</strong> semanas
                </>
              ) : null}
            </div>
            <p className={s.note}>
              El ritmo sale de las últimas 4 semanas y no resta cancelaciones.
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
            {rc.ok ? null : (
              <div className={s.warn}>
                Sin RevenueCat: {rc.reason} Con la llave aquí salen activas,
                pruebas, MRR e ingresos reales.
              </div>
            )}
          </div>
        </section>

        {/* 2. Dónde se va la gente */}
        <section className={s.card}>
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
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <p className={s.eyebrow}>Migración</p>
              <h2 className={s.h2}>
                {health.mismatches === 0 &&
                health.proVerifiedPct >= 90 &&
                health.rcRemoves === 0
                  ? "Todo en verde"
                  : "Hay algo que revisar"}
              </h2>
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
            <div className={s.unverified}>
              <span className={s.note} style={{ margin: 0 }}>
                Sin verificar:
              </span>
              {health.unverified.map((n) => (
                <span className={s.chip} key={n}>
                  {n}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
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

function Legend() {
  return (
    <div className={s.legend}>
      {PLATFORMS.map((p) => (
        <span key={p}>
          <span className={s.dot} style={{ background: PLATFORM_COLOR[p] }} />
          {PLATFORM_LABEL[p]}
        </span>
      ))}
      <span>
        <span className={s.dot} style={{ background: "var(--amber)" }} />
        Suscripciones
      </span>
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
  const outcomes = (parity.data ?? []) as { outcome: string }[];
  const count = (o: string) => outcomes.filter((r) => r.outcome === o).length;
  return {
    mismatches: mm.error ? null : ((mm.data as unknown[] | null)?.length ?? 0),
    proWithOrders: list.length,
    proVerified: verified,
    proVerifiedPct: list.length ? (verified / list.length) * 100 : 100,
    unverified: list.filter((b) => !b.pro_verified_at).map((b) => b.name),
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
