import "server-only";
import { createHash } from "node:crypto";
import type { PingRow } from "./admin";

export type NewSub = {
  key: string;
  day: string;
  platform: string | null;
  plan: string | null;
  label?: string;
  kind?: "trial" | "paid" | "converted";
  installIds?: string[];
  accountKeys?: string[];
  customerIds?: string[];
  tenure?: number | null;
  matchedInstallId?: string;
};

export type StoreEvent = {
  id: string;
  type: string;
  store: string | null;
  product_id: string | null;
  period_type: string | null;
  event_at: string | null;
  original_transaction_id: string | null;
  app_user_id: string | null;
  original_app_user_id: string | null;
  raw: { is_trial_conversion?: boolean; aliases?: string[] } | null;
};

const PLAN_OF_PRODUCT: Record<string, string> = {
  orale_monthly: "monthly",
  orale_monthly_99: "monthly",
  orale_yearly: "yearly",
  orale_pro_monthly: "pro_monthly",
  orale_pro_monthly_199: "pro_monthly",
  orale_pro_yearly: "pro_yearly",
};

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export type BillingAlias = { key_hash: string; customer_id: string };

/** Solo se usa para agrupar los eventos de la tienda en días de México. */
function mxDateOf(iso: string | null): string | null {
  if (!iso || !Number.isFinite(Date.parse(iso))) return null;
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

export function revenueCatSub(event: StoreEvent): NewSub | null {
  const converted = event.type === "RENEWAL" && event.raw?.is_trial_conversion === true;
  if (event.type !== "INITIAL_PURCHASE" && !converted) return null;
  const day = mxDateOf(event.event_at);
  if (!day) return null;
  const product = (event.product_id ?? "").split(":")[0];
  const customerIds = [event.original_app_user_id, event.app_user_id, ...(event.raw?.aliases ?? [])]
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return {
    key: customerIds[0] ?? `rc:${event.id}`,
    day,
    platform: event.store === "APP_STORE" ? "ios" : event.store === "PLAY_STORE" ? "android" : event.store,
    plan: PLAN_OF_PRODUCT[product] ?? null,
    kind: converted ? "converted" : event.period_type === "TRIAL" ? "trial" : "paid",
    customerIds,
    // Misma identidad que accountKeyForGrant de StoreKit en la app.
    accountKeys: event.store === "APP_STORE" && event.original_transaction_id
      ? [hash(event.original_transaction_id)] : [],
  };
}

export type StripeSub = { user_id: string; plan: string | null; subscribed_at: string };

export function stripeSub(row: StripeSub): NewSub | null {
  if (!row.plan || row.plan === "unknown") return null;
  return {
    key: row.user_id, day: row.subscribed_at, platform: "windows", plan: row.plan,
    kind: "paid", accountKeys: [hash(row.user_id)],
  };
}

/** Vincula compras con la MISMA fila de uso que alimenta la tabla Usuarios.
 * No calcula fechas de registro ni antigüedad al pagar: conserva days_since_install.
 * Solo une IDs exactos o alias verificados, nunca por nombre, plan o fecha.
 */
export function enrichSubscriberTenure(
  subs: NewSub[], rows: PingRow[], billingAliases: BillingAlias[] = [],
): NewSub[] {
  const byIdentity = new Map<string, PingRow[]>();
  const customersByAlias = new Map(billingAliases.map((a) => [a.key_hash, a.customer_id]));
  const androidIds = new Map<string, string[]>();
  for (const row of rows) {
    const identities = new Set([row.install_id, row.account_key].filter((id): id is string => !!id));
    if (row.platform === "android" && row.account_key) {
      let ids = androidIds.get(row.account_key);
      if (!ids) {
        ids = [`orale_purchase_${hash(`orale-revenuecat-v1:google:${row.account_key}`)}`];
        const customer = customersByAlias.get(hash(`google:${row.account_key}`));
        if (customer) ids.push(customer);
        androidIds.set(row.account_key, ids);
      }
      for (const id of ids) identities.add(id);
    }
    for (const id of identities) {
      if (!byIdentity.has(id)) byIdentity.set(id, []);
      byIdentity.get(id)!.push(row);
    }
  }
  return subs.map((sub) => {
    const ids = [sub.key, ...(sub.customerIds ?? []), ...(sub.accountKeys ?? []), ...(sub.installIds ?? [])];
    const linked = [...new Set(ids.flatMap((id) => byIdentity.get(id) ?? []))];
    // El account_key puede cambiar al cambiar de compra/plan. Una vez resuelto
    // el dispositivo, usa TODO su historial, como la tabla de usuarios.
    const installIds = [...new Set(linked.map((r) => r.install_id))];
    const matches = installIds.flatMap((id) => byIdentity.get(id) ?? [])
      .filter((r) => r.is_caja !== false && r.ping_date <= sub.day)
      .sort((a, b) => b.ping_date.localeCompare(a.ping_date) || (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    const latest = matches[0];
    const tenure = latest?.days_since_install;
    return {
      ...sub, installIds,
      matchedInstallId: latest?.install_id,
      tenure: tenure != null && Number.isSafeInteger(tenure) && tenure >= 0 ? tenure : null,
    };
  });
}
