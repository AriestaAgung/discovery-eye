import { test } from "node:test";
import assert from "node:assert";
import { tomlKey, emitMcpTable, listMcpTableNames, hasMcpTable, removeMcpTable } from "./lib-toml.mjs";

test("tomlKey: bare vs quoted", () => {
  assert.strictEqual(tomlKey("gh-server_1"), "gh-server_1");
  assert.strictEqual(tomlKey("github mcp"), '"github mcp"');
  assert.strictEqual(tomlKey("gh.server"), '"gh.server"');
});

test("emit + list round-trips bare, dotted, and spaced names", () => {
  for (const name of ["gh", "gh.server", "github mcp"]) {
    const toml = emitMcpTable(name, { command: "npx", args: ["a"] });
    const names = listMcpTableNames(toml);
    assert.deepStrictEqual(names, [name], `round trip for ${name}`);
    assert.ok(hasMcpTable(toml, name));
  }
});

test("listMcpTableNames excludes sub-tables", () => {
  const toml = emitMcpTable("gh", { command: "npx", env: { K: "v" } });
  assert.deepStrictEqual(listMcpTableNames(toml), ["gh"]); // not ["gh","gh"] from .env
});

test("removeMcpTable drops the table and its sub-tables only", () => {
  const a = emitMcpTable("a", { command: "x", env: { K: "v" } });
  const b = emitMcpTable("b", { command: "y" });
  const { text, removed } = removeMcpTable("\n" + a + "\n" + b, "a");
  assert.strictEqual(removed, true);
  assert.strictEqual(hasMcpTable(text, "a"), false);
  assert.strictEqual(hasMcpTable(text, "b"), true); // sibling preserved
  assert.ok(!text.includes("[mcp_servers.a.env]"));
});

test("removeMcpTable on absent name is a no-op", () => {
  const b = emitMcpTable("b", { command: "y" });
  const { removed } = removeMcpTable(b, "nope");
  assert.strictEqual(removed, false);
});
