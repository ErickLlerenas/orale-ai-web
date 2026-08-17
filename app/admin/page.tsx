import { unstable_noStore as noStore } from "next/cache";
import { adminClient, fetchAll } from "@/lib/supabase";
import {
  summarize,
  summarizeAi,
  summarizeToday,
  newSubscribersToday,
  mergeStripeNewSubscribers,
  planLabel,
  planPill,
  platformChip,
  userTenure,
  multiDeviceLabel,
  newInstallPlatformChips,
  emptyPlatformCounts,
  PRIMARY_PLATFORMS,
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
  type StripeSubRow,
} from "@/lib/metrics";
import MonthSelect from "./MonthSelect";
import DayTabs, { type DayKpi, type DaySnapshot } from "./DayTabs";
import { type NewSubDetail } from "./NewSubscribers";
import UsersByDay from "./UsersByDay";

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
  let stripeSubs: StripeSubRow[] = [];
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
      stripeSubsRes,
    ] = await Promise.all([
      fetchAll<Ping>(
        supabase
          .from("usage_pings")
          .select("*")
          .gte("ping_date", start)
          .lte("ping_date", end)
          .order("ping_date", { ascending: false })
          .order("install_id"),
      ),
      fetchAll<AiUsage>(
        supabase
          .from("ai_usage")
          .select("*")
          .gte("usage_date", start)
          .lte("usage_date", end)
          .order("usage_date", { ascending: false })
          .order("install_id"),
      ),
      fetchAll<Ping>(
        supabase
          .from("usage_pings")
          .select("*")
          .eq("ping_date", today)
          .order("install_id"),
      ),
      fetchAll<AiUsage>(
        supabase
          .from("ai_usage")
          .select("*")
          .eq("usage_date", today)
          .order("install_id"),
      ),
      fetchAll<Ping>(
        supabase
          .from("usage_pings")
          .select("*")
          .eq("ping_date", yesterday)
          .order("install_id"),
      ),
      fetchAll<AiUsage>(
        supabase
          .from("ai_usage")
          .select("*")
          .eq("usage_date", yesterday)
          .order("install_id"),
      ),
      fetchAll<{ install_id: string; role: string }>(
        supabase
          .from("business_devices")
          .select("install_id, role")
          .order("install_id"),
      ),
      // Altas Windows/Stripe de hoy y ayer (sin esperar ping de la app).
      fetchAll<StripeSubRow>(
        supabase
          .from("subscriptions")
          .select("user_id, plan, status, subscribed_at, updated_at")
          .in("subscribed_at", [today, yesterday])
          .order("user_id"),
      ),
    ]);
    if (pings.error) errorMsg = pings.error.message;
    else if (ai.error) errorMsg = ai.error.message;
    else if (todayPingsRes.error) errorMsg = todayPingsRes.error.message;
    else if (todayAiRes.error) errorMsg = todayAiRes.error.message;
    else if (yPingsRes.error) errorMsg = yPingsRes.error.message;
    else if (yAiRes.error) errorMsg = yAiRes.error.message;
    else if (devicesRes.error) errorMsg = devicesRes.error.message;
    else if (stripeSubsRes.error) errorMsg = stripeSubsRes.error.message;
    else {
      rows = (pings.data ?? []) as Ping[];
      aiRows = (ai.data ?? []) as AiUsage[];
      todayPings = (todayPingsRes.data ?? []) as Ping[];
      todayAi = (todayAiRes.data ?? []) as AiUsage[];
      yesterdayPings = (yPingsRes.data ?? []) as Ping[];
      yesterdayAi = (yAiRes.data ?? []) as AiUsage[];
      stripeSubs = (stripeSubsRes.data ?? []) as StripeSubRow[];
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
  // Días futuros en 0 (evita pings con reloj adelantado y llena el mes visualmente).
  const daily = s.daily.map((d) =>
    d.date <= today
      ? d
      : { ...d, newInstalls: 0, newSubs: 0, newByPlatform: emptyPlatformCounts() },
  );
  const pastDays = daily.filter((d) => d.date <= today);
  const maxSubs = Math.max(1, ...pastDays.map((d) => d.newSubs));
  const maxInstalls = Math.max(1, ...pastDays.map((d) => d.newInstalls));
  const monthSubsTotal = daily.reduce((sum, d) => sum + d.newSubs, 0);
  const monthInstallsTotal = daily.reduce((sum, d) => sum + d.newInstalls, 0);
  const monthByPlatform = daily.reduce(
    (acc, d) => {
      for (const key of Object.keys(acc) as (keyof typeof acc)[]) {
        acc[key] += d.newByPlatform[key];
      }
      return acc;
    },
    emptyPlatformCounts(),
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

  const todaySubs = mergeStripeNewSubscribers(
    newSubscribersToday(todayPings, today),
    stripeSubs,
    today,
  );
  const yesterdaySubs = mergeStripeNewSubscribers(
    newSubscribersToday(yesterdayPings, yesterday),
    stripeSubs,
    yesterday,
  );

  const todaySnap: DaySnapshot = {
    label: "Hoy",
    dateLabel: dayLabel(today),
    live: true,
    kpis: dayKpis(todaySubs.length, t),
    newPlatforms: newInstallPlatformChips(t.newByPlatform),
    subscribers: buildSubs(todaySubs, todayPings),
  };
  const yesterdaySnap: DaySnapshot = {
    label: "Ayer",
    dateLabel: dayLabel(yesterday),
    kpis: dayKpis(yesterdaySubs.length, y),
    newPlatforms: newInstallPlatformChips(y.newByPlatform),
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

  const platformRows = [
    ...PRIMARY_PLATFORMS,
    ...(monthByPlatform.mac > 0 ? [{ key: "mac" as const, label: "Mac" }] : []),
  ].map(({ key, label }) => ({
    key,
    label,
    n: monthByPlatform[key],
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
          <p className="muted month-card-hint">Descargas nuevas del mes</p>
          <div className="platform-bars">
            {platformRows.map((p) => (
              <div className="platform-bar-row" key={p.key}>
                <span className="platform-bar-label">{p.label}</span>
                <div className="platform-bar-track">
                  <div
                    className={`platform-bar-fill platform-${p.key}`}
                    style={{
                      width: p.n ? `${(p.n / platformMax) * 100}%` : "0",
                      minWidth: p.n ? undefined : 0,
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
        <h2>Cuentas en varios equipos ({s.multiDevice.length})</h2>
        <p className="muted">
          Sucursal doble = dos equipos cobraron este mes. Pro = meseros del
          plan. Cambio de equipo = solo uno cobra (el otro quedó vacío o lo
          cambiaron).
        </p>
        {s.multiDevice.length === 0 ? (
          <p className="muted">Ninguna cuenta usa más de un dispositivo.</p>
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
                    <td title={a.account_key}>{a.account_key.slice(0, 8)}</td>
                    <td>{a.device_count}</td>
                    <td title="Equipos que cerraron ventas este mes">
                      {a.selling_devices}
                    </td>
                    <td>
                      <span className={`pill kind-${a.kind}`}>
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

      <div className="panel subs-panel">
        <div className="subs-head">
          <div>
            <h2>Descargas · {monthLabel(month)}</h2>
            <p className="muted month-card-hint">Nuevas por día y por tienda</p>
          </div>
          <div className="subs-total">
            <span className="subs-total-n">{monthInstallsTotal}</span>
            <span className="subs-total-l">en el mes</span>
          </div>
        </div>
        <div className="bars-legend">
          {PRIMARY_PLATFORMS.map((p) => (
            <span key={p.key}>
              <i className={`swatch platform-${p.key}`} />
              {p.label} {monthByPlatform[p.key]}
            </span>
          ))}
        </div>
        <div className="bars bars-subs">
          {daily.map((d) => {
            const isFuture = d.date > today;
            const h = d.newInstalls
              ? Math.max(6, (d.newInstalls / maxInstalls) * 140)
              : isFuture
                ? 0
                : 3;
            const parts: { key: "ios" | "android" | "windows" | "unknown"; n: number }[] =
              PRIMARY_PLATFORMS.map((p) => ({
                key: p.key,
                n: d.newByPlatform[p.key],
              })).filter((p) => p.n > 0);
            const other =
              d.newInstalls - parts.reduce((sum, p) => sum + p.n, 0);
            if (other > 0) parts.push({ key: "unknown", n: other });
            return (
              <div
                className={`bar-col${isFuture ? " future" : ""}${d.newInstalls ? "" : " empty"}`}
                key={`dl-${d.date}`}
                title={
                  isFuture
                    ? d.date
                    : `${d.date}: ${d.newInstalls} descargas · iOS ${d.newByPlatform.ios} · Android ${d.newByPlatform.android} · Windows ${d.newByPlatform.windows}`
                }
              >
                <div className="bar-stack">
                  <span className="n new">
                    {!isFuture && d.newInstalls ? d.newInstalls : ""}
                  </span>
                  {d.newInstalls ? (
                    <div className="bar-stack-fill" style={{ height: `${h}px` }}>
                      {parts.map((p) => (
                        <div
                          key={p.key}
                          className={`bar-seg platform-${p.key}`}
                          style={{
                            height: `${(p.n / d.newInstalls) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bar ghost" style={{ height: `${h}px` }} />
                  )}
                </div>
                <span className="d">{d.date.slice(8)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel subs-panel">
        <div className="subs-head">
          <div>
            <h2>Suscripciones · {monthLabel(month)}</h2>
            <p className="muted month-card-hint">Nuevas por día</p>
          </div>
          <div className="subs-total">
            <span className="subs-total-n">{monthSubsTotal}</span>
            <span className="subs-total-l">en el mes</span>
          </div>
        </div>
        <div className="bars bars-subs">
          {daily.map((d) => {
            const isFuture = d.date > today;
            const h = d.newSubs
              ? Math.max(6, (d.newSubs / maxSubs) * 140)
              : isFuture
                ? 0
                : 3;
            return (
              <div
                className={`bar-col${isFuture ? " future" : ""}${d.newSubs ? "" : " empty"}`}
                key={d.date}
                title={
                  isFuture
                    ? d.date
                    : `${d.date}: ${d.newSubs} suscripciones`
                }
              >
                <div className="bar-stack">
                  <span className="n sell">
                    {!isFuture && d.newSubs ? d.newSubs : ""}
                  </span>
                  <div
                    className={`bar${d.newSubs ? " sell" : " ghost"}`}
                    style={{ height: `${h}px` }}
                  />
                </div>
                <span className="d">{d.date.slice(8)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <UsersByDay
        pings={rows}
        month={month}
        today={today}
        aiByInstall={Object.fromEntries(
          ai.byInstall.map((u) => [u.install_id, u]),
        )}
        waiterInstalls={[...waiterInstalls]}
      />
    </main>
  );
}
