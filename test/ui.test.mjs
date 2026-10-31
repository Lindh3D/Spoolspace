import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { createStore } from "../lib/store.mjs";
import { catalog } from "../lib/parser.mjs";

const html = readFileSync(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
const script = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);

// These are DOM workflow checks, not a real-browser layout/camera test. The mock
// transport uses the production store so responses keep the actual API shape.
async function openWorkspace(t, { extraSpools = [] } = {}) {
  const store = createStore(":memory:", { seed: false });
  const green = store.add({
    name: "Forest PLA",
    brand: "Bambu Lab",
    material: "PLA",
    colorName: "Forest green",
    colorHex: "#56814b",
    initialWeight: 1000,
    remainingWeight: 800,
    emptySpoolWeight: 250,
    location: "Shelf A",
  });
  const blue = store.add({
    name: "Ocean PETG",
    brand: "Polymaker",
    material: "PETG",
    colorName: "Blue",
    colorHex: "#2269ab",
    initialWeight: 2000,
    remainingWeight: 150,
    emptySpoolWeight: 220,
    location: "Dry box",
  });
  const small = store.add({
    name: "Small white spool",
    brand: "Prusament",
    material: "PLA",
    colorName: "White",
    colorHex: "#f3f3f3",
    initialWeight: 100,
    remainingWeight: 80,
    emptySpoolWeight: 0,
    location: "Shelf B",
  });
  const extras = extraSpools.map((spool) => store.add(spool));
  const dom = new JSDOM(html, {
    url: "http://localhost:4173/",
    runScripts: "outside-only",
  });
  const { window } = dom;
  const requests = [];
  window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  window.fetch = async (path, options = {}) => {
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : undefined;
    requests.push({ path, method, body });
    let value;
    try {
      if (path === "/api/bootstrap")
        value = {
          spools: store.list(),
          activity: store.activity(),
          settings: store.settings(),
          network: {
            urls: ["http://localhost:4173", "http://192.168.1.20:4173"],
            port: 4173,
          },
          scan: { ocr: true, ollama: false, model: "" },
        };
      else if (path === "/api/catalog") value = structuredClone(catalog);
      else if (path === "/api/materials" && method === "POST")
        value = store.addMaterial(body);
      else if (path.startsWith("/api/spools/") && method === "PATCH")
        value = store.update(path.split("/").at(-1), body);
      else if (path === "/api/spools" && method === "POST")
        value = store.add(body);
      else if (path === "/api/settings" && method === "PATCH")
        value = store.updateSettings(body);
      else {
        const match = path.match(
          /^\/api\/spools\/([^/]+)\/(usage|weigh|start)$/,
        );
        if (!match || method !== "POST")
          throw new Error(`Unexpected UI request: ${method} ${path}`);
        value =
          match[2] === "start"
            ? store.start(match[1])
            : match[2] === "usage"
              ? store.use(match[1], body)
              : store.weigh(match[1], body);
      }
      return { ok: true, json: async () => value };
    } catch (error) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: error.message }),
      };
    }
  };
  t.after(() => {
    dom.window.close();
    store.close();
  });
  window.eval(script + "\nwindow.testOpenSpoolForm = openSpoolForm;");
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  await settle();
  const $ = (selector) => window.document.querySelector(selector);
  const $$ = (selector) => [...window.document.querySelectorAll(selector)];
  const input = (selector, value, event = "input") => {
    const element = $(selector);
    assert.ok(element, selector);
    element.value = value;
    element.dispatchEvent(new window.Event(event, { bubbles: true }));
  };
  const submit = async (selector) => {
    const form = $(selector);
    assert.ok(form, selector);
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
  };
  return {
    window,
    store,
    green,
    blue,
    small,
    extras,
    requests,
    $,
    $$,
    input,
    submit,
    settle,
  };
}

test("inventory renders persisted spools with net weights and grams-based low-stock filtering", async (t) => {
  const ui = await openWorkspace(t);
  assert.equal(ui.$$("article.spool-card").length, 3);
  assert.match(ui.$("h1").textContent, /Filament inventory/);
  assert.match(ui.$(`[data-id="${ui.green.id}"]`).textContent, /800 g/);
  assert.match(ui.$(`[data-id="${ui.green.id}"] .pct`).textContent, /80%/);
  assert.equal(ui.$$(".stat-value").at(-1).textContent.trim(), "2");
  ui.input("#filter-stock", "low", "change");
  assert.deepEqual(
    ui
      .$$("article.spool-card .card-title")
      .map((element) => element.textContent)
      .sort(),
    ["Ocean PETG", "Small white spool"],
  );
  assert.equal(ui.$("#showing-count").textContent, "Showing 2 of 3 spools");
});

