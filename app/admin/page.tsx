import { adminClient } from "@/lib/supabase";
import {
  summarize,
  summarizeAi,
  pesos,
  type Ping,
  type AiUsage,
} from "@/lib/metrics";

// Siempre datos frescos (sin caché).
export const dynamic = "force-dynamic";

function sinceDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(d);
}

export default async function Admin() {
  let rows: Ping[] = [];
  let aiRows: AiUsage[] = [];
  let errorMsg: string | null = null;

  try {
    const supabase = adminClient();
    const since = sinceDate(60);
    const [pings, ai] = await Promise.all([
      supabase
        .from("usage_pings")
        .select("*")
        .gte("ping_date", since)
        .order("ping_date", { ascending: false }),
      supabase
        .from("ai_usage")
        .select("*")
        .gte("usage_date", since)
        .order("usage_date", { ascending: false }),
    ]);
    if (pings.error) errorMsg = pings.error.message;
    else if (ai.error) errorMsg = ai.error.message;
    else {
      rows = (pings.data ?? []) as Ping[];
      aiRows = (ai.data ?? []) as AiUsage[];
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

  const supabaseHost = (() => {
    try {
      return new URL(process.env.SUPABASE_URL ?? "").hostname;
    } catch {
      return "—";
    }
  })();

  const s = summarize(rows);
  const ai = summarizeAi(aiRows);
  const aiByInstall = new Map(ai.byInstall.map((u) => [u.install_id, u]));
  const maxDaily = Math.max(1, ...s.dailyActive.map((d) => d.count));

  const kpis = [
    { v: s.totalInstalls, l: "Instalaciones (60 d)" },
    { v: s.activeToday, l: "Activos hoy" },
    { v: s.active7, l: "Activos 7 días" },
    { v: s.active30, l: "Activos 30 días" },
    { v: s.subscribed, l: "Suscritos" },
    { v: s.inTrial, l: "En prueba" },
    { v: s.ordersToday, l: "Órdenes hoy" },
    { v: pesos(s.salesTodayCents), l: "Ventas hoy" },
    { v: ai.totalCalls, l: "Llamadas IA (60 d)" },
    { v: ai.callsToday, l: "Llamadas IA hoy" },
    { v: ai.usersWithAi, l: "Usuarios con IA" },
  ];

  return (
    <main className="admin">
      <h1>Dashboard · Órale AI</h1>
      <p className="muted">
        Analítica de uso anónima y agregada. Últimos 60 días.
      </p>
      <p className="muted">
        Fuente: <code>{supabaseHost}</code> · {rows.length} filas en{" "}
        <code>usage_pings</code> · {aiRows.length} filas en{" "}
        <code>ai_usage</code>
      </p>

      <div className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.l}>
            <div className="v">{k.v}</div>
            <div className="l">{k.l}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Negocios activos por día (14 días)</h2>
        <div className="bars">
          {s.dailyActive.map((d) => (
            <div className="bar-col" key={d.date}>
              <span className="n">{d.count}</span>
              <div
                className="bar"
                style={{ height: `${(d.count / maxDaily) * 130}px` }}
              />
              <span className="d">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Usuarios ({s.latest.length})</h2>
        <p className="muted">
          Una fila por instalación. La columna IA cuenta las llamadas a las
          funciones de IA (armar menú y reportes) en los últimos 60 días.
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
                <th>Último día</th>
                <th>Plataforma</th>
                <th>Versión</th>
                <th>Productos</th>
                <th>Órdenes (último)</th>
                <th>Ventas (último)</th>
                <th>IA (60 d)</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {s.latest.map((p) => {
                const u = aiByInstall.get(p.install_id);
                return (
                  <tr key={p.install_id}>
                    <td title={p.install_id}>{p.install_id.slice(0, 8)}</td>
                    <td>{p.ping_date}</td>
                    <td>{p.platform ?? "—"}</td>
                    <td>{p.app_version ?? "—"}</td>
                    <td>{p.product_count}</td>
                    <td>{p.orders_today}</td>
                    <td>{pesos(p.sales_today_cents)}</td>
                    <td title={u ? `Hoy: ${u.today} · Último uso: ${u.lastDate}` : "Sin uso de IA"}>
                      {u ? u.total : "—"}
                    </td>
                    <td>
                      {p.subscription_active ? (
                        <span className="pill sub">Suscrito</span>
                      ) : p.trial ? (
                        <span className="pill trial">Prueba</span>
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
