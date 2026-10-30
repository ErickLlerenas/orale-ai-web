import "server-only";

import { adminClient, fetchAll, fetchAllParallel } from "@/lib/supabase";
import {
  PING_COLUMNS,
  PLATFORMS,
  fillAccountKeys,
  firstSubscriptions,
  toInstalls,
  type Count,
  type Install,
  type PingRow,
} from "@/lib/admin";
import {
  canceledTransactions,
  revenueCatSub,
  stripeSub,
  type NewSub,
  type StoreEvent,
  type StripeSub,
} from "@/lib/admin-subscribers";

/// Lo que pide el panel (/admin), con caché compartida.

type Db = ReturnType<typeof adminClient>;

/// Lo que tarda en llegar (RevenueCat, eventos de la tienda, salud de la
/// migración) se guarda unos minutos: cambiar de pestaña o de mes no lo
/// vuelve a pedir. Un error no se guarda.
const MEMO_TTL_MS = 2 * 60_000;
const memoStore = new Map<string, { at: number; value: Promise<unknown> }>();
export function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memoStore.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value as Promise<T>;
  const value = load();
  memoStore.set(key, { at: Date.now(), value });
  value.catch(() => memoStore.delete(key));
  return value;
}

/// El historial de uso se guarda unos minutos: es lo que más tarda (~1.7 s
/// por 33 mil filas) y cambiar de pestaña lo volvía a pedir entero.
const HISTORY_TTL_MS = 2 * 60_000;
type History = {
  at: number;
  rows: PingRow[];
  installs: Install[];
  error: string | null;
};
let historyCache: History | null = null;
let historyLoading: Promise<History> | null = null;

export async function usageHistory(supabase: Db): Promise<History> {
  if (historyCache && Date.now() - historyCache.at < HISTORY_TTL_MS) {
    return historyCache;
  }
  historyLoading ??= (async () => {
    // Todo el historial, en páginas que se piden a la vez.
    const { count } = await supabase
      .from("usage_pings")
      .select("install_id", { count: "exact", head: true });
    const res = await fetchAllParallel<PingRow>(
      () =>
        supabase
          .from("usage_pings")
          .select(PING_COLUMNS)
          .order("ping_date")
          .order("install_id"),
      count ?? 0,
      16,
    );
    const rows = fillAccountKeys(res.data);
    const loaded: History = {
      at: Date.now(),
      rows,
      installs: toInstalls(rows),
      error: res.error?.message ?? null,
    };
    // Una lectura a medias no se guarda: la siguiente vuelve a intentar.
    if (!loaded.error) historyCache = loaded;
    return loaded;
  })().finally(() => {
    historyLoading = null;
  });
  return historyLoading;
}

const PRODUCT_LABEL: Record<string, string> = {
  orale_monthly: "Mensual",
  orale_yearly: "Anual",
  orale_pro_monthly: "Pro mensual",
  orale_pro_yearly: "Pro anual",
  orale_monthly_99: "Mensual $99",
  orale_pro_monthly_199: "Pro mensual $199",
  monthly: "Mensual",
  yearly: "Anual",
  pro_monthly: "Pro mensual",
  pro_yearly: "Pro anual",
};

/// Desde este día (México) los nuevos suscriptores salen de la tienda: el
/// webhook de RevenueCat empezó la noche del 23 de octubre de 2026.
const STORE_SINCE = "2026-10-24";

/// Altas de un día: de la tienda desde STORE_SINCE (sin pruebas que se
/// cobraron), antes de lo que reportaba la app.
export function subsOnDay(
  storeSubs: NewSub[],
  subsList: ReturnType<typeof firstSubscriptions>,
) {
  return (day: string): NewSub[] =>
    day >= STORE_SINCE
      ? storeSubs.filter((x) => x.day === day && x.kind !== "converted")
      : subsList.filter((x) => x.day === day);
}

