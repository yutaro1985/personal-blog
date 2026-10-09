import { readFile, mkdir, writeFile } from "node:fs/promises";
import { inventory } from "./lib/inventory.mjs";

try {
  const [input] = process.argv.slice(2);
  if (!input || process.argv.length !== 3)
    throw new Error("Usage: npm run inventory -- /path/to/export.xml");
  const report = inventory(await readFile(input, "utf8"));
  await mkdir(".private", { recursive: true, mode: 0o700 });
  await writeFile(
    ".private/inventory.json",
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    `Inventoried ${report.total} records; ${report.issues.length} issues. Private report: .private/inventory.json`,
  );
  if (report.issues.length) process.exitCode = 2;
} catch (error) {
  // Parser errors may contain unpublished XML. Do not send their content to logs.
  console.error(
    error.code === "EEXIST"
      ? "Report already exists; preserve or move .private/inventory.json before retrying."
      : "Inventory failed. Check input is valid WXR 1.2 (without DTD, <=32 MiB) and the output directory is writable.",
  );
  process.exitCode = 1;
}
