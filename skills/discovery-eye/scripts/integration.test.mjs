// End-to-end round trips across the real script CLIs: a candidate gets
// installed, shows up in the inventory flagged by the ledger, then is removed
// and the ledger cleared — proving the Phase 9 / list / remove / undo wiring
// actually composes. HOME is redirected to a tmp dir so nothing touches the
// real machine.
import { test } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const DIR = import.meta.dirname;
const node = (script, args, home) =>
  execFileSync("node", [join(DIR, script), ...args], {
    env: { ...process.env, HOME: home },
    encoding: "utf8",
  });

function env() {
  const home = mkdtempSync(join(tmpdir(), "it-home-"));
  const project = mkdtempSync(join(tmpdir(), "it-proj-"));
  return { home, project, clean: () => { rmSync(home, { recursive: true, force: true }); rmSync(project, { recursive: true, force: true }); } };
}
const invJson = (home, project) => JSON.parse(node("inventory.mjs", [project], home));

test("MCP install → inventory (flagged) → remove → undo", () => {
  const { home, project, clean } = env();
  const cfg = join(project, ".mcp.json");

  // install
  const ins = JSON.parse(node("install.mjs", ["mcp-json", cfg, "demo", '{"command":"npx","args":["demo"]}'], home));
  assert.strictEqual(ins.name, "demo");
  assert.ok(JSON.parse(readFileSync(cfg, "utf8")).mcpServers.demo);

  // record provenance
  node("ledger.mjs", ["add", JSON.stringify({ type: "mcp", name: "demo", scope: "project", target: cfg })], home);

  // inventory shows it, flagged
  let inv = invJson(home, project);
  const item = inv.mcp.find((m) => m.name === "demo");
  assert.ok(item, "demo should appear in inventory");
  assert.match(item.by, /discovery-eye/);
  assert.strictEqual(inv.ledgerCount, 1);

  // remove (config edit, backup made)
  const rm = node("remove.mjs", ["mcp", "demo", "project", project], home);
  assert.match(rm, /removed MCP 'demo'/);
  assert.ok(existsSync(cfg + ".bak"));
  assert.strictEqual(JSON.parse(readFileSync(cfg, "utf8")).mcpServers.demo, undefined);

  // undo: drop ledger record
  node("ledger.mjs", ["remove", "mcp:demo:project"], home);
  inv = invJson(home, project);
  assert.strictEqual(inv.mcp.find((m) => m.name === "demo"), undefined);
  assert.strictEqual(inv.ledgerCount, 0);

  clean();
});

test("skill install → inventory → quarantine → restore", () => {
  const { home, project, clean } = env();
  const src = join(project, "_src");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "SKILL.md"), "---\nname: demo-skill\n---\n# Demo");
  const destSkills = join(project, ".claude", "skills");

  // install
  const ins = JSON.parse(node("install.mjs", ["skill", src, destSkills, "demo-skill"], home));
  assert.ok(existsSync(join(ins.dest, "SKILL.md")));

  // inventory shows it
  let inv = invJson(home, project);
  assert.ok(inv.skills.some((s) => s.name === "demo-skill" && s.scope === "project" && s.host === "claude"));

  // quarantine
  const rm = node("remove.mjs", ["skill", "demo-skill", "project", project], home);
  const qid = rm.match(/-> (\S+)/)[1];
  assert.strictEqual(existsSync(ins.dest), false);
  inv = invJson(home, project);
  assert.strictEqual(inv.skills.some((s) => s.name === "demo-skill"), false);

  // restore
  node("remove.mjs", ["restore", qid], home);
  assert.ok(existsSync(join(ins.dest, "SKILL.md")));

  clean();
});
