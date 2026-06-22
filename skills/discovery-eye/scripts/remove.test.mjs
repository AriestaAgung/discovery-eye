import { test } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { emitMcpTable, hasMcpTable } from "./lib-toml.mjs";

const REMOVE = join(import.meta.dirname, "remove.mjs");
const run = (args, home) =>
  execFileSync("node", [REMOVE, ...args], { env: { ...process.env, HOME: home }, encoding: "utf8" });

test("mcp-toml: removes a Codex table and backs up", () => {
  const home = mkdtempSync(join(tmpdir(), "rm-toml-"));
  const cfg = join(home, "config.toml");
  writeFileSync(cfg, emitMcpTable("gh", { command: "npx", env: { T: "${T}" } }) + emitMcpTable("keep", { command: "x" }));
  const out = run(["mcp-toml", cfg, "gh"], home);
  assert.match(out, /removed MCP 'gh'/);
  assert.ok(existsSync(cfg + ".bak"));
  const txt = readFileSync(cfg, "utf8");
  assert.strictEqual(hasMcpTable(txt, "gh"), false);
  assert.strictEqual(hasMcpTable(txt, "keep"), true);
  rmSync(home, { recursive: true, force: true });
});

test("mcp-toml: errors on absent table", () => {
  const home = mkdtempSync(join(tmpdir(), "rm-toml2-"));
  const cfg = join(home, "config.toml");
  writeFileSync(cfg, emitMcpTable("keep", { command: "x" }));
  assert.throws(() => run(["mcp-toml", cfg, "ghost"], home), /not in/);
  rmSync(home, { recursive: true, force: true });
});
