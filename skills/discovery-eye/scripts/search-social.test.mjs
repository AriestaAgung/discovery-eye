import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQueries } from "./search-social.mjs";

test("buildQueries youtube returns brave-search recipe with site:youtube.com", () => {
  const recipes = buildQueries("youtube", "postgres mcp");
  assert.ok(Array.isArray(recipes));
  assert.ok(recipes.length >= 1);
  const brave = recipes.find((r) => r.tool === "brave-search");
  assert.ok(brave, "expected at least one brave-search recipe");
  assert.match(brave.query, /site:youtube\.com/);
  assert.match(brave.query, /postgres mcp/);
});

test("buildQueries youtube includes a webfetch fallback to youtube results page", () => {
  const recipes = buildQueries("youtube", "pdf parser");
  const wf = recipes.find((r) => r.tool === "webfetch");
  assert.ok(wf, "youtube should have a webfetch fallback");
  assert.match(wf.url, /^https:\/\/www\.youtube\.com\/results\?search_query=/);
  assert.match(wf.url, /pdf%20parser/);
});

test("buildQueries instagram uses site:instagram.com", () => {
  const recipes = buildQueries("instagram", "image ocr");
  const brave = recipes.find((r) => r.tool === "brave-search");
  assert.match(brave.query, /site:instagram\.com/);
});
