import "server-only";
import { createHash } from "node:crypto";
import { adminClient } from "@/lib/supabase";
import { MenuError } from "./server";
import { quoteCart, whatsappOrder } from "./cart";
import type { Menu, CartLine, Checkout } from "./types";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export async function storeOrder(slug: string, menu: Menu, lines: CartLine[], checkout: Checkout, requestKey: unknown, ip: string) {
  if (typeof requestKey !== "string" || !/^[a-f0-9]{64}$/.test(requestKey))
    throw new MenuError("Actualiza la página y vuelve a enviar tu pedido.", 400);
  const db = adminClient();
  for (const [key, max] of [[`online:buyer:${hash(ip)}`, 200], [`online:orders:${slug}`, 5000]] as const) {
    const { data, error } = await db.rpc("bump_ai_usage", { p_install_id: key, p_max: max });
    if (error) throw new MenuError("No pudimos preparar el pedido. Intenta más tarde.");
    if (data !== true) throw new MenuError("Demasiados intentos. Intenta más tarde.", 429);
  }
  // Validation and prices always come from the current server catalogue.
  const now = new Date();
  whatsappOrder(menu.catalog, lines, checkout, now);
  const q = quoteCart(menu.catalog, lines, now);
  const payload = {
    version: 1,
    checkout: { name: checkout.name.trim(), fulfillment: checkout.fulfillment, address: checkout.fulfillment === "delivery" ? checkout.address.trim() : "" },
    lines: q.priced.map(p => ({ productId: p.product.id, productName: p.product.name, variantId: p.variant.id, variantName: p.variant.name, variantPrice: p.variant.price, choices: p.choices.map(c => ({id: c.id, name: c.name, price: c.price})), quantity: p.line.quantity, notes: p.line.notes.trim(), total: p.total })),
    subtotal: q.subtotal, discount: q.discount, total: q.total, promotion: q.promotion,
  };
  const fingerprint = hash(JSON.stringify(payload));
  const tokenHash = hash(requestKey);
  const {data: store, error: storeError} = await db.from("online_stores").select("id,catalog_hash,enabled,paid_until").eq("slug", slug).maybeSingle();
  if (storeError || !store) throw new MenuError("No pudimos preparar el pedido.");
  if (!store.enabled || Date.parse(store.paid_until) <= Date.now()) throw new MenuError("El menú ya no está disponible.", 409);
  if (store.catalog_hash !== menu.revision) throw new MenuError("El menú cambió. Actualiza la página antes de continuar.", 409);
  const {error} = await db.from("online_order_requests").insert({store_id: store.id, token_hash: tokenHash, fingerprint, payload});
  if (error && error.code !== "23505") throw new MenuError("No pudimos guardar el pedido. Intenta de nuevo.");
  if (error) {
    const existing = await db.from("online_order_requests").select("fingerprint,expires_at").eq("store_id", store.id).eq("token_hash", tokenHash).single();
    if (existing.error || existing.data.fingerprint !== fingerprint) throw new MenuError("El pedido cambió. Actualiza la página antes de enviarlo.", 409);
    if (Date.parse(existing.data.expires_at) <= Date.now()) throw new MenuError("El pedido venció. Actualiza la página para preparar uno nuevo.", 410);
  }
  // Never take the production origin from a user-controlled Host header.
  const base = process.env.ONLINE_ORDER_WEB_URL ?? "https://oraleai.vercel.app";
  const url = new URL(`/pedido/${store.id}/${requestKey}`, base);
  if (process.env.ONLINE_ORDER_DEVELOPMENT === "true") url.searchParams.set("entorno", "prueba");
  return whatsappOrder(menu.catalog, lines, checkout, now, url.toString());
}