test("outside clicks keep an unfinished spool form open; its Close and X buttons close explicitly", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="add"]').click();
  ui.input("#f-name", "Unfinished spool");
  ui.input("#f-location", "Cabinet C");
  const form = ui.$("#spool-form"),
    modal = ui.$("#modal");
  modal.getBoundingClientRect = () => ({
    left: 100,
    right: 700,
    top: 100,
    bottom: 700,
  });
  modal.dispatchEvent(
    new ui.window.MouseEvent("click", {
      bubbles: true,
      clientX: 50,
      clientY: 50,
    }),
  );
  assert.equal(modal.open, true);
  assert.equal(ui.$("#spool-form"), form);
  assert.equal(ui.$("#f-name").value, "Unfinished spool");
  assert.equal(ui.$("#f-location").value, "Cabinet C");
  assert.equal(ui.store.list().length, 3);
  assert.equal(ui.$('#spool-form [data-action="close"]').textContent, "Close");
  ui.$('#spool-form [data-action="close"]').click();
  assert.equal(modal.open, false);
  ui.$('[data-action="add"]').click();
  ui.$('.modal-heading [aria-label="Close dialog"]').click();
  assert.equal(modal.open, false);
});

const matchingSpool = (overrides = {}) => ({
  name: "E-PLA Black",
  brand: "Add-North",
  material: "PLA",
  productLine: "E-PLA",
  formulation: "PLA",
  colorName: "Black",
  colorHex: "#000000",
  temperatureMin: 190,
  temperatureMax: 230,
  initialWeight: 1000,
  remainingWeight: 1000,
  emptySpoolWeight: 238,
  location: "Shelf A",
  ...overrides,
});

test("matching new spools collapse into a group and print usage updates only the chosen physical spool", async (t) => {
  const ui = await openWorkspace(t, {
    extraSpools: [
      ...Array.from({ length: 4 }, (_, i) =>
        matchingSpool({
          name: `New ${i + 1}`,
          location: i % 2 ? "Shelf B" : "Shelf A",
          formulation: i === 0 ? "" : "PLA",
        }),
      ),
      matchingSpool({
        name: "Opened first",
        remainingWeight: 650,
        openedDate: "2026-10-01",
        status: "in-use",
      }),
      matchingSpool({
        name: "Opened second",
        remainingWeight: 300,
        openedDate: "2026-10-02",
      }),
    ],
  });
  assert.equal(ui.$$("article.spool-card").length, 4);
  assert.equal(ui.$$(".spool-group-card").length, 1);
  assert.match(ui.$(".spool-group-card").textContent, /4 new, unused spools/);
  assert.match(
    ui.$(".spool-group-card").textContent,
    /2 opened, used or empty/,
  );
  ui.$(".spool-group-card").click();
  assert.equal(ui.$$(".group-spool").length, 2);
  assert.equal(ui.$$("#group-batch-0 option").length, 4);
  const chosen = ui.extras[2];
  ui.input("#group-batch-0", chosen.id, "change");
  ui.$("[data-start-group]").click();
  await ui.settle();
  assert.equal(ui.store.get(chosen.id).status, "in-use");
  assert.ok(ui.store.get(chosen.id).openedDate);
  assert.equal(ui.store.get(chosen.id).remainingWeight, 1000);
  assert.match(ui.$(".group-stock").textContent, /3 new, unused spools/);
  assert.equal(ui.$$(".group-spool").length, 3);
  ui.input(`#group-grams-${chosen.id}`, "42.5");
  await ui.submit(`.group-usage-form[data-id="${chosen.id}"]`);
  assert.equal(ui.store.get(chosen.id).remainingWeight, 957.5);
  for (const other of ui.extras.filter((s) => s.id !== chosen.id))
    assert.equal(ui.store.get(other.id).remainingWeight, other.remainingWeight);
  assert.equal(ui.$(`#group-grams-${chosen.id}`).max, "957.5");
  assert.equal(ui.store.list().length, 9);
  assert.equal(ui.requests.filter((r) => r.path.endsWith("/start")).length, 1);
  assert.equal(ui.requests.filter((r) => r.path.endsWith("/usage")).length, 1);
  ui.$(`[data-group-spool="${chosen.id}"] [data-detail]`).click();
  assert.ok(ui.$(".group-back"));
  ui.$(".group-back").click();
  assert.match(ui.$(".group-stock").textContent, /3 new, unused spools/);
});

