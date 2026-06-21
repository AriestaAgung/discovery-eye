# Social-Media MCP Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend discovery-eye's Tier-3 search along two axes: (a) social platforms (YouTube, Instagram, Threads, LinkedIn) and (b) structured GitHub discovery (repos + code search), normalizing every find into the standard candidate record (a pointer to a GitHub repo).

**Architecture:** Match the existing discovery-eye pattern exactly — the skill is the *playbook*, the agent is the *runtime*, and `.mjs` files are *plain helper programs* (no MCP server, no daemon, no deps). Two new sibling helpers, each following the `search-catalog.mjs` one-helper-per-source convention:
- `search-social.mjs` — `buildQueries` / `extractRepoUrls` / `normalizeResults` + CLI. The agent runs the emitted recipes via `brave-search_brave_web_search` / `webfetch`, then pipes raw JSON back through `normalize`.
- `search-github.mjs` — `buildGithubQueries` / `normalizeGithubRepos` / `normalizeGithubCode` + CLI. The agent runs recipes via `github_search_repositories` / `github_search_code`, then pipes the raw GitHub API JSON back through `normalize`. GitHub candidates carry richer metadata (`stars`, `updatedAt`, `topics`) that feed `scoring.md` directly.
Two reference docs (`social-platforms.md`, `github-discovery.md`) carry the per-source playbook. Existing `sources.md`, `SKILL.md`, `README.md`, `vetting.md` get small edits to wire the new tier members in.

**Tech Stack:** Node.js v22 (built-in `node:test` + `node:assert`, no dependencies), ES modules (`.mjs`), plain JSON over stdio — identical to existing scripts like `search-catalog.mjs` and `ledger.mjs`.

## Global Constraints

- **Node v22** — repo's only runtime requirement (README "Requirements" line). Use only built-in modules (`node:fs`, `node:os`, `node:path`, `node:test`, `node:assert`). No `npm install` ever.
- **ES modules** — all scripts use `.mjs` extension, `import` syntax, `export` for testable functions (mirror `ledger.mjs:20` `export const LABEL`).
- **Shebang + usage header** — every new script starts with `#!/usr/bin/env node` and a header comment block documenting usage, exactly like `search-catalog.mjs:1-7`.
- **State location** — host-agnostic state under `~/.discovery-eye/` (per README). Social search is **stateless** (no writes); only the existing ledger records installs.
- **No secret values** — never write API keys/tokens into config or env permanently. If a platform gains an optional API path (YouTube Data API), read the key from an env var *name* passed at call time; never persist it. (Inherits `vetting.md` / `host-profiles.md:52-54`.)
- **Exit codes** — `0` success, `1` runtime error (bad input file, etc.), `2` usage error. Matches `search-catalog.mjs:19,28` and `ledger.mjs:40,53,61`.
- **Stdout = JSON only** — helpers print JSON candidate records / recipes; human-readable errors go to stderr. Matches `search-catalog.mjs:97`.
- **ToS / platform limits (hard rule):** only fetch **public** content via the agent's WebFetch. Never attempt login automation, credential stuffing, or authenticated scraping of Instagram/Threads/LinkedIn. LinkedIn and Instagram almost always return a login wall unauthenticated — the pipeline MUST degrade gracefully to an empty candidate list (never crash, never fabricate).
- **Candidate record shape** — every normalized hit conforms to `references/sources.md:8-17`:
  ```jsonc
  { "type":"mcp", "name":"<repo>", "source":"github", "sourceUrl":"https://github.com/<owner>/<repo>",
    "description":"...", "need":"<confirmed need>", "install":{ "repo":"<url>", "path":"" }, "platform":"<youtube|instagram|threads|linkedin>" }
  ```
  The `platform` field is a new, additive key (existing consumers ignore unknown keys — it only aids the agent's suggestion phase).
- **DRY / YAGNI** — build only what the four target platforms need today. No generic "social API client" abstraction, no rate-limit cache (the agent's WebFetch handles throttling), no transcript extraction (out of scope; descriptions only).
- **Testing** — `node:test` + `node:assert`, run via `node --test skills/discovery-eye/scripts/search-social.test.mjs`. Pure-function unit tests only (no network). The agent-integration half is guided by the reference doc, like the rest of discovery-eye (existing scripts have no integration tests).
- **Commit cadence** — one commit per task, conventional-commit messages (`feat:`, `docs:`, `test:`, `chore:`), small atomic diffs.

---

## File Structure

**Create:**

| Path | Responsibility |
|------|----------------|
| `skills/discovery-eye/scripts/search-social.mjs` | Stateless helper. Exports `SUPPORTED_PLATFORMS`, `SITE_FOR`, `buildQueries`, `extractRepoUrls`, `normalizeResults`. CLI modes `plan` and `normalize`. |
| `skills/discovery-eye/scripts/search-social.test.mjs` | `node:test` unit tests for the three pure functions (no network). |
| `skills/discovery-eye/references/social-platforms.md` | Per-platform playbook the agent loads in Phase 5: query templates, fetch strategy, what's reachable unauthenticated, known limits, ToS notes, normalization contract. |
| `skills/discovery-eye/scripts/search-github.mjs` | Stateless helper. Exports `buildGithubQueries`, `normalizeGithubRepos`, `normalizeGithubCode`. CLI modes `plan` and `normalize <repos|code>`. |
| `skills/discovery-eye/scripts/search-github.test.mjs` | `node:test` unit tests for the three GitHub pure functions (no network). |
| `skills/discovery-eye/references/github-discovery.md` | GitHub discovery playbook: which `github_search_*` tool for which query, reading repo/code response shapes, mapping `stars`/`pushed_at` into `scoring.md` signals. |
| `AGENTS.md` | Records the verification command (`node --test ...`) and the no-deps / Node v22 constraint so future agents know how to validate this repo. |
| `docs/superpowers/plans/2026-06-21-social-media-mcp-search.md` | This plan. |

**Modify:**

| Path | Change |
|------|--------|
| `skills/discovery-eye/references/sources.md` | Expand the Tier-3 "Social (discovery)" bullet (currently lines 70-76, X/Twitter/Reddit/HN/blogs only) to list YouTube/Instagram/Threads/LinkedIn and reference `search-social.mjs` + `social-platforms.md`. Also replace the ad-hoc "GitHub search" bullet with a reference to `search-github.mjs` + `github-discovery.md`. |
| `skills/discovery-eye/SKILL.md` | Phase 5 (lines 91-100): add the four platforms + the GitHub helper to Tier-3 and show the `plan`/`normalize` helper invocations. |
| `skills/discovery-eye/references/vetting.md` | Add one clarifying row: a candidate that exists **only** as a social post with no inspectable repo gets the existing `⚠️ No source` flag (line 30). No new flag — just makes the rule explicit for social finds. |
| `README.md` | Repo-layout block (lines 98-113): add `search-social.mjs`, `search-github.mjs`, `social-platforms.md`, `github-discovery.md` rows. |

**Decomposition rationale:** the helpers' pure functions are the only deterministic, testable surface (the agent's brave-search/webfetch/github_search calls are non-deterministic and belong to the runtime, not unit tests). So tests target the pure functions; the CLI wiring is a thin shell over them; the reference docs are the agent-facing contract. Each task produces an independently testable deliverable and a commit. Tasks 1-10 cover the social helper; Tasks 11-16 cover the GitHub helper. Both helpers are independent and can land in either order, but are sequenced to keep diffs reviewable.

---

## Task 1: Scaffold helper + `buildQueries` for YouTube & Instagram (TDD)

**Files:**
- Create: `skills/discovery-eye/scripts/search-social.mjs`
- Create: `skills/discovery-eye/scripts/search-social.test.mjs`
- Test: `skills/discovery-eye/scripts/search-social.test.mjs`

**Interfaces:**
- Consumes: nothing (first task, no upstream dependencies).
- Produces:
  - `export const SUPPORTED_PLATFORMS = ["youtube", "instagram", "threads", "linkedin"]`
  - `export const SITE_FOR = { youtube:"youtube.com", instagram:"instagram.com", threads:"threads.net", linkedin:"linkedin.com" }`
  - `export function buildQueries(platform, need)` → returns `Array<{ tool:"brave-search"|"webfetch", query?:string, url?:string, purpose:string }>`. Throws `Error` for unsupported platform.

- [ ] **Step 1: Write the failing test**

Create `skills/discovery-eye/scripts/search-social.test.mjs` with exactly:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: FAIL — error `Cannot find module './search-social.mjs'` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `skills/discovery-eye/scripts/search-social.mjs` with exactly:

```js
#!/usr/bin/env node
// Tier-3 social search helper for discovery-eye.
// Gives the agent platform-specific search recipes (plan mode) and normalizes
// raw fetched content into candidate records that point at GitHub repos
// (normalize mode). Stateless: reads stdin / args, writes JSON to stdout.
//
// Usage:
//   node search-social.mjs plan <platform> "<need>"
//     -> prints JSON array of { tool, query|url, purpose } recipes the agent
//        runs via brave-search_brave_web_search / webfetch.
//   node search-social.mjs normalize <platform> ["<need>"]
//     -> reads raw JSON from stdin (what the agent fetched), prints normalized
//        candidate records (see references/sources.md candidate shape).
//
// Platforms: youtube, instagram, threads, linkedin.

export const SUPPORTED_PLATFORMS = ["youtube", "instagram", "threads", "linkedin"];

export const SITE_FOR = {
  youtube: "youtube.com",
  instagram: "instagram.com",
  threads: "threads.net",
  linkedin: "linkedin.com",
};

export function buildQueries(platform, need) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(
      `unsupported platform: ${platform}. supported: ${SUPPORTED_PLATFORMS.join(", ")}`
    );
  }
  const q = (need || "").trim();
  const site = SITE_FOR[platform];
  const recipes = [
    {
      tool: "brave-search",
      query: `"${q}" mcp site:${site}`,
      purpose: `find ${platform} posts mentioning MCP for: ${q}`,
    },
    {
      tool: "brave-search",
      query: `"${q}" "${platform}" model context protocol server`,
      purpose: `broader social mentions of ${q} MCP on ${platform}`,
    },
  ];
  if (platform === "youtube") {
    recipes.push({
      tool: "webfetch",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " mcp server")}`,
      purpose: "fallback: scrape YouTube results page if brave-search yields nothing",
    });
  }
  return recipes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: PASS — 3 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add skills/discovery-eye/scripts/search-social.mjs skills/discovery-eye/scripts/search-social.test.mjs
