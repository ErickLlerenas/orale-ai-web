import type { Catalog, CartLine, Checkout } from "./types";
export const money = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(cents / 100);

// Only the public demo accepts a destination from the visitor. Real orders
// always use the phone from the server's published business catalogue.
export function demoPhoneNumber(input: string): string {
  const compact = input.trim().replace(/[ ()-]/g, "");
  if (!/^\+?[1-9]\d{7,14}$/.test(compact))
    throw new Error(
      "Escribe tu WhatsApp con código de país, por ejemplo +52 y tus 10 dígitos.",
    );
  return compact.replace(/^\+/, "");
}

export function quoteCart(
  catalog: Catalog,
  lines: CartLine[],
  now = new Date(),
) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50)
    throw new Error("Agrega al menos un producto (máximo 50 renglones).");
  const counts = new Map<string, number>();
  const priced = lines.map((line) => {
    if (
      !line ||
      typeof line !== "object" ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 99 ||
      typeof line.notes !== "string" ||
      line.notes.length > 500
    )
      throw new Error("Revisa las cantidades y notas del pedido.");
    const product = catalog.products.find((p) => p.id === line.productId);
    if (!product?.available)
      throw new Error("Un producto ya no está disponible. Revisa tu carrito.");
    const count = (counts.get(product.id) ?? 0) + line.quantity;
    counts.set(product.id, count);
    if (product.stock != null && count > product.stock)
      throw new Error(`Solo quedan ${product.stock} de ${product.name}.`);
    const variant = product.variants.find((v) => v.id === line.variantId);
    if (!variant) throw new Error(`Revisa la presentación de ${product.name}.`);
    if (
      !Array.isArray(line.choiceIds) ||
      line.choiceIds.length > 100 ||
      new Set(line.choiceIds).size !== line.choiceIds.length
    )
      throw new Error("Revisa los extras del pedido.");
    const allowed = product.options.flatMap((o) => o.choices);
    const choices = line.choiceIds.map((id) => {
      const c = allowed.find((c) => c.id === id);
      if (!c)
        throw new Error(`Un extra de ${product.name} ya no está disponible.`);
      return c;
    });
    for (const option of product.options) {
      const count = choices.filter((c) =>
        option.choices.some((o) => o.id === c.id),
      ).length;
      if ((option.required && count === 0) || (!option.multiple && count > 1))
        throw new Error(`Revisa ${option.name} de ${product.name}.`);
    }
    const unit = variant.price + choices.reduce((sum, c) => sum + c.price, 0);
    return {
      line,
      product,
      variant,
      choices,
      unit,
      total: unit * line.quantity,
    };
  });
  const subtotal = priced.reduce((sum, p) => sum + p.total, 0);
  // Same NxM rule as the POS: sort descending, give the last N-M in each
  // group free; choose the best single promotion, never stack promotions.
  const local = new Date(now.getTime() + catalog.utcOffsetMinutes * 60000);
  const weekday = (local.getUTCDay() + 6) % 7;
  let discount = 0;
  let promotion = "";
  for (const promo of catalog.promotions) {
    if (promo.daysMask && !(promo.daysMask & (1 << weekday))) continue;
    if (promo.buy < 2 || promo.pay < 1 || promo.pay >= promo.buy) continue;
    const slots = priced
      .filter(
        (p) =>
          promo.productIds.includes(p.product.id) &&
          (!promo.choiceIds.length ||
            p.choices.some((c) => promo.choiceIds.includes(c.id))),
      )
      .flatMap((p) => Array.from({ length: p.line.quantity }, () => p.unit))
      .sort((a, b) => b - a);
    const candidate = slots.reduce(
      (sum, price, i) => sum + (i % promo.buy >= promo.pay ? price : 0),
      0,
    );
    if (candidate > discount) {
      discount = candidate;
      promotion = promo.name;
    }
  }
  return { priced, subtotal, discount, promotion, total: subtotal - discount };
}

export function whatsappOrder(
  catalog: Catalog,
  lines: CartLine[],
  checkout: Checkout,
  now = new Date(),
) {
  if (
    !checkout ||
    typeof checkout.name !== "string" ||
    !checkout.name.trim() ||
    checkout.name.length > 100 ||
    !["pickup", "delivery"].includes(checkout.fulfillment) ||
    typeof checkout.address !== "string" ||
    checkout.address.length > 500 ||
    (checkout.fulfillment === "delivery" && !checkout.address.trim())
  )
    throw new Error("Completa tu nombre y los datos de entrega.");
  if (checkout.fulfillment === "delivery" && catalog.acceptsDelivery !== true)
    throw new Error("Este negocio solo acepta pedidos para recoger.");
  const q = quoteCart(catalog, lines, now);
  const parts = [
    "🛍️ *SOLICITUD DE PEDIDO*",
    `*${catalog.name}*`,
    "",
    ...q.priced.flatMap((p, index) => [
      ...(index ? [""] : []),
      `*${p.line.quantity} × ${p.product.name}${p.product.variants.length > 1 ? ` (${p.variant.name})` : ""}* — *${money(p.total)}*`,
      ...p.choices.map(
        (c) => `  • ${c.name}${c.price ? ` (+${money(c.price)} c/u)` : ""}`,
      ),
      ...(p.line.notes.trim() ? [`  Nota: ${p.line.notes.trim()}`] : []),
    ]),
    "",
    ...(q.discount
      ? [
          `Subtotal: ${money(q.subtotal)}`,
          `${q.promotion}: −${money(q.discount)}`,
        ]
      : []),
    `*Total de productos: ${money(q.total)}*`,
    "",
    `👤 *Cliente:* ${checkout.name.trim()}`,
    ...(checkout.fulfillment === "delivery"
      ? [
          "🛵 *Entrega: A domicilio*",
          `*Dirección:* ${checkout.address.trim()}`,
          "Costo de envío por confirmar.",
        ]
      : [
          "🛍️ *Entrega: Pasar a recoger*",
          ...(catalog.address.trim()
            ? [`*Recoger en:* ${catalog.address.trim()}`]
            : []),
        ]),
    "",
    checkout.fulfillment === "delivery"
      ? "¿Me confirman disponibilidad, total y tiempo de entrega?"
      : "¿Me confirman disponibilidad, total y tiempo de preparación?",
  ];
  const message = parts.join("\n");
  if (message.length > 7500)
    throw new Error(
      "Tu pedido es muy largo. Reduce las notas o divídelo en dos mensajes.",
    );
  return {
    url: `https://wa.me/${catalog.phone}?text=${encodeURIComponent(message)}`,
    total: q.total,
    message,
  };
}
