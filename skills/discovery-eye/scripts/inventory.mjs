#!/usr/bin/env node
// `discovery-eye list` — host inventory (skills, MCP, plugins) across every
// supported agent, with items installed by discovery-eye flagged from the ledger.
//
// Usage: inventory.mjs [projectDir]
//   projectDir (optional) = cwd to scan for project-scope skills / MCP config
//
// Paths mirror references/host-profiles.md. Scans Claude Code, Codex, Gemini
// CLI, and Copilot CLI — whichever are present on the machine.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { listMcpTableNames } from "./lib-toml.mjs";

// host -> { skills (home-relative dir), mcp {file, fmt}, plugins, projectSkills }
const HOSTS = {
  claude: {
    skills: [".claude", "skills"],
    mcp: { rel: [".claude", "mcp.json"], fmt: "json" },
    plugins: [".claude", "plugins", "installed_plugins.json"],
    projectSkills: [".claude", "skills"],
    projectMcp: { rel: [".mcp.json"], fmt: "json" },
  },
  codex: {
    skills: [".codex", "skills"],
    mcp: { rel: [".codex", "config.toml"], fmt: "toml" },
    projectSkills: [".codex", "skills"],
  },
  gemini: {
    skills: [".gemini", "skills"],
    mcp: { rel: [".gemini", "settings.json"], fmt: "json" },
    projectSkills: [".gemini", "skills"],
  },
  copilot: {
    skills: [".copilot", "skills"],
  },
};

function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}
function listDir(p) {
  try { return readdirSync(p).filter((n) => !n.startsWith(".")); } catch { return []; }
}
function tomlMcpNames(file) {
  try { return listMcpTableNames(readFileSync(file, "utf8")); } catch { return []; }
}

export function buildInventory({ home = homedir(), projectDir = process.cwd() } = {}) {
  const ledger = readJson(join(home, ".discovery-eye", "ledger.json")) || { installs: [] };
  // Match on type+name+scope (and host when both sides have it). No name-only
  // fallback: that mislabels unrelated same-named items across hosts/types as
  // discovery-eye-managed, which would suppress the "not ours" Remove warning.
  const flag = (type, name, scope, host) =>
    ledger.installs.some((e) =>
      e.type === type && e.name === name && e.scope === scope &&
      (!e.host || !host || e.host === host)
    ) ? "🔖 discovery-eye" : "";

  const out = { skills: [], mcp: [], plugins: [], ledgerCount: ledger.installs.length };

  for (const [host, prof] of Object.entries(HOSTS)) {
    // skills — global + project
    const skillDirs = [["global", join(home, ...prof.skills)]];
    if (prof.projectSkills) skillDirs.push(["project", join(projectDir, ...prof.projectSkills)]);
    for (const [scope, dir] of skillDirs) {
      for (const entry of listDir(dir)) {
        const full = join(dir, entry);
        let isSkill = false;
        try { isSkill = statSync(full).isDirectory() || entry.endsWith(".md"); } catch {}
        if (!isSkill) continue;
        const name = entry.replace(/\.md$/, "");
        out.skills.push({ name, host, scope, by: flag("skill", name, scope, host) });
      }
    }

    // mcp — global + project
    const mcpTargets = [];
    if (prof.mcp) mcpTargets.push(["global", join(home, ...prof.mcp.rel), prof.mcp.fmt]);
    if (prof.projectMcp) mcpTargets.push(["project", join(projectDir, ...prof.projectMcp.rel), prof.projectMcp.fmt]);
    for (const [scope, file, fmt] of mcpTargets) {
      const names = fmt === "toml" ? tomlMcpNames(file) : Object.keys(readJson(file)?.mcpServers || {});
      for (const name of names) out.mcp.push({ name, host, scope, file, by: flag("mcp", name, scope, host) });
    }

    // plugins — host-specific (Claude only today)
    if (prof.plugins) {
      const plug = readJson(join(home, ...prof.plugins));
      for (const id of Object.keys(plug?.plugins || {})) {
        const name = id.split("@")[0];
        out.plugins.push({ name: id, host, scope: "user", by: flag("plugin", name, "global", host) || flag("plugin", id, "global", host) });
      }
    }
  }

  return out;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = buildInventory({ projectDir: process.argv[2] || process.cwd() });
  console.log(JSON.stringify(out, null, 2));
}
