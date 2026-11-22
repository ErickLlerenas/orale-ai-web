import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
// Compile only the pure production module; no new test runtime dependency.
const dir = mkdtempSync(join(tmpdir(), "orale-cart-"));
const file = join(dir, "cart.cjs");
writeFileSync(
  file,
  ts.transpileModule(
    readFileSync(new URL("../lib/online/cart.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText,
);
const {
  checkoutPhone,
  missingRequiredOption,
  mxPhone,
  quoteCart,
  whatsappOrder,
  demoPhoneNumber,
  promotionActive,
  promotionLabel,
  promotionConditions,
  storeHours,
  opensLabel,
} = createRequire(
  import.meta.url,
)(file);
rmSync(dir, { recursive: true, force: true });
const catalog = () => ({
  acceptsDelivery: true,
  version: 1,
  utcOffsetMinutes: -360,
  name: "Tacos de prueba",
  phone: "526641234567",
  address: "",
  categories: [{ id: "c", name: "Tacos" }],
  products: [
    {
      id: "p",
      name: "Taco",
      categoryId: "c",
      description: "",
      available: true,
      stock: 10,
      variants: [{ id: "v", name: "Normal", price: 2500 }],
      options: [
        {
          id: "o",
          name: "Salsa",
          required: true,
          multiple: false,
          choices: [
            { id: "s", name: "Verde", price: 0 },
            { id: "r", name: "Roja", price: 500 },
          ],
        },
      ],
    },
  ],
  promotions: [],
});
const line = (extra = {}) => ({
  productId: "p",
  variantId: "v",
  quantity: 1,
  choiceIds: ["s"],
  notes: "",
  ...extra,
});
const checkout = {
  name: "Cliente de prueba",
  fulfillment: "pickup",
  address: "",
};
test("prices come from catalogue, extras and quantity are included", () => {
  const q = quoteCart(catalog(), [
    line({ quantity: 2, choiceIds: ["r"], price: 1 }),
  ]);
  assert.equal(q.total, 6000);
});
test("reject unavailable, unknown variant and missing or duplicated required choices", () => {
  const c = catalog();
  c.products[0].available = false;
  assert.throws(() => quoteCart(c, [line()]));
  for (
    const bad of [
      line({ variantId: "unknown" }),
      line({ choiceIds: [] }),
      line({ choiceIds: ["s", "s"] }),
      line({ choiceIds: ["s", "r"] }),
      line({ choiceIds: ["foreign"] }),
    ]
  ) {
    assert.throws(() => quoteCart(catalog(), [bad]));
  }
});
test("the form points at the first required option with nothing chosen", () => {
  const product = catalog().products[0];
  product.options.unshift({
    id: "x",
    name: "Extras",
    required: false,
    multiple: true,
    choices: [{ id: "q", name: "Queso", price: 500 }],
  });
  product.options.push({
    id: "t",
    name: "Tortilla",
    required: true,
    multiple: false,
    choices: [{ id: "m", name: "Maíz", price: 0 }],
  });
  assert.equal(missingRequiredOption(product, [])?.id, "o");
  assert.equal(missingRequiredOption(product, ["q", "s"])?.id, "t");
  assert.equal(missingRequiredOption(product, ["s", "m"]), null);
  // Lo que el formulario deja pasar, el cotizador lo acepta.
  assert.doesNotThrow(() =>
    quoteCart(catalog(), [line({ choiceIds: ["s"] })])
  );
});
test("stock checked across separate cart rows and quantities are bounded", () => {
  assert.throws(() =>
    quoteCart(catalog(), [line({ quantity: 6 }), line({ quantity: 6 })])
  );
  for (const q of [-1, 0, 1.5, 100, NaN]) {
    assert.throws(() => quoteCart(catalog(), [line({ quantity: q })]));
  }
});
test("NxM matches POS, most valuable single promotion wins", () => {
  const c = catalog();
  c.promotions = [
    {
      id: "promo",
      name: "3x2",
      daysMask: 0,
      buy: 3,
      pay: 2,
      productIds: ["p"],
      choiceIds: [],
    },
    {
      id: "other",
      name: "2x1",
      daysMask: 0,
      buy: 2,
      pay: 1,
      productIds: ["p"],
      choiceIds: [],
    },
  ];
  const q = quoteCart(c, [line({ quantity: 4 })]);
  assert.equal(q.subtotal, 10000);
  assert.equal(q.discount, 5000);
  assert.equal(q.promotion, "2x1");
});
test("NxM follows the rule of the POS that published the menu", () => {
  // 3x2 con 4 piezas de $260 y 2 de $180.
  const c = catalog();
  c.products[0].variants[0].price = 18000;
  c.products.push({
    ...c.products[0],
    id: "b",
    name: "Mar y tierra",
    variants: [{ id: "bv", name: "Normal", price: 26000 }],
  });
  c.promotions = [
    {
      id: "promo",
      name: "3x2",
      daysMask: 0,
      buy: 3,
      pay: 2,
      productIds: ["p", "b"],
      choiceIds: [],
    },
  ];
  const rows = [
    line({ productId: "b", variantId: "bv", quantity: 4 }),
    line({ quantity: 2 }),
  ];
  // Caja de antes: la más barata de cada trío (una de 260 y una de 180).
  assert.equal(quoteCart(c, rows).discount, 44000);
  // Caja nueva: las dos más baratas de todo el pedido.
  c.promosFreeCheapest = true;
  const q = quoteCart(c, rows);
  assert.equal(q.subtotal, 140000);
  assert.equal(q.discount, 36000);
  assert.equal(q.total, 104000);
  // Un solo grupo, o todo al mismo precio: las dos reglas dan lo mismo.
  assert.equal(quoteCart(c, [line({ quantity: 6 })]).discount, 36000);
  assert.equal(
    quoteCart(c, [
      line({ productId: "b", variantId: "bv", quantity: 2 }),
      line(),
    ]).discount,
    18000,
  );
  // 5 piezas: sigue siendo una gratis, la más barata.
  assert.equal(
    quoteCart(c, [
      line({ productId: "b", variantId: "bv", quantity: 4 }),
      line(),
    ]).discount,
    18000,
  );
});
test("promotion uses business day and eligible extras", () => {
  const c = catalog();
  c.promotions = [
    {
      id: "promo",
      name: "Lunes",
      daysMask: 1,
      buy: 2,
      pay: 1,
      productIds: ["p"],
      choiceIds: ["r"],
    },
  ];
  const mondayLocal = new Date("2026-09-22T03:00:00Z");
  assert.equal(
    quoteCart(c, [line({ quantity: 2, choiceIds: ["r"] })], mondayLocal)
      .discount,
    3000,
  );
  assert.equal(quoteCart(c, [line({ quantity: 2 })], mondayLocal).discount, 0);
  assert.equal(
    quoteCart(
      c,
      [line({ quantity: 2, choiceIds: ["r"] })],
      new Date("2026-09-22T12:00:00Z"),
    ).discount,
    0,
  );
});
test("WhatsApp destination is profile phone; message safely encodes notes and totals", () => {
  const result = whatsappOrder(
    catalog(),
    [line({ notes: "Sin cebolla & limón + salsa" })],
    checkout,
  );
  const url = new URL(result.url);
  assert.equal(url.origin, "https://api.whatsapp.com");
  assert.equal(url.pathname, "/send");
  assert.equal(url.searchParams.get("phone"), "526641234567");
  const text = url.searchParams.get("text");
  assert.equal(
    result.message,
    text,
    "demo shows the exact message sent to WhatsApp",
  );
  assert.match(text, /Sin cebolla & limón \+ salsa/);
  assert.match(text, /\$25\.00/);
  assert.match(text, /confirman disponibilidad/);
});
test("delivery requires address and never claims shipping is included or order accepted", () => {
  assert.throws(() =>
    whatsappOrder(catalog(), [line()], {
      ...checkout,
      fulfillment: "delivery",
    })
  );
  const result = whatsappOrder(catalog(), [line()], {
    ...checkout,
    fulfillment: "delivery",
    address: "Calle de prueba 1",
  });
  assert.match(decodeURIComponent(result.url), /Costo de envío por confirmar/);
});
test("delivery asks the buyer's WhatsApp in 10 digits and puts it in the order", () => {
  const delivery = {
    ...checkout,
    fulfillment: "delivery",
    address: "Calle de prueba 1",
  };
  for (const bad of ["", "618 123", "618 123 45678", "abc"]) {
    assert.throws(
      () => whatsappOrder(catalog(), [line()], { ...delivery, phone: bad }),
      /WhatsApp a 10 dígitos/,
    );
  }
  const result = whatsappOrder(catalog(), [line()], {
    ...delivery,
    phone: "+52 1 (618) 123-4567",
  });
  assert.match(result.message, /WhatsApp:\* 618 123 4567/);
  assert.equal(
    checkoutPhone({ ...delivery, phone: "+52 1 (618) 123-4567" }),
    "6181234567",
  );
  // Una página abierta antes del cambio no manda el campo: entra sin él.
  const old = whatsappOrder(catalog(), [line()], delivery);
  assert.doesNotMatch(old.message, /WhatsApp:/);
  // Para recoger no se pide ni se guarda.
  const pickup = whatsappOrder(catalog(), [line()], { ...checkout, phone: "" });
  assert.doesNotMatch(pickup.message, /WhatsApp:/);
  assert.equal(checkoutPhone({ ...checkout, phone: "6181234567" }), "");
});
test("mxPhone reads 10 digits with or without the country code", () => {
  assert.equal(mxPhone("618-123-4567"), "6181234567");
  assert.equal(mxPhone("526181234567"), "6181234567");
  assert.equal(mxPhone("5216181234567"), "6181234567");
  assert.equal(mxPhone("16181234567"), "");
  assert.equal(mxPhone("618123456"), "");
  // Lo que la gente todavía escribe adelante.
  assert.equal(mxPhone("044 618 123 4567"), "6181234567");
  assert.equal(mxPhone("045 55 1234 5678"), "5512345678");
  assert.equal(mxPhone("01 618 123 4567"), "6181234567");
  // En México ningún número empieza con 0 o 1: un dígito de menos tras el 521
  // ya no pasa como otro número.
  assert.equal(mxPhone("521 618 123 456"), "");
  assert.equal(mxPhone("0181234567"), "");
  assert.equal(mxPhone("1181234567"), "");
});
test("reject oversized input and empty orders", () => {
  assert.throws(() => quoteCart(catalog(), []));
  assert.throws(() => quoteCart(catalog(), [line({ notes: "x".repeat(501) })]));
  assert.throws(() =>
    whatsappOrder(catalog(), [line()], { ...checkout, name: "" })
  );
});

test("demo destination accepts a country code and rejects malformed numbers", () => {
  assert.equal(demoPhoneNumber("+52 (55) 1234-5678"), "525512345678");
  assert.equal(demoPhoneNumber("+1 202 555 0123"), "12025550123");
  for (
    const value of [
      "",
      "+52",
      "abc525512345678",
      "001234567890",
      "1234567890123456",
      "525512345678?text=oops",
    ]
  ) {
    assert.throws(() => demoPhoneNumber(value));
  }
  const result = whatsappOrder(
    { ...catalog(), phone: demoPhoneNumber("+52 (55) 1234-5678") },
    [line()],
    checkout,
  );
  assert.equal(new URL(result.url).searchParams.get("phone"), "525512345678");
  assert.equal(new URL(result.url).searchParams.get("text"), result.message);
});

test("pickup-only menus reject delivery even if a client submits it manually", () => {
  for (const value of [false, undefined, "true"]) {
    const c = { ...catalog(), acceptsDelivery: value };
    assert.throws(
      () =>
        whatsappOrder(c, [line()], {
          ...checkout,
          fulfillment: "delivery",
          address: "Domicilio de prueba",
        }),
      /solo acepta pedidos para recoger/,
    );
    const pickup = whatsappOrder(c, [line()], checkout);
    assert.match(pickup.message, /Entrega: Pasar a recoger/);
    assert.doesNotMatch(pickup.message, /Costo de envío|Dirección:/);
  }
});
test("formatted order separates items, extras, delivery and totals", () => {
  const c = catalog();
  c.address = "Dirección del negocio";
  const result = whatsappOrder(
    c,
    [line({ quantity: 2, choiceIds: ["r"], notes: "Sin cebolla" })],
    checkout,
  );
  assert.match(result.message, /\*SOLICITUD DE PEDIDO\*/);
  assert.match(result.message, /\*2 × Taco\* — \*\$60\.00\*/);
  assert.match(result.message, /• Roja \(\+\$5\.00 c\/u\)/);
  assert.match(result.message, /Nota: Sin cebolla/);
  assert.match(result.message, /\*Total de productos: \$60\.00\*/);
  assert.match(result.message, /\*Recoger en:\* Dirección del negocio/);
  assert.match(result.message, /\*Cliente:\* Cliente de prueba/);
  assert.doesNotMatch(result.message, /pedido confirmado|pagado/i);
});

test("direct WhatsApp link preserves emoji, accents and multiline notes", () => {
  const result = whatsappOrder(catalog(), [
    line({ notes: "🌮 Sin cebolla\nSalsa & limón" }),
  ], checkout);
  const url = new URL(result.url);
  assert.equal(url.origin, "https://api.whatsapp.com");
  assert.equal(url.pathname, "/send");
  assert.equal(url.searchParams.get("phone"), catalog().phone);
  assert.equal(url.searchParams.get("text"), result.message);
  assert.ok(result.message.includes("🌮 Sin cebolla\nSalsa & limón"));
  assert.ok(!result.message.includes("�"));
});

const offer = (extra = {}) => ({
  id: "promo",
  name: "La Posada",
  daysMask: 0,
  buy: 2,
  pay: 2,
  fixedPriceCents: 4000,
  productIds: ["p"],
  choiceIds: [],
  ...extra,
});
test("fixed price applies complete groups, preserves leftovers and charges extras separately", () => {
  const c = catalog();
  c.promotions = [offer()];
  const q = quoteCart(c, [line({ quantity: 5, choiceIds: ["r"] })]);
  assert.equal(q.subtotal, 15000);
  assert.equal(q.discount, 2000);
  assert.equal(q.total, 13000);
  assert.equal(c.products[0].variants[0].price, 2500);
  c.promotions = [offer({ fixedPriceCents: 6000 })];
  assert.equal(quoteCart(c, [line({ quantity: 2 })]).discount, 0);
});
test("mixed products use highest complete groups and best single offer without stacking", () => {
  const c = catalog();
  c.products.push({
    ...c.products[0],
    id: "b",
    name: "Sope",
    variants: [{ id: "bv", name: "Normal", price: 3000 }],
  });
  c.promotions = [offer({ productIds: ["p", "b"] })];
  const rows = [
    line({ quantity: 2 }),
    line({ productId: "b", variantId: "bv" }),
  ];
  assert.equal(quoteCart(c, rows).discount, 1500);
  c.promotions.push(
    offer({
      id: "old",
      fixedPriceCents: undefined,
      pay: 1,
      productIds: ["p", "b"],
    }),
  );
  assert.equal(quoteCart(c, rows).discount, 2500);
});
test("combo needs one of every selected product and repeats only complete sets", () => {
  const c = catalog();
  c.products.push({
    ...c.products[0],
    id: "b",
    name: "Birriamen",
    variants: [{ id: "bv", name: "Normal", price: 3000 }],
  });
  c.promotions = [offer({ requireEachProduct: true, productIds: ["p", "b"] })];
  assert.equal(quoteCart(c, [line({ quantity: 3 })]).discount, 0);
  const q = quoteCart(c, [
    line({ quantity: 3, choiceIds: ["r"] }),
    line({ productId: "b", variantId: "bv", quantity: 2 }),
  ]);
  assert.equal(q.discount, 3000);
  assert.equal(q.total, 12000);
});
test("hours use business time, inclusive start and exclusive end, including NxM", () => {
  const c = catalog();
  const p = offer({ daysMask: 1, startsAtMinute: 600, endsAtMinute: 780 });
  c.promotions = [p];
  for (
    const [iso, expected] of [
      ["2026-10-12T15:59:00Z", false],
      ["2026-10-12T16:00:00Z", true],
      ["2026-10-12T18:59:59Z", true],
      ["2026-10-12T19:00:00Z", false],
      ["2026-10-13T16:00:00Z", false],
    ]
  ) {
    const now = new Date(iso);
    assert.equal(promotionActive(c, p, now), expected);
    assert.equal(
      quoteCart(c, [line({ quantity: 2 })], now).discount,
      expected ? 1000 : 0,
    );
  }
  c.promotions = [{ ...p, fixedPriceCents: undefined, pay: 1 }];
  assert.equal(
    quoteCart(c, [line({ quantity: 2 })], new Date("2026-10-12T19:00:00Z"))
      .discount,
    0,
  );
});
test("offer labels explain bundles, selected products, extras and schedule before purchase", () => {
  const c = catalog();
  const p = offer({
    startsAtMinute: 600,
    endsAtMinute: 780,
    requireEachProduct: true,
    choiceIds: ["r"],
  });
  assert.match(promotionLabel(p), /Combo/);
  const text = promotionConditions(c, p);
  for (
    const part of [
      "10:00–13:00",
      "Uno de cada producto: Taco",
      "Roja",
      "Extras por separado",
      "grupos completos",
    ]
  ) assert.ok(text.includes(part));
  assert.equal(
    promotionLabel({ ...p, fixedPriceCents: undefined, pay: 1 }),
    "2x1",
  );
});

// Horario del menú en línea (30 oct). -360 = hora del centro; 2026-10-12 es lunes.
test("horario: abierto, cerrado y cuándo vuelve a abrir, también de noche", () => {
  const c = catalog();
  assert.deepEqual(storeHours(c, new Date("2026-10-12T03:00:00Z")), { open: true, closesAt: null });
  const off = { open: false };
  // Lunes 13:00–22:00; martes cerrado; miércoles 19:00–02:00; jueves 24 h.
  c.hours = [
    { open: true, from: 780, to: 1320 },
    off,
    { open: true, from: 1140, to: 120 },
    { open: true, from: 0, to: 0 },
    off,
    off,
    off,
  ];
  const at = (iso) => storeHours(c, new Date(iso));
  // Lunes 12:59 → abre hoy a la 1:00 p.m.
  const early = at("2026-10-12T18:59:00Z");
  assert.deepEqual(early, { open: false, opensIn: 0, opensAt: 780 });
  assert.equal(opensLabel(c, early, new Date("2026-10-12T18:59:00Z")), "Abre hoy a la 1:00 p.m.");
  assert.deepEqual(at("2026-10-12T19:00:00Z"), { open: true, closesAt: 1320 });
  // Lunes 22:00 → cerrado; martes cerrado → abre el miércoles a las 7:00 p.m.
  const late = at("2026-10-13T04:00:00Z");
  assert.deepEqual(late, { open: false, opensIn: 2, opensAt: 1140 });
  assert.equal(opensLabel(c, late, new Date("2026-10-13T04:00:00Z")), "Abre el miércoles a las 7:00 p.m.");
  // Miércoles 23:30 abierto; jueves 1:30 a.m. sigue abierto por lo de anoche.
  assert.deepEqual(at("2026-10-15T05:30:00Z"), { open: true, closesAt: 120 });
  assert.deepEqual(at("2026-10-15T07:30:00Z"), { open: true, closesAt: 120 });
  // Jueves todo el día; viernes cerrado → abre el lunes, en 3 días.
  assert.deepEqual(at("2026-10-15T20:00:00Z"), { open: true, closesAt: null });
  const weekend = at("2026-10-17T18:00:00Z");
  assert.deepEqual(weekend, { open: false, opensIn: 2, opensAt: 780 });
  assert.equal(opensLabel(c, weekend, new Date("2026-10-17T18:00:00Z")), "Abre el lunes a la 1:00 p.m.");
});

// ── Menú en inglés ─────────────────────────────────────────────────────────
// i18n.ts importa cart.ts: se compilan juntos a una carpeta temporal.
const i18nDir = mkdtempSync(join(tmpdir(), "orale-i18n-"));
for (const name of ["cart", "i18n"]) {
  writeFileSync(
    join(i18nDir, `${name}.js`),
    ts.transpileModule(
      readFileSync(new URL(`../lib/online/${name}.ts`, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText,
  );
}
const requireI18n = createRequire(import.meta.url);
const english = requireI18n(join(i18nDir, "i18n.js"));
const cartEn = requireI18n(join(i18nDir, "cart.js"));
rmSync(i18nDir, { recursive: true, force: true });
const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("inglés: todo texto fijo de la página tiene su par en inglés", () => {
  const page = source("../components/online/Storefront.tsx");
  const fixed = [...page.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)].map((m) =>
    m[1]
  );
  assert.ok(fixed.length > 40, "la página usa t() para sus textos");
  // Los dos del carrito viven dentro de una condición.
  fixed.push("{count} producto · Ver carrito", "{count} productos · Ver carrito");
  const errors = [
    ...source("../lib/online/cart.ts").matchAll(/new CartError\(\s*"([^"]+)"/g),
  ].map((m) => m[1]);
  assert.ok(errors.length >= 12, "los avisos del carrito llevan plantilla");
  const missing = [...fixed, ...errors].filter((es) => !english.hasEnglish(es));
  assert.deepEqual(missing, []);
});

test("inglés: los textos fijos cambian, y en español salen igual que siempre", () => {
  assert.equal(english.ui("es", "Tu pedido"), "Tu pedido");
  assert.equal(english.ui("en", "Tu pedido"), "Your order");
  assert.equal(
    english.ui("es", "Cantidad de {name}", { name: "Taco" }),
    "Cantidad de Taco",
  );
  assert.equal(
    english.ui("en", "Cantidad de {name}", { name: "Taco" }),
    "Quantity of Taco",
  );
  // Sin par en inglés se queda en español: nunca en blanco.
  assert.equal(english.ui("en", "Texto nuevo sin traducir"), "Texto nuevo sin traducir");
  assert.equal(english.ui("en", "constructor"), "constructor");
});

test("inglés: el platillo sale traducido solo si hay traducción guardada", () => {
  const saved = { "Taco de asada": "Asada taco", Vacío: "  ", Raro: 7 };
  assert.equal(english.translated("en", saved, "Taco de asada"), "Asada taco");
  assert.equal(english.translated("en", saved, " Taco de asada "), "Asada taco");
  assert.equal(english.translated("es", saved, "Taco de asada"), "Taco de asada");
  for (const untouched of ["Pozole", "Vacío", "Raro", "constructor", "__proto__"]) {
    assert.equal(english.translated("en", saved, untouched), untouched);
  }
});

test("inglés: los avisos del carrito se entienden y traducen el platillo", () => {
  const c = catalog();
  c.products[0].stock = 2;
  const tr = (text) => ({ Taco: "Taco (EN)", Salsa: "Sauce" })[text] ?? text;
  let stock;
  try {
    cartEn.quoteCart(c, [line({ quantity: 3 })]);
  } catch (e) {
    stock = e;
  }
  assert.equal(stock.message, "Solo quedan 2 de Taco.");
  assert.equal(english.errorText("es", stock, tr), "Solo quedan 2 de Taco.");
  assert.equal(english.errorText("en", stock, tr), "Only 2 left of Taco (EN).");
  let option;
  try {
    cartEn.quoteCart(catalog(), [line({ choiceIds: [] })]);
  } catch (e) {
    option = e;
  }
  assert.equal(option.message, "Revisa Salsa de Taco.");
  assert.equal(english.errorText("en", option, tr), "Check Sauce for Taco (EN).");
  // Avisos del servidor: llegan como texto en español.
  assert.equal(
    english.errorText("en", new Error("El menú cambió. Revisa los precios antes de continuar."), tr),
    "The menu changed. Check the prices before continuing.",
  );
  assert.equal(
    english.errorText("en", new Error("El negocio está cerrado. Abre hoy a la 1:00 p.m."), tr),
    "The restaurant is closed.",
  );
  assert.equal(
    english.errorText("en", new Error(""), tr),
    "We couldn't prepare your order. Try again.",
  );
  assert.equal(
    english.errorText("es", new Error(""), tr),
    "No pudimos preparar el pedido. Intenta de nuevo.",
  );
});

test("inglés: horario y promociones se leen en inglés; el español no cambia", () => {
  const c = catalog();
  const off = { open: false };
  c.hours = [{ open: true, from: 780, to: 1320 }, off, { open: true, from: 1140, to: 120 }, off, off, off, off];
  const monday = new Date("2026-10-12T18:59:00Z");
  const early = cartEn.storeHours(c, monday);
  assert.equal(cartEn.opensLabel(c, early, monday, "en"), "Opens today at 1:00 PM");
  assert.equal(cartEn.opensLabel(c, early, monday), "Abre hoy a la 1:00 p.m.");
  const late = cartEn.storeHours(c, new Date("2026-10-13T04:00:00Z"));
  assert.equal(
    cartEn.opensLabel(c, late, new Date("2026-10-13T04:00:00Z"), "en"),
    "Opens Wednesday at 7:00 PM",
  );
  assert.equal(cartEn.clock12(0, "en"), "12:00 AM");
  const promo = {
    id: "m", name: "Martes", daysMask: 2, buy: 3, pay: 3, productIds: ["p"],
    choiceIds: ["r"], fixedPriceCents: 6000, requireEachProduct: false,
    startsAtMinute: 780, endsAtMinute: 900,
  };
  assert.equal(cartEn.promotionLabel(promo, "en"), "3 items for $60.00");
  assert.equal(cartEn.promotionLabel(promo), "3 productos por $60.00");
  assert.equal(cartEn.promotionSchedule(promo, "en"), "Tue · 13:00–15:00");
  assert.equal(cartEn.promotionSchedule({ ...promo, daysMask: 127 }, "en"), "Every day · 13:00–15:00");
  const tr = (text) => ({ Taco: "Taco (EN)", Roja: "Red" })[text] ?? text;
  const terms = cartEn.promotionConditions(c, promo, "en", tr);
  assert.match(terms, /^Tue · 13:00–15:00\. Included: Taco \(EN\)\./);
  assert.match(terms, /Requires one of these extras: Red\./);
  assert.match(terms, /The best promotion is applied when you confirm your order\.$/);
  assert.doesNotMatch(terms, /Participan|Requiere|Se aplica/);
  // Sin idioma, como siempre.
  assert.match(cartEn.promotionConditions(c, promo), /Participan: Taco\./);
});

test("inglés: lo que le llega al negocio sigue en español", () => {
  const result = cartEn.whatsappOrder(catalog(), [line({ quantity: 2 })], checkout);
  assert.match(result.message, /\*SOLICITUD DE PEDIDO\*/);
  assert.match(result.message, /\*2 × Taco\*/);
  assert.match(result.message, /Entrega: Pasar a recoger/);
  assert.doesNotMatch(result.message, /Your order|Pickup|item/i);
});
