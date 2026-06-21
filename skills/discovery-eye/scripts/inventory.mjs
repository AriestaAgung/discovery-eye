#!/usr/bin/env node
// `scout list` — full host inventory (skills, MCP, plugins) with items
// installed by scout/discovery-eye flagged from the ledger.
//
// Usage: inventory.mjs [projectDir]
//   projectDir (optional) = cwd to scan for project-scope .mcp.json / .claude/skills
//
// Claude Code paths. Other hosts: see references/host-profiles.md (extend here).

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();
const projectDir = process.argv[2] || process.cwd();

function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}
function listDir(p) {
  try { return readdirSync(p).filter((n) => !n.startsWith(".")); } catch { return []; }
}

// --- ledger (provenance) ---
const ledger = readJson(join(HOME, ".discovery-eye", "ledger.json")) || { installs: [] };
const byScout = new Set(ledger.installs.map((e) => `${e.type}:${e.name}:${e.scope}`));
const scoutNames = new Set(ledger.installs.map((e) => e.name));
const flag = (type, name, scope) =>
  byScout.has(`${type}:${name}:${scope}`) || scoutNames.has(name) ? "🔖 discovery-eye" : "";

const out = { skills: [], mcp: [], plugins: [], ledgerCount: ledger.installs.length };

// --- skills (global + project) ---
for (const [scope, dir] of [
  ["global", join(HOME, ".claude", "skills")],
  ["project", join(projectDir, ".claude", "skills")],
]) {
  for (const name of listDir(dir)) {
    const full = join(dir, name);
    let isSkill = false;
    try { isSkill = statSync(full).isDirectory() || name.endsWith(".md"); } catch {}
    if (!isSkill) continue;
    out.skills.push({ name: name.replace(/\.md$/, ""), scope, by: flag("skill", name.replace(/\.md$/, ""), scope) });
  }
}

// --- MCP servers (global + project) ---
for (const [scope, p] of [
  ["global", join(HOME, ".claude", "mcp.json")],
  ["project", join(projectDir, ".mcp.json")],
]) {
  const cfg = readJson(p);
  for (const name of Object.keys(cfg?.mcpServers || {}))
    out.mcp.push({ name, scope, file: p, by: flag("mcp", name, scope) });
}

// --- installed plugins ---
const plug = readJson(join(HOME, ".claude", "plugins", "installed_plugins.json"));
for (const id of Object.keys(plug?.plugins || {})) {
  const name = id.split("@")[0];
  out.plugins.push({ name: id, scope: "user", by: flag("plugin", name, "global") || flag("plugin", id, "global") });
}

console.log(JSON.stringify(out, null, 2));
