# 👁️ Discovery Eye

**Find and install everything a coding agent needs — in one guided flow.**

Discovery Eye is a portable **skill** that turns "I think there's a tool for
this…" into a vetted, approved, tracked install. It infers what your agent is
missing from the conversation and memory, searches every source (local
catalog, official registries, and the open web/GitHub), vets each candidate
for safety, and installs only what you approve — across MCP servers, skills,
plugins, connectors, and memory.

It works on every major coding agent that loads skills: **Claude Code, Codex,
Gemini CLI, Copilot CLI.**

---

## What it does

```
sense needs → confirm → search (local + registries + web) → vet →
suggest → approve (global/project) → install → verify → summary
```

- **Senses** unmet needs from your conversation + memory (you confirm before anything runs).
- **Searches** three tiers: local plugin catalog, official registries (MCP
  registry, marketplaces), and the open web/GitHub/social.
- **Vets** every candidate: source, popularity, recency, *what code it runs*,
  secret/auth needs, and context-token cost — with a ✅ / 🟡 / 🔴 risk badge.
- **Installs** with per-item approval and global-vs-project scope, host-aware
  (writes the right config in the right format for your agent).
- **Tracks** what it installed in a ledger so you can list and undo.

## Sub-commands

| Command | Does |
|---------|------|
| `discovery-eye` | Run the full discover → install flow |
| `discovery-eye list` | Show everything installed (skills/MCP/plugins), 🔖-flagging items it manages |
| `discovery-eye remove <item>` | Uninstall any item — recoverable (skills quarantined, configs backed up) |
| `discovery-eye undo` | Revert this/previous Discovery Eye installs from the ledger |

## Safety

- **Two human gates:** confirm needs before searching, approve each item before installing.
- **Never auto-installs from the open web** — web/GitHub finds are vetted and require explicit approval.
- **Recoverable removals:** skills move to quarantine, config edits keep a `.bak`.
- **No secret values** are ever written to config — only env-var *names*/placeholders.

---

## Install

Discovery Eye is a skill. Drop it into your agent's skills directory, or (on
Claude Code) install it as a plugin.

### Claude Code — as a plugin (one-click)

```
/plugin marketplace add <your-org>/discovery-eye
/plugin install discovery-eye@discovery-eye
```

### Claude Code — as a skill

```bash
cp -R skills/discovery-eye ~/.claude/skills/discovery-eye
```

### Codex

```bash
cp -R skills/discovery-eye ~/.codex/skills/discovery-eye
```

### Gemini CLI

```bash
cp -R skills/discovery-eye ~/.gemini/skills/discovery-eye
```

### Copilot CLI

```bash
cp -R skills/discovery-eye ~/.copilot/skills/discovery-eye
```

Then invoke it from your agent (e.g. `discovery-eye` / "find me a tool for …").

## Requirements

- Node.js (for the helper scripts; tested on v22).
- Runtime state is stored host-agnostically under `~/.discovery-eye/`.

---

## Repo layout

```
.
├── skills/discovery-eye/
│   ├── SKILL.md              # the skill: 11-phase flow + list/remove/undo modes
│   ├── references/           # loaded on demand
│   │   ├── sources.md        #   the 3 search tiers + candidate normalization
│   │   ├── host-profiles.md  #   per-agent install paths + provenance rules
│   │   └── vetting.md        #   evidence fields + risk flags + badges
│   └── scripts/              # plain Node helpers the skill calls
│       ├── search-catalog.mjs  # Tier-1 local catalog search
│       ├── ledger.mjs          # provenance record (powers list + undo)
│       ├── inventory.mjs       # `discovery-eye list`
│       └── remove.mjs          # uninstall / quarantine / restore
└── .claude-plugin/           # Claude Code plugin + marketplace manifests
```

## How it's built

The skill is the *playbook*; the agent is the *runtime*; the `.mjs` files are
*plain helper programs* (no MCP server, no daemon). State and provenance live
in `~/.discovery-eye/` so the skill is portable across agents and survives
rename / read-only install locations.

## License

Apache-2.0 — see [LICENSE](LICENSE).
