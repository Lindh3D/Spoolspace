import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const stage = resolve(process.argv[2]);
const packages = new Map();
function scan(directory) {
  if (!existsSync(directory)) return;
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    if (!item.isDirectory() || item.name.startsWith(".")) continue;
    const path = join(directory, item.name);
    if (item.name.startsWith("@")) {
      scan(path);
      continue;
    }
    const file = join(path, "package.json");
    if (existsSync(file)) {
      const p = JSON.parse(readFileSync(file, "utf8"));
      packages.set(
        `${p.name}@${p.version}`,
        `${p.name}@${p.version} — ${typeof p.license === "string" ? p.license : "See package license files"}`,
      );
    }
    scan(join(path, "node_modules"));
  }
}
scan(join(stage, "node_modules"));
writeFileSync(
  join(stage, "THIRD-PARTY-NOTICES.txt"),
  `Spoolspace is MIT licensed; see LICENSE.\nNode.js and bundled runtime libraries: see runtime/NODE-LICENSE.txt.\nDependency license files are retained in node_modules alongside their packages.\n\n${[...packages.values()].sort().join("\n")}\n`,
);
