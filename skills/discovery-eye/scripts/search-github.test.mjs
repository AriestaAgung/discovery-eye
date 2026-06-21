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
