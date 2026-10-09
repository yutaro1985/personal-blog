import { snapshot, restore } from "./lib/snapshot.mjs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
    const result =
      command === "backup"
        ? await snapshot(".wrangler/state", destination, {
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
