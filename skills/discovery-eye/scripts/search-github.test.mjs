import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGithubQueries } from "./search-github.mjs";

test("buildGithubQueries emits a repos query with stars:>50 and mcp server", () => {
  const recipes = buildGithubQueries("postgres mcp");
  assert.ok(Array.isArray(recipes));
  assert.ok(recipes.length >= 1);
  const repos = recipes.find((r) => r.tool === "github_search_repositories");
  assert.ok(repos, "expected at least one github_search_repositories recipe");
  assert.match(repos.query, /mcp server postgres mcp/);
  assert.match(repos.query, /stars:>50/);
  assert.equal(repos.sort, "stars");
});

test("buildGithubQueries emits a recently-updated repos query sorted by updated", () => {
  const recipes = buildGithubQueries("pdf parser");
  const updated = recipes.find(
    (r) => r.tool === "github_search_repositories" && r.sort === "updated"
  );
  assert.ok(updated, "expected a sort:updated repos recipe");
  assert.match(updated.query, /mcp pdf parser in:name,description/);
});

test("buildGithubQueries emits code-search recipes for READMEs and .mcp.json", () => {
  const recipes = buildGithubQueries("slack");
  const codeRecipes = recipes.filter((r) => r.tool === "github_search_code");
  assert.ok(codeRecipes.length >= 2, "expected at least 2 code-search recipes");
  const readmeQ = codeRecipes.find((r) => /in:readme/.test(r.query));
  assert.ok(readmeQ, "expected an in:readme code recipe");
  assert.match(readmeQ.query, /"mcp"/);
  assert.match(readmeQ.query, /"slack"/);
  const manifestQ = codeRecipes.find((r) => /filename:\.mcp\.json/.test(r.query));
  assert.ok(manifestQ, "expected a .mcp.json manifest code recipe");
  assert.match(manifestQ.query, /mcpServers/);
});

test("buildGithubQueries trims the need and rejects empty", () => {
  const recipes = buildGithubQueries("  trim me  ");
  assert.ok(recipes.every((r) => typeof r.query === "string" && r.query.length > 0));
});

import { normalizeGithubRepos } from "./search-github.mjs";

test("normalizeGithubRepos maps a repo item to a candidate with stars + updatedAt", () => {
  const raw = {
    items: [
      {
        full_name: "foo/pg-mcp",
        name: "pg-mcp",
        html_url: "https://github.com/foo/pg-mcp",
        stargazers_count: 42,
        pushed_at: "2026-05-01T00:00:00Z",
        description: "Postgres MCP server",
        topics: ["mcp", "postgres"],
      },
    ],
  };
  const out = normalizeGithubRepos(raw, "postgres mcp");
  assert.equal(out.length, 1);
  const c = out[0];
  assert.equal(c.type, "mcp");
  assert.equal(c.name, "pg-mcp");
  assert.equal(c.source, "github");
  assert.equal(c.sourceUrl, "https://github.com/foo/pg-mcp");
  assert.equal(c.need, "postgres mcp");
  assert.deepEqual(c.install, { repo: "https://github.com/foo/pg-mcp", path: "" });
  assert.equal(c.stars, 42);
  assert.equal(c.updatedAt, "2026-05-01T00:00:00Z");
  assert.deepEqual(c.topics, ["mcp", "postgres"]);
  assert.equal(c.discoveredVia, "github:repos");
});

test("normalizeGithubRepos dedupes repeated html_url across pages", () => {
  const raw = {
    items: [
      { full_name: "a/x", html_url: "https://github.com/a/x", stargazers_count: 1 },
      { full_name: "a/x", html_url: "https://github.com/a/x", stargazers_count: 1 },
      { full_name: "b/y", html_url: "https://github.com/b/y", stargazers_count: 2 },
    ],
  };
  const out = normalizeGithubRepos(raw, "");
  assert.equal(out.length, 2);
  assert.equal(out[0].sourceUrl, "https://github.com/a/x");
  assert.equal(out[1].sourceUrl, "https://github.com/b/y");
});

test("normalizeGithubRepos handles missing description/topics gracefully", () => {
  const raw = { items: [{ full_name: "z/w", html_url: "https://github.com/z/w" }] };
  const out = normalizeGithubRepos(raw, "n");
  assert.equal(out.length, 1);
  assert.equal(out[0].description, "");
  assert.deepEqual(out[0].topics, []);
  assert.equal(out[0].stars, 0);
  assert.equal(out[0].updatedAt, "");
});

test("normalizeGithubRepos returns [] for null or no items", () => {
  assert.deepEqual(normalizeGithubRepos(null, "x"), []);
  assert.deepEqual(normalizeGithubRepos({}, "x"), []);
  assert.deepEqual(normalizeGithubRepos({ items: [] }, "x"), []);
});
