import { test } from "node:test";
import assert from "node:assert";
import { parseRegistries, search } from "./search-registry.mjs";

const MOCK = {
  caveman: { source: { source: "github", repo: "JuliusBrussee/caveman" }, lastUpdated: "2026-05-28" },
  "superpowers-marketplace": { source: { source: "github", repo: "obra/superpowers" }, lastUpdated: "2026-06-01" },
  "local-thing": { source: { source: "local" }, lastUpdated: "2026-01-01" },
};

test("parses registries and builds github URLs", () => {
  const regs = parseRegistries(MOCK);
  assert.strictEqual(regs.length, 3);
  const sp = regs.find((r) => r.name === "superpowers-marketplace");
  assert.strictEqual(sp.sourceUrl, "https://github.com/obra/superpowers");
  const local = regs.find((r) => r.name === "local-thing");
  assert.strictEqual(local.sourceUrl, ""); // non-github has no URL
});

test("matches by name and repo, empty query returns nothing", () => {
  const regs = parseRegistries(MOCK);
  assert.strictEqual(search(regs, "superpowers").length, 1);
  assert.strictEqual(search(regs, "JuliusBrussee").length, 1); // repo owner match
  assert.strictEqual(search(regs, "nonexistent").length, 0);
  assert.strictEqual(search(regs, "").length, 0);
});
