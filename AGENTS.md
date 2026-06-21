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
node --test skills/discovery-eye/scripts/search-social.test.mjs skills/discovery-eye/scripts/search-github.test.mjs
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
- Guard the CLI dispatch with `fileURLToPath(import.meta.url) === process.argv[1]`
  so importing the module for tests does not trigger `process.exit`.
- Stdout prints JSON only; human errors go to stderr.
- Exit codes: `0` success, `1` runtime error, `2` usage error.

## What not to do

- Do not introduce a build step, bundler, or transpiler.
- Do not write API keys, tokens, or secret values into any file. Reference env
  var names only (see `references/vetting.md`, `references/host-profiles.md`).
- Do not add authenticated scraping / login automation for social platforms —
  public fetches only (see `references/social-platforms.md` ToS rules).
- Do not commit secrets, `.env`, or `~/.discovery-eye/` state.
