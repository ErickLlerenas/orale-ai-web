import { unstable_noStore as noStore } from "next/cache";
import { adminClient } from "@/lib/supabase";
import {
  summarize,
  summarizeAi,
  summarizeToday,
  newSubscribersToday,
  planLabel,
  platformChip,
  userTenure,
  fechaHora,
  currentMonth,
  monthLabel,
  monthOptions,
  monthRange,
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
  const ai = summarizeAi(aiRows, new Set(s.latest.map((p) => p.install_id)));
  const t = summarizeToday(todayPings, todayAi);
  const aiByInstall = new Map(ai.byInstall.map((u) => [u.install_id, u]));
  const maxDaily = Math.max(1, ...s.daily.map((d) => d.active));

  // Los pings se pueden purgar: si el mes no arranca con datos, se avisa en vez
  // de dejar creer que nadie abrió la app esos días.
  const firstWithData = s.daily.find((d) => d.active > 0)?.date ?? null;

  const todayKpis = [
    { v: t.selling, l: "Cobrando hoy" },
    { v: t.activeInstalls, l: "Abrieron la app" },
    { v: t.newInstalls, l: "Nuevas instalaciones" },
    { v: newSubs.length, l: "Se suscribieron" },
  ];

  // De los que cobran, cuántos pagan: la conversión que sí importa.
  const conversion = s.selling
    ? Math.round((s.sellingSubscribed / s.selling) * 100)
    : 0;

  const monthKpis = [
    { v: s.payingAccounts, l: "Cuentas de pago" },
    { v: s.selling, l: "Negocios cobrando" },
    { v: `${s.sellingSubscribed} · ${conversion}%`, l: "De esos, pagan" },
    { v: s.activeInstalls, l: "Abrieron la app" },
    { v: s.totalOrders, l: "Órdenes" },
    { v: ai.totalCalls, l: "Llamadas IA" },
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

      <section className="kpi-group">
        <h2 className="kpi-group-title">{monthLabel(month)}</h2>
        <div className="kpis">
          {monthKpis.map((k) => (
            <div className="kpi" key={k.l}>
              <div className="v">{k.v}</div>
              <div className="l">{k.l}</div>
            </div>
          ))}
        </div>
        <p className="muted kpi-note">
          Planes: {s.monthly} mensual · {s.yearly} anual · {s.pro} Pro ·{" "}
          {s.realBranches} sucursal doble. Equipos: {s.platforms.ios.installs}{" "}
          iOS · {s.platforms.android.installs} Android ·{" "}
          {s.platforms.windows.installs} Windows · {s.platforms.mac.installs}{" "}
          Mac.
        </p>
      </section>

      {newSubs.length > 0 && (
        <div className="panel">
          <h2>Se suscribieron hoy ({newSubs.length})</h2>
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
                {newSubs.map((n) => {
                  const platform = platformChip(n.platform);
                  return (
                    <tr key={n.identity}>
                      <td title={n.identity}>{n.identity.slice(0, 12)}</td>
                      <td>{n.isAccount ? "Cuenta" : "Dispositivo"}</td>
                      <td>{planLabel(n.plan)}</td>
                      <td>
                        <span className={platform.className}>
                          {platform.label}
                        </span>
                      </td>
                      <td>{fechaHora(n.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Negocios cobrando por día · {monthLabel(month)}</h2>
        <p className="muted">
          La barra llena es quien cobró ese día; la clara, quien solo abrió la
          app.
          {firstWithData && firstWithData.slice(8) !== "01" && (
            <> Solo hay pings guardados desde el {firstWithData.slice(8)}.</>
          )}
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
          cobrando» es lo que de verdad dice si el negocio usa la app.
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
                  <th>Antigüedad</th>
                  <th>Plataforma</th>
                  <th>Versión</th>
                  <th>Productos</th>
                  <th>Días cobrando</th>
                  <th>Ventas (rango)</th>
                  <th>IA (mes)</th>
                  <th>Plan</th>
                </tr>
              </thead>
              <tbody>
                {s.latest.map((p) => {
                  const u = aiByInstall.get(p.install_id);
                  const tenure = userTenure(p.days_since_install);
                  const platform = platformChip(p.platform);
                  return (
                    <tr key={p.install_id}>
                      <td title={p.install_id}>{p.install_id.slice(0, 8)}</td>
                      <td title={p.account_key ?? "Sin cuenta (gratis)"}>
                        {p.account_key ? p.account_key.slice(0, 8) : "—"}
                      </td>
                      <td title={p.ping_date}>{fechaHora(p.updated_at)}</td>
                      <td title={`${p.days_since_install} días desde la descarga`}>
                        <span className={tenure.className}>{tenure.label}</span>
                      </td>
                      <td>
                        <span className={platform.className}>
                          {platform.label}
                        </span>
                      </td>
                      <td>{p.app_version ?? "—"}</td>
                      <td>{p.product_count}</td>
                      <td title={`Días con ventas en ${monthLabel(month)}`}>
                        {s.soldDaysByInstall.get(p.install_id) ?? 0}
                      </td>
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
                      <td>
                        {p.subscription_active ? (
                          <span
                            className="pill sub"
                            title={`Suscrito el ${p.subscribed_at ?? "—"}`}
                          >
                            {planLabel(p.plan)}
                          </span>
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
