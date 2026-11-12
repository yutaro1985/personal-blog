import { readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
if (process.argv[2] !== "--server-stopped")
  throw new Error("Stop the Astro server, then pass --server-stopped");
const root = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const files = (await readdir(root)).filter((name) =>
  /^[0-9a-f]+\.sqlite$/.test(name),
);
if (files.length !== 1)
  throw new Error(
    "Expected exactly one initialized local D1 database. Start the site once, then stop it.",
  );
const database = join(root, files[0]);
const db = new DatabaseSync(database, { readOnly: true });
try {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((row) => row.name);
  // Never seed a database that has real user accounts.
  if (!tables.includes("users"))
    throw new Error("Unexpected schema; inspect manually");
  if (db.prepare("SELECT count(*) AS count FROM users").get().count !== 0)
    throw new Error("Account-bearing database refused; use a fresh local PoC");
} finally {
  db.close();
}
const result = spawnSync(
  process.execPath,
  [
    "node_modules/emdash/dist/cli/index.mjs",
    "seed",
    "seed/seed.json",
    "--database",
    database,
    "--uploads-dir",
    ".private/seed-uploads",
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
