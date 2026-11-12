import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const script = fileURLToPath(
  new URL("../scripts/inventory.mjs", import.meta.url),
);
const fixture = fileURLToPath(
  new URL("./fixtures/representative.xml", import.meta.url),
);
test("CLI writes a private report, no content to stdout, and refuses overwrite", () => {
  const cwd = mkdtempSync(join(tmpdir(), "blog-inventory-"));
  const run = () =>
    spawnSync(process.execPath, [script, fixture], { cwd, encoding: "utf8" });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.ok(!first.stdout.includes("日本語"));
  const output = join(cwd, ".private/inventory.json");
  const content = readFileSync(output, "utf8");
  assert.equal(statSync(output).mode & 0o777, 0o600);
  assert.equal(run().status, 1);
  assert.equal(readFileSync(output, "utf8"), content);
});
test("invalid private XML does not appear in diagnostic output", () => {
  const cwd = mkdtempSync(join(tmpdir(), "blog-inventory-"));
  const input = join(cwd, "bad.xml");
  writeFileSync(input, "<rss><secret>DRAFT_SECRET");
  const run = spawnSync(process.execPath, [script, input], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.ok(!(run.stdout + run.stderr).includes("DRAFT_SECRET"));
});
