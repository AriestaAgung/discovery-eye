#!/usr/bin/env node
// `discovery-eye remove` — uninstall an item from the inventory. Recoverable:
// skills are moved to a quarantine dir, config edits back up to <file>.bak.
// Plugins are NOT handled here (use the host's plugin uninstall) — the agent
// dispatches those per references/host-profiles.md.
//
// Usage:
//   remove.mjs skill <name> <scope> [projectDir]   quarantine a skill dir/file
//   remove.mjs mcp   <name> <scope> [projectDir]   remove an MCP server entry (backs up)
//   remove.mjs restore <quarantineId>              put a quarantined skill back
//   remove.mjs trash-list                          list quarantined items
//
// scope ∈ global | project

import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  renameSync, readdirSync, statSync, cpSync, rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";

const HOME = homedir();
const QUARANTINE = join(HOME, ".discovery-eye", "quarantine");
const [cmd, a, b, c] = process.argv.slice(2);

function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }); }
function readJson(p) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } }
function stamp() { return new Date().toISOString().replace(/[:.]/g, "-"); }
function backup(file) {
  const bak = file + ".bak";
  cpSync(file, bak);
  return bak;
}

function skillDirFor(scope, projectDir) {
  return scope === "project"
    ? join(projectDir || process.cwd(), ".claude", "skills")
    : join(HOME, ".claude", "skills");
}

if (cmd === "skill") {
  const [name, scope, projectDir] = [a, b, c];
  const dir = skillDirFor(scope, projectDir);
  // resolve dir or .md file
  let src = join(dir, name);
  if (!existsSync(src) && existsSync(src + ".md")) src = src + ".md";
  if (!existsSync(src)) { console.error(`not found: ${src}`); process.exit(1); }
  if (statSync(src).isSymbolicLink?.() || false) { /* keep */ }
  ensureDir(QUARANTINE);
  const qid = `${stamp()}__skill__${name}`;
  const dest = join(QUARANTINE, qid);
  // copy then remove (handles symlinks + cross-device)
  cpSync(src, dest, { recursive: true });
  rmSync(src, { recursive: true, force: true });
  writeFileSync(join(QUARANTINE, qid + ".manifest.json"),
    JSON.stringify({ type: "skill", name, scope, origin: src, quarantinedAt: new Date().toISOString() }, null, 2));
  console.log(`quarantined skill '${name}' -> ${qid}`);
} else if (cmd === "mcp") {
  const [name, scope, projectDir] = [a, b, c];
  const file = scope === "project"
    ? join(projectDir || process.cwd(), ".mcp.json")
    : join(HOME, ".claude", "mcp.json");
  const cfg = readJson(file);
  if (!cfg?.mcpServers?.[name]) { console.error(`MCP '${name}' not in ${file}`); process.exit(1); }
  const bak = backup(file);
  delete cfg.mcpServers[name];
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`removed MCP '${name}' from ${file} (backup: ${bak})`);
} else if (cmd === "restore") {
  const qid = a;
  const manifestPath = join(QUARANTINE, qid + ".manifest.json");
  const m = readJson(manifestPath);
  if (!m) { console.error(`no manifest for ${qid}`); process.exit(1); }
  const src = join(QUARANTINE, qid);
  ensureDir(join(m.origin, ".."));
  cpSync(src, m.origin, { recursive: true });
  rmSync(src, { recursive: true, force: true });
  rmSync(manifestPath, { force: true });
  console.log(`restored ${m.type} '${m.name}' -> ${m.origin}`);
} else if (cmd === "trash-list") {
  ensureDir(QUARANTINE);
  const items = readdirSync(QUARANTINE).filter((n) => n.endsWith(".manifest.json"));
  console.log(JSON.stringify(items.map((n) => ({ id: n.replace(".manifest.json", ""), ...readJson(join(QUARANTINE, n)) })), null, 2));
} else {
  console.error("usage: remove.mjs skill|mcp <name> <scope> [projectDir] | restore <qid> | trash-list");
  process.exit(2);
}
