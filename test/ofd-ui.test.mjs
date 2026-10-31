import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JSDOM } from "jsdom";
import { OFDCatalog } from "../lib/ofd-catalog.mjs";
import { LocalCatalog } from "../lib/local-catalog.mjs";
import { createStore } from "../lib/store.mjs";
import {
  parseLabel,
  parseRegion,
  catalog as referenceCatalog,
} from "../lib/parser.mjs";
import { createOFDFixture } from "./helpers/ofd-fixture.mjs";

const noisy =
  'od be "8 000 0 Sa\ned Yee Sse yy (&\nRT Po pT yids\nOPA To, - :\nP add:north\n3D-F AMENT\nPLA Economy\nDiameter [175 mem a\nColor | Biack FR\nSedtemn | Motori 050 Bias\n20 2031302238062';
const photo =
  "data:image/png;base64," +
  readFileSync(
    new URL("./fixtures/sample-label.png", import.meta.url),
  ).toString("base64");
async function workspace(t) {
  const directory = mkdtempSync(join(tmpdir(), "spoolspace-ofd-ui-")),
    fixture = createOFDFixture(join(directory, "upstream.db"));
  const catalog = new OFDCatalog({
    directory: join(directory, "cache"),
    fetchImpl: async () => new Response(readFileSync(fixture)),
  });
  catalog.adoptSnapshot(fixture);
  const store = createStore(":memory:", { seed: false }),
    own = store.add({
      name: "My used spool",
      brand: "My brand",
      material: "PLA",
      colorName: "Charcoal",
      colorHex: "#333333",
      initialWeight: 1000,
      remainingWeight: 123,
      emptySpoolWeight: 180,
      manufacturer: "My manufacturer",
      vendor: "My shop",
      temperatureMin: 215,
    });
  const localCatalog = new LocalCatalog(store, catalog);
  const dom = new JSDOM(
      readFileSync(new URL("../public/index.html", import.meta.url), "utf8"),
      { url: "http://localhost:4173", runScripts: "outside-only" },
    ),
    { window } = dom,
    requests = [];
  window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  window.URL.createObjectURL = () => "blob:unit-photo";
  window.URL.revokeObjectURL = () => {};
  window.Image = class {
    width = 1000;
    height = 500;
    set src(_) {
      queueMicrotask(() => this.onload?.());
    }
  };
  window.HTMLCanvasElement.prototype.getContext = () => ({
    fillRect() {},
    drawImage() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
  });
  window.HTMLCanvasElement.prototype.toDataURL = () => photo;
  // Transport uses the production catalog/store; image decoding and OCR output
  // are simulated here. Separate raster/OCR tests verify real image processing.
  window.fetch = async (path, options = {}) => {
    const method = options.method || "GET",
      body = options.body ? JSON.parse(options.body) : undefined;
    requests.push({ path, method, body });
    try {
      let value;
      const url = new URL(path, "http://localhost:4173");
      if (path === "/api/bootstrap")
        value = {
          spools: store.list(),
          settings: store.settings(),
          activity: store.activity(),
          templates: store.listTemplates(),
          network: { urls: [], port: 4173 },
          scan: { ocr: true, ollama: false },
          filamentDatabase: {
            ...catalog.status(),
            customCount: store.customFilaments().length,
          },
        };
      else if (path === "/api/filament-database/status")
        value = {
          ...catalog.status(),
          customCount: store.customFilaments().length,
        };
      else if (path === "/api/filament-database/sync")
        value = catalog.startSync();
      else if (path === "/api/filament-database/settings")
        value = catalog.configure(body);
      else if (url.pathname === "/api/filament-database/search")
        value = await localCatalog.search(Object.fromEntries(url.searchParams));
      else if (path === "/api/filament-database/match")
        value = await localCatalog.match(body);
      else if (path.startsWith("/api/filament-database/products/"))
        value = await localCatalog.getProduct(
          decodeURIComponent(path.split("/").at(-1)),
        );
      else if (path === "/api/catalog") value = referenceCatalog;
      else if (path === "/api/photo/orient")
        value = { angle: 0, reliable: false, message: "Adjust manually." };
      else if (path === "/api/photo/focus")
        value = { bounds: null, confidence: 0 };
      else if (path === "/api/scan") {
        const fields = parseLabel(noisy);
        value = {
          text: noisy,
          fields,
          warnings: [],
          regions: [],
          catalogMatch: await localCatalog.match({ text: noisy, fields }),
        };
      } else if (path === "/api/templates" && method === "POST") {
        const template = store.saveTemplate(body);
        value = {
          ...template,
          fields: Object.assign(
            {},
            ...template.regions.map((r) => parseRegion(r.field, r.value)),
          ),
        };
      } else if (path === "/api/spools" && method === "POST")
        value = store.add(body);
      else if (path.startsWith("/api/spools/") && method === "PATCH")
        value = store.update(path.split("/").at(-1), body);
      else throw Error(`Unexpected request ${method} ${path}`);
      return { ok: true, json: async () => structuredClone(value) };
    } catch (error) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: error.message }),
      };
    }
  };
  for (const name of ["photo-alignment.js", "label-editor.js", "app.js"])
    window.eval(
      readFileSync(new URL("../public/" + name, import.meta.url), "utf8"),
    );
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  await settle();
  t.after(async () => {
    window.close();
    await catalog.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const $ = (s) => window.document.querySelector(s),
    $$ = (s) => [...window.document.querySelectorAll(s)];
  const input = (selector, value, type = "input") => {
    const node = $(selector);
    assert.ok(node, selector);
    node.value = value;
    node.dispatchEvent(new window.Event(type, { bubbles: true }));
  };
  const submit = async (selector, submitter) => {
    $(selector).dispatchEvent(
      new window.SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        submitter: submitter ? $(submitter) : null,
      }),
    );
    await settle();
  };
  const openBrowser = () => {
    $('[data-view="settings"]').click();
    $('[data-action="open-filament-database"]').click();
  };
  return {
    window,
    catalog,
    store,
    own,
    requests,
    $,
    $$,
    input,
    submit,
    settle,
    openBrowser,
  };
}

