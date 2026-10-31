import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Installer migration: change only transport, preserving storage/startup paths,
// ports and optional TLS settings. Never open the inventory or trust store.
export async function useHttpDefault(file) {
  const original = await readFile(file, "utf8");
  const config = JSON.parse(original.replace(/^\uFEFF/, ""));
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("The installed server configuration is not a JSON object.");
  if (config.httpsMode === "off") return false;
  try {
    await writeFile(file + ".before-http.json", original, {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  config.httpsMode = "off";
  await writeFile(file + ".http.tmp", JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(file + ".http.tmp", file);
  return true;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length !== 3)
    throw new Error("Specify the installed config.json path.");
  await useHttpDefault(resolve(process.argv[2]));
}