test("grouping keeps different print settings separate and splits unopened batches by capacity", async (t) => {
  const ui = await openWorkspace(t, {
    extraSpools: [
      matchingSpool({ name: "New A", vendor: "Shop A" }),
      matchingSpool({ name: "New B", vendor: "Shop B", location: "Shelf B" }),
      matchingSpool({
        name: "Small new",
        initialWeight: 500,
        remainingWeight: 500,
      }),
      matchingSpool({ name: "Different temperature", temperatureMax: 240 }),
      matchingSpool({
        name: "Different grade",
        formulation: "PLA-CF",
        productLine: "PLA-CF",
      }),
      matchingSpool({ name: "Different color", colorHex: "#101010" }),
      matchingSpool({ name: "Different polymer", material: "PC-ABS" }),
    ],
  });
  assert.equal(ui.$$(".spool-group-card").length, 1);
  assert.match(ui.$(".spool-group-card").textContent, /3 new, unused spools/);
  ui.$(".spool-group-card").click();
  assert.equal(ui.$$(".group-batch").length, 2);
  assert.match(ui.$$(".group-batch")[0].textContent, /2 new, unused spools/);
  assert.match(ui.$$(".group-batch")[1].textContent, /1 new, unused spool/);
  assert.match(ui.$("#group-batch-0").textContent, /Shelf B/);
  assert.match(ui.$("#group-batch-0").textContent, /Shop B/);
});

test("list and low-stock filters show grouped stock while keeping individual matches visible", async (t) => {
  const ui = await openWorkspace(t, {
    extraSpools: [
      matchingSpool({ name: "Unopened A" }),
      matchingSpool({ name: "Unopened B" }),
      matchingSpool({
        name: "Low used",
        remainingWeight: 100,
        openedDate: "2026-10-01",
      }),
    ],
  });
  ui.input("#filter-stock", "low", "change");
  assert.match(ui.$(".spool-group-card").textContent, /2 new, unused spools/);
  assert.match(ui.$(".spool-group-card").textContent, /1 match filter/);
  ui.$('[data-layout="list"]').click();
  assert.equal(ui.$$("tbody tr[data-open-group]").length, 1);
  ui.$("tr[data-open-group]").dispatchEvent(
    new ui.window.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(ui.$$(".group-spool").length, 1);
  assert.match(ui.$(".group-stock").textContent, /2 new, unused spools/);
  const used = ui.extras[2];
  ui.input(`#group-grams-${used.id}`, "101");
  await ui.submit(`.group-usage-form[data-id="${used.id}"]`);
  assert.equal(ui.store.get(used.id).remainingWeight, 100);
  assert.ok(ui.$(`#group-grams-${used.id}`));
});

test("the plus beside filament type saves a custom blend without losing spool edits", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="add"]').click();
  ui.input("#f-name", "My blend spool");
  ui.input("#f-brand", "My brand");
  ui.input("#f-colorName", "Black");
  ui.input("#f-remainingWeight", "415");
  const plus = ui.$('[data-action="add-material"]');
  assert.equal(plus.previousElementSibling.id, "f-material");
  plus.click();
  ui.input("#custom-material-name", " pc-abs ");
  ui.$('[data-action="save-material"]').click();
  await ui.settle();
  assert.equal(ui.$("#f-material").value, "PC-ABS");
  assert.equal(ui.$("#f-name").value, "My blend spool");
  assert.equal(ui.$("#f-remainingWeight").value, "415");
  assert.equal(
    ui.$("#custom-material-editor").classList.contains("hidden"),
    true,
  );
  assert.deepEqual(ui.store.settings().customMaterials, ["PC-ABS"]);
  assert.equal(ui.store.list().length, 3);
  await ui.submit("#spool-form");
  assert.equal(
    ui.store.list().find((s) => s.name === "My blend spool").material,
    "PC-ABS",
  );
  assert.ok(ui.$$("#filter-material option").some((o) => o.value === "PC-ABS"));
  ui.$('[data-action="add"]').click();
  assert.ok(ui.$$("#f-material option").some((o) => o.value === "PC-ABS"));
  ui.$('[data-action="add-material"]').click();
  ui.input("#custom-material-name", "PC-ABS");
  ui.$('[data-action="save-material"]').click();
  await ui.settle();
  assert.equal(
    ui.$$("#f-material option").filter((o) => o.value === "PC-ABS").length,
    1,
  );
});

