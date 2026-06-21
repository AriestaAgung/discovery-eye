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