/// Altas de la tienda desde [fromDay]: compras nuevas y pruebas que se
/// cobraron (RevenueCat, iPhone/Android) y suscripciones de Windows (Stripe).
export async function storeNewSubs(
  supabase: Db,
  fromDay: string,
): Promise<NewSub[]> {
  const since = new Date(`${fromDay}T00:00:00-06:00`).toISOString();
  const out: NewSub[] = [];
  const [rc, st] = await Promise.all([
    fetchAll<StoreEvent>(
      supabase.from("revenuecat_events")
        .select("id, type, store, product_id, period_type, event_at, original_transaction_id, app_user_id, original_app_user_id, customer_id, cancel_reason, raw")
        .eq("environment", "PRODUCTION")
        .in("type", ["INITIAL_PURCHASE", "RENEWAL", "CANCELLATION", "UNCANCELLATION"])
        .gte("event_at", since)
        .order("event_at").order("id"),
    ),
    fetchAll<StripeSub>(
      supabase.from("subscriptions")
        .select("user_id, plan, subscribed_at, status, cancel_at_period_end, past_due_since")
        .gte("subscribed_at", fromDay)
        .order("user_id"),
    ),
  ]);
  const canceled = canceledTransactions(rc.data);
  for (const event of rc.data) {
    const sub = revenueCatSub(event);
    if (!sub) continue;
    const product = (event.product_id ?? "").split(":")[0];
    out.push({
      ...sub,
      label: PRODUCT_LABEL[product],
      canceled: !!event.original_transaction_id && canceled.has(event.original_transaction_id),
    });
  }
  for (const row of st.data) {
    const sub = stripeSub(row);
    if (sub) out.push(sub);
  }
  return out;
}

export function countSubs(list: NewSub[]): Count {
  const byPlatform: Record<string, number> = {};
  for (const p of PLATFORMS) byPlatform[p] = 0;
  for (const x of list) {
    if (x.platform) byPlatform[x.platform] = (byPlatform[x.platform] ?? 0) + 1;
  }
  return { total: list.length, byPlatform };
}

/// Nombre del negocio de cada cuenta: del servidor si tiene Pro, si no del
/// reporte diario de la app.
export async function businessNames(
  supabase: Db,
  accounts: { key: string; installIds: string[] }[],
) {
  const names = new Map<string, string>();
  const installToKey = new Map<string, string>();
  for (const l of accounts)
    for (const i of l.installIds) installToKey.set(i, l.key);
  const installIds = [...installToKey.keys()];
  const bizByInstall = new Map<string, string>();
  // Los grupos de 150 se piden a la vez: uno tras otro tardaba 3 segundos.
  const deviceParts = await Promise.all(
    chunks(installIds).map((part) =>
      supabase
        .from("business_devices")
        .select("install_id, business_id")
        .eq("role", "owner")
        .in("install_id", part),
    ),
  );
  for (const r of deviceParts) {
    for (const d of (r.data ?? []) as {
      install_id: string;
      business_id: string;
    }[]) {
      bizByInstall.set(d.install_id, d.business_id);
    }
  }
  const bizIds = [...new Set(bizByInstall.values())];
  const bizName = new Map<string, string>();
  if (bizIds.length) {
    const r = await supabase
      .from("businesses")
      .select("id, name")
      .in("id", bizIds);
    for (const b of (r.data ?? []) as { id: string; name: string }[]) {
      bizName.set(b.id, b.name);
    }
  }
  for (const [install, biz] of bizByInstall) {
    const key = installToKey.get(install);
    const name = bizName.get(biz);
    if (key && name && !names.has(key)) names.set(key, name);
  }
  // Sin Pro el negocio no existe en el servidor: el nombre lo manda el reporte
  // diario (app 3.0.107+) en install_profiles.
  const missing = installIds.filter((i) => {
    const key = installToKey.get(i);
    return key && !names.has(key);
  });
  const profileParts = await Promise.all(
    chunks(missing).map((part) =>
      supabase
        .from("install_profiles")
        .select("install_id, business_name")
        .not("business_name", "is", null)
        .in("install_id", part),
    ),
  );
  for (const r of profileParts) {
    for (const p of (r.data ?? []) as {
      install_id: string;
      business_name: string;
    }[]) {
      const key = installToKey.get(p.install_id);
      if (key && !names.has(key)) names.set(key, p.business_name);
    }
  }
  return names;
}

/// Separa una lista larga para no armar URLs gigantes en los filtros `in`.
export function chunks<T>(list: T[], size = 150): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export type PlanChurnRow = {
  /** monthly, yearly, pro_monthly, pro_yearly. */
  plan: string;
  /** Compras con acceso en algún momento desde [from]. */
  n: number;
  /** Se les venció sin renovar. */
  gone: number;
  /** Ya apagaron la renovación: se van cuando se les acabe. */
  leaving: number;
};

const PLAN_OF: Record<string, string> = {
  orale_monthly: "monthly",
  orale_monthly_99: "monthly",
  orale_yearly: "yearly",
  orale_pro_monthly: "pro_monthly",
  orale_pro_monthly_199: "pro_monthly",
  orale_pro_yearly: "pro_yearly",
};

