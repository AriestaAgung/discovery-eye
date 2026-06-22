#!/usr/bin/env node
// vet.mjs — vet a candidate MCP/skill/plugin before install.
// Usage: node vet.mjs <name-or-url-or-json>
// Stdout: JSON vetting report
// Exit: 0 pass, 1 hard block triggered, 2 usage error
//
// `vet(candidate, repoData)` is pure and synchronous. `repoData` is optional
// GitHub repo metadata (the shape returned by api.github.com/repos/<owner>/<repo>).
// The CLI fetches it with the global `fetch` (Node 18+); unit tests call vet()
// directly with no repoData, so they never touch the network.
//
// See references/vetting.md (risk flags + badges) and references/scoring.md
// (0–100 rubric) for the human-facing policy this mirrors.

import { fileURLToPath } from "node:url";

const YEAR_MS = 1000 * 60 * 60 * 24 * 365;
const MONTH_MS = 1000 * 60 * 60 * 24 * 30;

export function vet(candidate, repoData = {}) {
  const c = typeof candidate === "string" ? { name: candidate, sourceUrl: candidate } : candidate;
  const report = {
    name: c.name || c,
    passed: true,
    hardBlocks: [],
    softFlags: [],
    score: 0,
    details: {},
  };

  const isGithub = !!(c.sourceUrl && c.sourceUrl.includes("github.com"));
  const isNpx = typeof c.install === "string" && c.install.startsWith("npx");
  const isTrustedSource = c.source === "catalog" || c.source === "npm";
  const hasRepo = !!repoData.id;

  // Hard block — FAIL CLOSED: unless we can point at inspectable code, reject.
  // Inspectable = a GitHub repo, an npm/npx package, a curated catalog/npm
  // entry, or fetched repo metadata. A candidate with no such anchor (e.g. a
  // bare name or a web hit with no sourceUrl) is exactly what must be blocked.
  const inspectable = isGithub || isNpx || isTrustedSource || hasRepo;
  if (!inspectable) {
    report.hardBlocks.push("No inspectable source (need a GitHub repo, npm/npx package, or curated catalog entry)");
  }

  // Soft flags (warn, don't block) — only when we have repo metadata to judge.
  if (repoData.pushed_at) {
    const lastUpdate = new Date(repoData.pushed_at).getTime();
    if (Date.now() - lastUpdate > YEAR_MS) report.softFlags.push("Last updated > 1 year ago");
  }
  if (Number.isFinite(repoData.stargazers_count) && repoData.stargazers_count < 10) {
    report.softFlags.push(`Stars < 10 (${repoData.stargazers_count})`);
  }
  if (hasRepo && !repoData.description && !c.description) {
    report.softFlags.push("No README or description found");
  }

  // Merit score (0–100) — mirrors references/scoring.md.
  let score = 0;
  if (Number.isFinite(repoData.stargazers_count)) {
    if (repoData.stargazers_count > 1000) score += 30;
    else if (repoData.stargazers_count > 100) score += 20;
    else if (repoData.stargazers_count > 10) score += 10;
  }
  if (repoData.pushed_at) {
    const monthsAgo = (Date.now() - new Date(repoData.pushed_at).getTime()) / MONTH_MS;
    if (monthsAgo < 3) score += 20;
    else if (monthsAgo < 12) score += 10;
  }
  if (isTrustedSource) score += 30;
  else if (isGithub) score += 20;
  if (c.description) score += 20;

  report.score = Math.min(100, score);
  report.details = { isGithub, isNpx, hasRepo, source: c.source || null };
  report.passed = report.hardBlocks.length === 0;
  return report;
}

// Fetch owner/repo metadata from GitHub. Returns {} on any failure so vetting
// degrades to metadata-only rather than throwing (offline / rate-limited).
async function fetchRepoData(sourceUrl) {
  try {
    const parts = new URL(sourceUrl).pathname.replace(/^\/+/, "").split("/");
    if (parts.length < 2) return {};
    const repoPath = `${parts[0]}/${parts[1]}`;
    const res = await fetch(`https://api.github.com/repos/${repoPath}`, {
      headers: { "User-Agent": "discovery-eye", Accept: "application/vnd.github+json" },
    });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const input = process.argv[2];
  if (!input) {
    process.stderr.write("Usage: vet.mjs <name-or-url-or-json>\n");
    process.exit(2);
  }
  let candidate;
  if (input.startsWith("{")) candidate = JSON.parse(input);
  else if (input.startsWith("http")) candidate = { name: input, sourceUrl: input };
  else candidate = { name: input };

  let repoData = {};
  if (candidate.sourceUrl && candidate.sourceUrl.includes("github.com")) {
    repoData = await fetchRepoData(candidate.sourceUrl);
  }

  const report = vet(candidate, repoData);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (report.hardBlocks.length > 0) process.exit(1);
}
