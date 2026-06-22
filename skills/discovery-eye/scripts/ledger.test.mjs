import { test } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

// os.homedir() honors $HOME on POSIX, so HOME=<tmp> isolates ~/.discovery-eye state.
// Assertions match ledger.mjs's actual CLI: `add` -> "recorded <id>",
// `list` -> { label, installs: [...] }, id = type:name:scope.

test("add, list, and remove", () => {
  const fakeHome = mkdtempSync(join(tmpdir(), "ledger-test-"));
  const ledger = join(import.meta.dirname, "ledger.mjs");
  const record = '{"type":"mcp","name":"test-mcp","scope":"project","source":"test"}';

  const addOut = execSync(`HOME=${fakeHome} node ${ledger} add '${record}'`).toString().trim();
  assert.strictEqual(addOut, "recorded mcp:test-mcp:project");

  const db = JSON.parse(execSync(`HOME=${fakeHome} node ${ledger} list`).toString());
  assert.strictEqual(db.installs.length, 1);
  assert.strictEqual(db.installs[0].id, "mcp:test-mcp:project");

  execSync(`HOME=${fakeHome} node ${ledger} remove mcp:test-mcp:project`);
  const db2 = JSON.parse(execSync(`HOME=${fakeHome} node ${ledger} list`).toString());
  assert.strictEqual(db2.installs.length, 0);

  rmSync(fakeHome, { recursive: true, force: true });
});
