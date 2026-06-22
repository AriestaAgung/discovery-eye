#!/usr/bin/env node
// install.mjs — the mechanical, reversible writes behind Phase 9.
// Path-driven and host-agnostic: the caller resolves the target path from
// references/host-profiles.md and passes it in. This script owns only the
// *how*: merge safely, back up first, never clobber, verify after.
//
// Usage:
//   install.mjs mcp-json <configPath> <name> '<serverJson>'   merge into JSON mcpServers
//   install.mjs mcp-toml <configPath> <name> '<serverJson>'   append [mcp_servers.<name>] (Codex)
//   install.mjs memory   <file> '<text>' [label]              append a tagged memory block
//   install.mjs skill    <srcDir> <destSkillsDir> <name>      copy a skill + tag provenance
//
// Every command prints a JSON result and exits 0 on success, 1 on error,
// 2 on usage error. A config that already exists is backed up to <file>.bak.
// MCP name collisions are resolved by suffixing (-2, -3, …), never overwriting.

import {
  readFileSync, writeFileSync, existsSync, mkdirSync, cpSync,
} from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TAG = "discovery-eye";

function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}
function ensureParent(file) {
  mkdirSync(dirname(file), { recursive: true });
}
function backupIfExists(file) {
  if (!existsSync(file)) return null;
  const bak = file + ".bak";
  cpSync(file, bak);
  return bak;
}
// Pick a non-colliding name given an "already taken" predicate.
function freeName(name, taken) {
  if (!taken(name)) return name;
  for (let i = 2; ; i++) {
    const candidate = `${name}-${i}`;
    if (!taken(candidate)) return candidate;
  }
}

export function installMcpJson(configPath, name, server) {
  const cfg = readJson(configPath) || {};
  if (!cfg.mcpServers || typeof cfg.mcpServers !== "object") cfg.mcpServers = {};
  const finalName = freeName(name, (n) => n in cfg.mcpServers);
  const backup = backupIfExists(configPath);
  cfg.mcpServers[finalName] = server;
  ensureParent(configPath);
  writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n");
  // verify
  const after = readJson(configPath);
  if (!after?.mcpServers?.[finalName]) throw new Error("verify failed: entry not present after write");
  return { type: "mcp", format: "json", name: finalName, requested: name, collision: finalName !== name, file: configPath, backup };
}

// Minimal TOML emitter — enough for an MCP server table. Zero deps.
function tomlValue(v) {
  if (Array.isArray(v)) return "[" + v.map(tomlValue).join(", ") + "]";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(String(v)); // basic string with escapes
}
function emitMcpToml(name, server) {
  const lines = [`[mcp_servers.${name}]`];
  for (const [k, val] of Object.entries(server)) {
    if (k === "env" || (val && typeof val === "object" && !Array.isArray(val))) continue;
    lines.push(`${k} = ${tomlValue(val)}`);
  }
  if (server.env && typeof server.env === "object") {
    lines.push("", `[mcp_servers.${name}.env]`);
    for (const [k, val] of Object.entries(server.env)) lines.push(`${k} = ${tomlValue(val)}`);
  }
  return lines.join("\n") + "\n";
}

export function installMcpToml(configPath, name, server) {
  const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const has = (n) => new RegExp(`^\\[mcp_servers\\.${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "m").test(existing);
  const finalName = freeName(name, has);
  const backup = backupIfExists(configPath);
  const block = (existing && !existing.endsWith("\n") ? "\n" : "") + (existing ? "\n" : "") + emitMcpToml(finalName, server);
  ensureParent(configPath);
  writeFileSync(configPath, existing + block);
  const after = readFileSync(configPath, "utf8");
  if (!new RegExp(`^\\[mcp_servers\\.${finalName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "m").test(after)) {
    throw new Error("verify failed: table not present after write");
  }
  return { type: "mcp", format: "toml", name: finalName, requested: name, collision: finalName !== name, file: configPath, backup };
}

export function installMemory(file, text, label = "") {
  const open = label ? `<!-- installed_by: ${TAG} ${label} -->` : `<!-- installed_by: ${TAG} -->`;
  const close = `<!-- /${TAG} -->`;
  const block = `\n${open}\n${text.trim()}\n${close}\n`;
  const backup = backupIfExists(file);
  const prev = existsSync(file) ? readFileSync(file, "utf8") : "";
  ensureParent(file);
  writeFileSync(file, prev + block);
  return { type: "memory", file, backup, label: label || null };
}

// Add `installed_by: discovery-eye` to a SKILL.md's frontmatter (idempotent).
function tagSkillFrontmatter(skillMd) {
  if (!existsSync(skillMd)) return false;
  const content = readFileSync(skillMd, "utf8");
  if (/^installed_by:/m.test(content)) return false;
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return false;
  const tagged = content.replace(/^(---\n[\s\S]*?)\n---/, `$1\ninstalled_by: ${TAG}\n---`);
  writeFileSync(skillMd, tagged);
  return true;
}

export function installSkill(srcDir, destSkillsDir, name) {
  if (!existsSync(srcDir)) throw new Error(`source not found: ${srcDir}`);
  const dest = `${destSkillsDir}/${name}`;
  if (existsSync(dest)) throw new Error(`skill already installed: ${dest}`);
  mkdirSync(destSkillsDir, { recursive: true });
  cpSync(srcDir, dest, { recursive: true });
  const tagged = tagSkillFrontmatter(`${dest}/SKILL.md`);
  return { type: "skill", name, dest, taggedFrontmatter: tagged };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, ...a] = process.argv.slice(2);
  try {
    let res;
    if (cmd === "mcp-json") {
      const [configPath, name, json] = a;
      if (!configPath || !name || !json) throw new Error("usage: install.mjs mcp-json <configPath> <name> '<serverJson>'");
      res = installMcpJson(configPath, name, JSON.parse(json));
    } else if (cmd === "mcp-toml") {
      const [configPath, name, json] = a;
      if (!configPath || !name || !json) throw new Error("usage: install.mjs mcp-toml <configPath> <name> '<serverJson>'");
      res = installMcpToml(configPath, name, JSON.parse(json));
    } else if (cmd === "memory") {
      const [file, text, label] = a;
      if (!file || !text) throw new Error("usage: install.mjs memory <file> '<text>' [label]");
      res = installMemory(file, text, label);
    } else if (cmd === "skill") {
      const [srcDir, destSkillsDir, name] = a;
      if (!srcDir || !destSkillsDir || !name) throw new Error("usage: install.mjs skill <srcDir> <destSkillsDir> <name>");
      res = installSkill(srcDir, destSkillsDir, name);
    } else {
      process.stderr.write("usage: install.mjs mcp-json|mcp-toml|memory|skill ...\n");
      process.exit(2);
    }
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
}
