#!/usr/bin/env node
// Tier-1 search over the local plugin catalog cache.
// Usage: node search-catalog.mjs "<keywords>" [maxResults]
// Prints ranked matches as JSON candidate records (see references/sources.md).
//
// Zero network. Reads ~/.claude/plugins/plugin-catalog-cache.json so the
// agent doesn't have to load the 300KB+ file into context.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CATALOG = join(homedir(), ".claude", "plugins", "plugin-catalog-cache.json");
const query = (process.argv[2] || "").toLowerCase().trim();
const maxResults = Number(process.argv[3] || 8);

if (!query) {
  console.error('usage: search-catalog.mjs "<keywords>" [maxResults]');
  process.exit(2);
}

let catalog;
try {
  catalog = JSON.parse(readFileSync(CATALOG, "utf8")).catalog;
} catch (e) {
  console.error(`cannot read catalog at ${CATALOG}: ${e.message}`);
  process.exit(1);
}

const terms = query.split(/\s+/).filter(Boolean);
const plugins = catalog.plugins || {};

// component-type -> candidate type
const TYPE_FOR = { mcpServers: "mcp", skills: "skill" };

function score(text, weight) {
  if (!text) return 0;
  const t = text.toLowerCase();
  let s = 0;
  for (const term of terms) if (t.includes(term)) s += weight;
  return s;
}

const results = [];
for (const [id, p] of Object.entries(plugins)) {
  const mkt = p.marketplace_entry || {};
  const comps = p.components || {};
  const compNames = []
    .concat((comps.skills || []).map((x) => x.name))
    .concat((comps.mcpServers || []).map((x) => x.name || x))
    .concat((comps.commands || []).map((x) => x.name || x))
    .concat((comps.agents || []).map((x) => x.name || x))
    .filter(Boolean);

  let s = 0;
  s += score(mkt.name || p.plugin, 5);
  s += score(mkt.description, 3);
  s += score(mkt.category, 2);
  s += score(compNames.join(" "), 4);
  if (s === 0) continue;

  // popularity nudge (log-ish), keeps relevance dominant
  const installs = p.unique_installs || 0;
  s += Math.min(3, Math.log10(installs + 1));

  const types = new Set(["plugin"]);
  for (const key of Object.keys(TYPE_FOR))
    if ((comps[key] || []).length) types.add(TYPE_FOR[key]);

  results.push({
    id,
    score: Number(s.toFixed(2)),
    type: [...types].join("+"),
    name: mkt.name || p.plugin,
    source: `local:${(p.source && p.source.source) || "marketplace"}`,
    sourceUrl: mkt.homepage || "",
    author: mkt.author || "",
    category: mkt.category || "",
    description: (mkt.description || "").slice(0, 200),
    unique_installs: installs,
    last_updated: p.last_updated || "",
    tokens: (() => {
      const t = p.tokens || {};
      const m = t["claude-opus-4-7"] || t["claude-sonnet-4-6"] || Object.values(t)[0] || {};
      return { always_on: m.always_on || 0, on_invoke: m.on_invoke || 0 };
    })(),
    components: {
      skills: (comps.skills || []).map((x) => x.name),
      mcpServers: (comps.mcpServers || []).map((x) => x.name || x),
      commands: (comps.commands || []).length,
      agents: (comps.agents || []).length,
      hooks: (comps.hooks || []).length,
    },
  });
}

results.sort((a, b) => b.score - a.score || b.unique_installs - a.unique_installs);
console.log(JSON.stringify(results.slice(0, maxResults), null, 2));
