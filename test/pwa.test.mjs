import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";
const client = readFileSync(
  new URL("../public/pwa.js", import.meta.url),
  "utf8",
);
const worker = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);

test("HTTP does not advertise a working install button or register app support", async (t) => {
  const dom = new JSDOM('<section id="phone-install-panel"></section>', {
    url: "http://192.168.1.20:4173",
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.defineProperty(window, "isSecureContext", { value: false });
  let registrations = 0;
  Object.defineProperty(window.navigator, "serviceWorker", {
    value: {
      register: () => {
        registrations++;
        return Promise.resolve();
      },
    },
  });
  window.eval(client);
  window.SpoolspacePWA.render();
  assert.match(
    window.document.querySelector("#pwa-connection-note").textContent,
    /HTTP/,
  );
  assert.equal(window.document.querySelector("#install-pwa"), null);
  assert.match(window.document.body.textContent, /Create shortcut/);
  assert.match(window.document.body.textContent, /No certificates are needed/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(registrations, 0);
});

test("a secure Android-style install prompt is used once during the click and reports acceptance", async (t) => {
  const dom = new JSDOM('<section id="phone-install-panel"></section>', {
    url: "https://192.168.1.20:4174",
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.defineProperty(window, "isSecureContext", { value: true });
  Object.defineProperty(window.navigator, "serviceWorker", {
    value: { register: async () => {} },
  });
  window.eval(client);
  window.SpoolspacePWA.render({
    httpsPort: 4174,
    https: { mode: "local", fingerprint: "AA:BB" },
  });
  assert.equal(window.document.querySelector("#install-pwa"), null);
  assert.match(window.document.body.textContent, /30 seconds/);
  assert.match(window.document.body.textContent, /AA:BB/);
  let prompts = 0;
  const event = new window.Event("beforeinstallprompt", { cancelable: true });
  event.prompt = async () => {
    prompts++;
  };
  event.userChoice = Promise.resolve({ outcome: "accepted" });
  window.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  window.document.querySelector("#install-pwa").click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(prompts, 1);
  assert.equal(window.document.querySelector("#install-pwa"), null);
  assert.match(
    window.document.querySelector("#pwa-install-status").textContent,
    /Installation requested/,
  );
  window.dispatchEvent(new window.Event("appinstalled"));
  assert.equal(window.document.querySelector("#install-pwa"), null);
});

test("a rejected Android prompt and certificate-related worker errors are actionable", async (t) => {
  const dom = new JSDOM('<section id="phone-install-panel"></section>', {
    url: "https://192.168.1.20:4174",
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.defineProperty(window, "isSecureContext", { value: true });
  let failWorker = false;
  Object.defineProperty(window.navigator, "serviceWorker", {
    value: {
      register: async () => {
        if (failWorker) throw new Error("SSL certificate error");
      },
    },
  });
  window.eval(client);
  window.SpoolspacePWA.render();
  const event = new window.Event("beforeinstallprompt", { cancelable: true });
  event.prompt = () => {
    throw new Error("Install unavailable");
  };
  window.dispatchEvent(event);
  window.document.querySelector("#install-pwa").click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(
    window.document.querySelector("#pwa-install-status").textContent,
    /Chrome's menu/,
  );
  // A fresh document models a failed registration on first page load.
  failWorker = true;
  window.eval(client);
  window.dispatchEvent(new window.Event("load"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(
    window.document.querySelector("#pwa-worker-status").textContent,
    /SSL certificate error/,
  );
  assert.match(window.document.body.textContent, /Check certificate trust/);
});

test("secure clients register the scoped service worker", async (t) => {
  const dom = new JSDOM("", {
    url: "https://spool.home.arpa:4174",
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const calls = [];
  Object.defineProperty(window, "isSecureContext", { value: true });
  Object.defineProperty(window.navigator, "serviceWorker", {
    value: { register: async (...args) => calls.push(args) },
  });
  window.eval(client);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(calls.length >= 1);
  assert.equal(calls[0][0], "/sw.js");
  assert.equal(calls[0][1].scope, "/");
});

test("the offline worker never caches inventory APIs, backups or writes", async () => {
  const handlers = {},
    cached = [];
  let responsePromise;
  vm.runInNewContext(worker, {
    URL,
    self: {
      addEventListener: (name, fn) => (handlers[name] = fn),
      location: { origin: "https://spool.home.arpa" },
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => ({
        put: async (key) => cached.push(key),
        addAll: async () => {},
      }),
      match: async (key) => key,
      keys: async () => [],
    },
    fetch: async () => {
      throw new Error("offline");
    },
  });
  for (const [path, method] of [
    ["/api/spools", "GET"],
    ["/api/backup", "GET"],
    ["/api/spools", "POST"],
    ["/api/scan", "POST"],
  ]) {
    handlers.fetch({
      request: { url: "https://spool.home.arpa" + path, method },
      respondWith: () => assert.fail("API calls must not be intercepted"),
      waitUntil: () => {},
    });
  }
  handlers.fetch({
    request: {
      url: "https://spool.home.arpa/",
      method: "GET",
      mode: "navigate",
    },
    respondWith: (value) => (responsePromise = value),
  });
  assert.equal(await responsePromise, "/offline.html");
  assert.deepEqual(cached, []);
});