git commit -m "feat(discovery-eye): add buildQueries for youtube & instagram social search"
```

---

## Task 2: Extend `buildQueries` to Threads, LinkedIn + unsupported-platform guard (TDD)

**Files:**
- Modify: `skills/discovery-eye/scripts/search-social.test.mjs`
- Modify: `skills/discovery-eye/scripts/search-social.mjs` (no code change needed — `buildQueries` already covers all four platforms via `SITE_FOR`; this task adds test coverage + the guard assertion).

**Interfaces:**
- Consumes: `buildQueries` from Task 1.
- Produces: no new exports; locks the contract for the two remaining platforms + the throw behavior.

- [ ] **Step 1: Write the failing test**

Append to `skills/discovery-eye/scripts/search-social.test.mjs` (add after the existing tests, before EOF):

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: The two `buildQueries threads/linkedin` tests PASS already (implementation handles them via the generic `SITE_FOR` lookup), but the `SUPPORTED_PLATFORMS` import test FAILS until the import line resolves — it does resolve (Task 1 exports it), so all PASS. If any FAIL, fix before proceeding.

> Note: because Task 1's implementation already covers all four platforms generically, this task is primarily **contract-locking tests**. That is intentional — it guards against a future refactor that drops a platform.

- [ ] **Step 3: (No implementation change — implementation from Task 1 already satisfies these tests.)**

If Step 2 showed any failure, do NOT proceed: re-read `buildQueries` in `skills/discovery-eye/scripts/search-social.mjs` and confirm `SITE_FOR` has all four keys and the throw branch exists. Fix the implementation, not the tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: PASS — 7 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add skills/discovery-eye/scripts/search-social.test.mjs
git commit -m "test(discovery-eye): lock buildQueries contract for threads, linkedin, unsupported"
```

---

## Task 3: `extractRepoUrls` pure function (TDD)

**Files:**
- Modify: `skills/discovery-eye/scripts/search-social.test.mjs`
- Modify: `skills/discovery-eye/scripts/search-social.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export function extractRepoUrls(text)` → returns `string[]` of canonical `https://github.com/<owner>/<repo>` URLs, de-duplicated, preserving first-seen order. Empty array for falsy/no-match input.

- [ ] **Step 1: Write the failing test**

Append to `skills/discovery-eye/scripts/search-social.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: FAIL — `extractRepoUrls is not a function` (not yet exported).

- [ ] **Step 3: Write minimal implementation**

Add to `skills/discovery-eye/scripts/search-social.mjs` immediately after the `buildQueries` function (before EOF):

```js
// Matches github.com/<owner>/<repo>, with or without https://, tolerating a
// trailing period (end of sentence). Owner: 1-39 alnum/dash. Repo: alnum/._-.
const REPO_RE =
  /(?:https?:\/\/)?github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})/g;