test("custom types can be added while editing and cancelling the inline entry preserves the spool", async (t) => {
  const ui = await openWorkspace(t);
  ui.$(`[data-detail="${ui.green.id}"]`).click();
  ui.$(`button[data-edit="${ui.green.id}"]`).click();
  ui.$('[data-action="add-material"]').click();
  ui.input("#custom-material-name", "Discarded");
  ui.$('[data-action="cancel-material"]').click();
  assert.equal(ui.$("#f-material").value, "PLA");
  assert.deepEqual(ui.store.settings().customMaterials, []);
  ui.$('[data-action="add-material"]').click();
  ui.input("#custom-material-name", "TPE");
  ui.$("#custom-material-name").dispatchEvent(
    new ui.window.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  await ui.settle();
  assert.equal(ui.$("#f-material").value, "TPE");
  assert.equal(ui.store.get(ui.green.id).material, "PLA");
  await ui.submit("#spool-form");
  assert.equal(ui.store.get(ui.green.id).material, "TPE");
  assert.equal(ui.store.get(ui.green.id).remainingWeight, 800);
});

test("search, material filter, and list view preserve the matching collection", async (t) => {
  const ui = await openWorkspace(t);
  ui.input("#search", "forest");
  assert.deepEqual(
    ui
      .$$("article.spool-card .card-title")
      .map((element) => element.textContent),
    ["Forest PLA"],
  );
  ui.input("#search", "");
  ui.input("#filter-material", "PETG", "change");
  assert.deepEqual(
    ui
      .$$("article.spool-card .card-title")
      .map((element) => element.textContent),
    ["Ocean PETG"],
  );
  ui.$('[data-layout="list"]').click();
  assert.equal(ui.$$("tbody tr").length, 1);
  assert.match(ui.$("tbody").textContent, /Ocean PETG/);
  assert.equal(ui.window.localStorage.getItem("spoolspace-layout"), "list");
  ui.input("#search", "unavailable color");
  assert.match(ui.$("#inventory-results").textContent, /No spools/);
});

test("add spool saves numeric weights through the API and shows the saved spool after refresh", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="add"]').click();
  ui.input("#f-name", "PETG <Workshop>");
  ui.input("#f-brand", "My brand");
  ui.input("#f-material", "PETG", "change");
  ui.input("#f-colorName", "Copper");
  ui.input("#f-colorHex", "#b87333");
  ui.input("#f-initialWeight", "750");
  ui.input("#f-remainingWeight", "610.5");
  ui.input("#f-emptySpoolWeight", "180");
  ui.input("#f-location", "Cabinet C");
  await ui.submit("#spool-form");
  const request = ui.requests.find(
    (item) => item.path === "/api/spools" && item.method === "POST",
  );
  assert.ok(request, "spool form should send a creation request");
  assert.deepEqual(
    {
      initialWeight: request.body.initialWeight,
      remainingWeight: request.body.remainingWeight,
      emptySpoolWeight: request.body.emptySpoolWeight,
    },
    { initialWeight: 750, remainingWeight: 610.5, emptySpoolWeight: 180 },
  );
  assert.equal(request.body.material, "PETG");
  assert.equal(request.body.colorHex, "#b87333");
  const saved = ui.store
    .list()
    .find((spool) => spool.name === "PETG <Workshop>");
  assert.ok(saved);
  assert.equal(ui.$("dialog").open, false);
  assert.equal(ui.$("article.spool-card h3").textContent, "PETG <Workshop>");
  assert.equal(
    ui.$("article.spool-card workshop"),
    null,
    "spool text must not become HTML",
  );
});

