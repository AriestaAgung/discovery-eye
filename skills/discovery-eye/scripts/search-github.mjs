#!/usr/bin/env node
// Tier-3 GitHub discovery helper for discovery-eye.
// Emits github_search_repositories / github_search_code recipes (plan mode) and
// normalizes raw GitHub API JSON into candidate records (normalize mode).
// Stateless: reads stdin / args, writes JSON to stdout.
//
// Usage:
//   node search-github.mjs plan "<need>"
//     -> prints JSON array of { tool, query, sort?, purpose } recipes the agent
//        runs via github_search_repositories / github_search_code.
//   node search-github.mjs normalize <repos|code> ["<need>"] < <raw-json>
//     -> reads raw GitHub search API JSON from stdin, prints normalized
//        candidate records (see references/sources.md candidate shape).

export function buildGithubQueries(need) {
  const q = (need || "").trim();
  return [
    {
      tool: "github_search_repositories",
      query: `mcp server ${q} stars:>50`,
      sort: "stars",
      purpose: `popular MCP server repos for: ${q}`,
    },
    {
      tool: "github_search_repositories",
      query: `mcp ${q} in:name,description`,
      sort: "updated",
      purpose: `recently-updated MCP repos mentioning: ${q}`,
    },
    {
      tool: "github_search_code",
      query: `in:readme "mcp" "${q}" extension:md`,
      purpose: `find unlisted servers mentioning ${q} in README`,
    },
    {
      tool: "github_search_code",
      query: `"mcpServers" ${q} filename:.mcp.json`,
      purpose: `find .mcp.json manifests referencing ${q}`,
    },
  ];
}

export function normalizeGithubRepos(rawJson, need) {
  const needText = (need || "").trim();
  const out = [];
  if (!rawJson || !Array.isArray(rawJson.items)) return out;
  const seen = new Set();
  for (const r of rawJson.items) {
    const url = r.html_url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const name = (r.full_name || "").split("/")[1] || r.name || url;
    out.push({
      type: "mcp",
      name,
      source: "github",
      sourceUrl: url,
      description: (r.description || "").slice(0, 200),
      need: needText,
      install: { repo: url, path: "" },
      stars: r.stargazers_count || 0,
      updatedAt: r.pushed_at || r.updated_at || "",
      topics: Array.isArray(r.topics) ? r.topics : [],
      discoveredVia: "github:repos",
    });
  }
  return out;
}

export function normalizeGithubCode(rawJson, need) {
  const needText = (need || "").trim();
  const out = [];
  if (!rawJson || !Array.isArray(rawJson.items)) return out;
  const seen = new Set();
  for (const c of rawJson.items) {
    const repo = c.repository;
    if (!repo) continue;
    const url = repo.html_url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const name = (repo.full_name || "").split("/")[1] || url;
    const path = c.path || "";
    out.push({
      type: "mcp",
      name,
      source: "github",
      sourceUrl: url,
      description: (path ? `code match: ${path}` : "").slice(0, 200),
      need: needText,
      install: { repo: url, path },
      stars: repo.stargazers_count || 0,
      updatedAt: "",
      topics: [],
      discoveredVia: "github:code",
    });
  }
  return out;
}