export function extractRepoUrls(text) {
  if (!text) return [];
  const out = new Set();
  let m;
  REPO_RE.lastIndex = 0;
  while ((m = REPO_RE.exec(text)) !== null) {
    let repo = m[2];
    if (repo.endsWith(".")) repo = repo.slice(0, -1);
    if (!repo) continue;
    out.add(`https://github.com/${m[1]}/${repo}`);
  }
  return [...out];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: PASS — 12 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add skills/discovery-eye/scripts/search-social.test.mjs skills/discovery-eye/scripts/search-social.mjs
git commit -m "feat(discovery-eye): add extractRepoUrls for harvesting GitHub pointers from text"
```

---

## Task 4: `normalizeResults` for YouTube API + results-page shapes (TDD)

**Files:**
- Modify: `skills/discovery-eye/scripts/search-social.test.mjs`
- Modify: `skills/discovery-eye/scripts/search-social.mjs`

**Interfaces:**
- Consumes: `extractRepoUrls` (Task 3).
- Produces: `export function normalizeResults(platform, rawJson, need)` → returns `Array<candidateRecord>` where each record has shape:
  ```jsonc
  { "type":"mcp", "name":"<repo>", "source":"github", "sourceUrl":"https://github.com/<owner>/<repo>",
    "description":"<title> (yt:<videoId>)", "need":"<need>", "install":{ "repo":"<url>", "path":"" }, "platform":"youtube" }
  ```
  For the YouTube API shape, `rawJson` is `{ items: [{ id:{videoId}|videoId, snippet:{ title, description } }] }`.

- [ ] **Step 1: Write the failing test**

Append to `skills/discovery-eye/scripts/search-social.test.mjs`:

```js
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

```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: FAIL — `normalizeResults is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `skills/discovery-eye/scripts/search-social.mjs` after `extractRepoUrls`:

```js
export function normalizeResults(platform, rawJson, need) {
  const needText = (need || "").trim();
  const out = [];
  const seen = new Set();

  function addCandidate(repoUrl, description) {
    if (seen.has(repoUrl)) return;
    seen.add(repoUrl);
    const parts = repoUrl.replace("https://github.com/", "").split("/");
    out.push({
      type: "mcp",
      name: parts[1] || repoUrl,
      source: "github",
      sourceUrl: repoUrl,
      description: (description || "").slice(0, 200),
      need: needText,
      install: { repo: repoUrl, path: "" },
      platform,
    });
  }

  if (!rawJson) return out;

  if (platform === "youtube" && rawJson.items) {
    for (const v of rawJson.items) {
      const snip = v.snippet || {};
      const title = snip.title || "";
      const desc = snip.description || "";
      const vid = (v.id && (v.id.videoId || v.id)) || "";
      for (const url of extractRepoUrls(`${title}\n${desc}`)) {
        addCandidate(url, title + (vid ? ` (yt:${vid})` : ""));
      }
    }
    return out;
  }

  // Fallback for other platforms / shapes is implemented in Task 5.
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: PASS — 16 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add skills/discovery-eye/scripts/search-social.test.mjs skills/discovery-eye/scripts/search-social.mjs
git commit -m "feat(discovery-eye): normalizeResults harvests YouTube candidates into repo-pointer records"
```

---

## Task 5: `normalizeResults` generic fallback for Instagram/Threads/LinkedIn (TDD)

**Files:**
- Modify: `skills/discovery-eye/scripts/search-social.test.mjs`
- Modify: `skills/discovery-eye/scripts/search-social.mjs`

**Interfaces:**
- Consumes: `extractRepoUrls`, `normalizeResults` signature from Task 4.
- Produces: extends `normalizeResults` so that for non-YouTube platforms (or YouTube payloads lacking `items`) it harvests repo URLs from the **stringified** JSON blob (handles the agent wrapping fetched markdown as `{ "text": "...github.com/a/b..." }` or `{ "description": "...", "url": "..." }`). Returns `[]` for login-wall / empty payloads — never throws.

- [ ] **Step 1: Write the failing test**

Append to `skills/discovery-eye/scripts/search-social.test.mjs`:

```js
test("normalizeResults instagram harvests repo from {text} webfetch wrapper", () => {
  const raw = { text: "cool post! repo: github.com/aa/bb #mcp" };
  const out = normalizeResults("instagram", raw, "image ocr");
  assert.equal(out.length, 1);
  assert.equal(out[0].sourceUrl, "https://github.com/aa/bb");
  assert.equal(out[0].platform, "instagram");
  assert.equal(out[0].need, "image ocr");
});

test("normalizeResults linkedin returns [] on login-wall payload (no repo)", () => {
  const raw = { text: "Sign in to see more LinkedIn content", url: "https://linkedin.com/posts/xyz" };
  assert.deepEqual(normalizeResults("linkedin", raw, "resume"), []);
});

test("normalizeResults threads harvests from nested description field", () => {
  const raw = { post: { description: "thread about github.com/cc/dd mcp" } };
  const out = normalizeResults("threads", raw, "slack");
  assert.equal(out.length, 1);
  assert.equal(out[0].sourceUrl, "https://github.com/cc/dd");
});

test("normalizeResults returns [] for null/undefined rawJson on any platform", () => {
  assert.deepEqual(normalizeResults("youtube", null, "x"), []);
  assert.deepEqual(normalizeResults("instagram", undefined, "x"), []);
  assert.deepEqual(normalizeResults("linkedin", null, "x"), []);
});

test("normalizeResults generic fallback dedupes across stringified blob", () => {
  const raw = { a: "github.com/dup/x", b: { c: "github.com/dup/x and github.com/uniq/y" } };
  const out = normalizeResults("threads", raw, "");
  assert.equal(out.length, 2);
  assert.equal(out[0].sourceUrl, "https://github.com/dup/x");
  assert.equal(out[1].sourceUrl, "https://github.com/uniq/y");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: FAIL — the instagram/threads tests expect harvested candidates but the Task-4 `normalizeResults` returns `[]` for non-YouTube platforms (the fallback is a stub `return out`).

- [ ] **Step 3: Write minimal implementation**

In `skills/discovery-eye/scripts/search-social.mjs`, **replace** the trailing stub:

```js
  // Fallback for other platforms / shapes is implemented in Task 5.
  return out;
}
```

with:

```js
  // Generic fallback: Instagram / Threads / LinkedIn, or any payload without an
  // `items` array. The agent wraps fetched markdown as { text | description |
  // title } when it isn't already JSON; stringify everything so nested fields
  // are scanned too. Login-wall payloads simply yield no repo URLs -> [].
  const blob = JSON.stringify(rawJson);
  const desc =
    rawJson && typeof rawJson === "object" &&
    (rawJson.text || rawJson.description || rawJson.title)
      ? String(rawJson.text || rawJson.description || rawJson.title)
      : "";
  for (const url of extractRepoUrls(blob)) addCandidate(url, desc);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: PASS — 21 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add skills/discovery-eye/scripts/search-social.test.mjs skills/discovery-eye/scripts/search-social.mjs
git commit -m "feat(discovery-eye): normalizeResults generic fallback for instagram/threads/linkedin"
```

---

## Task 6: CLI wiring — `plan` and `normalize` modes (TDD via subprocess)

**Files:**
- Modify: `skills/discovery-eye/scripts/search-social.test.mjs`
- Modify: `skills/discovery-eye/scripts/search-social.mjs`

**Interfaces:**
- Consumes: `buildQueries`, `normalizeResults` (Tasks 1-5).
- Produces: a working CLI:
  - `node search-social.mjs plan <platform> "<need>"` → prints `buildQueries` JSON to stdout, exit 0.
  - `node search-social.mjs normalize <platform> ["<need>"]` → reads JSON from stdin, prints `normalizeResults` JSON to stdout, exit 0. Empty stdin → `[]`.
  - Unsupported mode / missing args → stderr message + exit 2. Invalid JSON on stdin → stderr + exit 1.

- [ ] **Step 1: Write the failing test**

Append to `skills/discovery-eye/scripts/search-social.test.mjs`:

```js
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "search-social.mjs");
const NODE = process.execPath;

function run(args, stdin = "") {
  try {
    const stdout = execFileSync(NODE, [SCRIPT, ...args], {
      input: stdin,
      encoding: "utf8",
    });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

test("CLI plan mode prints buildQueries JSON for youtube", () => {
  const { code, stdout } = run(["plan", "youtube", "postgres mcp"]);
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.ok(Array.isArray(parsed));
  assert.ok(parsed.some((r) => r.tool === "brave-search" && /site:youtube\.com/.test(r.query)));
});

test("CLI normalize mode reads stdin and emits candidates", () => {
  const payload = JSON.stringify({
    items: [{ id: { videoId: "v9" }, snippet: { title: "t", description: "github.com/zz/yy" } }],
  });
  const { code, stdout } = run(["normalize", "youtube", "need"], payload);
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].sourceUrl, "https://github.com/zz/yy");
});

test("CLI normalize mode with empty stdin returns []", () => {
  const { code, stdout } = run(["normalize", "instagram"], "");
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout), []);
});

test("CLI normalize mode exits 1 on invalid JSON", () => {
  const { code, stderr } = run(["normalize", "youtube"], "not json{");
  assert.equal(code, 1);
  assert.match(stderr, /invalid JSON/i);
});

test("CLI exits 2 with usage message when no mode given", () => {
  const { code, stderr } = run([]);
  assert.equal(code, 2);
  assert.match(stderr, /usage/i);
});

