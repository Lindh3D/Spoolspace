import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { X509Certificate } from "node:crypto";
import https from "node:https";
import net from "node:net";
import { spawn } from "node:child_process";
import {
  certificateNames,
  configureHttps,
  localHttps,
} from "../lib/local-https.mjs";
import { createApp } from "../server.mjs";

function directory(t) {
  const value = mkdtempSync(join(tmpdir(), "spoolspace-local-https-"));
  t.after(() =>
    rmSync(value, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 100,
    }),
  );
  return value;
}
function get(port, path, ca) {
  return new Promise((resolve, reject) =>
    https
      .get(
        { hostname: "127.0.0.1", port, path, ca, agent: false },
        (response) => {
          const chunks = [];
          response.on("data", (value) => chunks.push(value));
          response.on("end", () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: Buffer.concat(chunks),
            }),
          );
        },
      )
      .on("error", reject),
  );
}
async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

test("local HTTPS covers localhost and LAN IPs, reuses its authority, renews leaves and does not replace a missing authority", async (t) => {
  const dataDir = directory(t),
    names = ["localhost", "127.0.0.1", "::1", "192.168.1.25"];
  const first = await localHttps({ dataDir, names });
  const root = new X509Certificate(first.publicCertificate),
    leaf = new X509Certificate(first.tls.cert);
  assert.equal(root.ca, true);
  assert.equal(leaf.ca, false);
  assert.equal(leaf.verify(root.publicKey), true);
  assert.ok(leaf.checkIP("192.168.1.25"));
  assert.ok(leaf.checkIP("::1"));
  assert.ok(leaf.checkHost("localhost"));
  assert.deepEqual(
    readFileSync(join(dataDir, "https/spoolspace-ca.crt")),
    first.publicCertificate,
  );
  const second = await localHttps({ dataDir, names });
  assert.equal(second.tls.cert, first.tls.cert);
  assert.equal(second.info.fingerprint, first.info.fingerprint);
  const moved = await localHttps({
    dataDir,
    names: [...names, "192.168.1.26"],
  });
  assert.notEqual(moved.tls.cert, first.tls.cert);
  assert.equal(moved.info.fingerprint, first.info.fingerprint);
  assert.ok(new X509Certificate(moved.tls.cert).checkIP("192.168.1.26"));
  const renewed = await localHttps({
    dataDir,
    names,
    now: new Date(Date.now() + 65 * 86400000),
  });
  assert.notEqual(renewed.tls.cert, moved.tls.cert);
  assert.equal(renewed.info.fingerprint, first.info.fingerprint);
  unlinkSync(join(dataDir, "https/authority.json"));
  await assert.rejects(
    () => localHttps({ dataDir, names }),
    /authority key is missing/,
  );
});

test("certificate names filter invalid interfaces and configured certificates remain supported", async (t) => {
  assert.deepEqual(
    certificateNames({
      computer: "Workshop",
      interfaces: {
        one: [{ address: "192.168.1.5" }, { address: "fe80::1%8" }],
      },
      extra: ["spool.home.arpa", "../bad"],
    }),
    [
      "127.0.0.1",
      "192.168.1.5",
      "::1",
      "localhost",
      "spool.home.arpa",
      "workshop",
      "workshop.local",
    ],
  );
  const dataDir = directory(t);
  assert.equal((await configureHttps({ dataDir, mode: "off" })).tls, null);
  const generated = await localHttps({ dataDir, names: ["localhost"] });
  const certFile = join(dataDir, "custom.crt"),
    keyFile = join(dataDir, "custom.key");
  writeFileSync(certFile, generated.tls.cert);
  writeFileSync(keyFile, generated.tls.key);
  const custom = await configureHttps({
    dataDir,
    mode: "auto",
    certFile,
    keyFile,
  });
  assert.equal(custom.info.mode, "custom");
  assert.equal(custom.publicCertificate, null);
  assert.equal(custom.tls.cert.toString(), generated.tls.cert);
  await assert.rejects(
    () => configureHttps({ dataDir, mode: "auto", certFile: "missing" }),
    /both TLS_CERT_FILE/,
  );
  await assert.rejects(
    () => configureHttps({ dataDir, mode: "unknown" }),
    /HTTPS_MODE/,
  );
});

