import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { adminClient, fetchAll } from "@/lib/supabase";
import {
  PING_COLUMNS,
  PLATFORMS,
  activationFunnel,
  menuPaths,
  mxDay,
  newOwners,
  onboardingFunnel,
  pct,
  revenueCatOverview,
  toInstalls,
  versions,
  weekly,
  type PingRow,
  type Step,
} from "@/lib/admin2";

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
  // Se excluye hoy: los aparatos de hoy todavía no tuvieron tiempo de avanzar.
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

  const metric = (id: string) =>
    rc.ok ? rc.metrics.find((m) => m.id === id)?.value : undefined;
  const activeSubs = metric("active_subscriptions");

  const href = (q: Record<string, string>) => {
    const p = new URLSearchParams({
      days: String(days),
      platform,
      ...q,
    });
    return `/admin2?${p.toString()}`;
  };

  return (
    <main className="admin">
      <header className="admin-header">
        <div>
          <h1>Panel 2 · Órale AI</h1>
          <p className="muted">
            Pagos desde RevenueCat · embudos de negocios nuevos · migración
          </p>
        </div>
        <Link href="/admin" className="muted">
          ← Panel de siempre
        </Link>
      </header>

      {pingsRes.error ? (
        <p className="panel">Error leyendo usage_pings: {pingsRes.error.message}</p>
      ) : null}

      {/* 1. Suscripciones reales */}
      <section className="panel">
        <h2>Suscripciones (RevenueCat)</h2>
        {rc.ok ? (
          <>
            <div className="kpis">
              {rc.metrics.map((m) => (
                <div className="kpi" key={m.id}>
                  <div className="v">{formatMetric(m.value, m.unit)}</div>
                  <div className="l">{m.name}</div>
                </div>
              ))}
            </div>
            {activeSubs != null ? (
              <Goal value={activeSubs} goal={GOAL} />
            ) : null}
          </>
        ) : (
          <p className="muted">
            Sin datos de RevenueCat: {rc.reason} Mientras tanto, las cifras de
            suscripción de abajo vienen de la app y son aproximadas.
          </p>
        )}
      </section>

      {/* 2. Embudos */}
      <section className="panel">
        <div className="admin2-row">
          <h2>Negocios nuevos · últimos {days} días</h2>
          <nav className="admin2-tabs">
            <Link className={days === 7 ? "on" : ""} href={href({ days: "7" })}>
              7 días
            </Link>
            <Link className={days === 30 ? "on" : ""} href={href({ days: "30" })}>
              30 días
            </Link>
            <span className="admin2-sep" />
            {["todas", ...PLATFORMS].map((p) => (
              <Link
                key={p}
                className={platform === p ? "on" : ""}
                href={href({ platform: p })}
              >
                {p === "todas" ? "Todas" : PLATFORM_LABEL[p]}
              </Link>
            ))}
          </nav>
        </div>
        <p className="muted">
          Solo dueños que abrieron la app por primera vez del {from} al {to}:
          sin meseros ni cambios de aparato. Hoy no cuenta todavía.
        </p>
        <div className="admin2-cols">
          <div>
            <h3>Bienvenida (app 3.0.89+)</h3>
            <Funnel steps={onboarding} />
          </div>
          <div>
            <h3>Activación (todas las versiones)</h3>
            <Funnel steps={activation} />
          </div>
        </div>
        <h3>Cómo armaron el menú</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Camino</th>
              <th>Negocios</th>
              <th>Con menú</th>
              <th>Vendieron</th>
              <th>Suscritos</th>
            </tr>
          </thead>
          <tbody>
            {paths.map((p) => (
              <tr key={p.label}>
                <td>{p.label}</td>
                <td>{p.n}</td>
                <td>
                  {p.withMenu} <span className="muted">{pct(p.withMenu, p.n)}</span>
                </td>
                <td>
                  {p.sold} <span className="muted">{pct(p.sold, p.n)}</span>
                </td>
                <td>
                  {p.subscribed}{" "}
                  <span className="muted">{pct(p.subscribed, p.n)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 3. Instalaciones y versiones */}
      <section className="panel">
        <h2>Por semana</h2>
        <p className="muted">
          Negocios nuevos (dueños, sin cambios de aparato) y primeras
          suscripciones según la app: una por cuenta de tienda.
        </p>
        <table className="data">
          <thead>
            <tr>
              <th>Semana (lunes)</th>
              {PLATFORMS.map((p) => (
                <th key={`i-${p}`}>Nuevos {PLATFORM_LABEL[p]}</th>
              ))}
              {PLATFORMS.map((p) => (
                <th key={`s-${p}`}>Subs {PLATFORM_LABEL[p]}</th>
              ))}
              <th>Conversión</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => {
              const inst = Object.values(w.installs).reduce((a, b) => a + b, 0);
              const subs = Object.values(w.subs).reduce((a, b) => a + b, 0);
              return (
                <tr key={w.week}>
                  <td>{w.week}</td>
                  {PLATFORMS.map((p) => (
                    <td key={`i-${p}`}>{w.installs[p]}</td>
                  ))}
                  {PLATFORMS.map((p) => (
                    <td key={`s-${p}`}>{w.subs[p]}</td>
                  ))}
                  <td>{pct(subs, inst)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3>Versiones en uso (últimos 7 días)</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Versión</th>
              <th>Aparatos</th>
              {PLATFORMS.map((p) => (
                <th key={p}>{PLATFORM_LABEL[p]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vers.map((v) => (
              <tr key={v.version}>
                <td>{v.version}</td>
                <td>{v.total}</td>
                {PLATFORMS.map((p) => (
                  <td key={p}>{v.byPlatform[p] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 4. Migración */}
      <section className="panel">
        <h2>Salud de la migración</h2>
        <div className="kpis">
          <Health
            ok={health.mismatches === 0}
            value={health.mismatches ?? "—"}
            label="Diferencias en la tabla de líneas (C2, debe ser 0)"
          />
          <Health
            ok={health.proVerifiedPct >= 90}
            value={`${health.proVerified} / ${health.proWithOrders}`}
            label={`Pro verificados con comandas en 7 días (${pct(health.proVerified, health.proWithOrders)}, regla: 90%)`}
          />
          <Health
            ok={health.rcRemoves === 0}
            value={health.rcMatch}
            label={`Coinciden con RevenueCat · ${health.rcBetter} RC da más · ${health.rcErrors} errores`}
          />
          <Health
            ok
            value={health.syncV2 ?? "—"}
            label="Negocios con el sync nuevo (C5)"
          />
          <Health ok value={health.orderOps} label="Acciones por order-ops" />
        </div>
        {health.unverified.length > 0 ? (
          <p className="muted">
            Sin verificar: {health.unverified.join(", ")}
          </p>
        ) : null}
      </section>
    </main>
  );
}

function Funnel({ steps }: { steps: Step[] }) {
  const top = Math.max(1, steps[0]?.n ?? 1);
  return (
    <div className="admin2-funnel">
      {steps.map((s, i) => {
        const prev = i === 0 ? s.n : steps[i - 1].n;
        const lost = prev - s.n;
        return (
          <div key={s.label} className="admin2-step">
            <div className="admin2-bar" style={{ width: `${Math.max(4, (s.n / top) * 100)}%` }} />
            <div className="admin2-step-text">
              <strong>{s.n}</strong> {s.label}
              {s.hint ? <span className="muted"> · {s.hint}</span> : null}
              {i > 0 ? (
                <span className={lost / Math.max(1, prev) >= 0.3 ? "admin2-lost big" : "admin2-lost"}>
                  {pct(s.n, prev)} pasa · se van {lost}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Goal({ value, goal }: { value: number; goal: number }) {
  return (
    <div className="admin2-goal">
      <div className="admin2-goal-bar">
        <div style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} />
      </div>
      <span className="muted">
        {value} de {goal.toLocaleString("es-MX")} suscripciones activas (
        {pct(value, goal)})
      </span>
    </div>
  );
}

function Health({
  ok,
  value,
  label,
}: {
  ok: boolean;
  value: number | string;
  label: string;
}) {
  return (
    <div className={`kpi admin2-health ${ok ? "ok" : "bad"}`}>
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}

function formatMetric(value: number, unit?: string) {
  if (unit === "$" || unit === "USD") {
    return `$${Math.round(value).toLocaleString("es-MX")}`;
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
    : { data: [] as { id: string; name: string; pro_verified_at: string | null }[] };
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
