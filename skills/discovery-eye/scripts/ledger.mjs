#!/usr/bin/env node
// Provenance ledger for scout/discovery-eye installs.
// Single source of truth: records every install so `scout list` can flag them
// and `scout undo` knows exact targets + backups.
//
// Usage:
//   ledger.mjs add '<json entry>'     append an install record
//   ledger.mjs list                   print all records (JSON)
//   ledger.mjs remove <id>            drop a record by id
//
// Entry shape:
//   { type, name, scope, target, source, sourceUrl, installedAt, backup, inlineTagged }
//   type ∈ plugin|skill|mcp|connector|memory ; scope ∈ global|project
//   target = file or dir written ; backup = path to .bak if one was made

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

export const LABEL = "discovery-eye";
// Host-agnostic state dir — independent of which agent / where the skill lives.
const LEDGER = join(homedir(), ".discovery-eye", "ledger.json");

function load() {
  if (!existsSync(LEDGER)) return { label: LABEL, installs: [] };
  try {
    return JSON.parse(readFileSync(LEDGER, "utf8"));
  } catch {
    return { label: LABEL, installs: [] };
  }
}
function save(db) {
  mkdirSync(dirname(LEDGER), { recursive: true });
  writeFileSync(LEDGER, JSON.stringify(db, null, 2) + "\n");
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === "add") {
  if (!arg) { console.error("add needs a JSON entry"); process.exit(2); }
  const entry = JSON.parse(arg);
  entry.installedAt = entry.installedAt || new Date().toISOString();
  entry.id = entry.id || `${entry.type}:${entry.name}:${entry.scope}`;
  const db = load();
  // replace any existing record with same id (re-install)
  db.installs = db.installs.filter((e) => e.id !== entry.id);
  db.installs.push(entry);
  save(db);
  console.log("recorded " + entry.id);
} else if (cmd === "list") {
  console.log(JSON.stringify(load(), null, 2));
} else if (cmd === "remove") {
  if (!arg) { console.error("remove needs an id"); process.exit(2); }
  const db = load();
  const before = db.installs.length;
  db.installs = db.installs.filter((e) => e.id !== arg && e.name !== arg);
  save(db);
  console.log(`removed ${before - db.installs.length} record(s)`);
} else {
  console.error("usage: ledger.mjs add '<json>' | list | remove <id>");
  process.exit(2);
}
