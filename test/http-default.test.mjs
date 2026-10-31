import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useHttpDefault } from "../lib/windows-http-default.mjs";
import { configureHttps } from "../lib/local-https.mjs";

test("default and explicitly disabled HTTPS ignore saved certificate paths and create no certificate files", async (t) => {
  const folder = mkdtempSync(join(tmpdir(), "spoolspace-http-default-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  for (const settings of [
    {},
    { mode: "off", certFile: "missing.crt", keyFile: "missing.key" },
  ]) {
    const value = await configureHttps({ dataDir: folder, ...settings });
    assert.equal(value.tls, null);
    assert.equal(value.info.mode, "off");
  }
  assert.equal(existsSync(join(folder, "https")), false);
});

test("installer migration switches existing HTTPS to HTTP, preserving all other configuration and its original backup", async (t) => {
  const folder = mkdtempSync(join(tmpdir(), "spoolspace-http-upgrade-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const file = join(folder, "config.json");
  const config = {
    port: 5111,
    httpsMode: "auto",
    dataDir: "D:\\My inventory",
    httpsPort: 5112,
    tlsCertFile: "custom.crt",
    tlsKeyFile: "custom.key",
    allowedHosts: ["spool.home.arpa"],
    extra: { preserve: true },
  };
  const original = "\uFEFF" + JSON.stringify(config);
  writeFileSync(file, original);
  assert.equal(await useHttpDefault(file), true);
  assert.deepEqual(JSON.parse(readFileSync(file)), {
    ...config,
    httpsMode: "off",
  });
  assert.equal(readFileSync(file + ".before-http.json", "utf8"), original);
  const first = readFileSync(file, "utf8");
  assert.equal(await useHttpDefault(file), false);
  assert.equal(readFileSync(file, "utf8"), first);
  assert.equal(readFileSync(file + ".before-http.json", "utf8"), original);
  writeFileSync(file, "[]");
  await assert.rejects(() => useHttpDefault(file), /not a JSON object/);
  assert.equal(readFileSync(file, "utf8"), "[]");
});