test("Settings shows the cached catalog, background progress and automatic update control", async (t) => {
  const ui = await workspace(t);
  ui.$('[data-view="settings"]').click();
  assert.match(ui.$("#ofd-database-panel").textContent, /test.1/);
  assert.match(ui.$("#ofd-database-panel").textContent, /Product lines/);
  const auto = ui.$("#ofd-auto-update");
  auto.checked = false;
  auto.dispatchEvent(new ui.window.Event("change", { bubbles: true }));
  await ui.settle();
  assert.equal(ui.catalog.status().autoUpdate, false);
  ui.$('[data-action="update-filament-database"]').click();
  await ui.settle();
  assert.ok(ui.$("#ofd-database-panel progress"));
  if (ui.catalog.syncPromise) await ui.catalog.syncPromise;
  assert.equal(ui.store.get(ui.own.id).remainingWeight, 123);
});

test("saving an unknown filament makes it searchable as custom and available to later label matching", async (t) => {
  const ui = await workspace(t);
  ui.$('[data-action="add"]').click();
  ui.input("#f-name", "My copper stock");
  ui.input("#f-brand", "Nova Maker");
  ui.input("#f-productLine", "PLA Economy");
  ui.input("#f-colorName", "Copper");
  ui.input("#f-colorHex", "#b87333");
  ui.input("#f-temperatureMin", "195");
  ui.input("#f-temperatureMax", "235");
  await ui.submit("#spool-form");
  assert.equal(ui.store.customFilaments().length, 2);
  ui.openBrowser();
  assert.match(
    ui.$("#custom-filament-status").textContent,
    /My custom filaments: 2/,
  );
  ui.input("#ofd-source", "custom", "change");
  ui.input("#ofd-query", "Nova Maker");
  await ui.submit("#ofd-search-form");
  assert.equal(ui.$$(".catalog-match").length, 1);
  assert.match(ui.$(".catalog-match").textContent, /My custom filament/);
  assert.match(ui.$(".catalog-match").textContent, /diameter not recorded/);
  ui.input(
    "#ofd-label-text",
    "Brand: Nova Maker\nPLA Economy\nColor: Copper\nNet weight: 1kg",
  );
  await ui.submit("#ofd-match-form");
  assert.match(ui.$(".catalog-match").textContent, /Nova Maker/);
  ui.$('[data-catalog-pick="0"]').click();
  await ui.settle();
  assert.equal(ui.$("#f-brand").value, "Nova Maker");
  assert.equal(ui.$("#f-temperatureMin").value, "195");
  assert.equal(ui.$("#f-remainingWeight").value, "");
  assert.match(ui.$("#spool-form").textContent, /My custom filament/);
  assert.equal(ui.store.list().length, 2);
  ui.$('[data-action="mark-full-spool"]').click();
  await ui.submit("#spool-form");
  assert.equal(ui.store.list().length, 3);
  assert.equal(ui.store.customFilaments().length, 2);
});

