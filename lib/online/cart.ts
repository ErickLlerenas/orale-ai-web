import type { CartLine, Catalog, Checkout, HoursDay, Product } from "./types";

/** Idioma en que el comensal ve la página. El pedido al negocio va siempre en
 * español: los mensajes de este archivo salen en español si no se pide otro. */
export type Lang = "es" | "en";

/**
 * Un aviso para el comensal con su plantilla («Solo quedan {n} de {product}.»)
 * y sus datos aparte. El mensaje es el de siempre, en español; la página usa
 * la plantilla para enseñarlo en inglés (lib/online/i18n.ts).
 */
export class CartError extends Error {
  constructor(
    readonly template: string,
    readonly vars: Record<string, string | number> = {},
  ) {
    super(
      template.replace(/\{(\w+)\}/g, (m, k: string) =>
        k in vars ? String(vars[k]) : m,
      ),
    );
  }
}
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

/** «1:00 p.m.», «9:30 a.m.». En inglés, «1:00 PM». */
export function clock12(minute: number, lang: Lang = "es"): string {
  const h = Math.floor(minute / 60) % 24;
  const m = String(minute % 60).padStart(2, "0");
  const half = lang === "en" ? (h < 12 ? "AM" : "PM") : h < 12 ? "a.m." : "p.m.";
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${half}`;
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
export function opensLabel(
  catalog: Catalog,
  h: Extract<StoreHours, { open: false }>,
  now: Date,
  lang: Lang = "es",
): string {
  const { weekday } = businessClock(catalog, now);
  if (lang === "en") {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const day = h.opensIn === 0 ? "today" : h.opensIn === 1 ? "tomorrow" : days[(weekday + h.opensIn) % 7];
    return `Opens ${day} at ${clock12(h.opensAt, "en")}`;
  }
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
export function promotionLabel(p: Promotion, lang: Lang = "es"): string {
  return p.fixedPriceCents != null
    ? `${
      p.requireEachProduct
        ? "Combo"
        : lang === "en"
        ? `${p.buy} items for`
        : `${p.buy} productos por`
    } ${money(p.fixedPriceCents)}`
    : `${p.buy}x${p.pay}`;
}
export function promotionSchedule(p: Promotion, lang: Lang = "es"): string {
  const days = !p.daysMask || p.daysMask === 127
    ? lang === "en" ? "Every day" : "Todos los días"
    : (lang === "en"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"])
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
/** [tr] traduce los nombres del dueño (platillos y extras) al idioma pedido. */
export function promotionConditions(
  catalog: Catalog,
  p: Promotion,
  lang: Lang = "es",
  tr: (text: string) => string = (text) => text,
): string {
  const names = catalog.products.filter((x) => p.productIds.includes(x.id)).map(
    (x) => tr(x.name),
  ).join(", ");
  const choices = catalog.products.flatMap((x) =>
    x.options.flatMap((o) => o.choices)
  )
    .filter((x) => p.choiceIds.includes(x.id));
  const selected = [...new Map(choices.map((x) => [x.id, tr(x.name)])).values()]
    .join(", ");
  if (lang === "en") {
    return `${promotionSchedule(p, "en")}. ${
      p.requireEachProduct ? "One of each item: " : "Included: "
    }${names}.${
      selected ? ` Requires one of these extras: ${selected}.` : ""
    }${
      p.fixedPriceCents != null
        ? " Extras are charged separately. Complete groups only; if the regular price is lower, that one applies."
        : ""
    } The best promotion is applied when you confirm your order.`;
  }
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

/** La primera opción obligatoria sin nada elegido; null si ya se puede
 * agregar. Misma regla que [quoteCart]. */
export function missingRequiredOption(product: Product, choiceIds: string[]) {
  return (
    product.options.find(
      (o) => o.required && !o.choices.some((c) => choiceIds.includes(c.id)),
    ) ?? null
  );
}

export function quoteCart(
  catalog: Catalog,
  lines: CartLine[],
  now = new Date(),
) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50) {
    throw new CartError("Agrega al menos un producto (máximo 50 renglones).");
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
      throw new CartError("Revisa las cantidades y notas del pedido.");
    }
    const product = catalog.products.find((p) => p.id === line.productId);
    if (!product?.available) {
      throw new CartError("Un producto ya no está disponible. Revisa tu carrito.");
    }
    const count = (counts.get(product.id) ?? 0) + line.quantity;
    counts.set(product.id, count);
    if (product.stock != null && count > product.stock) {
      throw new CartError("Solo quedan {n} de {product}.", {
        n: product.stock,
        product: product.name,
      });
    }
    const variant = product.variants.find((v) => v.id === line.variantId);
    if (!variant) {
      throw new CartError("Revisa la presentación de {product}.", {
        product: product.name,
      });
    }
    if (
      !Array.isArray(line.choiceIds) ||
      line.choiceIds.length > 100 ||
      new Set(line.choiceIds).size !== line.choiceIds.length
    ) {
      throw new CartError("Revisa los extras del pedido.");
    }
    const allowed = product.options.flatMap((o) => o.choices);
    const choices = line.choiceIds.map((id) => {
      const c = allowed.find((c) => c.id === id);
      if (!c) {
        throw new CartError("Un extra de {product} ya no está disponible.", {
          product: product.name,
        });
      }
      return c;
    });
    for (const option of product.options) {
      const count = choices.filter((c) =>
        option.choices.some((o) => o.id === c.id)
      ).length;
      if ((option.required && count === 0) || (!option.multiple && count > 1)) {
        throw new CartError("Revisa {option} de {product}.", {
          option: option.name,
          product: product.name,
        });
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
  // Same NxM rule as the POS that published this menu, which rejects the
  // order if its own discount differs. Newer apps (promosFreeCheapest) give
  // away the cheapest units of the whole order; older ones, the cheapest of
  // each group. Choose the best single promotion, never stack promotions.
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
      if (catalog.promosFreeCheapest) {
        // Same count of free units as before, taken from the cheapest end.
        const rest = slots.length % promo.buy;
        const free = Math.floor(slots.length / promo.buy) *
            (promo.buy - promo.pay) + Math.max(0, rest - promo.pay);
        candidate = slots.slice(slots.length - free).reduce(
          (sum, price) => sum + price,
          0,
        );
      } else {
        candidate = slots.reduce(
          (sum, price, i) => sum + (i % promo.buy >= promo.pay ? price : 0),
          0,
        );
      }
    }
    if (candidate > discount) {
      discount = candidate;
      promotion = promo.name;
    }
  }
  return { priced, subtotal, discount, promotion, total: subtotal - discount };
}

/** WhatsApp de México en 10 dígitos. Acepta espacios y guiones, y quita lo que
 * la gente todavía escribe adelante: +52, 521, 044, 045 o 01. "" si no queda
 * un número de México (10 dígitos que no empiezan con 0 ni 1). */
export function mxPhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 13 && /^(521|044|045)/.test(digits)) {
    digits = digits.slice(3);
  } else if (digits.length === 12 && /^(52|01)/.test(digits)) {
    digits = digits.slice(2);
  }
  return /^[2-9]\d{9}$/.test(digits) ? digits : "";
}

/** El WhatsApp que se guarda con el pedido: solo a domicilio. */
export function checkoutPhone(checkout: Checkout): string {
  return checkout.fulfillment === "delivery" && typeof checkout.phone === "string"
    ? mxPhone(checkout.phone)
    : "";
}

const phoneLabel = (digits: string) =>
  `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;

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
    throw new CartError("Completa tu nombre y los datos de entrega.");
  }
  if (checkout.fulfillment === "delivery" && catalog.acceptsDelivery !== true) {
    throw new CartError("Este negocio solo acepta pedidos para recoger.");
  }
  // Una página abierta antes de pedir el WhatsApp no manda el campo: ese
  // pedido entra como antes, sin teléfono.
  const phone = checkoutPhone(checkout);
  if (
    checkout.fulfillment === "delivery" &&
    typeof checkout.phone === "string" &&
    !phone
  ) {
    throw new CartError("Escribe tu WhatsApp a 10 dígitos.");
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
    ...(phone ? [`📱 *WhatsApp:* ${phoneLabel(phone)}`] : []),
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
    throw new CartError(
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
