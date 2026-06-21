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
