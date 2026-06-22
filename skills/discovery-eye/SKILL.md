---
name: discovery-eye
description: Use when you need to find and install capabilities for a coding agent — MCP servers, skills, plugins, connectors, or memory — from the local catalog, official registries, or the open web (GitHub, social). Infers unmet needs from the conversation and memory, searches everywhere, vets each candidate for safety, and installs with per-item approval. Cross-agent (Claude Code, Codex, Gemini CLI, Copilot CLI).
---

# Discovery Eye — agent capability discovery & install

Find and install everything a coding agent might need, in one guided flow.
You sense what is missing, search every source, vet each candidate for
safety, and install only what the user approves.

> **`$SKILL_DIR`** below = this skill's own directory (the path given to you
> when the skill was invoked). Scripts live in `$SKILL_DIR/scripts/`. Run them
> with `node "$SKILL_DIR/scripts/<file>.mjs"`. State (ledger, quarantine)
> lives host-agnostically under `~/.discovery-eye/`.

## When to use

- User asks to find a tool / skill / MCP / plugin for some task.
- User invokes this skill directly.
- You notice a recurring unmet need (manual work a tool would solve).

## Operating principles

- **Confirm before searching, approve before installing.** Two human gates,
  never skipped.
- **Never auto-install from the open web.** Web/GitHub finds are vetted and
  require explicit per-item approval. See `references/vetting.md`.
- **Be host-aware.** Detect the host agent first; every install path differs.
  See `references/host-profiles.md`.
- **Prefer trusted tiers.** A local-catalog or registry hit beats a raw web
  hit for the same need.

**Sub-commands** (skip the pipeline, jump to the named section below):
- `discovery-eye list` (or "what's installed") → **List mode**.
- `discovery-eye remove <item>` (or "uninstall X") → **Remove mode**.
- `discovery-eye undo` (or "revert an install") → **Undo mode**.

## Checklist (create one todo per phase)