test("noisy label matching only opens a review form and requires actual remaining filament", async (t) => {
  const ui = await workspace(t);
  ui.openBrowser();
  ui.input("#ofd-label-text", noisy);
  await ui.submit("#ofd-match-form");
  const candidate = ui.$(
    '[data-catalog-scope="browser"][data-catalog-pick="0"]',
  );
  assert.ok(candidate);
  assert.match(ui.$("#ofd-search-results").textContent, /PLA Economy/);
  assert.match(ui.$("#ofd-search-results").textContent, /100%/);
  candidate.click();
  await ui.settle();
  assert.equal(ui.$("#f-brand").value, "Add-North");
  assert.equal(ui.$("#f-material").value, "PLA");
  assert.equal(ui.$("#f-productLine").value, "PLA Economy");
  assert.equal(ui.$("#f-colorName").value, "Black");
  assert.equal(ui.$("#f-colorHex").value, "#000000");
  assert.equal(ui.$("#f-initialWeight").value, "1000");
  assert.equal(ui.$("#f-emptySpoolWeight").value, "238");
  assert.equal(ui.$("#f-remainingWeight").value, "");
  assert.equal(ui.$("[name=ocrText]").value, noisy);
  assert.match(ui.$("[name=catalogVariantId]").value, /uuid-economy-black/);
  await ui.submit("#spool-form");
  assert.equal(
    ui.requests.filter((r) => r.path === "/api/spools" && r.method === "POST")
      .length,
    0,
  );
  ui.input("#f-grossWeight", "659");
  assert.equal(ui.$("#f-remainingWeight").value, "421");
  await ui.submit("#spool-form");
  const saved = ui.store.list().find((s) => s.brand === "Add-North");
  assert.equal(saved.remainingWeight, 421);
  assert.equal(saved.initialWeight, 1000);
  assert.equal(saved.ocrText, noisy);
  assert.equal(saved.catalogVariantId, "uuid-economy-black");
  assert.equal(ui.store.list().length, 2);
});

test("new spool scale readings recalculate with tare and capacity and save net grams", async (t) => {
  const ui = await workspace(t);
  ui.$('[data-action="add"]').click();
  ui.input("#f-name", "Weighed spool");
  ui.input("#f-brand", "My brand");
  ui.input("#f-colorName", "Black");
  ui.input("#f-grossWeight", "850.5");
  assert.equal(ui.$("#f-remainingWeight").value, "");
  assert.match(ui.$("#spool-weight-result").textContent, /empty spool weight/);
  await ui.submit("#spool-form");
  assert.equal(ui.store.list().length, 1);
  ui.input("#f-emptySpoolWeight", "238");
  assert.equal(ui.$("#f-remainingWeight").value, "612.5");
  assert.equal(ui.$("#f-remainingWeight").readOnly, true);
  ui.input("#f-emptySpoolWeight", "240");
  assert.equal(ui.$("#f-remainingWeight").value, "610.5");
  ui.input("#f-initialWeight", "500");
  assert.match(ui.$("#spool-weight-result").textContent, /exceeds/);
  await ui.submit("#spool-form");
  assert.equal(ui.store.list().length, 1);
  ui.input("#f-initialWeight", "1000");
  ui.input("#f-grossWeight", "239");
  assert.match(ui.$("#spool-weight-result").textContent, /less than/);
  await ui.submit("#spool-form");
  assert.equal(ui.store.list().length, 1);
  ui.input("#f-grossWeight", "240");
  assert.equal(ui.$("#f-remainingWeight").value, "0");
  ui.input("#f-grossWeight", "850.5");
  // Browsing the catalog must keep this unsaved scale reading intact.
  ui.$('[data-action="catalog-from-form"]').click();
  ui.$('[data-action="return-to-spool-form"]').click();
  assert.equal(ui.$("#f-grossWeight").value, "850.5");
  assert.equal(ui.$("#f-remainingWeight").value, "610.5");
  await ui.submit("#spool-form");
  const saved = ui.store.list().find((s) => s.name === "Weighed spool");
  assert.equal(saved.remainingWeight, 610.5);
  assert.equal(saved.emptySpoolWeight, 240);
  assert.equal(saved.initialWeight, 1000);
  assert.equal(ui.store.get(ui.own.id).remainingWeight, 123);
});

test("clearing a scale reading allows manual entry and editing supports the same calculation", async (t) => {
  const ui = await workspace(t);
  ui.$(`[data-detail="${ui.own.id}"]`).click();
  ui.$(`button[data-edit="${ui.own.id}"]`).click();
  assert.equal(ui.$("#f-remainingWeight").value, "123");
  ui.input("#f-grossWeight", "600");
  assert.equal(ui.$("#f-remainingWeight").value, "420");
  ui.input("#f-grossWeight", "");
  assert.equal(ui.$("#f-remainingWeight").readOnly, false);
  assert.equal(ui.$("#f-remainingWeight").value, "");
  ui.input("#f-remainingWeight", "111");
  await ui.submit("#spool-form");
  assert.equal(ui.store.get(ui.own.id).remainingWeight, 111);
});

