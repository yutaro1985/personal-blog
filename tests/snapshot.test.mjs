import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { snapshot, restore } from "../scripts/lib/snapshot.mjs";
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "blog-snapshot-"));
  const source = join(dir, "state");
  await mkdir(join(source, "r2"), { recursive: true });
  await writeFile(join(source, "r2", "image.bin"), "image fixture");
  await writeFile(join(source, "data.sqlite"), "db fixture");
  return { dir, source };
}
test("restores the same DB and media bytes into a new directory", async () => {
  const { dir, source } = await fixture();
  await snapshot(source, join(dir, "backup"));
  await restore(join(dir, "backup"), join(dir, "restored"));
  assert.equal(
    await readFile(join(dir, "restored", "data.sqlite"), "utf8"),
    "db fixture",
  );
  assert.equal(
    await readFile(join(dir, "restored", "r2", "image.bin"), "utf8"),
    "image fixture",
  );
});
test("refuses overwriting a backup or a restore target", async () => {
  const { dir, source } = await fixture();
  const backup = join(dir, "backup");
  await snapshot(source, backup);
  await assert.rejects(snapshot(source, backup));
  await assert.rejects(restore(backup, source));
});
test("rejects tampered content before restoration", async () => {
  const { dir, source } = await fixture();
  const backup = join(dir, "backup");
  await snapshot(source, backup);
  await writeFile(join(backup, "state", "data.sqlite"), "corrupt");
  await assert.rejects(restore(backup, join(dir, "restored")), /integrity/);
});
test("rejects symlinks instead of copying outside the snapshot", async () => {
  const { dir, source } = await fixture();
  await symlink("/etc/hosts", join(source, "outside"));
  await assert.rejects(snapshot(source, join(dir, "backup")), /symlink/);
});
