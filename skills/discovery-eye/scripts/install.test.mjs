import { test } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installMcpJson, installMcpToml, installMemory, installSkill } from "./install.mjs";

function tmp(prefix) { return mkdtempSync(join(tmpdir(), prefix)); }

test("mcp-json: creates config and merges entry", () => {
  const dir = tmp("ins-json-");
  const cfg = join(dir, ".mcp.json");
  const r = installMcpJson(cfg, "fs", { command: "npx", args: ["pkg"] });
  assert.strictEqual(r.name, "fs");
  assert.strictEqual(r.collision, false);
  assert.strictEqual(r.backup, null); // file didn't exist
  const after = JSON.parse(readFileSync(cfg, "utf8"));
  assert.deepStrictEqual(after.mcpServers.fs, { command: "npx", args: ["pkg"] });
  rmSync(dir, { recursive: true, force: true });
});

test("mcp-json: collision suffixes and backs up", () => {
  const dir = tmp("ins-coll-");
  const cfg = join(dir, ".mcp.json");
  writeFileSync(cfg, JSON.stringify({ mcpServers: { fs: { command: "old" } } }));
  const r = installMcpJson(cfg, "fs", { command: "new" });
  assert.strictEqual(r.name, "fs-2");
  assert.strictEqual(r.collision, true);
  assert.ok(existsSync(r.backup));
  const after = JSON.parse(readFileSync(cfg, "utf8"));
  assert.strictEqual(after.mcpServers.fs.command, "old"); // original untouched
  assert.strictEqual(after.mcpServers["fs-2"].command, "new");
  rmSync(dir, { recursive: true, force: true });
});

test("mcp-toml: appends table with env and is collision-safe", () => {
  const dir = tmp("ins-toml-");
  const cfg = join(dir, "config.toml");
  const r1 = installMcpToml(cfg, "gh", { command: "npx", args: ["a", "b"], env: { TOKEN: "${TOKEN}" } });
  assert.strictEqual(r1.name, "gh");
  const txt = readFileSync(cfg, "utf8");
  assert.match(txt, /\[mcp_servers\.gh\]/);
  assert.match(txt, /command = "npx"/);
  assert.match(txt, /args = \["a", "b"\]/);
  assert.match(txt, /\[mcp_servers\.gh\.env\]/);
  const r2 = installMcpToml(cfg, "gh", { command: "npx" });
  assert.strictEqual(r2.name, "gh-2");
  assert.ok(existsSync(r2.backup));
  rmSync(dir, { recursive: true, force: true });
});

test("memory: appends a tagged block", () => {
  const dir = tmp("ins-mem-");
  const file = join(dir, "CLAUDE.md");
  writeFileSync(file, "# existing\n");
  const r = installMemory(file, "Use ripgrep not grep.", "pref");
  assert.ok(existsSync(r.backup));
  const txt = readFileSync(file, "utf8");
  assert.match(txt, /# existing/);
  assert.match(txt, /<!-- installed_by: discovery-eye pref -->/);
  assert.match(txt, /Use ripgrep not grep\./);
  assert.match(txt, /<!-- \/discovery-eye -->/);
  rmSync(dir, { recursive: true, force: true });
});

test("skill: copies dir and tags frontmatter", () => {
  const dir = tmp("ins-skill-");
  const src = join(dir, "src");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "SKILL.md"), "---\nname: foo\n---\n# Foo");
  const destSkills = join(dir, "skills");
  const r = installSkill(src, destSkills, "foo");
  assert.ok(existsSync(join(destSkills, "foo", "SKILL.md")));
  assert.strictEqual(r.taggedFrontmatter, true);
  const md = readFileSync(join(destSkills, "foo", "SKILL.md"), "utf8");
  assert.match(md, /installed_by: discovery-eye/);
  // refuses to overwrite
  assert.throws(() => installSkill(src, destSkills, "foo"), /already installed/);
  rmSync(dir, { recursive: true, force: true });
});

test("skill: rejects path-traversal names", () => {
  const dir = tmp("ins-trav-");
  const src = join(dir, "src");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "SKILL.md"), "---\nname: x\n---\n");
  const destSkills = join(dir, "skills");
  for (const bad of ["../evil", "../../etc/x", "/abs/evil", "a/b"]) {
    assert.throws(() => installSkill(src, destSkills, bad), /path traversal/, `should reject ${bad}`);
  }
  rmSync(dir, { recursive: true, force: true });
});

test("mcp-json: refuses to overwrite a malformed existing config", () => {
  const dir = tmp("ins-bad-");
  const cfg = join(dir, ".mcp.json");
  writeFileSync(cfg, "{ this is not json");
  assert.throws(() => installMcpJson(cfg, "fs", { command: "npx" }), /not valid JSON/);
  // original left intact, not clobbered
  assert.strictEqual(readFileSync(cfg, "utf8"), "{ this is not json");
  rmSync(dir, { recursive: true, force: true });
});

test("mcp-json: preserves existing servers when adding", () => {
  const dir = tmp("ins-keep-");
  const cfg = join(dir, ".mcp.json");
  writeFileSync(cfg, JSON.stringify({ mcpServers: { a: { command: "x" } } }));
  installMcpJson(cfg, "b", { command: "y" });
  const after = JSON.parse(readFileSync(cfg, "utf8"));
  assert.deepStrictEqual(Object.keys(after.mcpServers).sort(), ["a", "b"]);
  rmSync(dir, { recursive: true, force: true });
});

test("backup: second install does not clobber the pristine .bak", () => {
  const dir = tmp("ins-bak2-");
  const cfg = join(dir, ".mcp.json");
  writeFileSync(cfg, JSON.stringify({ mcpServers: { orig: { command: "o" } } }));
  const r1 = installMcpJson(cfg, "a", { command: "x" });
  const r2 = installMcpJson(cfg, "b", { command: "y" });
  // first .bak is the pristine original; second backup is a distinct file
  assert.notStrictEqual(r1.backup, r2.backup);
  const pristine = JSON.parse(readFileSync(r1.backup, "utf8"));
  assert.deepStrictEqual(Object.keys(pristine.mcpServers), ["orig"]);
  rmSync(dir, { recursive: true, force: true });
});

test("mcp-toml: keeps nested non-env objects as sub-tables", () => {
  const dir = tmp("ins-nest-");
  const cfg = join(dir, "config.toml");
  installMcpToml(cfg, "remote", { command: "npx", headers: { Authorization: "Bearer x" } });
  const txt = readFileSync(cfg, "utf8");
  assert.match(txt, /\[mcp_servers\.remote\.headers\]/);
  assert.match(txt, /Authorization = "Bearer x"/);
  rmSync(dir, { recursive: true, force: true });
});

test("mcp-toml: quotes names with illegal bare-key chars", () => {
  const dir = tmp("ins-qkey-");
  const cfg = join(dir, "config.toml");
  installMcpToml(cfg, "github mcp", { command: "npx" });
  const txt = readFileSync(cfg, "utf8");
  assert.match(txt, /\[mcp_servers\."github mcp"\]/);
  rmSync(dir, { recursive: true, force: true });
});
