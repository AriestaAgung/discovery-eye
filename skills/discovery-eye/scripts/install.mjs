#!/usr/bin/env node
// install.mjs — the mechanical, reversible writes behind Phase 9.
// Path-driven and host-agnostic: the caller resolves the target path from
// references/host-profiles.md and passes it in. This script owns only the
// *how*: merge safely, back up first (never clobbering an earlier backup),
// never overwrite an existing entry, and verify after.
//
// Usage:
//   install.mjs mcp-json <configPath> <name> '<serverJson>'   merge into JSON mcpServers
//   install.mjs mcp-toml <configPath> <name> '<serverJson>'   append [mcp_servers.<name>] (Codex)
//   install.mjs memory   <file> '<text>' [label]              append a tagged memory block
//   install.mjs skill    <srcDir> <destSkillsDir> <name>      copy a skill + tag provenance
//
// Prints a JSON result; exits 0 ok, 1 error, 2 usage error.

import {
  readFileSync, writeFileSync, existsSync, mkdirSync, cpSync,
} from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { emitMcpTable, hasMcpTable } from "./lib-toml.mjs";

const TAG = "discovery-eye";

function readJsonStrict(p) {
  // null = file absent; throws on malformed (so we never silently wipe a
  // config we failed to parse).
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { throw new Error(`existing config is not valid JSON, refusing to overwrite: ${p} (${e.message})`); }
}
function ensureParent(file) {
  mkdirSync(dirname(file), { recursive: true });
}
// Back up the file, never clobbering an earlier pristine backup. Returns the
// path actually written (or null if the file did not exist).
function backupIfExists(file) {
  if (!existsSync(file)) return null;
  let bak = file + ".bak";
  if (existsSync(bak)) {
    let i = 2;
    while (existsSync(`${file}.bak.${i}`)) i++;
    bak = `${file}.bak.${i}`;
  }
  cpSync(file, bak);
  return bak;
}
function freeName(name, taken) {
  if (!taken(name)) return name;
  for (let i = 2; ; i++) {
    const candidate = `${name}-${i}`;
    if (!taken(candidate)) return candidate;
  }
}
// Reject names that aren't a single path segment contained in destDir
// (no separators, no traversal, no absolute paths).
function safeJoin(destDir, name) {
  if (typeof name !== "string" || !name || /[\\/]/.test(name)) {
    throw new Error(`unsafe name (path traversal): ${name}`);
  }
  const base = resolve(destDir);
  const full = resolve(base, name);
  const rel = relative(base, full);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`unsafe name (path traversal): ${name}`);
  }
  return full;
}

export function installMcpJson(configPath, name, server) {
  const cfg = readJsonStrict(configPath) || {};
  if (!cfg.mcpServers || typeof cfg.mcpServers !== "object") cfg.mcpServers = {};
  const finalName = freeName(name, (n) => n in cfg.mcpServers);
  const backup = backupIfExists(configPath);
  cfg.mcpServers[finalName] = server;
  ensureParent(configPath);
  writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n");
  const after = JSON.parse(readFileSync(configPath, "utf8")); // verify (throws if we wrote garbage)
  if (!after?.mcpServers?.[finalName]) throw new Error("verify failed: entry not present after write");
  return { type: "mcp", format: "json", name: finalName, requested: name, collision: finalName !== name, file: configPath, backup };
}

export function installMcpToml(configPath, name, server) {
  const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const finalName = freeName(name, (n) => hasMcpTable(existing, n));
  const backup = backupIfExists(configPath);
  const sep = existing && !existing.endsWith("\n") ? "\n\n" : (existing ? "\n" : "");
  const block = emitMcpTable(finalName, server);
  ensureParent(configPath);
  writeFileSync(configPath, existing + sep + block);
  if (!hasMcpTable(readFileSync(configPath, "utf8"), finalName)) {
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

function tagSkillFrontmatter(skillMd) {
  if (!existsSync(skillMd)) return false;
  const content = readFileSync(skillMd, "utf8");
  if (/^installed_by:/m.test(content)) return false;
  if (!/^---\n[\s\S]*?\n---/.test(content)) return false;
  writeFileSync(skillMd, content.replace(/^(---\n[\s\S]*?)\n---/, `$1\ninstalled_by: ${TAG}\n---`));
  return true;
}

export function installSkill(srcDir, destSkillsDir, name) {
  if (!existsSync(srcDir)) throw new Error(`source not found: ${srcDir}`);
  const dest = safeJoin(destSkillsDir, name); // rejects traversal
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
