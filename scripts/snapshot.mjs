import { snapshot, restore } from "./lib/snapshot.mjs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const [command, destination, confirmation] = process.argv.slice(2);
if (
  !["backup", "restore"].includes(command) ||
  !destination ||
  confirmation !== "--server-stopped"
) {
  console.error(
    "Stop all local servers first. Usage: node scripts/snapshot.mjs backup NEW_DIRECTORY --server-stopped | restore BACKUP_DIRECTORY --server-stopped",
  );
  process.exitCode = 1;
} else {
  try {
    let gitCommit;
    if (command === "backup") {
      gitCommit = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
        encoding: "utf8",
      }).trim();
      if (
        execFileSync(
          "git",
          ["status", "--porcelain", "--untracked-files=all"],
          {
            encoding: "utf8",
          },
        ).trim()
      )
        throw new Error(
          "Backup requires a clean Git checkout; commit source changes first.",
        );
    }
    const result =
      command === "backup"
        ? await snapshot(".wrangler/state", destination, {
            gitCommit,
            lockSha256: createHash("sha256")
              .update(await readFile("package-lock.json"))
              .digest("hex"),
            node: process.version,
          })
        : await restore(destination, ".private/restored-state");
    console.log(
      `${command}: ${result.files} files verified.${command === "restore" ? " Restored to .private/restored-state; active state untouched." : ""}`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
