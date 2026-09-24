import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
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
const { quoteCart, whatsappOrder, demoPhoneNumber } = createRequire(
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
  for (const bad of [
    line({ variantId: "unknown" }),
    line({ choiceIds: [] }),
    line({ choiceIds: ["s", "s"] }),
    line({ choiceIds: ["s", "r"] }),
    line({ choiceIds: ["foreign"] }),
  ])
    assert.throws(() => quoteCart(catalog(), [bad]));
});
test("stock checked across separate cart rows and quantities are bounded", () => {
  assert.throws(() =>
    quoteCart(catalog(), [line({ quantity: 6 }), line({ quantity: 6 })]),
  );
  for (const q of [-1, 0, 1.5, 100, NaN])
    assert.throws(() => quoteCart(catalog(), [line({ quantity: q })]));
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
    }),
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
    whatsappOrder(catalog(), [line()], { ...checkout, name: "" }),
  );
});

test("demo destination accepts a country code and rejects malformed numbers", () => {
  assert.equal(demoPhoneNumber("+52 (55) 1234-5678"), "525512345678");
  assert.equal(demoPhoneNumber("+1 202 555 0123"), "12025550123");
  for (const value of [
    "",
    "+52",
    "abc525512345678",
    "001234567890",
    "1234567890123456",
    "525512345678?text=oops",
  ])
    assert.throws(() => demoPhoneNumber(value));
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
  const result = whatsappOrder(catalog(), [line({ notes: "🌮 Sin cebolla\nSalsa & limón" })], checkout);
  const url = new URL(result.url);
  assert.equal(url.origin, "https://api.whatsapp.com");
  assert.equal(url.pathname, "/send");
  assert.equal(url.searchParams.get("phone"), catalog().phone);
  assert.equal(url.searchParams.get("text"), result.message);
  assert.ok(result.message.includes("🌮 Sin cebolla\nSalsa & limón"));
  assert.ok(!result.message.includes("�"));
});
