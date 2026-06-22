import { test } from "node:test";
import assert from "node:assert";
import { vet } from "./vet.mjs";

// vet() is pure/sync — these tests pass no repoData, so they never hit the network.

const NPX_INSTALL = "npx -y @modelcontextprotocol/server-filesystem";

test("passes for valid npx candidate", () => {
  const res = vet({ name: "filesystem-mcp", sourceUrl: "https://example.com", install: NPX_INSTALL, source: "catalog" });
  assert.strictEqual(res.passed, true);
  assert.strictEqual(res.hardBlocks.length, 0);
});

test("hard blocks missing source code", () => {
  const res = vet({ name: "bad-tool", sourceUrl: "https://example.com/not-a-repo", source: "web" });
  assert.strictEqual(res.passed, false);
  assert.ok(res.hardBlocks.length > 0);
});

test("catalog scores >= web for the same repo", () => {
  const url = "https://github.com/modelcontextprotocol/servers";
  const cat = vet({ name: "cat", sourceUrl: url, source: "catalog", description: "A" });
  const web = vet({ name: "web", sourceUrl: url, source: "web", description: "A" });
  assert.ok(cat.score >= web.score);
});

test("github source url is inspectable — no hard block", () => {
  const res = vet({ name: "gh", sourceUrl: "https://github.com/owner/repo", source: "web" });
  assert.strictEqual(res.hardBlocks.length, 0);
});

test("repoData drives stars and recency scoring", () => {
  const url = "https://github.com/owner/repo";
  const res = vet({ name: "popular", sourceUrl: url, source: "web", description: "A" }, {
    id: 1,
    stargazers_count: 5000,
    pushed_at: new Date().toISOString(),
  });
  // github(20) + desc(20) + stars>1000(30) + recent<3mo(20) = 90
  assert.strictEqual(res.score, 90);
  assert.strictEqual(res.softFlags.length, 0);
});

test("flags low stars via repoData", () => {
  const res = vet({ name: "obscure", sourceUrl: "https://github.com/owner/repo" }, { id: 1, stargazers_count: 2 });
  assert.ok(res.softFlags.some((f) => f.includes("Stars < 10")));
});
