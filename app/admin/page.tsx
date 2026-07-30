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
  multiDeviceLabel,
  mxToday,
  type Ping,
  type AiUsage,
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

  // Nuevos hoy = primera suscripción con fecha de hoy (`subscribed_at`).
  const newSubs = newSubscribersToday(todayPings, today);

  const s = summarize(rows, month);
  const ai = summarizeAi(aiRows);
  const t = summarizeToday(todayPings, todayAi);
  const aiByInstall = new Map(ai.byInstall.map((u) => [u.install_id, u]));
  const maxDaily = Math.max(1, ...s.daily.map((d) => d.active));

  const todayKpis = [
    { v: t.selling, l: "Negocios cobrando" },
    { v: t.activeInstalls, l: "Abrieron la app" },
    { v: t.newInstalls, l: "Nuevas instalaciones" },
    { v: newSubs.length, l: "Se suscribieron hoy" },
    { v: t.orders, l: "Órdenes hoy" },
    { v: t.aiCalls, l: "Llamadas IA" },
  ];

  // De los que cobran, cuántos pagan: la conversión que sí importa.
  const conversion = s.selling
    ? Math.round((s.sellingSubscribed / s.selling) * 100)
    : 0;

  const groups = [
    {
      title: "Resumen del mes",
      kpis: [
        { v: s.activeInstalls, l: "Abrieron la app" },
        { v: s.empty, l: "Solo descargaron" },
        { v: s.configured, l: "Con menú, sin cobrar" },
        { v: s.selling, l: "Negocios cobrando" },
        { v: `${s.sellingSubscribed} · ${conversion}%`, l: "De esos, pagan" },
        { v: s.totalOrders, l: "Órdenes del mes" },
        { v: ai.totalCalls, l: "Llamadas IA" },
        { v: ai.usersWithAi, l: "Usuarios con IA" },
      ],
    },
  ];

  const platformRows: {
    key: "ios" | "android" | "windows" | "mac";
    label: string;
  }[] = [
    { key: "ios", label: "iOS" },
    { key: "android", label: "Android" },
    { key: "windows", label: "Windows" },
    { key: "mac", label: "Mac" },
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
          Primera suscripción con fecha de hoy (<code>subscribed_at</code>).
        </p>
        {newSubs.length === 0 ? (
          <p className="muted">Nadie se ha suscrito hoy… todavía. 🌮</p>
        ) : (
          <div className="table-wrap">
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
          </div>
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
            <div className="v">{s.pro}</div>
            <div className="l">Órale AI Pro</div>
          </div>
          <div className="kpi">
            <div className="v">{s.realBranches}</div>
            <div className="l">Sucursal doble</div>
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
              <th>Pro</th>
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
                  <td>{stats.pro}</td>
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
                <td>{s.platforms.unknown.pro}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Cuentas en varios equipos ({s.multiDevice.length})</h2>
        <p className="muted">
          Solo cuenta como sucursal doble si dos equipos COBRARON este mes. En
          Pro los equipos extra son los meseros, y un equipo que no cobra suele
          ser un cambio de aparato o una instalación que quedó vacía.
        </p>
        {s.multiDevice.length === 0 ? (
          <p className="muted">
            Ninguna cuenta usa más de un dispositivo. (Aparecerán aquí conforme
            las apps actualizadas manden su account_key.)
          </p>
        ) : (
          <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Equipos</th>
                <th>Cobrando</th>
                <th>Qué es</th>
                <th>Plan</th>
                <th>Última visita</th>
              </tr>
            </thead>
            <tbody>
              {s.multiDevice.map((a) => (
                <tr key={a.account_key}>
                  <td title={a.account_key}>{a.account_key.slice(0, 12)}</td>
                  <td>{a.device_count}</td>
                  <td title="Equipos que cerraron ventas este mes">
                    {a.selling_devices}
                  </td>
                  <td>
                    <span
                      className={`pill ${a.kind === "branches" ? "warn" : "off"}`}
                    >
                      {multiDeviceLabel(a.kind)}
                    </span>
                  </td>
                  <td>{planLabel(a.plan)}</td>
                  <td>{a.last_seen}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Negocios cobrando por día · {monthLabel(month)}</h2>
        <p className="muted">
          La barra llena es quien cobró ese día; la clara, quien solo abrió la
          app.
        </p>
        <div className="bars">
          {s.daily.map((d) => (
            <div className="bar-col" key={d.date}>
              <span className="n">{d.selling}</span>
              <div
                className="bar ghost"
                title={`${d.active} abrieron · ${d.selling} cobraron`}
                style={{ height: `${(d.active / maxDaily) * 130}px` }}
              >
                <div
                  className="bar fill"
                  style={{
                    height: d.active
                      ? `${(d.selling / d.active) * 100}%`
                      : "0%",
                  }}
                />
              </div>
              <span className="d">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Usuarios ({s.latest.length})</h2>
        <p className="muted">
          Una fila por instalación activa en {monthLabel(month)}. «Días
          cobrando» es lo que de verdad dice si el negocio usa la app; el total
          histórico llega en cero desde las versiones viejas que aún no lo
          mandan.
        </p>
        {s.latest.length === 0 ? (
          <p className="muted">
            Aún no hay datos. Aparecerán cuando las apps manden su primer ping.
          </p>
        ) : (
          <div className="table-wrap">
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
                <th>Días cobrando</th>
                <th>Órdenes (total)</th>
                <th>Hoy</th>
                <th>Ventas (rango)</th>
                <th>IA (mes)</th>
                <th>Suscrito el</th>
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
                    <td title={`Días con ventas en ${monthLabel(month)}`}>
                      {s.soldDaysByInstall.get(p.install_id) ?? 0}
                    </td>
                    <td title="Órdenes cerradas acumuladas">
                      {p.orders_total ?? 0}
                    </td>
                    <td title="Órdenes cerradas hoy">{p.orders_today ?? 0}</td>
                    <td>{p.sales_bucket ?? "—"}</td>
                    <td
                      title={
                        u
                          ? `Hoy: ${u.today} · Último uso: ${u.lastDate}`
                          : "Sin uso de IA"
                      }
                    >
                      {u ? u.total : "—"}
                    </td>
                    <td>{p.subscribed_at ?? "—"}</td>
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
          </div>
        )}
      </div>
    </main>
  );
}
