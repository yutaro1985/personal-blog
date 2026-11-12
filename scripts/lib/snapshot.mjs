import {
  readdir,
  lstat,
  readFile,
  writeFile,
  mkdir,
  copyFile,
} from "node:fs/promises";
import { join, relative, resolve, dirname } from "node:path";
import { createHash } from "node:crypto";

async function hashes(root) {
  const result = Object.create(null);
  async function visit(path) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error("Snapshot refuses symlinks");
    if (stat.isDirectory()) {
      for (const name of (await readdir(path)).sort())
        await visit(join(path, name));
    } else if (stat.isFile())
      result[relative(root, path)] = createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
    else throw new Error("Snapshot supports regular files only");
  }
  await visit(root);
  return result;
}
async function copyChecked(source, dest, expected) {
  for (const name of Object.keys(expected)) {
    const target = join(dest, name);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await copyFile(join(source, name), target);
  }
  if (JSON.stringify(await hashes(dest)) !== JSON.stringify(expected))
    throw new Error("Snapshot integrity mismatch");
}
/** Caller must stop all writers; this copies emulator files, not a live database. */
export async function snapshot(source, dest, metadata = {}) {
  const src = resolve(source),
    out = resolve(dest);
  if (out === src || out.startsWith(src + "/"))
    throw new Error("Backup must be outside source");
  const files = await hashes(src);
  if (!Object.keys(files).length)
    throw new Error("Empty state cannot be a backup");
  await mkdir(out, { mode: 0o700 }); // exclusive, never overwrite
  await mkdir(join(out, "state"), { mode: 0o700 });
  await copyChecked(src, join(out, "state"), files);
  await writeFile(
    join(out, "manifest.json"),
    JSON.stringify(
      { version: 1, createdAt: new Date().toISOString(), metadata, files },
      null,
      2,
    ) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  return { files: Object.keys(files).length };
}
export async function restore(backup, dest) {
  const manifest = JSON.parse(
    await readFile(join(backup, "manifest.json"), "utf8"),
  );
  const actual = await hashes(join(backup, "state"));
  if (
    manifest.version !== 1 ||
    JSON.stringify(actual) !== JSON.stringify(manifest.files)
  )
    throw new Error("Backup integrity mismatch");
  await mkdir(dest, { mode: 0o700 }); // new directory only, never replace current state
  await copyChecked(join(backup, "state"), dest, actual);
  return { files: Object.keys(actual).length };
}
