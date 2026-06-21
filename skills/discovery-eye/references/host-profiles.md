# Host profiles — detect + install per agent

Detect the host first, then use its row for every install. Paths verified on
macOS; `~` = user home. Project scope = current working directory.

## Detection

Resolve host from runtime markers, in order:
1. Environment / runtime identity of the agent you are executing in.
2. Presence of the agent home dir: `~/.claude`, `~/.codex`, `~/.gemini`, `~/.copilot`.
3. If ambiguous, ask the user.

## Profile table

| Host | Skills dir (global) | Skills dir (project) | MCP config + format | Memory file | Plugins |
|------|--------------------|--------------------|--------------------|-------------|---------|
| **Claude Code** | `~/.claude/skills/<name>/` | `.claude/skills/<name>/` | global `~/.claude/mcp.json` · project `.mcp.json` — **JSON** `mcpServers` | `~/.claude/CLAUDE.md` · project `CLAUDE.md` · `memory/` | marketplace + plugin install (native) |
| **Codex** | `~/.codex/skills/<name>/` | `.codex/skills/<name>/` (if supported) | `~/.codex/config.toml` — **TOML** `[mcp_servers.<name>]` | `~/.codex/AGENTS.md` · project `AGENTS.md` · `~/.codex/memories/` | none — install components directly |
| **Gemini CLI** | `~/.gemini/skills/<name>/` | `.gemini/skills/<name>/` | `~/.gemini/settings.json` — **JSON** `mcpServers` | `~/.gemini/GEMINI.md` · project `GEMINI.md` | extensions (`~/.gemini/extensions/`) |
| **Copilot CLI** | `~/.copilot/skills/<name>/` | n/a | host config under `~/.copilot/` | — | none |

If a path is uncertain at install time, confirm by listing the dir before writing.

## Install per type

### plugin
- **Claude Code only** (others have no native plugin system):
  - if marketplace not in `~/.claude/plugins/known_marketplaces.json`, add it
    (`/plugin marketplace add <repo>`), then `/plugin install <plugin>@<marketplace>`.
- **Other hosts:** fall back — install the plugin's *components* individually
  (its skills as skills, its servers as mcp).

### skill
- Fetch `SKILL.md` (+ referenced assets) from the source.
- Write to the host skills dir for the chosen scope: `<skillsDir>/<name>/SKILL.md`.
- Preserve relative `references/` and `scripts/` if the skill ships them.

### mcp
Canonical server: `{ name, command, args[], env{}, url? }`. Serialize to the
host's format, **merging** into existing config (never clobber):

- **JSON hosts** (Claude, Gemini) — add under `mcpServers`:
  ```json
  { "mcpServers": { "<name>": { "command": "npx", "args": ["pkg@latest"] } } }
  ```
- **TOML host** (Codex) — add a table:
  ```toml
  [mcp_servers.<name>]
  command = "npx"
  args = ["pkg@latest"]
  ```
- **Secrets:** collect required env var *names* only. Reference them
  (`"env": { "API_KEY": "${API_KEY}" }`) or leave a clear placeholder + tell
  the user to set the real value. Never write a secret value into config.

### connector (remote / OAuth MCP)
- Write the remote MCP entry (URL-based), then hand interactive auth to the
  user (e.g. an `authenticate` step). Do not attempt to capture tokens.

### memory
- Append a clearly-delimited block to the host memory file at chosen scope,
  or create the file if absent. Keep one fact per block; don't duplicate
  existing content.

## Provenance (every install)

Record each install in the ledger
(`~/.claude/skills/scout/scripts/ledger.mjs add '<entry>'`) — canonical source
of truth for `scout list` and `scout undo`. Add an inline `installed_by:
discovery-eye` tag only where the format tolerates it: **skill** frontmatter
and **memory** blocks (`<!-- installed_by: discovery-eye -->`). MCP/connector
configs (JSON/TOML) and plugins are **ledger-only** — never add unknown keys
to a host config.

## Merge safety (all config writes)

1. Read existing config (it may not exist → start from `{}` / empty).
2. Parse, add/merge the new key, re-serialize preserving the rest.
3. Back up the original (`<file>.bak`) before overwriting.
4. Verify the new entry is present after write.
