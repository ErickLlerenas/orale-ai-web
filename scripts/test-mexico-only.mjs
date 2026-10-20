import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const dir = mkdtempSync(join(tmpdir(), "orale-mexico-"));
for (const [target, source] of [["format", "lib/owner/format.ts"], ["parse", "lib/owner/parse.ts"], ["pricing", "lib/pricing.ts"], ["seo", "lib/seo.ts"]]) {
  writeFileSync(join(dir, target + ".js"), ts.transpileModule(readFileSync(new URL("../" + source, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const require = createRequire(import.meta.url);
const { pesos } = require(join(dir, "format.js"));
const { parseOwnerMetrics } = require(join(dir, "parse.js"));
const { softwareJsonLd, siteTitle, siteDescription } = require(join(dir, "seo.js"));
rmSync(dir, { recursive: true, force: true });
test("Mexican money keeps cents and sharing metadata offers Mexico only", () => {
  assert.equal(pesos(1250050), "$12,500.50");
  const graph = softwareJsonLd()["@graph"];
  assert.equal(graph[0].areaServed, "MX");
  assert.equal(graph[1].offers.priceCurrency, "MXN");
  assert.ok(!siteTitle.includes("Chile") && !siteDescription.includes("Chile"));
});
test("foreign metrics are rejected before being displayed as Mexican pesos", () => {
  assert.throws(() => parseOwnerMetrics({ locations: [{ country: "CL" }] }), /México/);
  assert.throws(() => parseOwnerMetrics({ country: "CL" }), /México/);
  assert.deepEqual(parseOwnerMetrics({ locations: [] }).locations, []);
});
