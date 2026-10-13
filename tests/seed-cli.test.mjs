import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

test("seed refuses an account-bearing database before invoking the CLI", (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "blog-seed-cli-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const root = join(cwd, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  mkdirSync(root, { recursive: true });
  const database = join(root, "abc123.sqlite");
  const db = new DatabaseSync(database);
  try {
    db.exec(
      "CREATE TABLE users (id TEXT); INSERT INTO users VALUES ('synthetic-user');",
    );
  } finally {
    db.close();
  }
  const before = readFileSync(database);
  const cli = join(cwd, "node_modules/emdash/dist/cli");
  mkdirSync(cli, { recursive: true });
  writeFileSync(
    join(cli, "index.mjs"),
    'import { writeFileSync } from "node:fs"; writeFileSync("cli-called", "called");',
  );
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("../scripts/seed-local.mjs", import.meta.url)),
      "--server-stopped",
    ],
    { cwd, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Account-bearing database refused/);
  assert.equal(existsSync(join(cwd, "cli-called")), false);
  assert.deepEqual(readFileSync(database), before);
});
