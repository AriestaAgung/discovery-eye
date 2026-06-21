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

import { SUPPORTED_PLATFORMS } from "./search-social.mjs";

test("buildQueries threads uses site:threads.net", () => {
  const recipes = buildQueries("threads", "slack bot");
  const brave = recipes.find((r) => r.tool === "brave-search");
  assert.match(brave.query, /site:threads\.net/);
});

test("buildQueries linkedin uses site:linkedin.com", () => {
  const recipes = buildQueries("linkedin", "resume parser");
  const brave = recipes.find((r) => r.tool === "brave-search");
  assert.match(brave.query, /site:linkedin\.com/);
});

test("buildQueries throws for unsupported platform", () => {
  assert.throws(
    () => buildQueries("tiktok", "anything"),
    /unsupported platform: tiktok/
  );
});

test("SUPPORTED_PLATFORMS lists exactly the four target platforms", () => {
  assert.deepEqual([...SUPPORTED_PLATFORMS].sort(), [
    "instagram",
    "linkedin",
    "threads",
    "youtube",
  ]);
});

import { extractRepoUrls } from "./search-social.mjs";

test("extractRepoUrls finds bare github.com owner/repo links", () => {
  const urls = extractRepoUrls("see github.com/foo/bar for the mcp server");
  assert.deepEqual(urls, ["https://github.com/foo/bar"]);
});

test("extractRepoUrls finds https-prefixed links and strips trailing dot", () => {
  const urls = extractRepoUrls(
    "check https://github.com/baz/qux. and github.com/a/b."
  );
  assert.deepEqual(urls, ["https://github.com/baz/qux", "https://github.com/a/b"]);
});

test("extractRepoUrls dedupes repeated repos preserving first-seen order", () => {
  const urls = extractRepoUrls(
    "github.com/x/y mentioned twice: github.com/x/y and github.com/z/w"
  );
  assert.deepEqual(urls, ["https://github.com/x/y", "https://github.com/z/w"]);
});

test("extractRepoUrls ignores github.com path-less or non-repo fragments", () => {
  const urls = extractRepoUrls("visit github.com or github.com/foo only");
  assert.deepEqual(urls, []);
});

test("extractRepoUrls returns [] for empty / null input", () => {
  assert.deepEqual(extractRepoUrls(""), []);
  assert.deepEqual(extractRepoUrls(null), []);
  assert.deepEqual(extractRepoUrls(undefined), []);
});

import { normalizeResults } from "./search-social.mjs";

test("normalizeResults youtube extracts candidates from API items with videoId object", () => {
  const raw = {
    items: [
      {
        id: { videoId: "vid1" },
        snippet: {
          title: "Best Postgres MCP server walkthrough",
          description: "repo: github.com/foo/pg-mcp — stars welcome",
        },
      },
    ],
  };
  const out = normalizeResults("youtube", raw, "postgres mcp");
  assert.equal(out.length, 1);
  assert.equal(out[0].type, "mcp");
  assert.equal(out[0].name, "pg-mcp");
  assert.equal(out[0].source, "github");
  assert.equal(out[0].sourceUrl, "https://github.com/foo/pg-mcp");
  assert.equal(out[0].need, "postgres mcp");
  assert.equal(out[0].platform, "youtube");
  assert.match(out[0].description, /Postgres MCP server walkthrough/);
  assert.match(out[0].description, /\(yt:vid1\)/);
  assert.deepEqual(out[0].install, { repo: "https://github.com/foo/pg-mcp", path: "" });
});

test("normalizeResults youtube dedupes same repo across multiple videos", () => {
  const raw = {
    items: [
      { id: { videoId: "a" }, snippet: { title: "t1", description: "github.com/foo/x" } },
      { id: { videoId: "b" }, snippet: { title: "t2", description: "github.com/foo/x again" } },
      { id: { videoId: "c" }, snippet: { title: "t3", description: "github.com/bar/y" } },
    ],
  };
  const out = normalizeResults("youtube", raw, "need");
  assert.equal(out.length, 2);
  assert.equal(out[0].sourceUrl, "https://github.com/foo/x");
  assert.equal(out[1].sourceUrl, "https://github.com/bar/y");
});

test("normalizeResults youtube handles string id (search-page scrape shape)", () => {
  const raw = {
    items: [
      { id: "vid2", snippet: { title: "Demo", description: "github.com/baz/qux" } },
    ],
  };
  const out = normalizeResults("youtube", raw, "");
  assert.equal(out.length, 1);
  assert.equal(out[0].sourceUrl, "https://github.com/baz/qux");
  assert.match(out[0].description, /\(yt:vid2\)/);
});

test("normalizeResults youtube returns [] when items have no repo links", () => {
  const raw = {
    items: [
      { id: { videoId: "v" }, snippet: { title: "no links", description: "just talk" } },
    ],
  };
  assert.deepEqual(normalizeResults("youtube", raw, "x"), []);
});