test("new manual and recognized spools reuse saved storage while cancellation and explicit values are respected", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="add"]').click();
  ui.input("#f-name", "Remember my storage");
  ui.input("#f-brand", "My brand");
  ui.input("#f-colorName", "Black");
  ui.input("#f-location", "Cabinet C");
  ui.input("#f-storage", "Dry box", "change");
  await ui.submit("#spool-form");
  const expected = { location: "Cabinet C", storage: "Dry box" };
  assert.deepEqual(ui.store.settings().spoolDefaults, expected);
  ui.$('[data-action="add"]').click();
  assert.equal(ui.$("#f-location").value, "Cabinet C");
  assert.equal(ui.$("#f-storage").value, "Dry box");
  assert.equal(ui.$("#f-name").value, "");
  assert.equal(ui.$("#f-remainingWeight").value, "1000");
  ui.input("#f-location", "Unsaved location");
  ui.input("#f-storage", "Open shelf", "change");
  ui.$('#modal [data-action="close"]').click();
  ui.window.testOpenSpoolForm({ name: "Scanned spool", _scan: true });
  assert.equal(ui.$("#f-location").value, "Cabinet C");
  assert.equal(ui.$("#f-storage").value, "Dry box");
  assert.equal(ui.$("#f-remainingWeight").value, "");
  assert.deepEqual(ui.store.settings().spoolDefaults, expected);
  ui.window.testOpenSpoolForm({
    name: "Catalog spool",
    _catalog: true,
    location: "",
    storage: "Vacuum container",
  });
  assert.equal(ui.$("#f-location").value, "");
  assert.equal(ui.$("#f-storage").value, "Vacuum container");
});

test("editing preserves a spool's own storage and changed storage becomes the next new-spool default", async (t) => {
  const ui = await openWorkspace(t);
  ui.$(`[data-detail="${ui.green.id}"]`).click();
  ui.$(`button[data-edit="${ui.green.id}"]`).click();
  assert.equal(ui.$("#f-location").value, "Shelf A");
  ui.input("#f-location", "Drying cabinet");
  ui.input("#f-storage", "Dry box", "change");
  await ui.submit("#spool-form");
  ui.$('[data-action="add"]').click();
  assert.equal(ui.$("#f-location").value, "Drying cabinet");
  assert.equal(ui.$("#f-storage").value, "Dry box");
  assert.equal(ui.store.get(ui.small.id).location, "Shelf B");
});

test("invalid remaining weight stays in the add form without sending a write", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="add"]').click();
  ui.input("#f-name", "Impossible spool");
  ui.input("#f-brand", "Test");
  ui.input("#f-colorName", "Black");
  ui.input("#f-initialWeight", "100");
  ui.input("#f-remainingWeight", "101");
  await ui.submit("#spool-form");
  assert.equal(ui.requests.filter((item) => item.method === "POST").length, 0);
  assert.equal(ui.$("dialog").open, true);
  assert.match(ui.$("#toasts").textContent, /cannot exceed/i);
  assert.equal(ui.$('#spool-form button[type="submit"]').disabled, false);
});

test("settings accept a grams threshold above 99 and preserve a zero threshold", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-view="settings"]').click();
  assert.match(ui.$('label[for="low-stock"]').textContent, /\(g\)/);
  assert.equal(ui.$("#low-stock").max, "100000");
  ui.input("#app-name", "My print room");
  ui.input("#low-stock", "1250");
  ui.input("#ollama-model", "llava:7b");
  assert.equal(ui.$("#settings-form").checkValidity(), true);
  await ui.submit("#settings-form");
  const request = ui.requests.find((item) => item.path === "/api/settings");
  assert.equal(request.method, "PATCH");
  assert.equal(request.body.lowStockThreshold, 1250);
  assert.equal(request.body.appName, "My print room");
  assert.equal(request.body.ollamaModel, "llava:7b");
  assert.equal(ui.$("#low-stock").value, "1250");
  ui.input("#low-stock", "0");
  assert.equal(ui.$("#settings-form").checkValidity(), true);
  await ui.submit("#settings-form");
  assert.equal(ui.$("#low-stock").value, "0");
  ui.$('[data-view="inventory"]').click();
  assert.equal(ui.$$(".stat-value").at(-1).textContent.trim(), "0");
});

