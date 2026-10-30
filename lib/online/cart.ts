import type { CartLine, Catalog, Checkout, HoursDay } from "./types";
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

/** Día (0 = lunes, como daysMask) y minuto en la hora del negocio. */
function businessClock(catalog: Catalog, now: Date) {
  const local = new Date(now.getTime() + catalog.utcOffsetMinutes * 60000);
  return {
    weekday: (local.getUTCDay() + 6) % 7,
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

const allDay = (d: HoursDay) => d.open && d.from === d.to;
const overnight = (d: HoursDay) => d.open && d.from > d.to;

/** «1:00 p.m.», «9:30 a.m.». */
export function clock12(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = String(minute % 60).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "a.m." : "p.m."}`;
}

export type StoreHours =
  | { open: true; closesAt: number | null }
  | { open: false; opensIn: number; opensAt: number };

/**
 * Si el menú recibe pedidos ahora, en la hora del negocio. Sin horario, siempre
 * (los menús de antes no tienen). Abierto: a qué minuto cierra hoy (null todo
 * el día). Cerrado: en cuántos días y a qué minuto vuelve a abrir.
 */
export function storeHours(catalog: Catalog, now: Date): StoreHours {
  const hours = catalog.hours;
  if (!hours || hours.length !== 7) return { open: true, closesAt: null };
  const { weekday, minute } = businessClock(catalog, now);
  const today = hours[weekday];
  const yesterday = hours[(weekday + 6) % 7];
  // Lo de anoche que cierra esta madrugada.
  if (yesterday.open && overnight(yesterday) && minute < yesterday.to) {
    return { open: true, closesAt: yesterday.to };
  }
  if (today.open) {
    if (allDay(today)) return { open: true, closesAt: null };
    if (overnight(today) ? minute >= today.from : minute >= today.from && minute < today.to) {
      return { open: true, closesAt: today.to };
    }
  }
  for (let d = 0; d < 8; d++) {
    const day = hours[(weekday + d) % 7];
    if (day.open && (d > 0 || day.from > minute)) {
      return { open: false, opensIn: d, opensAt: day.from };
    }
  }
  return { open: false, opensIn: 7, opensAt: 0 };
}

/** «Abre hoy a la 1:00 p.m.», «Abre mañana…», «Abre el lunes…». */
export function opensLabel(catalog: Catalog, h: Extract<StoreHours, { open: false }>, now: Date): string {
  const { weekday } = businessClock(catalog, now);
  const names = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const when = h.opensIn === 0 ? "hoy" : h.opensIn === 1 ? "mañana" : `el ${names[(weekday + h.opensIn) % 7]}`;
  const time = clock12(h.opensAt);
  return `Abre ${when} a la${time.startsWith("1:") ? "" : "s"} ${time}`;
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
