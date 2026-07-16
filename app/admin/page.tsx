import { unstable_noStore as noStore } from "next/cache";
import { adminClient } from "@/lib/supabase";
import {
  summarize,
  summarizeAi,
  summarizeToday,
  newSubscribersToday,
  planLabel,
  platformLabel,
  fechaHora,
  currentMonth,
  monthLabel,
  monthOptions,
  monthRange,
  mxToday,
  type Ping,
  type AiUsage,
  type NewSubscriber,
} from "@/lib/metrics";
import MonthSelect from "./MonthSelect";

// Siempre datos frescos (sin caché).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Admin({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  noStore();

  const options = monthOptions(12);
  const validMonths = new Set(options.map((o) => o.value));
  const month =
    searchParams.month && validMonths.has(searchParams.month)
      ? searchParams.month
      : currentMonth();
  const { start, end } = monthRange(month);

  const today = mxToday();

  let rows: Ping[] = [];
  let aiRows: AiUsage[] = [];
  let todayPings: Ping[] = [];
  let todayAi: AiUsage[] = [];
  let errorMsg: string | null = null;

  try {
    const supabase = adminClient();
    const [pings, ai, todayPingsRes, todayAiRes] = await Promise.all([
      supabase
        .from("usage_pings")
        .select("*")
        .gte("ping_date", start)
        .lte("ping_date", end)
        .order("ping_date", { ascending: false }),
      supabase
        .from("ai_usage")
        .select("*")
        .gte("usage_date", start)
        .lte("usage_date", end)
        .order("usage_date", { ascending: false }),
      supabase.from("usage_pings").select("*").eq("ping_date", today),
      supabase.from("ai_usage").select("*").eq("usage_date", today),
    ]);
    if (pings.error) errorMsg = pings.error.message;
    else if (ai.error) errorMsg = ai.error.message;
    else if (todayPingsRes.error) errorMsg = todayPingsRes.error.message;
    else if (todayAiRes.error) errorMsg = todayAiRes.error.message;
    else {
      rows = (pings.data ?? []) as Ping[];
      aiRows = (ai.data ?? []) as AiUsage[];
      todayPings = (todayPingsRes.data ?? []) as Ping[];
      todayAi = (todayAiRes.data ?? []) as AiUsage[];
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  if (errorMsg) {
    return (
      <main className="admin">
        <h1>Dashboard</h1>
        <p className="muted">No se pudieron cargar los datos: {errorMsg}</p>
        <p className="muted">
          Revisa que SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY estén
          configurados, y que exista la tabla <code>usage_pings</code>.
        </p>
      </main>
    );
  }

  // ¿Quiénes se suscribieron HOY? = suscritos hoy sin historial de suscripción
  // previa (comparado contra todos los pings anteriores a hoy).
  let newSubs: NewSubscriber[] = [];
  if (!errorMsg) {
    const subToday = todayPings.filter((p) => p.subscription_active);
    const accountKeys = [
      ...new Set(
        subToday
          .filter((p) => p.account_key)
          .map((p) => p.account_key as string),
      ),
    ];
    const installIds = [
      ...new Set(
        subToday.filter((p) => !p.account_key).map((p) => p.install_id),
      ),
    ];
    if (subToday.length > 0) {
      try {
        const supabase = adminClient();
        const priorAccSet = new Set<string>();
        const priorInstSet = new Set<string>();
        if (accountKeys.length) {
          const res = await supabase
            .from("usage_pings")
            .select("account_key")
            .eq("subscription_active", true)
            .lt("ping_date", today)
            .in("account_key", accountKeys);
          for (const r of (res.data ?? []) as { account_key: string | null }[]) {
            if (r.account_key) priorAccSet.add(r.account_key);
          }
        }
        if (installIds.length) {
          const res = await supabase
            .from("usage_pings")
            .select("install_id")
            .eq("subscription_active", true)
            .lt("ping_date", today)
            .in("install_id", installIds);
          for (const r of (res.data ?? []) as { install_id: string }[]) {
            priorInstSet.add(r.install_id);
          }
        }
        newSubs = newSubscribersToday(todayPings, priorAccSet, priorInstSet);
      } catch {
        // Silencioso: si falla el historial, no mostramos nuevos suscriptores.
      }
    }
  }

  const s = summarize(rows, month);
  const ai = summarizeAi(aiRows);
  const t = summarizeToday(todayPings, todayAi);
  const aiByInstall = new Map(ai.byInstall.map((u) => [u.install_id, u]));
  const maxDaily = Math.max(1, ...s.dailyActive.map((d) => d.count));

  const todayKpis = [
    { v: t.activeInstalls, l: "Negocios activos" },
    { v: t.newInstalls, l: "Nuevas instalaciones" },
    { v: newSubs.length, l: "Se suscribieron hoy" },
    { v: t.orders, l: "Órdenes" },
    { v: t.aiCalls, l: "Llamadas IA" },
  ];

  const groups = [
    {
      title: "Resumen del mes",
      kpis: [
        { v: s.activeInstalls, l: "Instalaciones activas" },
        { v: s.totalOrders, l: "Órdenes del mes" },
        { v: ai.totalCalls, l: "Llamadas IA" },
        { v: ai.usersWithAi, l: "Usuarios con IA" },
      ],
    },
  ];

  const platformRows: { key: "ios" | "android" | "windows"; label: string }[] = [
    { key: "ios", label: "iOS" },
    { key: "android", label: "Android" },
    { key: "windows", label: "Windows" },
  ];

  return (
    <main className="admin">
      <header className="admin-header">
        <div>
          <h1>Dashboard · Órale AI</h1>
          <p className="muted">
            Analítica de uso anónima y agregada · {monthLabel(month)}
          </p>
        </div>
        <MonthSelect value={month} options={options} />
      </header>

      <section className="kpi-group today-group">
        <h2 className="kpi-group-title">
          <span className="live-dot" />
          Hoy · {fechaHora(new Date().toISOString()).split(",")[0]}
        </h2>
        <div className="kpis">
          {todayKpis.map((k) => (
            <div className="kpi" key={k.l}>
              <div className="v">{k.v}</div>
              <div className="l">{k.l}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="panel">
        <h2>Se suscribieron hoy ({newSubs.length})</h2>
        <p className="muted">
          Cuentas o dispositivos cuya suscripción se activó por primera vez hoy.
        </p>
        {newSubs.length === 0 ? (
          <p className="muted">Nadie se ha suscrito hoy… todavía. 🌮</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Identidad</th>
                <th>Tipo</th>
                <th>Plan</th>
                <th>Plataforma</th>
                <th>Hora</th>
              </tr>
            </thead>
            <tbody>
              {newSubs.map((n) => (
                <tr key={n.identity}>
                  <td title={n.identity}>{n.identity.slice(0, 12)}</td>
                  <td>{n.isAccount ? "Cuenta" : "Dispositivo"}</td>
                  <td>{planLabel(n.plan)}</td>
                  <td>{platformLabel(n.platform)}</td>
                  <td>{fechaHora(n.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {groups.map((g) => (
        <section className="kpi-group" key={g.title}>
          <h2 className="kpi-group-title">{g.title}</h2>
          <div className="kpis">
            {g.kpis.map((k) => (
              <div className="kpi" key={k.l}>
                <div className="v">{k.v}</div>
                <div className="l">{k.l}</div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="panel subscriptions-panel">
        <h2>Suscripciones</h2>
        <p className="muted">
          Resumen de cuentas de pago y dispositivos con suscripción activa.
          Las cuentas se deduplican; los dispositivos cuentan cada instalación.
        </p>
        <div className="subscription-summary">
          <div className="kpi">
            <div className="v">{s.payingAccounts}</div>
            <div className="l">Cuentas de pago</div>
          </div>
          <div className="kpi">
            <div className="v">{s.subscribed}</div>
            <div className="l">Dispositivos suscritos</div>
          </div>
          <div className="kpi">
            <div className="v">{s.monthly}</div>
            <div className="l">Plan mensual</div>
          </div>
          <div className="kpi">
            <div className="v">{s.yearly}</div>
            <div className="l">Plan anual</div>
          </div>
          <div className="kpi">
            <div className="v">{s.multiDevice.length}</div>
            <div className="l">Doble sucursal</div>
          </div>
        </div>

        <h3 className="panel-subtitle">Por plataforma</h3>
        <table className="data platform-table">
          <thead>
            <tr>
              <th>Plataforma</th>
              <th>Instalaciones</th>
              <th>Suscritos</th>
              <th>Mensual</th>
              <th>Anual</th>
            </tr>
          </thead>
          <tbody>
            {platformRows.map(({ key, label }) => {
              const stats = s.platforms[key];
              return (
                <tr key={key}>
                  <td>
                    <span className={`platform-tag platform-${key}`}>
                      {label}
                    </span>
                  </td>
                  <td>{stats.installs}</td>
                  <td>{stats.subscribed}</td>
                  <td>{stats.monthly}</td>
                  <td>{stats.yearly}</td>
                </tr>
              );
            })}
            {s.platforms.unknown.installs > 0 && (
              <tr>
                <td>
                  <span className="platform-tag platform-unknown">
                    Desconocida
                  </span>
                </td>
                <td>{s.platforms.unknown.installs}</td>
                <td>{s.platforms.unknown.subscribed}</td>
                <td>{s.platforms.unknown.monthly}</td>
                <td>{s.platforms.unknown.yearly}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Doble sucursal ({s.multiDevice.length})</h2>
        <p className="muted">
          Cuentas de pago usadas en 2+ dispositivos: una sola suscripción
          operando en varias sucursales.
        </p>
        {s.multiDevice.length === 0 ? (
          <p className="muted">
            Ninguna cuenta usa más de un dispositivo. (Aparecerán aquí conforme
            las apps actualizadas manden su account_key.)
          </p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Dispositivos</th>
                <th>Plan</th>
                <th>Última visita</th>
              </tr>
            </thead>
            <tbody>
              {s.multiDevice.map((a) => (
                <tr key={a.account_key}>
                  <td title={a.account_key}>{a.account_key.slice(0, 12)}</td>
                  <td>{a.device_count}</td>
                  <td>{planLabel(a.plan)}</td>
                  <td>{a.last_seen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h2>Negocios activos por día · {monthLabel(month)}</h2>
        <div className="bars">
          {s.dailyActive.map((d) => (
            <div className="bar-col" key={d.date}>
              <span className="n">{d.count}</span>
              <div
                className="bar"
                style={{ height: `${(d.count / maxDaily) * 130}px` }}
              />
              <span className="d">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Usuarios ({s.latest.length})</h2>
        <p className="muted">
          Una fila por instalación activa en {monthLabel(month)}. La columna IA
          cuenta las llamadas a las funciones de IA (armar menú y reportes) en
          el mes.
        </p>
        {s.latest.length === 0 ? (
          <p className="muted">
            Aún no hay datos. Aparecerán cuando las apps manden su primer ping.
          </p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cuenta</th>
                <th>Última visita</th>
                <th>Días</th>
                <th>Plataforma</th>
                <th>Versión</th>
                <th>Productos</th>
                <th>Órdenes (último)</th>
                <th>Ventas (rango)</th>
                <th>IA (mes)</th>
                <th>Plan</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {s.latest.map((p) => {
                const u = aiByInstall.get(p.install_id);
                return (
                  <tr key={p.install_id}>
                    <td title={p.install_id}>{p.install_id.slice(0, 8)}</td>
                    <td title={p.account_key ?? "Sin cuenta (gratis)"}>
                      {p.account_key ? p.account_key.slice(0, 8) : "—"}
                    </td>
                    <td title={p.ping_date}>{fechaHora(p.updated_at)}</td>
                    <td title="Días desde que instaló la app">
                      {p.days_since_install}
                    </td>
                    <td>{platformLabel(p.platform)}</td>
                    <td>{p.app_version ?? "—"}</td>
                    <td>{p.product_count}</td>
                    <td>{p.orders_today}</td>
                    <td>{p.sales_bucket ?? "—"}</td>
                    <td title={u ? `Hoy: ${u.today} · Último uso: ${u.lastDate}` : "Sin uso de IA"}>
                      {u ? u.total : "—"}
                    </td>
                    <td>{p.subscription_active ? planLabel(p.plan) : "—"}</td>
                    <td>
                      {p.subscription_active ? (
                        <span className="pill sub">Suscrito</span>
                      ) : (
                        <span className="pill off">Inactivo</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