test("a running HTTPS server can renew its certificate while the trusted authority stays the same", async (t) => {
  const dataDir = directory(t);
  const first = await localHttps({ dataDir, names: ["127.0.0.1"] });
  const ca = new X509Certificate(first.publicCertificate).toString();
  let next;
  const app = createApp({
    database: ":memory:",
    seed: false,
    host: "127.0.0.1",
    port: 0,
    httpsPort: 0,
    tls: first.tls,
    httpsInfo: { ...first.info },
    renewHttps: async () => {
      next = await localHttps({ dataDir, names: ["127.0.0.1", "localhost"] });
      return next;
    },
  });
  await app.listen();
  t.after(() => app.close());
  await app.refreshHttps();
  assert.notEqual(next.tls.cert, first.tls.cert);
  assert.equal(next.info.fingerprint, first.info.fingerprint);
  const response = await get(
    app.secureServer.address().port,
    "/api/bootstrap",
    ca,
  );
  assert.equal(response.status, 200);
  assert.ok(
    JSON.parse(response.body).network.https.names.includes("localhost"),
  );
});

test("HTTPS uses a verified local chain; HTTP only exposes pairing and the public CA, never inventory writes", async (t) => {
  const config = await configureHttps({
    dataDir: directory(t),
    mode: "auto",
    names: ["localhost", "127.0.0.1"],
  });
  const ca = new X509Certificate(config.publicCertificate).toString();
  const app = createApp({
    database: ":memory:",
    seed: false,
    host: "127.0.0.1",
    port: 0,
    httpsPort: 0,
    tls: config.tls,
    httpsInfo: config.info,
    publicCertificate: config.publicCertificate,
  });
  const address = await app.listen();
  t.after(() => app.close());
  const port = app.secureServer.address().port;
  const base = `http://127.0.0.1:${address.port}`;
  const redirect = await fetch(base + "/?scan=1", { redirect: "manual" });
  assert.equal(redirect.status, 308);
  assert.equal(
    redirect.headers.get("location"),
    `https://127.0.0.1:${port}/?scan=1`,
  );
  const plainWrite = await fetch(base + "/api/spools", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(plainWrite.status, 426);
  const setup = await fetch(base + "/connect");
  assert.equal(setup.status, 200);
  const html = await setup.text();
  assert.match(html, /CA certificate/);
  assert.match(html, /30 seconds/);
  assert.ok(html.includes(config.info.fingerprint));
  assert.equal(html.includes("PRIVATE KEY"), false);
  const certificate = await fetch(base + "/local-ca.crt");
  assert.equal(
    certificate.headers.get("content-type"),
    "application/x-x509-ca-cert",
  );
  assert.deepEqual(
    Buffer.from(await certificate.arrayBuffer()),
    config.publicCertificate,
  );
  const bootstrap = await get(port, "/api/bootstrap", ca);
  assert.equal(bootstrap.status, 200);
  const data = JSON.parse(bootstrap.body);
  assert.equal(data.network.https.mode, "local");
  assert.ok(data.network.urls.every((value) => value.startsWith("https:")));
  assert.equal(data.network.https.key, undefined);
  assert.deepEqual(data.spools, []);
  const qr = await get(
    port,
    "/api/qr?url=" + encodeURIComponent(base + "/connect"),
    ca,
  );
  assert.equal(qr.status, 200);
  assert.equal(
    (
      await get(
        port,
        "/api/qr?url=" + encodeURIComponent(`https://127.0.0.1:${port}/`),
        ca,
      )
    ).status,
    200,
  );
  assert.equal((await get(port, "/https/authority.json", ca)).status, 404);
  const health = await (await fetch(base + "/api/health")).json();
  assert.equal(health.httpsPort, port);
  await assert.rejects(
    () => get(port, "/", undefined),
    /certificate|issuer|self.signed/i,
  );
});

test("the supervised Windows-style CLI supports explicit HTTPS and stops without touching trust stores", async (t) => {
  const dataDir = directory(t),
    port = await freePort(),
    securePort = await freePort();
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    windowsHide: true,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      HOST: "127.0.0.1",
      PORT: String(port),
      HTTPS_PORT: String(securePort),
      HTTPS_MODE: "auto",
      TLS_CERT_FILE: "",
      TLS_KEY_FILE: "",
      SPOOLSPACE_SUPERVISED: "1",
      CATALOG_AUTO_UPDATE: "false",
      SEED_DEMO: "false",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (value) => (output += value));
  child.stderr.on("data", (value) => (output += value));
  const exit = new Promise((resolve) => child.once("exit", resolve));
  t.after(async () => {
    if (child.exitCode === null) {
      child.stdin.end("shutdown\n");
      await exit;
    }
  });
  let health;
  for (let i = 0; i < 100; i++) {
    try {
      health = await (
        await fetch(`http://127.0.0.1:${port}/api/health`)
      ).json();
      if (health.httpsPort === securePort) break;
    } catch {}
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(health?.httpsPort, securePort, output);
  const ca = new X509Certificate(
    readFileSync(join(dataDir, "https/spoolspace-ca.crt")),
  ).toString();
  assert.equal((await get(securePort, "/", ca)).status, 200);
  assert.match(output, /This computer: https:/);
  child.stdin.end("shutdown\n");
  assert.equal(await exit, 0);
});