test("CLI plan exits 2 when platform missing", () => {
  const { code, stderr } = run(["plan"]);
  assert.equal(code, 2);
  assert.match(stderr, /usage/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: FAIL — the `plan`/`normalize` modes don't exist; running the script with no args currently produces no output and exits 0 (no CLI block yet), so the usage/exit-2 tests fail.

- [ ] **Step 3: Write minimal implementation**

Append to the bottom of `skills/discovery-eye/scripts/search-social.mjs`:

```js
const [mode, platform, need] = process.argv.slice(2);

if (mode === "plan") {
  if (!platform || !need) {
    console.error('usage: search-social.mjs plan <platform> "<need>"');
    process.exit(2);
  }
  console.log(JSON.stringify(buildQueries(platform, need), null, 2));
} else if (mode === "normalize") {
  if (!platform) {
    console.error('usage: search-social.mjs normalize <platform> ["<need>"]');
    process.exit(2);
  }
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    let rawJson = null;
    if (input.trim()) {
      try {
        rawJson = JSON.parse(input);
      } catch (e) {
        console.error(`invalid JSON on stdin: ${e.message}`);
        process.exit(1);
      }
    }
    console.log(JSON.stringify(normalizeResults(platform, rawJson, need || ""), null, 2));
  });
} else {
  console.error(
    'usage: search-social.mjs plan <platform> "<need>" | normalize <platform> ["<need>"]'
  );
  process.exit(2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: PASS — 27 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add skills/discovery-eye/scripts/search-social.test.mjs skills/discovery-eye/scripts/search-social.mjs
git commit -m "feat(discovery-eye): wire plan/normalize CLI modes for search-social helper"
```

---

## Task 7: `references/social-platforms.md` playbook

**Files:**
- Create: `skills/discovery-eye/references/social-platforms.md`

**Interfaces:**
- Consumes: the helper from Tasks 1-6.
- Produces: a reference doc the agent loads during Phase 5 to learn per-platform search strategy, fetch limits, and the normalize contract. No code; verified by reading.

- [ ] **Step 1: Write the document**

Create `skills/discovery-eye/references/social-platforms.md` with exactly:

```markdown
# Social-platform search (Tier 3)

Extends Tier-3 (open web) to find MCP-related candidates mentioned on
**YouTube, Instagram, Threads, LinkedIn.** These platforms rarely appear in the
default WebSearch set for niche MCP queries, and most block unauthenticated
reads — so the flow is: ask the helper for recipes, run them with the agent's
own `brave-search_brave_web_search` / `webfetch`, then pipe the raw result
back through the helper to normalize.

> All candidates discovered here are **Tier-3** and MUST go through
> `vetting.md` + explicit per-item approval. A social post with no inspectable
> repo gets the `⚠️ No source` flag (`vetting.md:30`) and is dropped.

## Helper

```
node "$SKILL_DIR/scripts/search-social.mjs plan <platform> "<need>"
node "$SKILL_DIR/scripts/search-social.mjs normalize <platform> ["<need>"] < <raw-json>
```

`plan` prints an array of `{ tool, query|url, purpose }`. `normalize` reads raw
JSON from stdin (whatever the agent fetched) and prints candidate records
pointing at `github.com` repos — never at the social post itself.

Platforms: `youtube`, `instagram`, `threads`, `linkedin`.

## Flow (per platform, per need)

1. Run `plan <platform> "<need>"`. For each returned recipe:
   - `tool: "brave-search"` → call `brave-search_brave_web_search` with the
     `query` string.
   - `tool: "webfetch"` → call `webfetch` on the `url`, format `markdown`.
2. Collect all raw outputs into one JSON document. If a fetch returned plain
   markdown (not JSON), wrap it as `{ "text": "<markdown>" }` before feeding
   `normalize`. If brave-search returned its native JSON, pass it through.
3. Pipe the combined JSON to `normalize <platform> "<need>"`. Each printed
   record is a candidate (repo pointer).
4. Merge into the Phase 6 candidate pool. Dedupe against the inventory set
   and other tiers by `sourceUrl` (canonical GitHub repo).

## Per-platform notes

| Platform | Reachable unauthenticated? | Realistic yield | Notes |
|----------|---------------------------|-----------------|-------|
| **YouTube** | Yes — results page + video pages via webfetch (descriptions, not transcripts). | **High** — creators link repos in descriptions. | Best signal of the four. `plan` includes a webfetch fallback to the results page. No transcript extraction (out of scope); descriptions only. |
| **Instagram** | Posts: **login wall** almost always. Public profile pages partially visible. | **Low** — few MCP posts, mostly login-blocked. | Expect mostly empty `normalize` output. Treat empty as graceful skip, not failure. |
| **Threads** | Partial — `threads.net/@user/post/<id>` sometimes renders text unauthenticated. | **Low-Medium** — emerging dev discussion. | Worth one fetch attempt; if HTML is a login interstitial, discard and move on. |
| **LinkedIn** | **Login wall** on every post URL. | **Near zero** directly. | Do not attempt to circumvent (ToS). Use brave-search snippets only; if a snippet names a repo, that repo becomes the candidate via `extractRepoUrls`, fetched from GitHub (not LinkedIn). |

## Optional: YouTube Data API v3

If the user has `YOUTUBE_API_KEY` set in their environment, the agent MAY call
the YouTube Data API `search.list` directly (query `<need> mcp`, type `video`,
order `relevance`, maxResults 10) and feed the raw response to `normalize`.
This is strictly opt-in — the helper does **not** read the key, does **not**
make network calls, and the agent must never persist the key. The keyless
`plan` + `webfetch` path above is the default and requires no credentials.

## ToS & safety (hard rules)

- Fetch **public** content only. Never script login forms, never replay
  cookies/tokens, never use headless browsers to bypass login walls.
- LinkedIn: scraping violates their ToS; rely on search-engine snippets only.
- Instagram: same — do not attempt authenticated Graph API flows here.
- A social find is a **pointer**, never a source of truth. The candidate is
  the GitHub repo it points to; vet the repo, not the post.
```

- [ ] **Step 2: Verify the document is well-formed**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('skills/discovery-eye/references/social-platforms.md','utf8');console.log('lines:',t.split('\n').length);console.log('has helper usage:',/search-social\.mjs/.test(t));console.log('has all platforms:',/youtube/.test(t)&&/instagram/.test(t)&&/threads/.test(t)&&/linkedin/.test(t));"`
Expected output:
```
lines: 74
has helper usage: true
has all platforms: true
```

(Exact line count may vary by a line if your editor trims trailing newline — the two booleans must be `true`.)

- [ ] **Step 3: Commit**

```bash
git add skills/discovery-eye/references/social-platforms.md
git commit -m "docs(discovery-eye): add social-platforms reference for youtube/instagram/threads/linkedin"
```

---

## Task 8: Wire new platforms into `references/sources.md` Tier-3

**Files:**
- Modify: `skills/discovery-eye/references/sources.md` (lines 70-76, the "Social (discovery)" block).

**Interfaces:**
- Consumes: `social-platforms.md` (Task 7), `search-social.mjs` (Tasks 1-6).
- Produces: Tier-3 social bullet now covers all four target platforms and points at the helper + reference.

- [ ] **Step 1: Read the current block to confirm exact text to replace**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('skills/discovery-eye/references/sources.md','utf8');const i=t.indexOf('Social (discovery)');console.log(t.slice(i-40,i+340));"`
Expected: shows the block starting `- **Social (discovery)** — mentions on blogs, X/Twitter, Reddit r/* threads only as a *pointer*...` and the `**Social validation (not discovery).** ... site:reddit.com OR site:news.ycombinator.com ...` paragraph.

- [ ] **Step 2: Apply the edit**

In `skills/discovery-eye/references/sources.md`, replace this exact block:

```
- **Social (discovery)** — mentions on blogs, X/Twitter, Reddit r/* threads
  only as a *pointer* to a repo; the repo, not the post, is the candidate.

**Social validation (not discovery).** Once you have a candidate, a quick
`"<name>" site:reddit.com OR site:news.ycombinator.com` search gauges
community sentiment — this feeds the *social-validation* signal in
`scoring.md` (low weight). Never promote a candidate on buzz alone.
```

with:

```
- **Social (discovery)** — mentions on blogs, X/Twitter, Reddit r/* threads
  only as a *pointer* to a repo; the repo, not the post, is the candidate.
- **Social platforms (YouTube, Instagram, Threads, LinkedIn)** — niche MCP
  discussion that the default WebSearch rarely surfaces. Use the helper:
  `node "$SKILL_DIR/scripts/search-social.mjs plan <platform> "<need>"` emits
  per-platform search recipes (brave-search queries + a YouTube results-page
  webfetch fallback); run them with the agent's own
  `brave-search_brave_web_search` / `webfetch`, then pipe the raw fetched JSON
  to `node "$SKILL_DIR/scripts/search-social.mjs normalize <platform> "<need>"`
  to harvest repo-pointer candidates. Full per-platform strategy, reachability,
  and ToS limits are in `references/social-platforms.md`. Instagram and
  LinkedIn almost always return a login wall unauthenticated — empty
  `normalize` output is a graceful skip, not a failure.

**Social validation (not discovery).** Once you have a candidate, a quick
`"<name>" site:reddit.com OR site:news.ycombinator.com` search gauges
community sentiment — this feeds the *social-validation* signal in
`scoring.md` (low weight). Never promote a candidate on buzz alone.
```

- [ ] **Step 3: Verify the edit landed and no other content moved**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('skills/discovery-eye/references/sources.md','utf8');console.log('has helper mention:',/search-social\.mjs plan/.test(t));console.log('has platforms doc ref:',/social-platforms\.md/.test(t));console.log('still has validation block:',/Social validation \(not discovery\)/.test(t));console.log('still has reddit/hn:',/site:news\.ycombinator\.com/.test(t));"`
Expected output:
```
has helper mention: true
has platforms doc ref: true
still has validation block: true
still has reddit/hn: true
```

- [ ] **Step 4: Commit**

```bash
git add skills/discovery-eye/references/sources.md
git commit -m "docs(discovery-eye): wire youtube/instagram/threads/linkedin into Tier-3 social search"
```

---

## Task 9: Update `SKILL.md` Phase 5 + `README.md` repo layout

**Files:**
- Modify: `skills/discovery-eye/SKILL.md` (Phase 5, around lines 91-100).
- Modify: `README.md` (repo-layout block, lines 98-113).

**Interfaces:**
- Consumes: Tasks 1-8.
- Produces: the skill body tells the agent about the new helper; the README lists the new files.

- [ ] **Step 1: Edit `SKILL.md` Phase 5 — expand the Tier-3 open-web bullet**

In `skills/discovery-eye/SKILL.md`, replace this exact line (currently line 100):

```
3. **Open web** — WebSearch + GitHub search + WebFetch + social mentions.
```

with:

```
3. **Open web** — WebSearch + GitHub search + WebFetch + social mentions,
   including the four social platforms (YouTube, Instagram, Threads, LinkedIn)
   via `node "$SKILL_DIR/scripts/search-social.mjs plan <platform> "<need>"`
   to get recipes, then `normalize <platform>` on the fetched JSON. See
   `references/social-platforms.md` for per-platform strategy & ToS limits.
```

- [ ] **Step 2: Edit `README.md` repo layout — add the two new files**

In `README.md`, replace this exact block:

```
│   │   ├── sources.md        #   the 3 search tiers (+ skills.sh, social) + normalization
│   │   ├── scoring.md        #   0–100 merit-ranking rubric + reputation boosts
│   │   ├── host-profiles.md  #   per-agent install paths + provenance rules
│   │   └── vetting.md        #   safety: evidence fields + risk flags + badges
│   └── scripts/              # plain Node helpers the skill calls
│       ├── search-catalog.mjs  # Tier-1 local catalog search
│       ├── ledger.mjs          # provenance record (powers list + undo)
│       ├── inventory.mjs       # `discovery-eye list`
│       └── remove.mjs          # uninstall / quarantine / restore
```

with:

```
│   │   ├── sources.md        #   the 3 search tiers (+ skills.sh, social) + normalization
│   │   ├── social-platforms.md #  YouTube/Instagram/Threads/LinkedIn search strategy & ToS
│   │   ├── scoring.md        #   0–100 merit-ranking rubric + reputation boosts
│   │   ├── host-profiles.md  #   per-agent install paths + provenance rules
│   │   └── vetting.md        #   safety: evidence fields + risk flags + badges
│   └── scripts/              # plain Node helpers the skill calls
│       ├── search-catalog.mjs  # Tier-1 local catalog search
│       ├── search-social.mjs   # Tier-3 social-platform search + normalize
│       ├── ledger.mjs          # provenance record (powers list + undo)
│       ├── inventory.mjs       # `discovery-eye list`
│       └── remove.mjs          # uninstall / quarantine / restore
```

- [ ] **Step 3: Verify both edits**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('skills/discovery-eye/SKILL.md','utf8');const r=fs.readFileSync('README.md','utf8');console.log('skill mentions helper:',/search-social\.mjs plan/.test(s));console.log('skill mentions platforms doc:',/social-platforms\.md/.test(s));console.log('readme has search-social.mjs:',/search-social\.mjs/.test(r));console.log('readme has social-platforms.md:',/social-platforms\.md/.test(r));"`
Expected output:
```
skill mentions helper: true
skill mentions platforms doc: true
readme has search-social.mjs: true
readme has social-platforms.md: true
```

- [ ] **Step 4: Commit**

```bash
git add skills/discovery-eye/SKILL.md README.md
git commit -m "docs(discovery-eye): reference social-platforms helper in SKILL Phase 5 + README layout"
```

---

## Task 10: `vetting.md` social-source clarification + `AGENTS.md` + final verification

**Files:**
- Modify: `skills/discovery-eye/references/vetting.md` (Risk flags list, around line 30).
- Create: `AGENTS.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: explicit vetting guidance for social-only candidates; a repo-level `AGENTS.md` recording the verification command.

- [ ] **Step 1: Edit `vetting.md` — clarify the `No source` flag for social finds**

In `skills/discovery-eye/references/vetting.md`, replace this exact line (currently line 30):

```
- ⚠️ **No source** — only a social post, no inspectable repo.
```

with:

```
- ⚠️ **No source** — only a social post, no inspectable repo. Social-platform
  candidates (YouTube/Instagram/Threads/LinkedIn) found via `search-social.mjs`
  MUST resolve to a GitHub `sourceUrl`; a hit that yields no repo URL is
  dropped at `normalize`, never suggested.
```

- [ ] **Step 2: Create `AGENTS.md` at repo root**

Create `AGENTS.md` with exactly:

```markdown
# AGENTS.md

Guidance for AI coding agents working in this repo.

## What this repo is

`discovery-eye` is a portable **skill** (playbook + plain Node helper scripts)
that lets a coding agent discover, vet, and install MCP servers / skills /
plugins / connectors / memory. The skill is the playbook; the agent is the
runtime; `.mjs` files are plain helper programs (no MCP server, no daemon).

## Tech stack & constraints

- **Node.js v22** only. Use built-in modules exclusively (`node:fs`, `node:os`,
  `node:path`, `node:test`, `node:assert`, `node:child_process`, `node:url`).
- **No dependencies.** Do not add a `package.json` with runtime deps, do not
  `npm install`. ES modules via `.mjs` extension.
- **State** lives host-agnostically under `~/.discovery-eye/` (see
  `skills/discovery-eye/scripts/ledger.mjs`). Most helpers are stateless.

## How to verify changes

Run the unit tests (no network, no setup):

```bash
node --test skills/discovery-eye/scripts/search-social.test.mjs
```

To run every `.test.mjs` in the repo as the set grows:

```bash
node --test skills/discovery-eye/scripts/*.test.mjs
```

Expected: all tests pass, exit code 0. There is no lint step and no typecheck
step configured for this repo — the test command above is the verification gate.

## Conventions for new helpers

- Shebang `#!/usr/bin/env node` + a header comment block with usage (see
  `skills/discovery-eye/scripts/search-catalog.mjs:1-7` for the template).
- Export pure functions for unit testing; put CLI dispatch at the bottom.
- Stdout prints JSON only; human errors go to stderr.
- Exit codes: `0` success, `1` runtime error, `2` usage error.

## What not to do

- Do not introduce a build step, bundler, or transpiler.
- Do not write API keys, tokens, or secret values into any file. Reference env
  var names only (see `references/vetting.md`, `references/host-profiles.md`).
- Do not add authenticated scraping / login automation for social platforms —
  public fetches only (see `references/social-platforms.md` ToS rules).
- Do not commit secrets, `.env`, or `~/.discovery-eye/` state.
```

- [ ] **Step 3: Run the full test suite as the final verification**

Run: `node --test skills/discovery-eye/scripts/search-social.test.mjs`
Expected: PASS — 27 tests pass, 0 fail, exit 0.

- [ ] **Step 4: Sanity-check the helper end-to-end via CLI**

Run: `node skills/discovery-eye/scripts/search-social.mjs plan youtube "postgres mcp"`
Expected: prints a JSON array whose first element has `"tool": "brave-search"` and a `query` containing `site:youtube.com` and `postgres mcp`.

Run:
```bash
echo '{"items":[{"id":{"videoId":"v"},"snippet":{"title":"t","description":"github.com/foo/bar"}}]}' | node skills/discovery-eye/scripts/search-social.mjs normalize youtube "postgres mcp"
```
Expected: prints a JSON array with one candidate whose `sourceUrl` is `https://github.com/foo/bar` and `platform` is `youtube`.

- [ ] **Step 5: Commit**

```bash
git add skills/discovery-eye/references/vetting.md AGENTS.md
git commit -m "docs(discovery-eye): clarify No-source flag for social finds; add AGENTS.md with test command"
```

---

## Task 11: Scaffold GitHub helper + `buildGithubQueries` (TDD)

**Files:**
- Create: `skills/discovery-eye/scripts/search-github.mjs`
- Create: `skills/discovery-eye/scripts/search-github.test.mjs`
- Test: `skills/discovery-eye/scripts/search-github.test.mjs`

**Interfaces:**
- Consumes: nothing (first GitHub task).
- Produces:
  - `export function buildGithubQueries(need)` → returns `Array<{ tool:"github_search_repositories"|"github_search_code", query:string, sort?:string, purpose:string }>`.

- [ ] **Step 1: Write the failing test**

Create `skills/discovery-eye/scripts/search-github.test.mjs` with exactly:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/discovery-eye/scripts/search-github.test.mjs`
Expected: FAIL — `Cannot find module './search-github.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `skills/discovery-eye/scripts/search-github.mjs` with exactly:

```js
#!/usr/bin/env node
// Tier-3 GitHub discovery helper for discovery-eye.
// Emits github_search_repositories / github_search_code recipes (plan mode) and
// normalizes raw GitHub API JSON into candidate records (normalize mode).
// Stateless: reads stdin / args, writes JSON to stdout.
//
// Usage:
//   node search-github.mjs plan "<need>"
//     -> prints JSON array of { tool, query, sort?, purpose } recipes the agent
//        runs via github_search_repositories / github_search_code.
//   node search-github.mjs normalize <repos|code> ["<need>"] < <raw-json>
//     -> reads raw GitHub search API JSON from stdin, prints normalized
//        candidate records (see references/sources.md candidate shape).

export function buildGithubQueries(need) {
  const q = (need || "").trim();
  return [
    {
      tool: "github_search_repositories",
      query: `mcp server ${q} stars:>50`,
      sort: "stars",
      purpose: `popular MCP server repos for: ${q}`,
    },
    {
      tool: "github_search_repositories",
      query: `mcp ${q} in:name,description`,
      sort: "updated",
      purpose: `recently-updated MCP repos mentioning: ${q}`,
    },
    {
      tool: "github_search_code",
      query: `in:readme "mcp" "${q}" extension:md`,
      purpose: `find unlisted servers mentioning ${q} in README`,
    },
    {
      tool: "github_search_code",
      query: `"mcpServers" ${q} filename:.mcp.json`,
      purpose: `find .mcp.json manifests referencing ${q}`,
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/discovery-eye/scripts/search-github.test.mjs`
Expected: PASS — 4 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add skills/discovery-eye/scripts/search-github.mjs skills/discovery-eye/scripts/search-github.test.mjs
git commit -m "feat(discovery-eye): add buildGithubQueries for structured GitHub MCP discovery"
```

---

## Task 12: `normalizeGithubRepos` — repo search → candidates (TDD)

**Files:**
- Modify: `skills/discovery-eye/scripts/search-github.test.mjs`
- Modify: `skills/discovery-eye/scripts/search-github.mjs`

**Interfaces:**
- Consumes: `buildGithubQueries` (Task 11).
- Produces: `export function normalizeGithubRepos(rawJson, need)` → `Array<candidateRecord>` with shape:
  ```jsonc
  { "type":"mcp", "name":"<repo-name>", "source":"github", "sourceUrl":"<html_url>",
    "description":"<description>", "need":"<need>", "install":{ "repo":"<url>", "path":"" },
    "stars":<int>, "updatedAt":"<pushed_at ISO>", "topics":[...], "discoveredVia":"github:repos" }
  ```
  Input shape: `{ items: [{ full_name, html_url, stargazers_count, pushed_at, updated_at, description, topics, name, owner:{login} }] }`.

- [ ] **Step 1: Write the failing test**

Append to `skills/discovery-eye/scripts/search-github.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/discovery-eye/scripts/search-github.test.mjs`
Expected: FAIL — `normalizeGithubRepos is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `skills/discovery-eye/scripts/search-github.mjs` after `buildGithubQueries`:

```js
export function normalizeGithubRepos(rawJson, need) {
  const needText = (need || "").trim();
  const out = [];
  if (!rawJson || !Array.isArray(rawJson.items)) return out;
  const seen = new Set();
  for (const r of rawJson.items) {
    const url = r.html_url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const name = (r.full_name || "").split("/")[1] || r.name || url;
    out.push({
      type: "mcp",
      name,
      source: "github",
      sourceUrl: url,
      description: (r.description || "").slice(0, 200),
      need: needText,
      install: { repo: url, path: "" },
      stars: r.stargazers_count || 0,
      updatedAt: r.pushed_at || r.updated_at || "",
      topics: Array.isArray(r.topics) ? r.topics : [],
      discoveredVia: "github:repos",
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/discovery-eye/scripts/search-github.test.mjs`
Expected: PASS — 8 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add skills/discovery-eye/scripts/search-github.test.mjs skills/discovery-eye/scripts/search-github.mjs
git commit -m "feat(discovery-eye): normalizeGithubRepos maps repo search to candidates with stars/updatedAt"
```

---

## Task 13: `normalizeGithubCode` — code search → candidates (TDD)

**Files:**
- Modify: `skills/discovery-eye/scripts/search-github.test.mjs`
- Modify: `skills/discovery-eye/scripts/search-github.mjs`

**Interfaces:**
- Consumes: `buildGithubQueries`, `normalizeGithubRepos` (Tasks 11-12).
- Produces: `export function normalizeGithubCode(rawJson, need)` → `Array<candidateRecord>`. Input shape: `{ items: [{ repository: { full_name, html_url, stargazers_count }, path, name }] }`. Dedupes by `repository.html_url`. Sets `install.path` to the matched file path and `discoveredVia:"github:code"`.

- [ ] **Step 1: Write the failing test**

Append to `skills/discovery-eye/scripts/search-github.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/discovery-eye/scripts/search-github.test.mjs`
Expected: FAIL — `normalizeGithubCode is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `skills/discovery-eye/scripts/search-github.mjs` after `normalizeGithubRepos`:

```js
export function normalizeGithubCode(rawJson, need) {
  const needText = (need || "").trim();
  const out = [];
  if (!rawJson || !Array.isArray(rawJson.items)) return out;
  const seen = new Set();
  for (const c of rawJson.items) {
    const repo = c.repository;
    if (!repo) continue;
    const url = repo.html_url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const name = (repo.full_name || "").split("/")[1] || url;
    const path = c.path || "";
    out.push({
      type: "mcp",
      name,
      source: "github",
      sourceUrl: url,
      description: (path ? `code match: ${path}` : "").slice(0, 200),
      need: needText,
      install: { repo: url, path },
      stars: repo.stargazers_count || 0,
      updatedAt: "",
      topics: [],
      discoveredVia: "github:code",
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/discovery-eye/scripts/search-github.test.mjs`
Expected: PASS — 12 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add skills/discovery-eye/scripts/search-github.test.mjs skills/discovery-eye/scripts/search-github.mjs
git commit -m "feat(discovery-eye): normalizeGithubCode harvests repo candidates from code search"
```

---

## Task 14: GitHub CLI wiring — `plan` and `normalize <repos|code>` (TDD via subprocess)

**Files:**
- Modify: `skills/discovery-eye/scripts/search-github.test.mjs`
- Modify: `skills/discovery-eye/scripts/search-github.mjs`

**Interfaces:**
- Consumes: `buildGithubQueries`, `normalizeGithubRepos`, `normalizeGithubCode` (Tasks 11-13).
- Produces: working CLI:
  - `node search-github.mjs plan "<need>"` → prints `buildGithubQueries` JSON, exit 0.
  - `node search-github.mjs normalize repos ["<need>"]` → reads stdin, prints `normalizeGithubRepos`, exit 0.
  - `node search-github.mjs normalize code ["<need>"]` → reads stdin, prints `normalizeGithubCode`, exit 0.
  - Missing args / unknown normalize target → stderr + exit 2. Invalid JSON → stderr + exit 1.

- [ ] **Step 1: Write the failing test**

Append to `skills/discovery-eye/scripts/search-github.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/discovery-eye/scripts/search-github.test.mjs`
Expected: FAIL — no CLI block; running with no args exits 0 with no output.

- [ ] **Step 3: Write minimal implementation**

Append to the bottom of `skills/discovery-eye/scripts/search-github.mjs`:

```js
const [mode, target, need] = process.argv.slice(2);

if (mode === "plan") {
  if (!target) {
    console.error('usage: search-github.mjs plan "<need>"');
    process.exit(2);
  }
  console.log(JSON.stringify(buildGithubQueries(target), null, 2));
} else if (mode === "normalize") {
  if (target !== "repos" && target !== "code") {
    console.error('usage: search-github.mjs normalize <repos|code> ["<need>"]');
    process.exit(2);
  }
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    let rawJson = null;
    if (input.trim()) {
      try {
        rawJson = JSON.parse(input);
      } catch (e) {
        console.error(`invalid JSON on stdin: ${e.message}`);
        process.exit(1);
      }
    }
    const out = target === "repos"
      ? normalizeGithubRepos(rawJson, need || "")
      : normalizeGithubCode(rawJson, need || "");
    console.log(JSON.stringify(out, null, 2));
  });
} else {
  console.error('usage: search-github.mjs plan "<need>" | normalize <repos|code> ["<need>"]');
  process.exit(2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/discovery-eye/scripts/search-github.test.mjs`
Expected: PASS — 19 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add skills/discovery-eye/scripts/search-github.test.mjs skills/discovery-eye/scripts/search-github.mjs
git commit -m "feat(discovery-eye): wire plan/normalize CLI modes for search-github helper"
```

---

## Task 15: `references/github-discovery.md` playbook

**Files:**
- Create: `skills/discovery-eye/references/github-discovery.md`

**Interfaces:**
- Consumes: the helper from Tasks 11-14.
- Produces: agent-facing reference for GitHub discovery. No code; verified by reading.

- [ ] **Step 1: Write the document**

Create `skills/discovery-eye/references/github-discovery.md` with exactly:

```markdown
# GitHub discovery (Tier 3)

Structured GitHub search for MCP candidates — the highest-yield Tier-3 source.
Uses the agent's `github_search_repositories` and `github_search_code` tools
(stronger than the raw `github.com/search` URL in `sources.md`).

> All candidates discovered here are **Tier-3** and MUST go through `vetting.md`
> + explicit per-item approval. GitHub finds are usually inspectable (unlike
> login-walled social platforms) but still require vetting of *what code runs*.

## Helper

```
node "$SKILL_DIR/scripts/search-github.mjs plan "<need>"
node "$SKILL_DIR/scripts/search-github.mjs normalize repos ["<need>"] < <raw-json>
node "$SKILL_DIR/scripts/search-github.mjs normalize code  ["<need>"] < <raw-json>
```

`plan` emits recipes tagged with the `github_search_*` tool to call and the
query string. `normalize` reads the raw GitHub API JSON (what the tool
returned) and prints candidate records.

## Flow (per need)

1. Run `plan "<need>"`. For each recipe, call the named tool:
   - `tool: "github_search_repositories"` → `github_search_repositories` with
     `query` and `sort`. Capture the JSON response.
   - `tool: "github_search_code"` → `github_search_code` with `query`. Capture
     the JSON response.
2. Pipe each captured response to the matching `normalize` target:
   - repos response → `normalize repos "<need>"`
   - code response → `normalize code "<need>"`
3. Merge all candidates into the Phase 6 pool. Dedupe by `sourceUrl` (canonical
   GitHub repo URL) across both normalize outputs and other tiers.
4. A repo that appears in BOTH repos-search and code-search is one candidate —
   keep the higher-signal record (repos-search gives `stars` + `updatedAt`;
   code-search gives the matched file `path`). Prefer repos-search metadata.

## Why two normalize targets

GitHub's two search APIs return different item shapes:
- **repos** — `{ items: [{ full_name, html_url, stargazers_count, pushed_at, description, topics }] }`.
  Rich metadata; feeds `scoring.md` Popularity (`stars`) + Recency (`updatedAt`)
  directly. Use for ranking.
- **code** — `{ items: [{ repository: { full_name, html_url, ... }, path, name }] }`.
  Finds unlisted servers (README mentions, `.mcp.json` manifests). Use to surface
  repos the repos-search missed; the matched `path` hints where the MCP config
  lives (helpful for the install step).

## Candidate record (GitHub)

```jsonc
{ "type":"mcp", "name":"<repo>", "source":"github", "sourceUrl":"<html_url>",
  "description":"<description>", "need":"<need>",
  "install":{ "repo":"<url>", "path":"<file path|empty>" },
  "stars":<int>, "updatedAt":"<ISO>", "topics":[...],
  "discoveredVia":"github:repos" | "github:code" }
```

`stars`, `updatedAt`, `topics`, `discoveredVia` are additive — they feed
`scoring.md` (Popularity uses `stars`, Recency uses `updatedAt`, Fit can use
`topics`) and are ignored by any consumer that doesn't read them.

## Notes & limits

- `github_search_code` rate-limits more aggressively than repos search for
  unauthenticated/low-scope tokens. If a code query errors, skip it — the
  repos-search + README WebFetch fallback still covers most servers.
- `stars:>50` in the default repos recipe filters out noise; lower it only if
  the need is niche and the first pass returns nothing.
- A `.mcp.json` manifest hit is a strong signal the repo *is* an MCP host (not
  necessarily a server). Still vet the repo — the manifest may reference an
  external server you'd install from elsewhere.
- For very common terms (e.g. "database"), the repos query may be broad; the
  Phase 6 Fit score (keyword overlap) handles ranking, not search breadth.
```

- [ ] **Step 2: Verify the document is well-formed**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('skills/discovery-eye/references/github-discovery.md','utf8');console.log('has helper usage:',/search-github\.mjs/.test(t));console.log('has both targets:',/normalize repos/.test(t)&&/normalize code/.test(t));console.log('mentions scoring:',/scoring\.md/.test(t));"`
Expected output:
```
has helper usage: true
has both targets: true
mentions scoring: true
```

- [ ] **Step 3: Commit**

```bash
git add skills/discovery-eye/references/github-discovery.md
git commit -m "docs(discovery-eye): add github-discovery reference for structured MCP search"
```

---

## Task 16: Wire GitHub helper into `sources.md`, `SKILL.md`, `README.md`, `AGENTS.md`

**Files:**
- Modify: `skills/discovery-eye/references/sources.md` (Tier-3 GitHub bullet, currently lines 65-67).
- Modify: `skills/discovery-eye/SKILL.md` (Phase 5 — GitHub bullet).
- Modify: `README.md` (repo-layout block — add `search-github.mjs` + `github-discovery.md`).
- Modify: `AGENTS.md` (created in Task 10 — extend the test command to cover `search-github.test.mjs`).

**Interfaces:**
- Consumes: Tasks 11-15.
- Produces: GitHub discovery fully wired into the skill's Tier-3 surface.

- [ ] **Step 1: Edit `sources.md` — replace the ad-hoc GitHub bullet**

In `skills/discovery-eye/references/sources.md`, replace this exact block:

```
- **GitHub search** — `https://github.com/search?q=<need>+mcp&type=repositories`,
  sort by stars/recently-updated. Look for `SKILL.md`, `mcp` server repos,
  `.mcp.json`, marketplace manifests.
```

with:

```
- **GitHub search** — structured, via the helper. Run
  `node "$SKILL_DIR/scripts/search-github.mjs plan "<need>"` to emit
  `github_search_repositories` / `github_search_code` recipes, call those tools,
  then pipe the raw responses through `normalize repos` / `normalize code`.
  Candidates carry `stars` + `updatedAt` (feeds `scoring.md` Popularity +
  Recency directly). Full strategy + response-shape notes in
  `references/github-discovery.md`. (Falls back to the manual
  `https://github.com/search?q=<need>+mcp` URL + WebFetch only if the
  `github_search_*` tools are unavailable on the host.)
```

- [ ] **Step 2: Edit `SKILL.md` Phase 5 — add a GitHub bullet after the open-web one**

In `skills/discovery-eye/SKILL.md`, the Tier-3 open-web bullet was edited in
Task 9 to mention the social helper. Add a new sibling bullet immediately after
that open-web bullet (before the next numbered item or paragraph). Insert:

```
   For structured GitHub discovery, prefer the dedicated helper:
   `node "$SKILL_DIR/scripts/search-github.mjs plan "<need>"` emits
   `github_search_repositories` / `github_search_code` recipes; run them and
   pipe responses to `normalize repos` / `normalize code`. See
   `references/github-discovery.md`.
```

- [ ] **Step 3: Edit `README.md` repo layout — add GitHub rows**

In `README.md`, the references/scripts blocks were edited in Task 9. Add the
GitHub helper row to the `scripts/` block (after the `search-social.mjs` row
added in Task 9) and the GitHub reference row to the `references/` block (after
the `social-platforms.md` row added in Task 9).

Add to the references block, after the `social-platforms.md` line:

```
│   │   ├── github-discovery.md #  GitHub search strategy + response-shape notes
```

Add to the scripts block, after the `search-social.mjs` line:

```
│       ├── search-github.mjs   # Tier-3 GitHub (repos + code search) + normalize
```

- [ ] **Step 4: Edit `AGENTS.md` — extend the test command to cover both helpers**

In `AGENTS.md` (created in Task 10), replace this exact block:

```
Run the unit tests (no network, no setup):

```bash
node --test skills/discovery-eye/scripts/search-social.test.mjs
```

To run every `.test.mjs` in the repo as the set grows:

```bash
node --test skills/discovery-eye/scripts/*.test.mjs
```
```

with:

```
Run the unit tests (no network, no setup):

```bash
node --test skills/discovery-eye/scripts/search-social.test.mjs skills/discovery-eye/scripts/search-github.test.mjs
```

To run every `.test.mjs` in the repo as the set grows:

```bash
node --test skills/discovery-eye/scripts/*.test.mjs
```
```

- [ ] **Step 5: Verify all edits + run the full suite**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('skills/discovery-eye/SKILL.md','utf8');const r=fs.readFileSync('skills/discovery-eye/references/sources.md','utf8');const rm=fs.readFileSync('README.md','utf8');const a=fs.readFileSync('AGENTS.md','utf8');console.log('sources has github helper:',/search-github\.mjs plan/.test(r));console.log('sources has github-discovery.md ref:',/github-discovery\.md/.test(r));console.log('skill has github helper:',/search-github\.mjs plan/.test(s));console.log('readme has search-github.mjs:',/search-github\.mjs/.test(rm));console.log('readme has github-discovery.md:',/github-discovery\.md/.test(rm));console.log('agents.md mentions search-github test:',/search-github\.test\.mjs/.test(a));"
node --test skills/discovery-eye/scripts/*.test.mjs
```
Expected: all six booleans `true`; all tests pass (social 27 + github 19 = 46 tests), exit 0.

- [ ] **Step 6: Commit**

```bash
git add skills/discovery-eye/references/sources.md skills/discovery-eye/SKILL.md README.md AGENTS.md
git commit -m "docs(discovery-eye): wire github discovery helper into sources/SKILL/README/AGENTS"
```

---

## Self-Review

**1. Spec coverage.** The user's request: "search the social media like instagram, threads, linkedin, youtube to find interesting mcp things that related to the needs" **+ add github discovery.**

Social axis:
- Instagram search → Task 1 (`buildQueries` instagram) + Task 5 (normalize fallback) + Task 7 (ToS/login-wall) + Task 8 (wired into sources.md). ✓
- Threads search → Task 2 (contract) + Task 5 (normalize) + Task 7 + Task 8. ✓
- LinkedIn search → Task 2 + Task 5 + Task 7 (explicit near-zero/ToS) + Task 8. ✓
- YouTube search → Task 1 (incl. webfetch fallback) + Task 4 (API+page shapes) + Task 7 + Task 8. ✓

GitHub axis:
- Repos search → Task 11 (`buildGithubQueries` repos recipe) + Task 12 (`normalizeGithubRepos`) + Task 14 (CLI `normalize repos`) + Task 15 (playbook) + Task 16 (wired into sources/SKILL/README). ✓
- Code search (README mentions + `.mcp.json` manifests) → Task 11 (code recipes) + Task 13 (`normalizeGithubCode`) + Task 14 (CLI `normalize code`) + Task 15 + Task 16. ✓
- Scoring integration → `stars` + `updatedAt` fields on GitHub candidates feed `scoring.md` Popularity + Recency (Task 12, documented in Task 15). ✓

Cross-cutting:
- "find interesting mcp things" → candidates normalized to repo-pointer records (`type:"mcp"`, `source:"github"`) that feed the existing Phase 6 vet/rank/suggest flow (Tasks 8, 9, 16). ✓
- "related to the needs" → `need` param threads through both helpers' `plan` (query strings) and `normalize` (record `need` field). ✓

**2. Placeholder scan.** No "TBD", "add error handling", "similar to Task N", or undescribed steps. Every code step contains complete, runnable code. Every command has expected output. ✓

**3. Type consistency.**
- Social: `buildQueries(platform, need)` signature identical in Task 1 (defined), Task 2 (tested), Task 6 (CLI). `extractRepoUrls(text)` identical in Task 3 (defined), used in Tasks 4 & 5. `normalizeResults(platform, rawJson, need)` identical in Task 4 (defined), Task 5 (extended — same signature, added fallback branch), Task 6 (CLI).
- GitHub: `buildGithubQueries(need)` identical in Task 11 (defined), Task 14 (CLI). `normalizeGithubRepos(rawJson, need)` identical in Task 12 (defined), Task 14 (CLI). `normalizeGithubCode(rawJson, need)` identical in Task 13 (defined), Task 14 (CLI).
- Candidate record shape consistent across both helpers, `social-platforms.md`, `github-discovery.md`, and the existing `sources.md:8-17` shape. GitHub candidates add `stars`/`updatedAt`/`topics`/`discoveredVia` (additive); social candidates add `platform` (additive). No consumer breaks on the extra keys. ✓

**4. Edge cases handled:** empty stdin → `[]` (Tasks 6, 14); invalid JSON → exit 1 (Tasks 6, 14); unsupported platform → throw (Task 1/2); unknown normalize target → exit 2 (Task 14); login-wall payload → `[]` not crash (Task 5); dedup across videos, stringified blob, and GitHub items (Tasks 4, 5, 12, 13). ✓

No issues found. Plan is internally consistent and covers the full spec (social + GitHub).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-social-media-mcp-search.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
