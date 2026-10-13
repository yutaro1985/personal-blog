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
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const script = fileURLToPath(
  new URL("../scripts/snapshot.mjs", import.meta.url),
);
function fixture(t, gitState = "committed") {
  const cwd = mkdtempSync(join(tmpdir(), "blog-snapshot-cli-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, ".wrangler/state"), { recursive: true });
  writeFileSync(join(cwd, ".wrangler/state/db.sqlite"), "synthetic database");
  writeFileSync(join(cwd, ".gitignore"), ".wrangler/\n.private/\n");
  writeFileSync(join(cwd, "package-lock.json"), "{}\n");
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  if (gitState !== "absent") git("init", "-q");
  if (gitState === "committed") {
    git("add", ".");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-qm",
      "fixture",
    );
  }
  const run = (command = "backup") =>
    spawnSync(
      process.execPath,
      [script, command, ".private/backup", "--server-stopped"],
      { cwd, encoding: "utf8" },
    );
  mkdirSync(join(cwd, ".private"));
  return { cwd, git, run };
}

test("backup identifies clean source and restore preserves its bytes", (t) => {
  const { cwd, git, run } = fixture(t);
  const backup = run();
  assert.equal(backup.status, 0, backup.stderr);
  const { metadata } = JSON.parse(
    readFileSync(join(cwd, ".private/backup/manifest.json"), "utf8"),
  );
  assert.equal(metadata.gitCommit, git("rev-parse", "HEAD"));
  assert.equal(
    metadata.lockSha256,
    createHash("sha256").update("{}\n").digest("hex"),
  );
  assert.equal(metadata.node, process.version);
  writeFileSync(join(cwd, "package-lock.json"), "changed\n");
  const restored = run("restore");
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(
    readFileSync(join(cwd, ".private/restored-state/db.sqlite"), "utf8"),
    "synthetic database",
  );
});

for (const change of ["unstaged", "staged", "untracked"]) {
  test(`backup rejects ${change} source changes before creating output`, (t) => {
    const { cwd, git, run } = fixture(t);
    writeFileSync(
      join(cwd, change === "untracked" ? "new.mjs" : "package-lock.json"),
      "changed\n",
    );
    if (change === "staged") git("add", "package-lock.json");
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /clean Git checkout/);
    assert.equal(existsSync(join(cwd, ".private/backup")), false);
  });
}

for (const gitState of ["absent", "unborn"]) {
  test(`backup refuses ${gitState} Git HEAD before creating output`, (t) => {
    const { cwd, run } = fixture(t, gitState);
    assert.equal(run().status, 1);
    assert.equal(existsSync(join(cwd, ".private/backup")), false);
  });
}
