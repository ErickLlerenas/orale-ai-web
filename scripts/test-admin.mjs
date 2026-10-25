import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, imports = {}, env = process.env) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", code)(
    (id) => id === "server-only" ? {} : imports[id] ?? require(id),
    module, module.exports, { env },
  );
  return module.exports;
}
const { enrichSubscriberTenure, revenueCatSub, stripeSub } = load("../lib/admin-subscribers.ts");
const { tenureLabel } = load("../lib/admin-tenure.ts");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const ping = (extra = {}) => ({
  install_id: "device", account_key: "account", ping_date: "2026-10-25",
  platform: "ios", is_caja: true, inherited_access: false,
  days_since_install: 29, updated_at: "2026-10-25T10:00:00Z", ...extra,
});
const event = (extra = {}) => ({
  id: "event", type: "INITIAL_PURCHASE", store: "APP_STORE",
  product_id: "orale_monthly", period_type: "NORMAL",
  event_at: "2026-10-25T08:00:00Z", original_transaction_id: "transaction",
  app_user_id: "rc-user", original_app_user_id: "original-rc-user", raw: {}, ...extra,
});

test("iOS enlaza la transacción original y usa exactamente days_since_install", () => {
  const sub = revenueCatSub(event());
  const [result] = enrichSubscriberTenure([sub], [ping({ account_key: hash("transaction") })]);
  assert.equal(result.tenure, 29);
  assert.equal(result.matchedInstallId, "device");
  assert.deepEqual(result.installIds, ["device"]);
});

test("cambiar de compra/plan conserva la fila e historial del mismo dispositivo", () => {
  const sub = revenueCatSub(event({ event_at: "2026-10-24T08:00:00Z" }));
  const [result] = enrichSubscriberTenure([sub], [
    ping({ account_key: hash("transaction"), ping_date: "2026-10-23", days_since_install: 27 }),
    ping({ account_key: "new-account-key", ping_date: "2026-10-24", days_since_install: 28 }),
    ping({ account_key: "new-account-key", ping_date: "2026-10-25", days_since_install: 29 }),
  ]);
  assert.equal(result.tenure, 28); // misma fila que Usuarios al seleccionar ayer
});

test("Android resuelve identidad de RevenueCat y alias de compras verificados", () => {
  const account = hash("purchase-token");
  const shadowId = `orale_purchase_${hash(`orale-revenuecat-v1:google:${account}`)}`;
  for (const [id, aliases] of [
    [shadowId, []],
    ["canonical-customer", [{ key_hash: hash(`google:${account}`), customer_id: "canonical-customer" }]],
  ]) {
    const sub = revenueCatSub(event({ store: "PLAY_STORE", raw: { aliases: [id] } }));
    const [result] = enrichSubscriberTenure([sub], [ping({ platform: "android", account_key: account, days_since_install: 60 })], aliases);
    assert.equal(result.tenure, 60);
    assert.equal(tenureLabel(result.tenure), "2 meses");
  }
});

test("Windows enlaza el usuario hasheado, sin consultar registro ni fecha de pago", () => {
  const sub = stripeSub({ user_id: "user", plan: "monthly", subscribed_at: "2026-10-25" });
  const [result] = enrichSubscriberTenure([sub], [ping({ account_key: hash("user"), platform: "windows", days_since_install: 14 })]);
  assert.equal(result.tenure, 14);
});

test("el histórico de app usa cuenta o instalación y el último reporte de ese día", () => {
  for (const key of ["account", "device"]) {
    const [result] = enrichSubscriberTenure([{ key, day: "2026-10-25" }], [
      ping({ days_since_install: 5 }),
      ping({ days_since_install: 6, updated_at: "2026-10-25T12:00:00Z" }),
    ]);
    assert.equal(result.tenure, 6);
  }
});

test("edad ausente o inválida nunca se inventa como cero", () => {
  for (const age of [null, -1, NaN, Infinity, 0.5]) {
    const [result] = enrichSubscriberTenure([{ key: "device", day: "2026-10-25" }], [ping({ days_since_install: age })]);
    assert.equal(result.tenure, null);
    assert.equal(result.matchedInstallId, "device");
  }
  const [fresh] = enrichSubscriberTenure([{ key: "device", day: "2026-10-25" }], [ping({ days_since_install: 0 })]);
  assert.equal(fresh.tenure, 0);
});

