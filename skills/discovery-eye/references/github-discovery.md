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
