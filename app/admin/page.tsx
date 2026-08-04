import { unstable_noStore as noStore } from "next/cache";
import { adminClient } from "@/lib/supabase";
import {
  summarize,
  summarizeAi,
  summarizeToday,
  newSubscribersToday,
  planLabel,
  planPill,
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
  /** Respaldo de rol para pings sin `is_caja` (versiones viejas de la app). */
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
      // El rol es de la pareja (dispositivo, negocio) y estas filas no se
      // borran nunca: un teléfono que probó unirse como mesero quedaba marcado
      // de por vida. Si en algún negocio es la caja, no lo contamos mesero.
      const devices = (devicesRes.data ?? []) as {
        install_id: string;
        role: string;
      }[];
      const ownerInstalls = new Set(
        devices.filter((d) => d.role === "owner").map((d) => d.install_id),
      );
      waiterInstalls = new Set(
        devices
          .filter(
            (d) => d.role === "waiter" && !ownerInstalls.has(d.install_id),
          )
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
  // No pintar el futuro: un equipo con el reloj mal manda pings con fecha adelantada.
  const daily = s.daily.filter((d) => d.date <= today);
  const maxDaily = Math.max(
    1,
    ...daily.map((d) => Math.max(d.active, d.selling, d.newInstalls)),
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

  // Embudo de USO por equipo (no clientes).
  const funnel = [
    {
      n: s.activeInstalls,
      l: "Abrieron",
      tip: "Equipos que abrieron la app en el mes",
    },
    {
      n: s.configured + s.selling,
      l: "Con menú",
      tip: "Equipos que ya capturaron productos",
    },
    {
      n: s.selling,
      l: "Cobrando",
      tip: "Equipos que cerraron al menos una venta",
    },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.n));
  // De los equipos activos, cuántos tienen suscripción.
  const installConversion = s.activeInstalls
    ? Math.round((s.subscribed / s.activeInstalls) * 100)
    : 0;
  // De los equipos que cobran, cuántos tienen suscripción.
  const sellingConversion = s.selling
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

  const planMix = [
    { key: "monthly", label: "Mensual", n: s.monthly, className: "mix-monthly" },
    { key: "yearly", label: "Anual", n: s.yearly, className: "mix-yearly" },
    {
      key: "pro_monthly",
      label: "Pro mensual",
      n: s.proMonthly,
      className: "mix-pro-monthly",
    },
    {
      key: "pro_yearly",
      label: "Pro anual",
      n: s.proYearly,
      className: "mix-pro-yearly",
    },
  ];
  const planTotal = Math.max(1, planMix.reduce((sum, p) => sum + p.n, 0));

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

      <p className="month-section-label">{monthLabel(month)}</p>
      <div className="month-grid">
        <section className="panel">
          <h2 className="month-chart-title">Embudo de uso</h2>
          <p className="muted month-card-hint">Por equipo instalado</p>
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
        </section>
        <section className="panel">
          <h2 className="month-chart-title">Negocio</h2>
          <div className="biz-stats">
            <div className="biz-stat">
              <div className="biz-n">{s.payingAccounts}</div>
              <div className="biz-l">Clientes que pagan</div>
            </div>
            <div className="biz-stat">
              <div className="biz-n">{installConversion}%</div>
              <div className="biz-l">De los que abrieron, están suscritos</div>
              <div
                className="biz-meter"
                title={`${s.subscribed} de ${s.activeInstalls} equipos que abrieron tienen suscripción`}
              >
                <div
                  className="biz-meter-fill"
                  style={{ width: `${installConversion}%` }}
                />
              </div>
              <div className="biz-meter-hint">
                {s.subscribed} de {s.activeInstalls} equipos
              </div>
            </div>
            <div className="biz-stat">
              <div className="biz-n">{sellingConversion}%</div>
              <div className="biz-l">De los que cobran, pagan</div>
              <div
                className="biz-meter"
                title={`${s.sellingSubscribed} de ${s.selling} equipos que cobraron tienen suscripción`}
              >
                <div
                  className="biz-meter-fill"
                  style={{ width: `${sellingConversion}%` }}
                />
              </div>
              <div className="biz-meter-hint">
                {s.sellingSubscribed} de {s.selling} equipos
              </div>
            </div>
            <div className="biz-stat">
              <div className="biz-l">Planes de tus clientes</div>
              <div className="plan-mix">
                <div className="plan-mix-bar">
                  {planMix.map((p) =>
                    p.n > 0 ? (
                      <div
                        key={p.key}
                        className={`plan-mix-seg ${p.className}`}
                        style={{ width: `${(p.n / planTotal) * 100}%` }}
                        title={`${p.label}: ${p.n}`}
                      />
                    ) : null,
                  )}
                </div>
                <div className="plan-mix-legend">
                  {planMix.map((p) => (
                    <div className="plan-mix-item" key={p.key}>
                      <i className={`swatch ${p.className}`} />
                      <span className="plan-mix-label">{p.label}</span>
                      <span className="plan-mix-n">{p.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="panel">
          <h2 className="month-chart-title">Por plataforma</h2>
          <p className="muted month-card-hint">Por equipo instalado</p>
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
        </section>
      </div>

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
          {daily.map((d) => (
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
                        ? `${Math.max(3, (d.active / maxDaily) * 260)}px`
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
                        ? `${Math.max(3, (d.selling / maxDaily) * 260)}px`
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
                        ? `${Math.max(3, (d.newInstalls / maxDaily) * 260)}px`
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
                  const pill = planPill(p.plan, p.subscription_status);
                  // La app reporta el rol; el set solo cubre a quien todavía
                  // no lo manda.
                  const isWaiter =
                    p.is_caja === false ||
                    (p.is_caja == null && waiterInstalls.has(p.install_id));
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
                        {(p.orders_total ?? 0) > 25 ? (
                          <span
                            className={`pill ${
                              p.subscription_active ? "sub" : "danger"
                            }`}
                            title={
                              p.subscription_active
                                ? "Mucho uso y con suscripción"
                                : "Mucho uso sin suscripción"
                            }
                          >
                            {p.orders_total}
                          </span>
                        ) : (
                          (p.orders_total ?? 0)
                        )}
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
                            className={pill.className}
                            title={`${pill.title} · Suscrito el ${
                              p.subscribed_at ?? "—"
                            }`}
                          >
                            {pill.label}
                          </span>
                        ) : isWaiter ? (
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
