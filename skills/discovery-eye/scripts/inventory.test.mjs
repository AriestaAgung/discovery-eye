import { test } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildInventory } from "./inventory.mjs";

function setup() {
  const home = mkdtempSync(join(tmpdir(), "inv-home-"));
  const project = mkdtempSync(join(tmpdir(), "inv-proj-"));
  return { home, project, clean: () => { rmSync(home, { recursive: true, force: true }); rmSync(project, { recursive: true, force: true }); } };
}

test("empty machine returns empty inventory", () => {
  const { home, project, clean } = setup();
  const inv = buildInventory({ home, projectDir: project });
  assert.deepStrictEqual([inv.skills.length, inv.mcp.length, inv.plugins.length], [0, 0, 0]);
  clean();
});

test("scans skills + MCP across hosts (Claude json, Codex toml, Gemini json)", () => {
  const { home, project, clean } = setup();
  // Claude global skill + global JSON mcp
  mkdirSync(join(home, ".claude", "skills", "claude-skill"), { recursive: true });
  writeFileSync(join(home, ".claude", "skills", "claude-skill", "SKILL.md"), "---\nname: x\n---\n");
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(join(home, ".claude", "mcp.json"), JSON.stringify({ mcpServers: { "claude-mcp": { command: "npx" } } }));
  // Codex TOML mcp
  mkdirSync(join(home, ".codex"), { recursive: true });
  writeFileSync(join(home, ".codex", "config.toml"), '[mcp_servers.codex-mcp]\ncommand = "npx"\n');
  // Gemini JSON settings
  mkdirSync(join(home, ".gemini"), { recursive: true });
  writeFileSync(join(home, ".gemini", "settings.json"), JSON.stringify({ mcpServers: { "gemini-mcp": { command: "npx" } } }));
  // project-scope Claude .mcp.json
  writeFileSync(join(project, ".mcp.json"), JSON.stringify({ mcpServers: { "proj-mcp": { command: "npx" } } }));

  const inv = buildInventory({ home, projectDir: project });

  assert.ok(inv.skills.some((s) => s.name === "claude-skill" && s.host === "claude" && s.scope === "global"));
  assert.ok(inv.mcp.some((m) => m.name === "claude-mcp" && m.host === "claude" && m.scope === "global"));
  assert.ok(inv.mcp.some((m) => m.name === "codex-mcp" && m.host === "codex"));
  assert.ok(inv.mcp.some((m) => m.name === "gemini-mcp" && m.host === "gemini"));
  assert.ok(inv.mcp.some((m) => m.name === "proj-mcp" && m.host === "claude" && m.scope === "project"));
  clean();
});

test("flags ledger-installed items with the discovery-eye badge", () => {
  const { home, project, clean } = setup();
  mkdirSync(join(home, ".discovery-eye"), { recursive: true });
  writeFileSync(join(home, ".discovery-eye", "ledger.json"), JSON.stringify({
    installs: [{ type: "mcp", name: "mine", scope: "project" }],
  }));
  writeFileSync(join(project, ".mcp.json"), JSON.stringify({ mcpServers: { mine: { command: "npx" } } }));
  const inv = buildInventory({ home, projectDir: project });
  const item = inv.mcp.find((m) => m.name === "mine");
  assert.match(item.by, /discovery-eye/);
  assert.strictEqual(inv.ledgerCount, 1);
  clean();
});
