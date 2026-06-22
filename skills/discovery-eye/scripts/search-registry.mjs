#!/usr/bin/env node
// Tier-2 helper: search the locally-known marketplace/registry index so the
// agent knows *which* configured registries are worth querying for a need.
// Zero network — reads ~/.claude/plugins/known_marketplaces.json.
//
// Usage: node search-registry.mjs "<keywords>"
// Prints matching registries as JSON; each is a starting point the agent then
// expands (list its plugins) via the host plugin mechanism / WebFetch.
//
// Note: this indexes the *registries you've added*, not every tool inside them.
// Querying a registry's full contents stays agent-driven (Tier-2 in SKILL.md).

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const INDEX = join(homedir(), ".claude", "plugins", "known_marketplaces.json");

export function parseRegistries(json) {
  const obj = typeof json === "string" ? JSON.parse(json) : json;
  return Object.entries(obj || {}).map(([name, v]) => {
    const src = v?.source || {};
    const repo = src.repo || "";
    return {
      name,
      type: "registry",
      source: "registry",
      provider: src.source || "unknown",
      repo,
      sourceUrl: src.source === "github" && repo ? `https://github.com/${repo}` : "",
      lastUpdated: v?.lastUpdated || "",
    };
  });
}

export function search(registries, query) {
  const terms = (query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return registries.filter((r) => {
    const hay = `${r.name} ${r.repo} ${r.provider}`.toLowerCase();
    return terms.some((t) => hay.includes(t));
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const query = (process.argv[2] || "").trim();
  if (!query) { process.stderr.write('usage: search-registry.mjs "<keywords>"\n'); process.exit(2); }
  let registries;
  try {
    registries = parseRegistries(readFileSync(INDEX, "utf8"));
  } catch (e) {
    process.stderr.write(`cannot read registry index at ${INDEX}: ${e.message}\n`);
    process.exit(1);
  }
  console.log(JSON.stringify(search(registries, query), null, 2));
}
