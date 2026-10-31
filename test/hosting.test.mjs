import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import https from "node:https";
import http from "node:http";
import net from "node:net";
import { createApp } from "../server.mjs";

test("health identifies the application without returning inventory or private paths; custom DNS is explicit", async (t) => {
  const app = createApp({
    database: ":memory:",
    seed: false,
    host: "127.0.0.1",
    port: 0,
    allowedHosts: ["spool.home.arpa"],
  });
  const address = await app.listen();
  t.after(() => app.close());
  const base = `http://127.0.0.1:${address.port}`;
  const health = await (await fetch(base + "/api/health")).json();
  assert.equal(health.app, "Spoolspace");
  assert.match(health.dataId, /^[a-f0-9]{16}$/);
  assert.equal(health.spools, undefined);
  assert.equal(health.database, undefined);
  const hostStatus = (name) =>
    new Promise((resolve, reject) =>
      http
        .get(
          {
            hostname: "127.0.0.1",
            port: address.port,
            path: "/api/health",
            headers: { host: name },
          },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        )
        .on("error", reject),
    );
  assert.equal(await hostStatus("spool.home.arpa"), 200);
  assert.equal(await hostStatus("untrusted.example"), 403);
  const manifest = await fetch(base + "/manifest.webmanifest");
  assert.match(manifest.headers.get("content-type"), /manifest\+json/);
  const data = await manifest.json();
  assert.equal(data.display, "standalone");
  for (const icon of data.icons)
    assert.equal((await fetch(base + icon.src)).status, 200);
});

test("the supervised CLI uses its chosen data directory and shuts down through its own stdin", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "spoolspace-supervised-"));
  const portProbe = net.createServer();
  await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
  const port = portProbe.address().port;
  await new Promise((resolve) => portProbe.close(resolve));
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      DATA_DIR: directory,
      HOST: "127.0.0.1",
      PORT: String(port),
      TLS_CERT_FILE: "",
      TLS_KEY_FILE: "",
      HTTPS_MODE: "",
      SPOOLSPACE_SUPERVISED: "1",
      CATALOG_AUTO_UPDATE: "false",
      SEED_DEMO: "false",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (value) => (output += value));
  child.stderr.on("data", (value) => (output += value));
  t.after(() => {
    if (child.exitCode === null) child.kill();
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 100,
    });
  });
  const exit = new Promise((resolve) => child.once("exit", resolve));
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/bootstrap`);
      const data = await response.json();
      if (response.ok) {
        assert.equal(data.spools.length, 0);
        ready = true;
        break;
      }
    } catch {}
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  child.stdin.write("shutdown\n");
  child.stdin.end();
  const code = await Promise.race([
    exit,
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Supervised shutdown timed out")),
        15000,
      );
      timer.unref();
    }),
  ]);
  assert.equal(code, 0, output);
  assert.ok(existsSync(join(directory, "spoolspace.sqlite")));
});

test("configured HTTPS serves the same inventory and reports the secure port", async (t) => {
  const openssl =
    process.platform === "win32"
      ? "C:/Program Files/Git/usr/bin/openssl.exe"
      : "openssl";
  try {
    execFileSync(openssl, ["version"], { stdio: "ignore" });
  } catch {
    t.skip(
      "OpenSSL is needed only to generate this temporary test certificate",
    );
    return;
  }
  const directory = mkdtempSync(join(tmpdir(), "spoolspace-tls-"));
  const cert = join(directory, "test.crt"),
    key = join(directory, "test.key");
  execFileSync(
    openssl,
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
    ],
    { stdio: "ignore", env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
  );
  const app = createApp({
    database: ":memory:",
    seed: false,
    host: "127.0.0.1",
    port: 0,
    httpsPort: 0,
    tls: { cert: readFileSync(cert), key: readFileSync(key) },
  });
  await app.listen();
  t.after(async () => {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const securePort = app.secureServer.address().port;
  // This generated self-signed certificate is confined to this test client.
  const data = await new Promise((resolve, reject) =>
    https
      .get(
        {
          hostname: "127.0.0.1",
          port: securePort,
          path: "/api/bootstrap",
          rejectUnauthorized: false,
        },
        (response) => {
          let body = "";
          response.on("data", (value) => (body += value));
          response.on("end", () => resolve(JSON.parse(body)));
        },
      )
      .on("error", reject),
  );
  assert.equal(data.network.httpsPort, securePort);
  assert.equal(data.network.port, securePort);
  assert.ok(data.network.urls.every((url) => url.startsWith("https://")));
  assert.deepEqual(data.spools, []);
});