/// Bajas por plan desde [from], según la tienda (billing_customers: Apple,
/// Google y Stripe), no según quién abre la app. Cada compra es una fila; se
/// revisó (29 oct) que ninguna vencida fuera alguien que se cambió de plan.
export async function planChurn(supabase: Db, from: string): Promise<PlanChurnRow[]> {
  const since = new Date(`${from}T00:00:00-06:00`).toISOString();
  const now = new Date().toISOString();
  const res = await fetchAll<{ id: string; product_id: string | null; expires_at: string | null; auto_renew: boolean | null }>(
    supabase
      .from("billing_customers")
      .select("id, product_id, expires_at, auto_renew")
      .gte("expires_at", since)
      .order("id"),
  );
  const out = new Map<string, PlanChurnRow>();
  for (const c of res.data) {
    const plan = PLAN_OF[(c.product_id ?? "").split(":")[0]];
    if (!plan || !c.expires_at) continue;
    let row = out.get(plan);
    if (!row) out.set(plan, (row = { plan, n: 0, gone: 0, leaving: 0 }));
    row.n++;
    if (c.expires_at <= now) row.gone++;
    else if (c.auto_renew === false) row.leaving++;
  }
  return [...out.values()];
}

export type CancelReason = {
  installId: string;
  /** monthly, yearly, pro_monthly, pro_yearly. */
  plan: string | null;
  /** too_expensive, low_use, missing, closed, other. */
  reason: string;
  detail: string | null;
  at: string;
  offerAccepted: boolean;
  /** Ya había cancelado en la tienda cuando contestó. */
  after: boolean;
};

/// Lo que contestaron en la encuesta al cancelar desde [from]: una respuesta
/// por aparato, la más reciente (igual que «¿Por qué se van?» de /admin).
export async function cancelReasons(supabase: Db, from: string) {
  const since = new Date(`${from}T00:00:00-06:00`).toISOString();
  const r = await supabase
    .from("cancel_survey_answers")
    .select("install_id, product_id, reason, detail, offer_accepted, moment, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  const seen = new Set<string>();
  const list: CancelReason[] = [];
  for (const x of (r.data ?? []) as {
    install_id: string;
    product_id: string | null;
    reason: string;
    detail: string | null;
    offer_accepted: boolean | null;
    moment: string | null;
    created_at: string;
  }[]) {
    if (seen.has(x.install_id)) continue;
    seen.add(x.install_id);
    list.push({
      installId: x.install_id,
      plan: PLAN_OF[(x.product_id ?? "").split(":")[0]] ?? null,
      reason: x.reason,
      detail: x.detail?.trim() || null,
      at: x.created_at,
      offerAccepted: !!x.offer_accepted,
      after: x.moment === "after",
    });
  }
  const names = await businessNames(
    supabase,
    list.map((x) => ({ key: x.installId, installIds: [x.installId] })),
  );
  return { list, names };
}

export type SupportCase = {
  id: string;
  at: string;
  title: string;
  detail: string | null;
  version: string | null;
  platform: string | null;
};
export type SupportPerson = { installId: string; cases: SupportCase[] };

/// Lo que el chat de soporte le pasó a Erick y nadie ha revisado: cada persona
/// con sus casos, de lo más nuevo a lo más viejo. Las ideas solo se cuentan.
export async function pendingSupport(supabase: Db) {
  const [cases, ideas] = await Promise.all([
    supabase
      .from("support_requests")
      .select("id, created_at, title, detail, install_id, app_version, platform")
      .eq("kind", "escalation")
      .eq("reviewed", false)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("kind", "idea")
      .eq("reviewed", false),
  ]);
  const byPerson = new Map<string, SupportCase[]>();
  for (const r of (cases.data ?? []) as {
    id: string;
    created_at: string;
    title: string;
    detail: string | null;
    install_id: string | null;
    app_version: string | null;
    platform: string | null;
  }[]) {
    const key = r.install_id ?? "sin aparato";
    if (!byPerson.has(key)) byPerson.set(key, []);
    byPerson.get(key)!.push({
      id: r.id,
      at: r.created_at,
      title: r.title,
      detail: r.detail?.trim() || null,
      version: r.app_version,
      platform: r.platform,
    });
  }
  const people: SupportPerson[] = [...byPerson].map(([installId, list]) => ({ installId, cases: list }));
  const names = await businessNames(
    supabase,
    people.map((p) => ({ key: p.installId, installIds: [p.installId] })),
  );
  return { people, names, ideas: ideas.count ?? 0, error: cases.error?.message ?? null };
}
