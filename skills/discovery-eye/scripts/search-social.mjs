#!/usr/bin/env node
// Tier-3 social search helper for discovery-eye.
// Gives the agent platform-specific search recipes (plan mode) and normalizes
// raw fetched content into candidate records that point at GitHub repos
// (normalize mode). Stateless: reads stdin / args, writes JSON to stdout.
//
// Usage:
//   node search-social.mjs plan <platform> "<need>"
//     -> prints JSON array of { tool, query|url, purpose } recipes the agent
//        runs via brave-search_brave_web_search / webfetch.
//   node search-social.mjs normalize <platform> ["<need>"]
//     -> reads raw JSON from stdin (what the agent fetched), prints normalized
//        candidate records (see references/sources.md candidate shape).
//
// Platforms: youtube, instagram, threads, linkedin.

import { fileURLToPath } from "node:url";

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

export const SUPPORTED_PLATFORMS = ["youtube", "instagram", "threads", "linkedin"];

export const SITE_FOR = {
  youtube: "youtube.com",
  instagram: "instagram.com",
  threads: "threads.net",
  linkedin: "linkedin.com",
};

export function buildQueries(platform, need) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(
      `unsupported platform: ${platform}. supported: ${SUPPORTED_PLATFORMS.join(", ")}`
    );
  }
  const q = (need || "").trim();
  const site = SITE_FOR[platform];
  const recipes = [
    {
      tool: "brave-search",
      query: `"${q}" mcp site:${site}`,
      purpose: `find ${platform} posts mentioning MCP for: ${q}`,
    },
    {
      tool: "brave-search",
      query: `"${q}" "${platform}" model context protocol server`,
      purpose: `broader social mentions of ${q} MCP on ${platform}`,
    },
  ];
  if (platform === "youtube") {
    recipes.push({
      tool: "webfetch",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " mcp server")}`,
      purpose: "fallback: scrape YouTube results page if brave-search yields nothing",
    });
  }
  return recipes;
}

// Matches github.com/<owner>/<repo>, with or without https://, tolerating a
// trailing period (end of sentence). Owner: 1-39 alnum/dash. Repo: alnum/._-.
const REPO_RE =
  /(?:https?:\/\/)?github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})/g;

export function extractRepoUrls(text) {
  if (!text) return [];
  const out = new Set();
  let m;
  REPO_RE.lastIndex = 0;
  while ((m = REPO_RE.exec(text)) !== null) {
    let repo = m[2];
    if (repo.endsWith(".")) repo = repo.slice(0, -1);
    if (!repo) continue;
    out.add(`https://github.com/${m[1]}/${repo}`);
  }
  return [...out];
}

export function normalizeResults(platform, rawJson, need) {
  const needText = (need || "").trim();
  const out = [];
  const seen = new Set();

  function addCandidate(repoUrl, description) {
    if (seen.has(repoUrl)) return;
    seen.add(repoUrl);
    const parts = repoUrl.replace("https://github.com/", "").split("/");
    out.push({
      type: "mcp",
      name: parts[1] || repoUrl,
      source: "github",
      sourceUrl: repoUrl,
      description: (description || "").slice(0, 200),
      need: needText,
      install: { repo: repoUrl, path: "" },
      platform,
    });
  }

  if (!rawJson) return out;

  if (platform === "youtube" && rawJson.items) {
    for (const v of rawJson.items) {
      const snip = v.snippet || {};
      const title = snip.title || "";
      const desc = snip.description || "";
      const vid = (v.id && (v.id.videoId || v.id)) || "";
      for (const url of extractRepoUrls(`${title}\n${desc}`)) {
        addCandidate(url, title + (vid ? ` (yt:${vid})` : ""));
      }
    }
    return out;
  }

  // Generic fallback: Instagram / Threads / LinkedIn, or any payload without an
  // `items` array. The agent wraps fetched markdown as { text | description |
  // title } when it isn't already JSON; stringify everything so nested fields
  // are scanned too. Login-wall payloads simply yield no repo URLs -> [].
  const blob = JSON.stringify(rawJson);
  const desc =
    rawJson && typeof rawJson === "object" &&
    (rawJson.text || rawJson.description || rawJson.title)
      ? String(rawJson.text || rawJson.description || rawJson.title)
      : "";
  for (const url of extractRepoUrls(blob)) addCandidate(url, desc);
  return out;
}

if (isMainModule) {
  const [mode, platform, need] = process.argv.slice(2);

  if (mode === "plan") {
    if (!platform || !need) {
      console.error('usage: search-social.mjs plan <platform> "<need>"');
      process.exit(2);
    }
    console.log(JSON.stringify(buildQueries(platform, need), null, 2));
  } else if (mode === "normalize") {
    if (!platform) {
      console.error('usage: search-social.mjs normalize <platform> ["<need>"]');
      process.exit(2);
    }
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (input += c));
    process.stdin.on("end", () => {
      let rawJson = null;
      if (input.trim()) {
        try {
          rawJson = JSON.parse(input);
        } catch (e) {
          console.error(`invalid JSON on stdin: ${e.message}`);
          process.exit(1);
        }
      }
      console.log(JSON.stringify(normalizeResults(platform, rawJson, need || ""), null, 2));
    });
  } else {
    console.error(
      'usage: search-social.mjs plan <platform> "<need>" | normalize <platform> ["<need>"]'
    );
    process.exit(2);
  }
}
