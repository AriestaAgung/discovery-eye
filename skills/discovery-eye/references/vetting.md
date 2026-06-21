# Vetting — evidence + risk before install

Every candidate is vetted. Tier-3 (open web/GitHub) candidates MUST pass and
MUST get explicit per-item approval; they are never auto-installed.

## Evidence to gather

| Field | Where | Why it matters |
|-------|-------|----------------|
| **Source** | repo URL / marketplace id | provenance — is it the canonical project? |
| **Popularity** | GitHub stars, or `unique_installs` from local catalog | adoption signal |
| **Recency** | last commit / last-updated | maintained vs abandoned |
| **What it runs** | hooks, MCP `command`+`args`, `postinstall`/setup scripts | the actual attack surface |
| **Secrets/auth** | env vars, OAuth, tokens it requests | exfiltration / scope risk |
| **Permissions** | filesystem, network, shell access it needs | blast radius |
| **Context cost** | `always_on` / `on_invoke` tokens (local catalog `tokens`) | always-on cost taxes *every* prompt; on-invoke only when used |

For Tier-3, read the README and the entry point (the hook script / MCP server
main / install script) with WebFetch before recommending.

## Risk flags

Raise a flag for any of:
- ⚠️ **Unmaintained** — no update in ~12+ months.
- ⚠️ **Obscure** — near-zero stars/installs and not on a known registry.
- ⚠️ **Runs arbitrary shell** — hooks or MCP that exec shell with untrusted input.
- ⚠️ **Wants secrets** — requests API keys/tokens, especially broad-scope.
- ⚠️ **Network egress** — sends data to a third-party host not core to its purpose.
- ⚠️ **Typosquat** — name mimics a popular project but different repo/author.
- ⚠️ **No source** — only a social post, no inspectable repo.
- ⚠️ **Heavy always-on** — large `always_on` token cost; bloats every prompt.

## Risk badge (shown in suggestions)

- ✅ **trusted** — Tier-1/2, maintained, popular, no flags.
- 🟡 **caution** — usable but ≥1 minor flag (e.g. low stars, needs a key).
- 🔴 **review** — ≥1 serious flag (arbitrary shell + obscure, typosquat, no
  source). Not offered for one-click install; require explicit override and
  re-confirmation.

## Decision rule

- ✅ → offer with recommended pick.
- 🟡 → offer, but state the flag inline so the user chooses informed.
- 🔴 → do **not** pre-select; surface the flag, require the user to type an
  explicit confirmation before it can be installed.
