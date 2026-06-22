// Minimal, shared TOML helpers for the `[mcp_servers.<name>]` tables Codex uses.
// One source of truth so the emitter (install), the detector (inventory), and
// the remover (remove) all agree on how a server name maps to a table header.
// Zero deps. Not a general TOML library — scoped to MCP server tables.

const BARE_KEY = /^[A-Za-z0-9_-]+$/;

// A bare key is emitted as-is; anything else is a quoted key (valid TOML),
// which is what keeps names with spaces/dots/symbols from corrupting the file.
export function tomlKey(name) {
  return BARE_KEY.test(name) ? name : JSON.stringify(String(name));
}

export function tomlValue(v) {
  if (Array.isArray(v)) return "[" + v.map(tomlValue).join(", ") + "]";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(String(v));
}

export function mcpHeader(name) {
  return `[mcp_servers.${tomlKey(name)}]`;
}

// Serialize a server object into a TOML table. Nested objects become sub-tables
// (one level) instead of being silently dropped.
export function emitMcpTable(name, server) {
  const key = tomlKey(name);
  const scalars = [];
  const tables = [];
  for (const [k, v] of Object.entries(server)) {
    if (v && typeof v === "object" && !Array.isArray(v)) tables.push([k, v]);
    else scalars.push(`${k} = ${tomlValue(v)}`);
  }
  const out = [`[mcp_servers.${key}]`, ...scalars];
  for (const [k, v] of tables) {
    out.push("", `[mcp_servers.${key}.${tomlKey(k)}]`);
    for (const [ik, iv] of Object.entries(v)) out.push(`${ik} = ${tomlValue(iv)}`);
  }
  return out.join("\n") + "\n";
}

// Names of top-level mcp_servers tables (bare or quoted). Sub-tables like
// [mcp_servers.x.env] are intentionally excluded (the `]` must follow the name).
export function listMcpTableNames(text) {
  const names = [];
  for (const raw of (text || "").split("\n")) {
    const m = raw.trim().match(/^\[mcp_servers\.(?:"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_-]+))\]$/);
    if (m) names.push(m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2]);
  }
  return names;
}

export function hasMcpTable(text, name) {
  return listMcpTableNames(text).includes(name);
}

// Remove a server's table and any of its sub-tables. Returns { text, removed }.
export function removeMcpTable(text, name) {
  const header = mcpHeader(name);
  const subPrefix = `[mcp_servers.${tomlKey(name)}.`;
  const out = [];
  let skipping = false;
  let removed = false;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t === header || t.startsWith(subPrefix)) { skipping = true; removed = true; continue; }
    if (skipping && t.startsWith("[")) skipping = false;
    if (!skipping) out.push(line);
  }
  return { text: out.join("\n"), removed };
}