test("un evento anónimo sin vínculo no toma la edad de otra persona del mismo plan/día", () => {
  const sub = revenueCatSub(event({ store: "PLAY_STORE", original_app_user_id: "$RCAnonymousID:unknown", app_user_id: "$RCAnonymousID:unknown" }));
  const [result] = enrichSubscriberTenure([sub], [ping({ platform: "android", plan: "monthly", days_since_install: 100 })]);
  assert.equal(result.tenure, null);
  assert.equal(result.matchedInstallId, undefined);
});

test("conserva distinción de pruebas/conversiones y excluye renovaciones normales", () => {
  assert.equal(revenueCatSub(event({ type: "RENEWAL" })), null);
  assert.equal(revenueCatSub(event({ type: "CANCELLATION" })), null);
  assert.equal(revenueCatSub(event({ period_type: "TRIAL" })).kind, "trial");
  assert.equal(revenueCatSub(event({ type: "RENEWAL", raw: { is_trial_conversion: true } })).kind, "converted");
});

test("el formato compartido conserva días y meses de Usuarios", () => {
  assert.equal(tenureLabel(null), "—");
  assert.equal(tenureLabel(0), "hoy");
  assert.equal(tenureLabel(1), "1 día");
  assert.equal(tenureLabel(29), "29 días");
  assert.equal(tenureLabel(30), "1 mes");
  assert.equal(tenureLabel(61), "2 meses");
});

const { NextRequest } = require("next/server");
function middlewareFor(env) {
  return load("../middleware.ts", {
    "@/lib/accounting/access": { sessionRole: async () => null, sessionCookie: "session" },
    "@/lib/seo": { siteUrl: "https://orale.ai" },
  }, { ADMIN_USER: "admin", ADMIN_PASSWORD: "test-password", ...env }).middleware;
}
function request(path = "/admin", host = "localhost:3000", headers = {}) {
  return new NextRequest(`http://${host}${path}`, { headers: { host, ...headers } });
}

test("solo el modo local explícito de desarrollo permite el panel sin clave", async () => {
  const middleware = middlewareFor({ NODE_ENV: "development", ORALE_LOCAL_ADMIN: "1" });
  assert.equal((await middleware(request())).status, 200);
  const redirect = await middleware(request("/admin2?month=2026-10"));
  assert.equal(redirect.status, 308);
  assert.equal(new URL(redirect.headers.get("location")).pathname, "/admin");
  assert.equal(new URL(redirect.headers.get("location")).search, "?month=2026-10");
  assert.equal((await middleware(request("/admin/api/example"))).status, 401);
  assert.equal((await middleware(request("/admin", "public.example"))).status, 401);
});

test("producción, Vercel y desarrollo normal mantienen autenticación pese al Host o URL", async () => {
  for (const env of [
    { NODE_ENV: "production", ORALE_LOCAL_ADMIN: "1" },
    { NODE_ENV: "test", ORALE_LOCAL_ADMIN: "1" },
    { NODE_ENV: "development" },
    { NODE_ENV: "development", ORALE_LOCAL_ADMIN: "1", VERCEL: "1" },
  ]) {
    const middleware = middlewareFor(env);
    for (const path of ["/admin?ORALE_LOCAL_ADMIN=1", "/admin2", "/admin/api/example"]) {
      const response = await middleware(request(path));
      assert.equal(response.status, 401);
      assert.match(response.headers.get("www-authenticate"), /Basic/);
    }
    const headers = { authorization: `Basic ${Buffer.from("admin:test-password").toString("base64")}` };
    assert.equal((await middleware(request("/admin", "localhost:3000", headers))).status, 200);
    assert.equal((await middleware(request("/admin2", "localhost:3000", headers))).status, 308);
    assert.equal((await middleware(request("/admin", "localhost:3000", { authorization: "Basic ???" }))).status, 401);
  }
});
