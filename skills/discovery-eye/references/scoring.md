# Scoring & ranking

How to rank candidates within a need (Phase 6). This is **merit ranking**, not
safety — safety/risk lives in `vetting.md` (the ✅🟡🔴 badge). A high score does
not override a 🔴 risk flag.

Score each candidate 0–100, then sort. Show the top ~3 per need.

## Signals (weighted)

| Signal | Max | How to get |
|--------|-----|------------|
| **Fit** to the need | 30 | keyword overlap with domain/task/framework (see below) |
| **Popularity** | 25 | install count (local catalog `unique_installs`, skills.sh installs) log-scaled; GitHub stars if no install count |
| **Recency** | 15 | last commit / `last_updated`: <90d full, decays to 0 by ~18mo |
| **Source reputation** | 15 | trusted org boost (see list) |
| **Trust tier** | 10 | Tier-1 local = 10, Tier-2 registry = 7, Tier-3 web = 3 |
| **Social validation** | 5 | corroborating reddit/HN/blog mentions (validation, not discovery) |

**Context-cost modifier (ours, unique): −0 to −15.** Subtract for heavy
`always_on` token cost (an always-on skill taxes every prompt). MCP servers are
`always_on: 0` → no penalty. Rule of thumb: `−min(15, round(always_on/400))`.

### Fit detail (max 30)
- domain exact match in name/description: +12
- task keyword match in description/README: +10
- language/framework match: +8

## Source reputation boost (+15 max, cap)

Trusted orgs, +15: `anthropics/*`, `modelcontextprotocol/*`, `microsoft/*`,
`vercel-labs/*`, `google-labs-code/*`, `getsentry/*`, `supabase/*`, and other
first-party vendor repos (the tool's own publisher). Known community author: +7.
Unknown author: 0. Solo author, no history, requests secrets: −5.

## Thresholds

- **≥ 70** → recommend (pre-select as the pick for its need).
- **40–69** → show with note "moderate reputation".
- **< 40** *and* (installs < 100 *and* stars < 50) → show only if nothing better
  exists, with an explicit low-reputation warning (and the vetting badge).
- **0 candidates** → see SKILL.md Phase 7 empty-branch handling.

## Dedupe & tiebreakers

Canonical id = `owner/repo` lowercase (or marketplace plugin id, or MCP server
name). Same item across tiers → one candidate, keep the highest-trust source.
Tiebreakers in order: popularity → recency → reputation → lower context-cost →
alphabetical.
