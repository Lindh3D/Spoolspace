import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { JSDOM } from "jsdom";
import {
  windowsStartupStatus,
  isLocalStartupClient,
} from "../lib/windows-startup.mjs";
import { createApp } from "../server.mjs";

test("Windows startup bridge only reads installed settings with a bounded hidden process", async () => {
  let calls = 0;
  const run = async (executable, args, options) => {
    calls++;
    assert.equal(executable, "C:\\Spoolspace\\Spoolspace.exe");
    assert.deepEqual(args, ["--startup-status"]);
    assert.equal(options.windowsHide, true);
    assert.equal(options.timeout, 5000);
    return { stdout: '{"installed":true,"mode":"service","conflict":false}' };
  };
  for (const args of [
    { platform: "linux", executable: "x" },
    { platform: "win32", executable: "" },
  ])
    assert.deepEqual(await windowsStartupStatus({ ...args, run }), {
      installed: false,
      mode: null,
    });
  assert.equal(calls, 0);
  assert.deepEqual(
    await windowsStartupStatus({
      platform: "win32",
      executable: "C:\\Spoolspace\\Spoolspace.exe",
      run,
    }),
    { installed: true, mode: "service", conflict: false },
  );
  for (const run of [
    async () => {
      throw new Error("timeout");
    },
    async () => ({ stdout: '{"installed":true,"mode":"evil"}' }),
  ]) {
    const status = await windowsStartupStatus({
      platform: "win32",
      executable: "x",
      run,
    });
    assert.equal(status.mode, null);
    assert.match(status.error, /could not be read/);
  }
});

test("startup controls require a direct loopback connection and localhost hostname", () => {
  for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1"])
    assert.equal(isLocalStartupClient(address, "localhost"), true);
  assert.equal(isLocalStartupClient("192.168.1.20", "localhost"), false);
  assert.equal(isLocalStartupClient("127.0.0.1", "spool.home.arpa"), false);
});

test("the startup API is read-only and reports the actual system setting", async (t) => {
  const app = createApp({
    database: ":memory:",
    seed: false,
    host: "127.0.0.1",
    port: 0,
    startupStatus: async () => ({
      installed: true,
      mode: "login",
      conflict: false,
    }),
  });
  const address = await app.listen();
  t.after(() => app.close());
  const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(base + "/api/windows/startup");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    installed: true,
    mode: "login",
    conflict: false,
    canConfigure: true,
  });
  assert.equal(
    (await fetch(base + "/api/windows/startup", { method: "POST" })).status,
    404,
  );
});

const client = readFileSync(
  new URL("../public/windows-startup.js", import.meta.url),
  "utf8",
);
async function panel(t, status, url = "http://localhost:4173") {
  const dom = new JSDOM('<section id="windows-startup-panel"></section>', {
    url,
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  dom.window.fetch = async () => ({ ok: true, json: async () => status });
  dom.window.eval(client);
  await dom.window.SpoolspaceWindowsStartup.render();
  return dom.window;
}
test("Settings reads the current startup mode and opens Windows review with the chosen mode", async (t) => {
  const window = await panel(t, {
    installed: true,
    mode: "service",
    canConfigure: true,
  });
  const select = window.document.querySelector("select");
  assert.equal(select.value, "service");
  assert.equal(
    window.document.querySelector("#windows-startup-open").href,
    "spoolspace://startup/service",
  );
  select.value = "manual";
  select.dispatchEvent(new window.Event("change"));
  assert.equal(
    window.document.querySelector("#windows-startup-open").href,
    "spoolspace://startup/manual",
  );
  assert.match(window.document.body.textContent, /next Windows startup/);
  assert.match(
    window.document.body.textContent,
    /current server keeps running/,
  );
  window.fetch = async () => ({
    ok: true,
    json: async () => ({ installed: true, mode: "login", canConfigure: true }),
  });
  window.document.querySelector("#windows-startup-refresh").click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(window.document.querySelector("select").value, "login");
});
test("phone and portable clients explain how to change startup without launching a helper", async (t) => {
  const remote = await panel(
    t,
    { installed: true, mode: "manual", canConfigure: false },
    "http://192.168.1.20:4173",
  );
  assert.equal(remote.document.querySelector("select").disabled, true);
  assert.equal(remote.document.querySelector("a"), null);
  assert.match(remote.document.body.textContent, /Windows server/);
  const portable = await panel(t, { installed: false, mode: null });
  assert.equal(portable.document.querySelector("select"), null);
  assert.match(portable.document.body.textContent, /installed Windows version/);
});
test("startup read failures do not pretend the app uses manual mode", async (t) => {
  const window = await panel(t, {
    installed: true,
    mode: null,
    canConfigure: true,
    error: "Settings unavailable <img src=x>",
  });
  assert.equal(window.document.querySelector("select").value, "");
  assert.match(window.document.body.textContent, /Unable to read/);
  assert.equal(window.document.querySelector("img"), null);
  assert.match(
    window.document.querySelector("#windows-startup-status").textContent,
    /Settings unavailable/,
  );
});
test(
  "native Windows startup transitions, rollback and URI validation",
  { skip: process.platform !== "win32" },
  () => {
    const directory = mkdtempSync(join(tmpdir(), "spoolspace-startup-test-"));
    try {
      const exe = join(directory, "StartupTests.exe");
      execFileSync(
        join(
          process.env.WINDIR,
          "Microsoft.NET/Framework64/v4.0.30319/csc.exe",
        ),
        [
          "/nologo",
          "/target:exe",
          "/platform:x64",
          "/main:StartupTests",
          `/out:${exe}`,
          "/reference:System.Windows.Forms.dll",
          "/reference:System.Drawing.dll",
          "/reference:System.ServiceProcess.dll",
          "/reference:System.Web.Extensions.dll",
          ...[
            "../platform/windows/Spoolspace.cs",
            "../platform/windows/WindowsStartup.cs",
            "./windows-startup-native.cs",
          ].map((path) => fileURLToPath(new URL(path, import.meta.url))),
        ],
        { windowsHide: true, timeout: 30000 },
      );
      const output = execFileSync(exe, [], {
        windowsHide: true,
        timeout: 10000,
        encoding: "utf8",
      });
      assert.match(output, /checks passed \(no system writes\)/);
    } finally {
      rmSync(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    }
  },
);
