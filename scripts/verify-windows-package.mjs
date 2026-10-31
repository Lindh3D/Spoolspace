import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import net from "node:net";
const stage = resolve(process.argv[2]);
const require = (await import("node:module")).createRequire(
  join(stage, "package.json"),
);
for (const name of ["data", ".env", "backups", "test", "attachments"])
  assert.equal(
    existsSync(join(stage, name)),
    false,
    `Private/development data must not enter bundle: ${name}`,
  );
assert.equal(existsSync(join(stage, "node_modules/jsdom")), false);
const scratch = mkdtempSync(join(tmpdir(), "spoolspace-package-"));
const { createCanvas } = require("@napi-rs/canvas");
const { createApp } = await import(pathToFileURL(join(stage, "server.mjs")));
const { recognizeImage } = await import(
  pathToFileURL(join(stage, "lib/recognition.mjs"))
);
const app = createApp({
  database: join(scratch, "inventory.sqlite"),
  catalogDirectory: null,
  seed: false,
  port: 0,
  host: "127.0.0.1",
});
let verified = false;
try {
  const address = await app.listen();
  const health = await (
    await fetch(`http://127.0.0.1:${address.port}/api/health`)
  ).json();
  assert.equal(health.app, "Spoolspace");
  assert.equal(
    health.version,
    JSON.parse(readFileSync(join(stage, "package.json"))).version,
  );
  const canvas = createCanvas(1100, 410),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1100, 410);
  ctx.fillStyle = "black";
  ctx.font = "42px Arial";
  [
    "Brand: Spoolspace",
    "Material: PLA",
    "Color: Black",
    "Net weight: 1 kg",
  ].forEach((line, i) => ctx.fillText(line, 40, 70 + i * 90));
  const read = await recognizeImage(canvas.toDataURL("image/png"));
  assert.equal(read.fields.material, "PLA");
  assert.equal(read.fields.initialWeight, 1000);
  await app.close();
  const config = join(scratch, "launcher.json");
  const secureProbe = net.createServer();
  await new Promise((resolve) => secureProbe.listen(0, "127.0.0.1", resolve));
  const securePort = secureProbe.address().port;
  await new Promise((resolve) => secureProbe.close(resolve));
  writeFileSync(
    config,
    JSON.stringify({
      port: address.port,
      host: "127.0.0.1",
      dataDir: join(scratch, "launcher-data"),
      httpsPort: securePort,
      tlsCertFile: "",
      tlsKeyFile: "",
      allowedHosts: [],
    }),
  );
  const result = await new Promise((resolveExit, reject) => {
    const child = spawn(join(stage, "Spoolspace.exe"), ["--verify"], {
      windowsHide: true,
      env: { ...process.env, SPOOLSPACE_CONFIG_PATH: config },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (value) => (output += value));
    child.stderr.on("data", (value) => (output += value));
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Native launcher verification timed out"));
    }, 45000);
    child.on("error", reject);
    child.on("exit", (code) => {
      clearTimeout(timeout);
      resolveExit({ code, output });
    });
  });
  assert.equal(result.code, 0, result.output);
  assert.ok(existsSync(join(scratch, "launcher-data/spoolspace.sqlite")));
  assert.equal(
    existsSync(join(scratch, "launcher-data/https")),
    false,
    "Default HTTP startup must not generate certificates",
  );
  const startup = JSON.parse(
    execFileSync(join(stage, "Spoolspace.exe"), ["--startup-status"], {
      windowsHide: true,
      timeout: 5000,
      encoding: "utf8",
    }),
  );
  assert.equal(
    startup.installed,
    false,
    "The staged portable package must not claim to be the installed application",
  );
  assert.equal(startup.mode, null);
  verified = true;
  console.log(
    "Packaged Node, SQLite, native canvas, offline OCR, HTTP health and Windows launcher start/stop verified.",
  );
} finally {
  if (app.server.listening) await app.close();
  if (verified) {
    try {
      rmSync(scratch, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 200,
      });
    } catch {
      console.warn(`Temporary verification files retained: ${scratch}`);
    }
  } else console.error(`Verification diagnostics retained: ${scratch}`);
}
