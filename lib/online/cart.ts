import type { CartLine, Catalog, Checkout } from "./types";
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
  if (!/^\+?[1-9]\d{7,14}$/.test(compact)) {
    throw new Error(
      "Escribe tu WhatsApp con código de país, por ejemplo +52 y tus 10 dígitos.",
    );
  }
  return compact.replace(/^\+/, "");
}

type Promotion = Catalog["promotions"][number];
export function promotionActive(
  catalog: Catalog,
  promo: Promotion,
  now: Date,
): boolean {
  const local = new Date(now.getTime() + catalog.utcOffsetMinutes * 60000);
  const weekday = (local.getUTCDay() + 6) % 7;
  if (promo.daysMask && !(promo.daysMask & (1 << weekday))) return false;
  if (promo.startsAtMinute == null && promo.endsAtMinute == null) return true;
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  return promo.startsAtMinute != null && promo.endsAtMinute != null &&
    promo.startsAtMinute >= 0 && promo.endsAtMinute <= 1440 &&
    promo.startsAtMinute < promo.endsAtMinute &&
    minute >= promo.startsAtMinute && minute < promo.endsAtMinute;
}
export function promotionLabel(p: Promotion): string {
  return p.fixedPriceCents != null
    ? `${p.requireEachProduct ? "Combo" : `${p.buy} productos por`} ${
      money(p.fixedPriceCents)
    }`
    : `${p.buy}x${p.pay}`;
}
export function promotionSchedule(p: Promotion): string {
  const days = !p.daysMask || p.daysMask === 127
    ? "Todos los días"
    : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
      .filter((_, i) => p.daysMask & (1 << i)).join(", ");
  const clock = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${
      String(m % 60).padStart(2, "0")
    }`;
  return days +
    (p.startsAtMinute != null && p.endsAtMinute != null
      ? ` · ${clock(p.startsAtMinute)}–${clock(p.endsAtMinute)}`
      : "");
}
export function promotionConditions(catalog: Catalog, p: Promotion): string {
  const names = catalog.products.filter((x) => p.productIds.includes(x.id)).map(
    (x) => x.name,
  ).join(", ");
  const choices = catalog.products.flatMap((x) =>
    x.options.flatMap((o) => o.choices)
  )
    .filter((x) => p.choiceIds.includes(x.id));
  const selected = [...new Map(choices.map((x) => [x.id, x.name])).values()]
    .join(", ");
  return `${promotionSchedule(p)}. ${
    p.requireEachProduct ? "Uno de cada producto: " : "Participan: "
  }${names}.${
    selected ? ` Requiere alguno de estos extras: ${selected}.` : ""
  }${
    p.fixedPriceCents != null
      ? " Extras por separado. Solo grupos completos; si el precio individual resulta menor, se respeta."
      : ""
  } Se aplica la mejor promoción al confirmar el pedido.`;
}

export function quoteCart(
  catalog: Catalog,
  lines: CartLine[],
  now = new Date(),
) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50) {
    throw new Error("Agrega al menos un producto (máximo 50 renglones).");
  }
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
    ) {
      throw new Error("Revisa las cantidades y notas del pedido.");
    }
    const product = catalog.products.find((p) => p.id === line.productId);
    if (!product?.available) {
      throw new Error("Un producto ya no está disponible. Revisa tu carrito.");
    }
    const count = (counts.get(product.id) ?? 0) + line.quantity;
    counts.set(product.id, count);
    if (product.stock != null && count > product.stock) {
      throw new Error(`Solo quedan ${product.stock} de ${product.name}.`);
    }
    const variant = product.variants.find((v) => v.id === line.variantId);
    if (!variant) throw new Error(`Revisa la presentación de ${product.name}.`);
    if (
      !Array.isArray(line.choiceIds) ||
      line.choiceIds.length > 100 ||
      new Set(line.choiceIds).size !== line.choiceIds.length
    ) {
      throw new Error("Revisa los extras del pedido.");
    }
    const allowed = product.options.flatMap((o) => o.choices);
    const choices = line.choiceIds.map((id) => {
      const c = allowed.find((c) => c.id === id);
      if (!c) {
        throw new Error(`Un extra de ${product.name} ya no está disponible.`);
      }
      return c;
    });
    for (const option of product.options) {
      const count = choices.filter((c) =>
        option.choices.some((o) => o.id === c.id)
      ).length;
      if ((option.required && count === 0) || (!option.multiple && count > 1)) {
        throw new Error(`Revisa ${option.name} de ${product.name}.`);
      }
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
  let discount = 0;
  let promotion = "";
  for (const promo of catalog.promotions) {
    if (!promotionActive(catalog, promo, now)) continue;
    const eligible = priced.filter((p) =>
      promo.productIds.includes(p.product.id) &&
      (!promo.choiceIds.length ||
        p.choices.some((c) => promo.choiceIds.includes(c.id)))
    );
    let candidate = 0;
    if (promo.fixedPriceCents != null) {
      if (promo.buy < 2 || promo.fixedPriceCents <= 0) continue;
      const slots = eligible.flatMap((p) =>
        Array.from(
          { length: p.line.quantity },
          () => ({ id: p.product.id, price: p.variant.price }),
        )
      ).sort((a, b) => b.price - a.price);
      if (promo.requireEachProduct) {
        const ids = [...new Set(promo.productIds)];
        if (ids.length < 2) continue;
        const groups = ids.map((id) => slots.filter((s) => s.id === id));
        const count = Math.min(...groups.map((g) => g.length));
        for (let i = 0; i < count; i++) {
          candidate += Math.max(
            0,
            groups.reduce((sum, g) => sum + g[i].price, 0) -
              promo.fixedPriceCents,
          );
        }
      } else {
        for (let i = 0; i + promo.buy <= slots.length; i += promo.buy) {
          candidate += Math.max(
            0,
            slots.slice(i, i + promo.buy).reduce((sum, s) => sum + s.price, 0) -
              promo.fixedPriceCents,
          );
        }
      }
    } else {
      if (promo.buy < 2 || promo.pay < 1 || promo.pay >= promo.buy) continue;
      const slots = eligible.flatMap((p) =>
        Array.from({ length: p.line.quantity }, () => p.unit)
      ).sort((a, b) => b - a);
      candidate = slots.reduce(
        (sum, price, i) => sum + (i % promo.buy >= promo.pay ? price : 0),
        0,
      );
    }
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
  orderUrl?: string,
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
  ) {
    throw new Error("Completa tu nombre y los datos de entrega.");
  }
  if (checkout.fulfillment === "delivery" && catalog.acceptsDelivery !== true) {
    throw new Error("Este negocio solo acepta pedidos para recoger.");
  }
  const q = quoteCart(catalog, lines, now);
  const parts = [
    "🛍️ *SOLICITUD DE PEDIDO*",
    `*${catalog.name}*`,
    "",
    ...q.priced.flatMap((p, index) => [
      ...(index ? [""] : []),
      `*${p.line.quantity} × ${p.product.name}${
        p.product.variants.length > 1 ? ` (${p.variant.name})` : ""
      }* — *${money(p.total)}*`,
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
  if (orderUrl) {
    parts.push("", "📲 *Para la caja · Abrir pedido en Órale AI:*", orderUrl);
  }
  const message = parts.join("\n");
  if (message.length > 7500) {
    throw new Error(
      "Tu pedido es muy largo. Reduce las notas o divídelo en dos mensajes.",
    );
  }
  return {
    // Avoid wa.me redirects, which can replace non-BMP emoji with U+FFFD.
    url: `https://api.whatsapp.com/send?phone=${catalog.phone}&text=${
      encodeURIComponent(message)
    }`,
    total: q.total,
    message,
  };
}