test("a scale update requires recorded tare; valid usage and weighing update the displayed balance", async (t) => {
  const ui = await openWorkspace(t);
  ui.$(`[data-id="${ui.small.id}"]`).click();
  const weighButton = ui.$('#weigh-form button[type="submit"]');
  assert.equal(
    weighButton.disabled,
    true,
    "unknown tare must disable the scale action",
  );
  assert.equal(ui.$("#gross-weight").disabled, true);
  weighButton.click();
  await ui.settle();
  assert.equal(
    ui.requests.filter((item) => item.path.endsWith("/weigh")).length,
    0,
  );
  ui.$('[data-action="close"]').click();
  ui.$(`[data-id="${ui.green.id}"]`).click();
  ui.input("#usage-grams", "50");
  await ui.submit("#usage-form");
  assert.equal(ui.store.get(ui.green.id).remainingWeight, 750);
  assert.match(ui.$(".detail-weight").textContent, /750 g/);
  ui.input("#gross-weight", "900");
  await ui.submit("#weigh-form");
  assert.equal(ui.store.get(ui.green.id).remainingWeight, 650);
  assert.match(ui.$(".detail-weight").textContent, /650 g/);
  assert.deepEqual(
    ui.requests.find((item) => item.path.endsWith("/weigh")).body,
    { grossWeight: 900 },
  );
});

test("print planning includes the allowance, matches material and available grams, and does not reserve or consume stock", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="planner"]').click();
  ui.input("#f-planMaterial", "PLA", "change");
  ui.input("#f-planGrams", "75");
  ui.input("#f-planMargin", "10");
  await ui.submit("#planner-form");
  assert.deepEqual(
    ui
      .$$("#planner-results .select-spool-row strong")
      .map((node) => node.textContent),
    ["Forest PLA"],
    "82.5 g requirement should exclude the 80 g PLA spool and the sufficiently stocked PETG spool",
  );
  assert.match(
    ui.$("#planner-results").textContent,
    /82[.,]5 g needed with allowance/,
  );
  assert.equal(ui.store.get(ui.green.id).remainingWeight, 800);
  ui.$("#planner-results [data-detail]").click();
  assert.match(ui.$(".detail-weight").textContent, /800 g/);
  assert.equal(
    ui.requests.filter((request) => request.method !== "GET").length,
    0,
  );
  ui.$('[data-action="close"]').click();
  ui.$('[data-action="planner"]').click();
  ui.input("#f-planMaterial", "PLA", "change");
  ui.input("#f-planGrams", "900");
  ui.input("#f-planMargin", "10");
  await ui.submit("#planner-form");
  assert.equal(ui.$$("#planner-results .select-spool-row").length, 0);
  assert.match(
    ui.$("#planner-results").textContent,
    /No single spool has enough/,
  );
  assert.equal(ui.store.get(ui.green.id).remainingWeight, 800);
  assert.equal(
    ui.requests.filter((request) => request.method !== "GET").length,
    0,
  );
});

test("empty spool lookup learns matching brand tare from saved inventory and fills the form without adding a spool", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="add"]').click();
  ui.input("#f-brand", "Bambu Lab");
  assert.equal(ui.$("#f-emptySpoolWeight").value, "");
  ui.$('[data-action="lookup-tare"]').click();
  await ui.settle();
  assert.equal(
    ui.requests.filter((request) => request.path === "/api/catalog").length,
    1,
  );
  const learned = ui
    .$$("[data-tare-option]")
    .find((node) => node.textContent.includes("From your library"));
  assert.ok(learned, "a previously recorded same-brand tare should be offered");
  assert.match(learned.textContent, /Forest PLA/);
  assert.match(learned.textContent, /250 g/);
  assert.doesNotMatch(ui.$("#tare-lookup").textContent, /Polymaker|Prusament/);
  assert.match(
    ui.$("#tare-lookup").textContent,
    /Reference weights are examples/,
  );
  learned.click();
  assert.equal(ui.$("#f-emptySpoolWeight").value, "250");
  assert.equal(ui.$("#tare-lookup").textContent, "");
  assert.equal(ui.store.list().length, 3);
  assert.equal(
    ui.requests.filter((request) => request.method !== "GET").length,
    0,
  );
});