1. Detect host
2. Sense needs
3. Inventory (what's already installed)
4. Confirm needs
5. Search (parallel, 3 tiers)
6. Vet & rank
7. Suggest
8. Approve + scope
9. Install
10. Activate & verify
11. Summary

---

## Phase 1 — Detect host

Identify which agent you are running in (Claude Code, Codex, Gemini CLI,
Copilot CLI). Load `references/host-profiles.md` and resolve its install
surface (skills dir, MCP config path + format, plugin mechanism, memory
file). Everything downstream uses this profile.

## Phase 2 — Sense needs

Read the context that reveals unmet needs. Read only what exists:

- The current conversation (what has the user been doing manually / fighting).
- Memory: host memory file (`CLAUDE.md` / `AGENTS.md` / `GEMINI.md`),
  project `memory/`, and `.remember/` (`now.md`, `recent.md`) if present.
- The project itself (languages, frameworks) for capability gaps.

Infer 3–6 candidate needs. A need is a capability gap, not a product name —
e.g. "parse PDFs", "query Postgres", "browser automation for tests".

## Phase 3 — Inventory (what's already installed)

Read what the host already has so you never suggest a duplicate (use List
mode / `inventory.mjs`): skills dir (global + project), MCP config
(`mcpServers` / `[mcp_servers.*]`), installed plugins.

Build an installed-set. In Phase 6 any candidate already in it is marked
**already installed** and dropped from suggestions (or shown as "have it").
If every inferred need is already covered, say so and stop — don't invent work.

## Phase 4 — Confirm needs

Present the inferred needs to the user as a single multi-select question and
let them edit, remove, or add. **Do not search until the user confirms.**
If the user already stated a concrete need, still confirm scope but keep it short.

## Phase 5 — Search (parallel, 3 tiers)

For the confirmed needs, fan out parallel subagents (one per source-tier, or
per need for large sets). Three tiers, detailed in `references/sources.md`:

1. **Local** (Claude Code) — `~/.claude/plugins/plugin-catalog-cache.json` via
   `node "$SKILL_DIR/scripts/search-catalog.mjs" "<keywords>"`. Fast, zero-risk.
   On hosts without this catalog, skip Tier 1.
2. **Registries** — anthropics marketplace, MCP registry, awesome-mcp lists,
   superpowers, and entries in `~/.claude/plugins/known_marketplaces.json`.
3. **Open web** — WebSearch + GitHub search + WebFetch + social mentions,
   including the four social platforms (YouTube, Instagram, Threads, LinkedIn)
   via `node "$SKILL_DIR/scripts/search-social.mjs plan <platform> "<need>"`
   to get recipes, then `normalize <platform>` on the fetched JSON. See
   `references/social-platforms.md` for per-platform strategy & ToS limits.

   For structured GitHub discovery, prefer the dedicated helper:
   `node "$SKILL_DIR/scripts/search-github.mjs plan "<need>"` emits
   `github_search_repositories` / `github_search_code` recipes; run them and
   pipe responses to `normalize repos` / `normalize code`. See
   `references/github-discovery.md`.

Every result is normalized to the **candidate record**:

```
{ type, name, source, sourceUrl, description, need, install }
```
`type` ∈ `plugin | skill | mcp | connector | memory`. `install` carries the
type-specific payload (marketplace+plugin id, repo+path, MCP command+args+env, …).
**Memory backends** (mem0, openmemory, the MCP memory server) are not their own
type — they are MCP servers; tag them `mcp` and route through the mcp path. The
`memory` type is reserved for **durable notes** written to the host memory file.

## Phase 6 — Vet & rank

For each candidate gather evidence and flag risk per `references/vetting.md`:
source repo, popularity (stars / `unique_installs`), last-updated, **what code
it runs** (hooks, MCP `command`, post-install scripts), secret/auth needs, and
**context cost** (`always_on` / `on_invoke` tokens from the local catalog — an
always-on skill taxes every prompt). Drop candidates already in the inventory
set (Phase 3), then **dedupe and rank with the 0–100 rubric in
`references/scoring.md`** (merit ranking — distinct from the safety badge).

For a fast, consistent first pass you MAY run the vetting helper per candidate:

```
node "$SKILL_DIR/scripts/vet.mjs" '<candidate-json>'
```

It fetches GitHub repo metadata (stars, last-push), applies the hard-block
rules, and returns `{ passed, hardBlocks, softFlags, score }`. Treat its `score`
as the merit baseline and its `hardBlocks` as authoritative (a hard block → 🔴,
never pre-selected). You still add the judgment the script can't: reading the
entry-point code, secret/auth scope, and context-token cost. The helper needs
no network to score a candidate you already have metadata for, and degrades to
a metadata-only score if the GitHub call fails (offline / rate-limited).

When one plugin covers several confirmed needs, list it once and note all the
needs it answers — don't repeat it per need.

## Phase 7 — Suggest

Present candidates grouped by need as a clean, numbered list. Do not output raw
JSON or internal phase logs. Per item, display: name, type badge, score,
**risk badge**, and a brief one-line value.

**If a need has more than one candidate, you MUST present the list and ask the
user to pick which one they prefer before proceeding.** Do not auto-select a
recommended pick.

**Empty branches** — handle gracefully, don't fabricate:
- A need with no candidate → say so, suggest a broader re-search or manual route.
- All needs already covered by inventory → report it and stop.

## Phase 8 — Approve + scope

Once the user has selected their preferred candidate for a need, ask for the
install scope: **global** (user-level dir) or **project** (cwd `.claude/` /
`.mcp.json`). Items that failed vetting (🔴) are not offered for one-click
install — flag them and require an explicit override.

## Phase 9 — Install

Dispatch by `type` using the host profile. Exact commands/paths per host per
type live in `references/host-profiles.md`. Summary:

- **plugin** → add marketplace if new, then plugin install (Claude Code only;
  other hosts install the plugin's components individually).
- **skill** → fetch SKILL.md (+ assets), write into host skills dir at chosen scope.
- **mcp** → serialize the server entry into the host MCP config (JSON or
  TOML). Prompt for required env var *names*; never store secret *values* —
  reference env or leave a placeholder.
- **connector** → remote-MCP/OAuth entry; hand off interactive auth to the user.
- **memory** → *backend* (mem0/openmemory/MCP memory server) installs via the
  **mcp** path above (tag `mcp:memory` in the ledger); a *durable note* is
  appended to the host memory file (`CLAUDE.md`/`AGENTS.md`/`GEMINI.md`) at scope.

**Always back up** the target config to `<file>.bak` before writing (enables
Undo). **Name collision:** if an MCP server name already exists, do not
clobber — append a suffix (`<name>-2`) or ask the user to pick; flag it.
Report failures, don't hide them.

**Record provenance.** After each successful install, write a ledger record
(canonical source of truth for List + Undo):

```
node "$SKILL_DIR/scripts/ledger.mjs" add \
  '{"type":"mcp","name":"<name>","scope":"project","target":"<file/dir>","source":"<src>","sourceUrl":"<url>","backup":"<file>.bak"}'
```

Then add an **inline `discovery-eye` tag where the format allows it** (set
`inlineTagged:true` in the ledger entry when you do):
- **skill** → add `installed_by: discovery-eye` to the SKILL.md frontmatter.
- **memory** → wrap the block: `<!-- installed_by: discovery-eye -->` … `<!-- /discovery-eye -->`.
- **mcp / connector / plugin** → ledger-only (JSON/TOML/host configs reject
  unknown keys; never pollute them). Provenance lives in the ledger.

## Phase 10 — Activate & verify

After writing, confirm the install actually took:
- **skill** → the file exists at the expected path and parses (valid frontmatter).
- **mcp** → the entry is present and the `command` resolves (e.g. binary/npx
  package exists). A full server boot may need a restart — say so.
- **plugin** → it appears in the installed list.

**Restart hint:** MCP servers, plugins, and (on some hosts) new skills only
take effect after the agent restarts/reloads. Tell the user explicitly when a
restart is required for what they just installed.

## Phase 11 — Summary

Output a table: item · type · need it solves · scope · status · how to
use/invoke. List anything skipped and why (failed vetting, needs manual auth,
declined, already installed). Remind the user they can run `discovery-eye undo`
to revert this session's installs.

---

## List mode

Triggered by `discovery-eye list` / "what's installed". Show the full host
inventory with discovery-eye installs flagged:

```
node "$SKILL_DIR/scripts/inventory.mjs" <projectDir>
```

It scans skills (global + project), MCP servers (global + project), and
installed plugins, cross-references the ledger, and flags installed items
with 🔖 discovery-eye. Render it as a grouped table; call out which items
Discovery Eye manages (those are the ones Undo can revert).

## Remove mode

Triggered by `discovery-eye remove <item>` / "uninstall X". Removes **any**
inventory item (not only discovery-eye installs). Recoverable by design —
nothing is hard-deleted.

1. **Locate** — run List mode (`inventory.mjs`) to resolve the item's exact
   type + scope. If ambiguous (same name in two scopes), ask which.
2. **Warn before destructive action** — show what will be removed and its
   target path. If the item is **not** flagged 🔖 discovery-eye (we didn't
   install it), say so explicitly: it's pre-existing and you'll have to
   reinstall it yourself later. Require confirmation.
3. **Remove by type:**
   - **skill** → `node "$SKILL_DIR/scripts/remove.mjs" skill <name> <scope> [projectDir]`
     (moves the dir/file to `~/.discovery-eye/quarantine/`, writes a restore manifest).
   - **mcp / connector** → `node "$SKILL_DIR/scripts/remove.mjs" mcp <name> <scope> [projectDir]`
     (backs up the config to `.bak`, deletes just that entry).
   - **memory** → remove the tagged block; back up the file first.
   - **plugin** → uninstall via the **host plugin mechanism** (e.g. Claude Code
     `/plugin` uninstall); we do not delete plugin caches directly.
4. **Ledger** — if the removed item was a discovery-eye install, drop its
   record: `node "$SKILL_DIR/scripts/ledger.mjs" remove <id>`.
5. **Report** + how to recover: skills via
   `remove.mjs restore <qid>` (see `remove.mjs trash-list`), configs from `.bak`.

## Undo mode

Triggered by `discovery-eye undo` or a revert request. The **ledger is the
source of truth** — read it, don't guess:

```
node "$SKILL_DIR/scripts/ledger.mjs" list
```

For each record the user chooses to revert (confirm before deleting, show
exactly what will change):
- **config writes** (mcp/connector/memory) → restore the recorded `backup`
  `<file>.bak`; if no backup (file was created fresh), remove just the entry
  that was added, or delete the file if it was created empty-of-others.
- **skill** → quarantine the installed `<skillsDir>/<name>/` via `remove.mjs skill`.
- **plugin** → uninstall via the host plugin mechanism.

After reverting, drop the record:
`node "$SKILL_DIR/scripts/ledger.mjs" remove <id>`. Report what was reverted.
