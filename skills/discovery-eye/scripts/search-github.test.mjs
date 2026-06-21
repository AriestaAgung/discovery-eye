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

import { normalizeGithubCode } from "./search-github.mjs";

test("normalizeGithubCode maps a code match to a candidate carrying the file path", () => {
  const raw = {
    items: [
      {
        repository: { full_name: "foo/bar", html_url: "https://github.com/foo/bar", stargazers_count: 7 },
        path: "README.md",
        name: "README.md",
      },
    ],
  };
  const out = normalizeGithubCode(raw, "slack");
  assert.equal(out.length, 1);
  const c = out[0];
  assert.equal(c.type, "mcp");
  assert.equal(c.name, "bar");
  assert.equal(c.sourceUrl, "https://github.com/foo/bar");
  assert.equal(c.discoveredVia, "github:code");
  assert.equal(c.install.path, "README.md");
  assert.equal(c.stars, 7);
  assert.match(c.description, /README\.md/);
});

test("normalizeGithubCode dedupes multiple matches in the same repo", () => {
  const raw = {
    items: [
      { repository: { full_name: "a/b", html_url: "https://github.com/a/b" }, path: "README.md" },
      { repository: { full_name: "a/b", html_url: "https://github.com/a/b" }, path: "docs/mcp.md" },
      { repository: { full_name: "c/d", html_url: "https://github.com/c/d" }, path: ".mcp.json" },
    ],
  };
  const out = normalizeGithubCode(raw, "");
  assert.equal(out.length, 2);
  assert.equal(out[0].sourceUrl, "https://github.com/a/b");
  assert.equal(out[0].install.path, "README.md");
  assert.equal(out[1].sourceUrl, "https://github.com/c/d");
});

test("normalizeGithubCode skips items without a repository object", () => {
  const raw = { items: [{ path: "x.md" }, { repository: { full_name: "g/h", html_url: "https://github.com/g/h" }, path: "y.md" }] };
  const out = normalizeGithubCode(raw, "");
  assert.equal(out.length, 1);
  assert.equal(out[0].sourceUrl, "https://github.com/g/h");
});

test("normalizeGithubCode returns [] for null or no items", () => {
  assert.deepEqual(normalizeGithubCode(null, "x"), []);
  assert.deepEqual(normalizeGithubCode({}, "x"), []);
  assert.deepEqual(normalizeGithubCode({ items: [] }, "x"), []);
});

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "search-github.mjs");
const NODE = process.execPath;

function run(args, stdin = "") {
  try {
    const stdout = execFileSync(NODE, [SCRIPT, ...args], { input: stdin, encoding: "utf8" });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

test("CLI plan mode prints buildGithubQueries JSON", () => {
  const { code, stdout } = run(["plan", "postgres mcp"]);
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.ok(Array.isArray(parsed));
  assert.ok(parsed.some((r) => r.tool === "github_search_repositories"));
  assert.ok(parsed.some((r) => r.tool === "github_search_code"));
});

test("CLI normalize repos reads stdin and emits candidates", () => {
  const payload = JSON.stringify({
    items: [{ full_name: "foo/bar", html_url: "https://github.com/foo/bar", stargazers_count: 3 }],
  });
  const { code, stdout } = run(["normalize", "repos", "need"], payload);
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].sourceUrl, "https://github.com/foo/bar");
  assert.equal(parsed[0].discoveredVia, "github:repos");
});

test("CLI normalize code reads stdin and emits candidates", () => {
  const payload = JSON.stringify({
    items: [{ repository: { full_name: "a/b", html_url: "https://github.com/a/b" }, path: "README.md" }],
  });
  const { code, stdout } = run(["normalize", "code", "need"], payload);
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].discoveredVia, "github:code");
  assert.equal(parsed[0].install.path, "README.md");
});

test("CLI normalize with empty stdin returns []", () => {
  const { code, stdout } = run(["normalize", "repos"], "");
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout), []);
});

test("CLI normalize exits 1 on invalid JSON", () => {
  const { code, stderr } = run(["normalize", "repos"], "not json{");
  assert.equal(code, 1);
  assert.match(stderr, /invalid JSON/i);
});

test("CLI normalize exits 2 on unknown target", () => {
  const { code, stderr } = run(["normalize", "issues", "x"], "{}");
  assert.equal(code, 2);
  assert.match(stderr, /usage/i);
});

test("CLI exits 2 with usage message when no mode given", () => {
  const { code, stderr } = run([]);
  assert.equal(code, 2);
  assert.match(stderr, /usage/i);
});
