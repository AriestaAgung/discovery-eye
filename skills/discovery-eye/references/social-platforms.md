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
