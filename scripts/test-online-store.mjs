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
