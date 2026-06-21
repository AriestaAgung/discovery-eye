# Search sources

Three tiers, searched in parallel. Always prefer a hit from a higher tier
(1 > 2 > 3) when the same capability appears in multiple tiers.

Every hit, from any source, must be normalized to the **candidate record**:

```jsonc
{
  "type": "plugin | skill | mcp | connector | memory",
  "name": "human name",
  "source": "local | registry:<name> | github | web:<host>",
  "sourceUrl": "https://…",
  "description": "one line, what it does",
  "need": "the confirmed need this answers",
  "install": { /* type-specific, see host-profiles.md */ }
}
```

---

## Tier 1 — Local catalog (fast, zero-risk)

`~/.claude/plugins/plugin-catalog-cache.json` — already indexes every plugin
in the known marketplaces with its components and popularity.

Use the helper instead of reading the 300KB+ file:

```
node "$SKILL_DIR/scripts/search-catalog.mjs" "<need keywords>"
```

It returns ranked matches with: plugin id, type breakdown
(skills/agents/mcpServers/hooks), `unique_installs`, and the marketplace
description. Map each component to a candidate:
- a plugin with `mcpServers` → also surface as an `mcp` option
- a plugin with `skills` → the skill names are usable individually if the
  source repo ships them standalone

Marketplace registry of where those plugins come from:
`~/.claude/plugins/known_marketplaces.json`.

## Tier 2 — Registries (curated, low-risk)

- **anthropics official** — `anthropics/claude-plugins-official` (already a
  marketplace; in the local catalog).
- **skills.sh** — cross-agent skill registry with install counts. CLI
  `npx skills find "<query>"` (ranked, non-interactive) is the stable path;
  webfetch `https://skills.sh/` for the leaderboard. Parse `owner/repo@skill`
  + install count (feeds the popularity signal in `scoring.md`).
- **MCP registry** — `https://registry.modelcontextprotocol.io` (official
  server list; query by keyword). Fetch the server's repo + run command.
- **awesome-mcp-servers** — `github.com/modelcontextprotocol/servers` and the
  community `awesome-mcp-servers` list. Good for `mcp` candidates.
- **superpowers** — `obra/superpowers-marketplace` (skills/plugins).
- Any other entry in `known_marketplaces.json`.

For a marketplace not yet in `known_marketplaces.json`, treat it as Tier-2
only after confirming it is a real, maintained marketplace; otherwise it is
Tier-3.

## Tier 3 — Open web (powerful, must be vetted)

- **WebSearch** — `"<need>" claude skill OR mcp server OR plugin` etc.
- **GitHub search** — `https://github.com/search?q=<need>+mcp&type=repositories`,
  sort by stars/recently-updated. Look for `SKILL.md`, `mcp` server repos,
  `.mcp.json`, marketplace manifests.
- **WebFetch** — read candidate README / repo to fill the candidate record
  and the vetting evidence.
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

Tier-3 candidates ALWAYS go through `vetting.md` and ALWAYS require explicit
per-item approval. Never auto-install a Tier-3 find.

---

## Dedupe & rank

Collapse by canonical identity (repo URL, marketplace plugin id, or MCP server
name), keeping the highest-trust source per merged candidate, then score and
rank with the 0–100 rubric in `references/scoring.md`. Cap to the top ~3 per
need unless the user asks for more.