test("catalog lookup preserves unsaved user entries and returns them when cancelled", async (t) => {
  const ui = await workspace(t);
  ui.$(`[data-id="${ui.own.id}"]`).click();
  ui.$(`[data-edit="${ui.own.id}"]`).click();
  ui.input("#f-brand", "My corrected brand");
  ui.$('[data-action="catalog-from-form"]').click();
  ui.$('.modal-heading [data-action="close"]').click();
  assert.equal(ui.$("#f-brand").value, "My corrected brand");
  assert.equal(ui.$("#f-remainingWeight").value, "123");
  assert.equal(ui.$("#spool-form").dataset.edit, ui.own.id);
  ui.$('[data-action="catalog-from-form"]').click();
  ui.input("#ofd-query", "Add North PLA Economy Black");
  await ui.submit("#ofd-search-form");
  ui.$('[data-catalog-pick="0"]').click();
  await ui.settle();
  assert.equal(ui.$("#f-brand").value, "My corrected brand");
  assert.equal(ui.$("#f-manufacturer").value, "My manufacturer");
  assert.equal(ui.$("#f-vendor").value, "My shop");
  assert.equal(ui.$("#f-emptySpoolWeight").value, "180");
  assert.equal(ui.$("#f-temperatureMin").value, "215");
  assert.equal(ui.$("#f-remainingWeight").value, "123");
  assert.equal(ui.$("#f-productLine").value, "PLA Economy");
});

test("missing upstream temperatures, manufacturer and tare stay blank and a full spool needs explicit confirmation", async (t) => {
  const ui = await workspace(t);
  ui.openBrowser();
  ui.input("#ofd-query", "BambuLabs PLA Basic Black");
  await ui.submit("#ofd-search-form");
  ui.$('[data-catalog-pick="0"]').click();
  await ui.settle();
  for (const selector of [
    "#f-manufacturer",
    "#f-temperatureMin",
    "#f-temperatureMax",
    "#f-emptySpoolWeight",
    "#f-remainingWeight",
  ])
    assert.equal(ui.$(selector).value, "", selector);
  ui.$('[data-action="mark-full-spool"]').click();
  assert.equal(ui.$("#f-remainingWeight").value, "1000");
  await ui.submit("#spool-form");
  const saved = ui.store.list().find((s) => s.brand === "Bambu Lab");
  assert.equal(saved.emptySpoolWeight, 0);
  assert.equal(saved.remainingWeight, 1000);
  assert.equal(saved.temperatureMin, null);
});

test("confirmed template fields match the catalog and preserve source HEX and provenance in spool review", async (t) => {
  const ui = await workspace(t);
  ui.$('[data-action="scan"]').click();
  Object.defineProperty(ui.$("#scan-file"), "files", {
    value: [
      new ui.window.File(["fixture"], "label.png", { type: "image/png" }),
    ],
  });
  ui.$("#scan-file").dispatchEvent(
    new ui.window.Event("change", { bubbles: true }),
  );
  await ui.settle();
  assert.ok(ui.$('[data-catalog-scope="scan"][data-catalog-pick="0"]'));
  ui.$('[data-action="teach-label"]').click();
  for (const [field, value] of [
    ["brand", "add:north"],
    ["material", "PLA"],
    ["productLine", "PLA Economy"],
    ["colorName", "Biack"],
  ]) {
    ui.input("#region-field", field, "change");
    ui.$('[data-action="add-region"]').click();
    ui.input("#region-value", value);
  }
  ui.$('[data-action="match-template-fields"]').click();
  await ui.settle();
  ui.$('[data-catalog-scope="template"][data-catalog-pick="0"]').click();
  await ui.settle();
  assert.equal(ui.$("#region-value").value, "Black");
  await ui.submit("#template-form", '[data-use-spool="true"]');
  assert.equal(ui.$("#f-brand").value, "Add-North");
  assert.equal(ui.$("#f-colorHex").value, "#000000");
  assert.equal(ui.$("#f-remainingWeight").value, "");
  assert.equal(ui.$("[name=catalogVariantId]").value, "uuid-economy-black");
  assert.equal(ui.$("[name=ocrText]").value, noisy);
  assert.equal(ui.store.list().length, 1);
  assert.equal(ui.store.listTemplates().length, 1);
});
