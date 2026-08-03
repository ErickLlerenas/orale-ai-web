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
  mxYesterday,
  dayLabel,
  type Ping,
  type AiUsage,
  type NewSubscriber,
} from "@/lib/metrics";
import MonthSelect from "./MonthSelect";
import DayTabs, { type DayKpi, type DaySnapshot } from "./DayTabs";
import { type NewSubDetail } from "./NewSubscribers";

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
  const yesterday = mxYesterday();

  let rows: Ping[] = [];
  let aiRows: AiUsage[] = [];
  let todayPings: Ping[] = [];
  let todayAi: AiUsage[] = [];
  let yesterdayPings: Ping[] = [];
  let yesterdayAi: AiUsage[] = [];
  /** install_id que entraron como mesero (código de equipo). */
  let waiterInstalls = new Set<string>();
  let errorMsg: string | null = null;

  try {
    const supabase = adminClient();
    const [
      pings,
      ai,
      todayPingsRes,
      todayAiRes,
      yPingsRes,
      yAiRes,
      devicesRes,
    ] = await Promise.all([
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
      supabase.from("usage_pings").select("*").eq("ping_date", yesterday),
      supabase.from("ai_usage").select("*").eq("usage_date", yesterday),
      supabase.from("business_devices").select("install_id, role"),
    ]);
    if (pings.error) errorMsg = pings.error.message;
    else if (ai.error) errorMsg = ai.error.message;
    else if (todayPingsRes.error) errorMsg = todayPingsRes.error.message;
    else if (todayAiRes.error) errorMsg = todayAiRes.error.message;
    else if (yPingsRes.error) errorMsg = yPingsRes.error.message;
    else if (yAiRes.error) errorMsg = yAiRes.error.message;
    else if (devicesRes.error) errorMsg = devicesRes.error.message;
    else {
      rows = (pings.data ?? []) as Ping[];
      aiRows = (ai.data ?? []) as AiUsage[];
      todayPings = (todayPingsRes.data ?? []) as Ping[];
      todayAi = (todayAiRes.data ?? []) as AiUsage[];
      yesterdayPings = (yPingsRes.data ?? []) as Ping[];
      yesterdayAi = (yAiRes.data ?? []) as AiUsage[];
      waiterInstalls = new Set(
        ((devicesRes.data ?? []) as { install_id: string; role: string }[])
          .filter((d) => d.role === "waiter")
          .map((d) => d.install_id),
      );
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

  const s = summarize(rows, month);
  const ai = summarizeAi(aiRows, new Set(s.latest.map((p) => p.install_id)));
  const t = summarizeToday(todayPings, todayAi);
  const y = summarizeToday(yesterdayPings, yesterdayAi);
  const aiByInstall = new Map(ai.byInstall.map((u) => [u.install_id, u]));
  const maxDaily = Math.max(
    1,
    ...s.daily.map((d) => Math.max(d.active, d.selling, d.newInstalls)),
  );

  const buildSubs = (
    subs: NewSubscriber[],
    dayPings: Ping[],
  ): NewSubDetail[] =>
    subs.map((n) => {
      const match =
        (n.isAccount
          ? s.latest.find((p) => p.account_key === n.identity) ??
            dayPings.find((p) => p.account_key === n.identity)
          : s.latest.find((p) => p.install_id === n.identity) ??
            dayPings.find((p) => p.install_id === n.identity)) ?? null;
      const tenure = userTenure(match?.days_since_install ?? 0);
      const platform = platformChip(match?.platform ?? n.platform);
      const u = match ? aiByInstall.get(match.install_id) : undefined;
      const deviceCount = n.isAccount
        ? s.latest.filter((p) => p.account_key === n.identity).length || 1
        : 1;
      return {
        identity: n.identity,
        isAccount: n.isAccount,
        plan: planLabel(n.plan),
        platformLabel: platform.label,
        platformClass: platform.className,
        tenureLabel: tenure.label,
        tenureClass: tenure.className,
        appVersion: match?.app_version ?? "—",
        productCount: match?.product_count ?? 0,
        lastSeen: fechaHora(match?.updated_at ?? n.updated_at),
        aiMonth: u ? String(u.total) : "—",
        installId: match?.install_id ?? (n.isAccount ? "—" : n.identity),
        accountKey: match?.account_key ?? (n.isAccount ? n.identity : null),
        deviceCount,
      };
    });

  const dayKpis = (
    subsCount: number,
    summary: ReturnType<typeof summarizeToday>,
  ): DayKpi[] => [
    { v: subsCount, l: "Se suscribieron", tone: "subs" },
    { v: summary.newInstalls, l: "Nuevas instalaciones", tone: "new" },
    { v: summary.activeInstalls, l: "Abrieron la app", tone: "open" },
    { v: summary.selling, l: "Cobrando", tone: "sell" },
  ];

  const todaySubs = newSubscribersToday(todayPings, today);
  const yesterdaySubs = newSubscribersToday(yesterdayPings, yesterday);

  const todaySnap: DaySnapshot = {
    label: "Hoy",
    dateLabel: dayLabel(today),
    live: true,
    kpis: dayKpis(todaySubs.length, t),
    subscribers: buildSubs(todaySubs, todayPings),
  };
  const yesterdaySnap: DaySnapshot = {
    label: "Ayer",
    dateLabel: dayLabel(yesterday),
    kpis: dayKpis(yesterdaySubs.length, y),
    subscribers: buildSubs(yesterdaySubs, yesterdayPings),
  };

  // Embudo del mes: de abrir la app a pagar.
  const funnel = [
    {
      n: s.activeInstalls,
      l: "Abrieron",
      tip: "Instalaciones activas en el mes",
    },
    {
      n: s.configured + s.selling,
      l: "Con menú",
      tip: "Ya capturaron productos",
    },
    {
      n: s.selling,
      l: "Cobrando",
      tip: "Cerraron al menos una venta",
    },
    {
      n: s.sellingSubscribed,
      l: "Pagan",
      tip: "De los que cobran, con suscripción",
    },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.n));
  const conversion = s.selling
    ? Math.round((s.sellingSubscribed / s.selling) * 100)
    : 0;

  const platformRows = (
    [
      ["ios", "iOS"],
      ["android", "Android"],
      ["windows", "Windows"],
      ["mac", "Mac"],
    ] as const
  ).map(([key, label]) => ({
    key,
    label,
    n: s.platforms[key].installs,
  }));
  const platformMax = Math.max(1, ...platformRows.map((p) => p.n));

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

      <DayTabs today={todaySnap} yesterday={yesterdaySnap} />

      <section className="kpi-group month-summary">
        <h2 className="kpi-group-title">{monthLabel(month)}</h2>
        <div className="month-grid">
          <div>
            <h3 className="month-chart-title">Embudo de uso</h3>
            <div className="funnel">
              {funnel.map((f, i) => (
                <div
                  className={`funnel-step step-${i}`}
                  key={f.l}
                  title={f.tip}
                  style={{ width: `${Math.max(18, (f.n / funnelMax) * 100)}%` }}
                >
                  <span className="funnel-n">{f.n}</span>
                  <span className="funnel-l">{f.l}</span>
                </div>
              ))}
            </div>
            <p className="muted month-chart-note">
              {s.payingAccounts} cuentas de pago · {conversion}% de los que
              cobran pagan · {s.monthly} mensual · {s.yearly} anual · {s.pro}{" "}
              Pro
            </p>
          </div>
          <div>
            <h3 className="month-chart-title">Por plataforma</h3>
            <div className="platform-bars">
              {platformRows.map((p) => (
                <div className="platform-bar-row" key={p.key}>
                  <span className="platform-bar-label">{p.label}</span>
                  <div className="platform-bar-track">
                    <div
                      className={`platform-bar-fill platform-${p.key}`}
                      style={{
                        width: `${(p.n / platformMax) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="platform-bar-n">{p.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="panel">
        <h2>Actividad por día · {monthLabel(month)}</h2>
        <div className="bars-legend">
          <span>
            <i className="swatch open" /> Abrieron
          </span>
          <span>
            <i className="swatch sell" /> Cobraron
          </span>
          <span>
            <i className="swatch new" /> Descargas
          </span>
        </div>
        <div className="bars">
          {s.daily.map((d) => (
            <div
              className="bar-col"
              key={d.date}
              title={`${d.date}: ${d.active} abrieron · ${d.selling} cobraron · ${d.newInstalls} descargas`}
            >
              <div className="bar-pair">
                <div className="bar-stack">
                  <span className="n open">{d.active || ""}</span>
                  <div
                    className="bar open"
                    style={{
                      height: d.active
                        ? `${Math.max(3, (d.active / maxDaily) * 120)}px`
                        : "0px",
                    }}
                  />
                </div>
                <div className="bar-stack">
                  <span className="n sell">{d.selling || ""}</span>
                  <div
                    className="bar sell"
                    style={{
                      height: d.selling
                        ? `${Math.max(3, (d.selling / maxDaily) * 120)}px`
                        : "0px",
                    }}
                  />
                </div>
                <div className="bar-stack">
                  <span className="n new">{d.newInstalls || ""}</span>
                  <div
                    className="bar new"
                    style={{
                      height: d.newInstalls
                        ? `${Math.max(3, (d.newInstalls / maxDaily) * 120)}px`
                        : "0px",
                    }}
                  />
                </div>
              </div>
              <span className="d">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Usuarios ({s.latest.length})</h2>
        <p className="muted">
          Una fila por instalación activa en {monthLabel(month)}.
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
                  <th>Órdenes</th>
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
                      <td title="Órdenes cerradas acumuladas">
                        {p.orders_total ?? 0}
                      </td>
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
                        ) : waiterInstalls.has(p.install_id) ? (
                          <span
                            className="pill mesero"
                            title="Entró con código de mesero (no suscribe)"
                          >
                            Mesero
                          </span>
                        ) : (
                          <span className="pill off">Sin suscripción</span>
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
