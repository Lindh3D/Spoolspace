import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { createStore } from "../lib/store.mjs";
import { catalog, parseRegion } from "../lib/parser.mjs";
import { qrEvidence } from "../lib/qr-evidence.mjs";
import { parsePrusaSpool, mergeSpoolReport } from "../lib/prusa-spool.mjs";
import { prusaURL, prusaHTML } from "./helpers/prusa-report.mjs";

const html = readFileSync(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
const script = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
const alignmentScript = readFileSync(
  new URL("../public/photo-alignment.js", import.meta.url),
  "utf8",
);
const editorScript = readFileSync(
  new URL("../public/label-editor.js", import.meta.url),
  "utf8",
);
const photo = `data:image/png;base64,${readFileSync(new URL("./fixtures/sample-label.png", import.meta.url)).toString("base64")}`;

// Canvas/Image are deliberately simulated: these test file input routing,
// annotation coordinates, and API payloads, not real image decoding or layout.
async function openWorkspace(
  t,
  {
    savedTemplates = [],
    genericFields = { material: "PLA", name: "PLA" },
    regionTexts = {},
    deferRegionRead = false,
    orientation = {
      angle: 0,
      reliable: true,
      message: "Text orientation checked locally.",
    },
    deferOrientation = false,
    qrResult,
    photoWidth = 1000,
    photoHeight = 500,
    focusResult = { bounds: null, confidence: 0 },
    deferFocus = false,
    deferRead = false,
    failFirstRead = false,
  } = {},
) {
  const store = createStore(":memory:", { seed: false });
  const templates = structuredClone(savedTemplates);
  const requests = [];
  const fileClicks = [];
  const photoExports = [];
  let releaseRegionRead;
  let releaseOrientation;
  let releaseFocus;
  let releaseRead;
  let genericReads = 0;
  const dom = new JSDOM(html, {
    url: "http://localhost:4173/",
    runScripts: "outside-only",
  });
  const { window } = dom;
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  window.URL.createObjectURL = () => "blob:fixture-photo";
  window.URL.revokeObjectURL = () => {};
  window.Image = class {
    width = photoWidth;
    height = photoHeight;
    naturalWidth = photoWidth;
    naturalHeight = photoHeight;
    set src(value) {
      queueMicrotask(() => this.onload?.());
    }
  };
  window.HTMLCanvasElement.prototype.getContext = function () {
    return {
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      fillRect() {},
      drawImage() {},
      getImageData() {
        return { data: new Uint8ClampedArray([50, 100, 150, 255]) };
      },
    };
  };
  window.HTMLCanvasElement.prototype.toDataURL = function (type) {
    photoExports.push({ width: this.width, height: this.height, type });
    return photo;
  };
  window.Element.prototype.setPointerCapture = () => {};
  window.Element.prototype.releasePointerCapture = () => {};
  const click = window.HTMLInputElement.prototype.click;
  window.HTMLInputElement.prototype.click = function () {
    if (this.type === "file") fileClicks.push(this.id);
    return click.call(this);
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
          network: { urls: ["http://192.168.1.20:4173"], port: 4173 },
          scan: { ocr: true, ollama: false, model: "" },
          templates: templates.map(({ exampleImage, ...metadata }) => metadata),
        };
      else if (path === "/api/catalog") value = structuredClone(catalog);
      else if (path === "/api/photo/orient") {
        if (deferOrientation)
          await new Promise((resolve) => (releaseOrientation = resolve));
        value = orientation;
      } else if (path === "/api/photo/focus") {
        if (deferFocus)
          await new Promise((resolve) => (releaseFocus = resolve));
        value = focusResult;
      } else if (path === "/api/templates" && method === "GET")
        value = templates.map(({ exampleImage, ...metadata }) => metadata);
      else if (
        (path === "/api/templates" && method === "POST") ||
        (path.startsWith("/api/templates/") && method === "PATCH")
      ) {
        const existing = templates.find(
          (item) => item.id === path.split("/").at(-1),
        );
        value = {
          ...existing,
          ...body,
          id: existing?.id || "template-saved",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fields: Object.assign(
            {},
            ...[...body.regions]
              .sort(
                (a, b) =>
                  Number(a.field === "productLine") -
                  Number(b.field === "productLine"),
              )
              .map((region) => parseRegion(region.field, region.value)),
          ),
        };
        if (existing) templates.splice(templates.indexOf(existing), 1, value);
        else templates.push(value);
      } else if (path.startsWith("/api/templates/") && method === "GET")
        value = templates.find((item) => item.id === path.split("/").at(-1));
      else if (path === "/api/scan") {
        if (!body.regions) {
          genericReads++;
          if (deferRead)
            await new Promise((resolve) => (releaseRead = resolve));
          if (failFirstRead && genericReads === 1)
            throw new Error("Label reader unavailable. Try again.");
        }
        if (body.regions && deferRegionRead)
          await new Promise((resolve) => {
            releaseRegionRead = resolve;
          });
        value = body.templateId
          ? {
              text: "My Unknown Brand\nPLA Matte\nBlue",
              fields: {
                brand: "My Unknown Brand",
                material: "PLA",
                productLine: "PLA Matte",
                colorName: "Blue",
              },
              regions: [
                { field: "brand", text: "My Unknown Brand" },
                { field: "productLine", text: "PLA Matte" },
              ],
              warnings: [],
              method: "Template OCR",
              template: { id: body.templateId, name: "My label layout" },
            }
          : {
              text: "PLA\nUnknown print",
              fields: structuredClone(
                typeof genericFields === "function"
                  ? genericFields(genericReads)
                  : genericFields,
              ),
              regions:
                body.regions?.map((region) => ({
                  field: region.field,
                  text:
                    regionTexts[region.field] ??
                    (region.field === "brand"
                      ? "My Unkn0wn Brand"
                      : "PLA Economy"),
                })) || [],
              warnings: [],
              method: "Offline OCR",
            };
        if (qrResult)
          value.qr =
            body.readQR === false ? { codes: [], skipped: true } : qrResult;
        if (body.regions)
          value.fields = Object.assign(
            {},
            ...value.regions.map((region) =>
              parseRegion(region.field, region.text),
            ),
          );
      } else if (path === "/api/spools" && method === "POST")
        value = store.add(body);
      else throw new Error(`Unexpected UI request: ${method} ${path}`);
      return { ok: true, json: async () => structuredClone(value) };
    } catch (error) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: error.message }),
      };
    }
  };
  t.after(() => {
    window.close();
    store.close();
  });
  window.eval(alignmentScript);
  window.eval(editorScript);
  window.eval(script);
  await settle();
  const $ = (selector) => window.document.querySelector(selector);
  const $$ = (selector) => [...window.document.querySelectorAll(selector)];
  const input = (selector, value, event = "input") => {
    const element = $(selector);
    assert.ok(element, selector);
    element.value = value;
    element.dispatchEvent(new window.Event(event, { bubbles: true }));
  };
  const usePhoto = async (selector = "#scan-file") => {
    const element = $(selector);
    assert.ok(element, selector);
    Object.defineProperty(element, "files", {
      configurable: true,
      value: [new window.File(["fixture"], "spool.png", { type: "image/png" })],
    });
    element.dispatchEvent(new window.Event("change", { bubbles: true }));
    await settle();
  };
  const submit = async (selector, submitter = null) => {
    assert.ok($(selector), selector);
    $(selector).dispatchEvent(
      new window.SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        submitter: submitter ? $(submitter) : null,
      }),
    );
    await settle();
  };
  return {
    window,
    store,
    templates,
    requests,
    fileClicks,
    photoExports,
    $,
    $$,
    input,
    usePhoto,
    submit,
    settle,
    releaseRegionRead: () => {
      assert.ok(releaseRegionRead, "a region OCR request should be pending");
      releaseRegionRead();
    },
    releaseOrientation: () => {
      assert.ok(releaseOrientation);
      releaseOrientation();
    },
    releaseFocus: () => {
      assert.ok(releaseFocus);
      releaseFocus();
    },
    releaseRead: () => {
      assert.ok(releaseRead);
      releaseRead();
    },
  };
}

test("label rectangles normalize reverse drags and clamp to the photo edges", async (t) => {
  const ui = await openWorkspace(t);
  const container = ui.window.document.createElement("div");
  ui.window.document.body.append(container);
  const editor = new ui.window.LabelRegionEditor({ container, image: photo });
  editor.svg.getBoundingClientRect = () => ({
    left: 100,
    top: 50,
    width: 800,
    height: 400,
  });
  const pointer = (type, x, y) =>
    editor.svg.dispatchEvent(
      new ui.window.MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
      }),
    );
  pointer("pointerdown", 740, 290);
  pointer("pointermove", 260, 130);
  pointer("pointerup", 260, 130);
  assert.equal(editor.regions.length, 1);
  assert.equal(editor.regions[0].field, "brand");
  assert.ok(Math.abs(editor.regions[0].x - 0.2) < 1e-9);
  assert.ok(Math.abs(editor.regions[0].y - 0.2) < 1e-9);
  assert.ok(Math.abs(editor.regions[0].width - 0.6) < 1e-9);
  assert.ok(Math.abs(editor.regions[0].height - 0.4) < 1e-9);
  editor.field = "productLine";
  pointer("pointerdown", -20, 0);
  pointer("pointerup", 1200, 700);
  assert.equal(editor.regions.length, 2);
  const line = editor.regions.find((region) => region.field === "productLine");
  assert.deepEqual(
    { x: line.x, y: line.y, width: line.width, height: line.height },
    { x: 0, y: 0, width: 1, height: 1 },
  );
  editor.field = "temperatureRange";
  pointer("pointerdown", 300, 180);
  pointer("pointermove", 500, 250);
  pointer("pointercancel", 500, 250);
  pointer("pointerup", 500, 250);
  assert.equal(
    editor.regions.length,
    2,
    "a cancelled touch gesture must not become a saved box",
  );
});

test("photo library and camera buttons route to separate inputs without forcing gallery capture", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="scan"]').click();
  assert.ok(ui.$("#scan-file"));
  assert.equal(ui.$("#scan-file").hasAttribute("capture"), false);
  assert.equal(ui.$("#camera-file").getAttribute("capture"), "environment");
  ui.$('.scan-actions [data-action="choose-photo"]').click();
  assert.deepEqual(ui.fileClicks, ["scan-file"]);
  ui.$('.scan-actions [data-action="take-photo"]').click();
  assert.deepEqual(ui.fileClicks, ["scan-file", "camera-file"]);
  await ui.usePhoto();
  assert.equal(ui.$("#read-label").disabled, false);
  assert.ok(
    ui.$("#scan-file"),
    "choosing a photo must preserve the library input for a replacement photo",
  );
  assert.ok(
    ui.$("#camera-file"),
    "choosing a photo must preserve the separate camera input",
  );
});

test("outside clicks preserve a scan and the bottom Close button dismisses it explicitly", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  const modal = ui.$("#modal"),
    preview = ui.$("#scan-preview");
  modal.getBoundingClientRect = () => ({
    left: 100,
    right: 900,
    top: 50,
    bottom: 750,
  });
  modal.dispatchEvent(
    new ui.window.MouseEvent("click", {
      bubbles: true,
      clientX: 20,
      clientY: 20,
    }),
  );
  assert.equal(modal.open, true);
  assert.equal(ui.$("#scan-preview"), preview);
  assert.ok(ui.$("#read-label"));
  assert.equal(
    ui.$('.modal-footer [data-action="close"]').textContent,
    "Close",
  );
  ui.$('.modal-footer [data-action="close"]').click();
  assert.equal(modal.open, false);
});

test("manual entry from a scan keeps its reference photo through catalog lookup without attaching it to unrelated forms", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  ui.$('#modal [data-action="add"]').click();
  assert.equal(ui.$("#modal").classList.contains("photo-review-dialog"), true);
  assert.equal(ui.$(".review-photo-panel img").src, photo);
  assert.equal(
    ui.$("#f-remainingWeight").value,
    "",
    "A scan cannot establish the current weight",
  );
  ui.input("#f-name", "My manually entered spool");
  ui.input("#f-location", "Cabinet C");
  const form = ui.$("#spool-form");
  form.scrollTop = 200;
  assert.equal(
    ui.$(".review-photo-panel").parentElement,
    form.parentElement,
    "The reference is outside the scrolling properties",
  );
  ui.$('[data-action="catalog-from-form"]').click();
  ui.$('[data-action="return-to-spool-form"]').click();
  assert.equal(ui.$(".review-photo-panel img").src, photo);
  assert.equal(ui.$("#f-name").value, "My manually entered spool");
  assert.equal(ui.$("#f-location").value, "Cabinet C");
  ui.$('#spool-form [data-action="close"]').click();
  ui.$('#app [data-action="add"]').click();
  assert.equal(ui.$(".review-photo-panel"), null);
  assert.equal(ui.$("#modal").classList.contains("photo-review-dialog"), false);
});

test("recognized spool review keeps the scan photo while saving only spool properties", async (t) => {
  const ui = await openWorkspace(t, {
    genericFields: {
      name: "PLA spool",
      brand: "My brand",
      material: "PLA",
      colorName: "Black",
      initialWeight: 1000,
    },
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  ui.$("#read-label").click();
  assert.equal(ui.$(".review-photo-panel img").src, photo);
  assert.equal(ui.$("#f-brand").value, "My brand");
  ui.input("#f-remainingWeight", "650");
  await ui.submit("#spool-form");
  const saved = ui.requests.find(
    (r) => r.path === "/api/spools" && r.method === "POST",
  );
  assert.ok(saved);
  assert.equal(saved.body.remainingWeight, 650);
  assert.equal(saved.body._reviewPhoto, undefined);
  assert.equal(saved.body.reviewPhoto, undefined);
  assert.equal(ui.$("#modal").open, false);
});

test("spool entry preserves PLA as base material and saves an independent product line and temperature range", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="add"]').click();
  ui.input("#f-name", "Workshop X-PLA");
  ui.input("#f-brand", "My Unknown Brand");
  ui.input("#f-material", "PLA", "change");
  ui.input("#f-productLine", "X-PLA Economy");
  ui.input("#f-vendor", "Local filament shop");
  ui.input("#f-manufacturer", "Independent maker");
  ui.input("#f-colorName", "Olive");
  ui.input("#f-temperatureMin", "195");
  ui.input("#f-temperatureMax", "225");
  await ui.submit("#spool-form");
  const request = ui.requests.find(
    (item) => item.path === "/api/spools" && item.method === "POST",
  );
  assert.ok(request);
  assert.equal(request.body.material, "PLA");
  assert.equal(request.body.productLine, "X-PLA Economy");
  assert.equal(request.body.vendor, "Local filament shop");
  assert.equal(request.body.manufacturer, "Independent maker");
  assert.equal(request.body.temperatureMin, 195);
  assert.equal(request.body.temperatureMax, 225);
  const spool = ui.store.list().find((item) => item.name === "Workshop X-PLA");
  assert.ok(spool);
  assert.equal(spool.material, "PLA");
  assert.equal(spool.productLine, "X-PLA Economy");
  assert.equal(spool.temperatureMin, 195);
  assert.equal(spool.temperatureMax, 225);
});

test("an unfamiliar label can save a corrected single-field template without requiring every optional field", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  assert.match(
    ui.$("#scan-status").textContent,
    /Missing or incorrect details/,
  );
  ui.$('[data-action="teach-label"]').click();
  ui.input("#template-name", "My unfamiliar label");
  ui.input("#region-field", "brand", "change");
  const overlay = ui.$("#region-editor .annotation-overlay");
  overlay.getBoundingClientRect = () => ({
    left: 100,
    top: 50,
    width: 800,
    height: 400,
  });
  overlay.dispatchEvent(
    new ui.window.MouseEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      clientX: 180,
      clientY: 90,
      button: 0,
    }),
  );
  overlay.dispatchEvent(
    new ui.window.MouseEvent("pointerup", {
      bubbles: true,
      clientX: 580,
      clientY: 150,
      button: 0,
    }),
  );
  ui.input("#region-x", "25", "change");
  ui.input("#region-y", "10", "change");
  ui.input("#region-width", "50", "change");
  ui.input("#region-height", "15", "change");
  ui.input("#region-value", "My Unknown Brand");
  await ui.submit("#template-form");
  const request = ui.requests.find(
    (item) => item.path === "/api/templates" && item.method === "POST",
  );
  assert.ok(request, "template form must save a local template");
  assert.equal(request.body.name, "My unfamiliar label");
  assert.match(request.body.exampleImage, /^data:image\//);
  assert.equal(request.body.imageWidth, 1000);
  assert.equal(request.body.imageHeight, 1000);
  assert.equal(
    request.body.regions.length,
    1,
    "vendor/material/temperature regions remain optional",
  );
  assert.deepEqual(
    {
      field: request.body.regions[0].field,
      x: request.body.regions[0].x,
      y: request.body.regions[0].y,
      width: request.body.regions[0].width,
      height: request.body.regions[0].height,
      value: request.body.regions[0].value,
    },
    {
      field: "brand",
      x: 0.25,
      y: 0.1,
      width: 0.5,
      height: 0.15,
      value: "My Unknown Brand",
    },
  );
  assert.equal(
    ui.store.list().length,
    0,
    "saving a template alone must not add a spool",
  );
  assert.equal(
    ui.requests.filter(
      (item) => item.path === "/api/spools" && item.method === "POST",
    ).length,
    0,
  );
  ui.$('[data-action="scan"]').click();
  await ui.settle();
  assert.match(ui.$("#scan-template").textContent, /My unfamiliar label/);
});

test("region OCR corrections survive save-and-review and editing an existing template keeps its id", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  ui.$('[data-action="teach-label"]').click();
  ui.input("#template-name", "Unknown brand PLA layout");
  ui.$('[data-action="add-region"]').click();
  ui.$('[data-action="read-regions"]').click();
  await ui.settle();
  assert.equal(ui.$("#region-value").value, "My Unkn0wn Brand");
  ui.input("#region-value", "My Unknown Brand");
  ui.input("#region-field", "productLine", "change");
  ui.$('[data-action="add-region"]').click();
  ui.$('[data-action="read-regions"]').click();
  await ui.settle();
  assert.equal(ui.$("#region-value").value, "PLA Economy");
  ui.input("#region-value", "X-PLA");
  const reads = ui.requests.filter(
    (request) => request.path === "/api/scan" && request.body.regions,
  );
  assert.equal(reads.length, 2);
  assert.deepEqual(
    reads[1].body.regions.map((region) => region.field),
    ["brand", "productLine"],
  );
  assert.equal(reads[1].body.mode, "ocr");
  await ui.submit("#template-form", '[data-use-spool="true"]');
  const save = ui.requests.find(
    (request) => request.path === "/api/templates" && request.method === "POST",
  );
  assert.equal(
    save.body.regions.find((region) => region.field === "brand").value,
    "My Unknown Brand",
  );
  assert.equal(
    save.body.regions.find((region) => region.field === "brand").recognizedText,
    "My Unkn0wn Brand",
  );
  assert.equal(
    save.body.regions.find((region) => region.field === "productLine")
      .recognizedText,
    "PLA Economy",
  );
  assert.equal(ui.$("#f-material").value, "PLA");
  assert.equal(ui.$("#f-productLine").value, "X-PLA");
  assert.match(ui.$("#f-name").value, /My Unknown Brand.*X-PLA/);
  assert.equal(ui.$(".review-photo-panel img").src, photo);
  assert.equal(
    ui.store.list().length,
    0,
    "reviewing a template must still wait for the separate spool save",
  );
  ui.$('[data-action="close"]').click();
  ui.$('[data-view="templates"]').click();
  ui.$('[data-edit-template="template-saved"]').click();
  await ui.settle();
  assert.equal(ui.$("#template-name").value, "Unknown brand PLA layout");
  assert.equal(
    ui.$("#region-value").value,
    "My Unknown Brand",
    "editing the saved example should retain its confirmed text",
  );
  ui.input("#template-name", "Corrected PLA label layout");
  await ui.submit("#template-form");
  const update = ui.requests.find(
    (request) =>
      request.path === "/api/templates/template-saved" &&
      request.method === "PATCH",
  );
  assert.ok(
    update,
    "editing must PATCH the saved id rather than create a duplicate",
  );
  assert.equal(update.body.regions.length, 2);
  assert.equal(ui.templates.length, 1);
  assert.equal(ui.templates[0].name, "Corrected PLA label layout");
});

test("selected templates send their id for recognition and retain newly read product details instead of copying the example", async (t) => {
  const ui = await openWorkspace(t, {
    savedTemplates: [
      {
        id: "template-existing",
        name: "My label layout",
        exampleImage: photo,
        imageWidth: 1000,
        imageHeight: 500,
        regions: [
          {
            id: "brand-box",
            field: "brand",
            x: 0.1,
            y: 0.1,
            width: 0.5,
            height: 0.1,
            value: "My Unknown Brand",
          },
          {
            id: "line-box",
            field: "productLine",
            x: 0.1,
            y: 0.4,
            width: 0.5,
            height: 0.1,
            value: "PLA Economy",
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  ui.input("#scan-template", "template-existing", "change");
  await ui.settle();
  ui.$("#read-label").click();
  await ui.settle();
  const request = ui.requests
    .filter((item) => item.path === "/api/scan")
    .at(-1);
  assert.ok(request);
  assert.equal(request.body.templateId, "template-existing");
  assert.match(request.body.image, /^data:image\//);
  ui.$("#read-label").click();
  assert.equal(ui.$("#f-material").value, "PLA");
  assert.equal(ui.$("#f-productLine").value, "PLA Matte");
  assert.notEqual(ui.$("#f-productLine").value, "PLA Economy");
  assert.equal(ui.$("#f-colorName").value, "Blue");
  assert.equal(ui.$("#f-brand").value, "My Unknown Brand");
});

test("teaching a new photo with an existing layout clears exemplar values before OCR reads the new label", async (t) => {
  const template = {
    id: "template-existing",
    name: "Old example layout",
    exampleImage: photo,
    imageWidth: 1000,
    imageHeight: 500,
    regions: [
      {
        id: "brand-box",
        field: "brand",
        x: 0.1,
        y: 0.1,
        width: 0.5,
        height: 0.1,
        value: "Old Brand",
        recognizedText: "0ld Brand",
      },
      {
        id: "line-box",
        field: "productLine",
        x: 0.1,
        y: 0.4,
        width: 0.5,
        height: 0.1,
        value: "PLA Economy",
        recognizedText: "PLA Economy",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const ui = await openWorkspace(t, {
    savedTemplates: [template],
    regionTexts: { brand: "New Brand", productLine: "PLA Matte" },
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  ui.input("#scan-template", "template-existing", "change");
  ui.$('[data-action="teach-label"]').click();
  assert.equal(
    ui.$("#region-value").value,
    "",
    "saved brand text describes the old example, not the new photo",
  );
  ui.input("#region-field", "productLine", "change");
  assert.equal(
    ui.$("#region-value").value,
    "",
    "a saved variant must not be silently confirmed for another photo",
  );
  ui.$('[data-action="read-regions"]').click();
  await ui.settle();
  assert.equal(ui.$("#region-value").value, "PLA Matte");
  ui.input("#region-field", "brand", "change");
  assert.equal(ui.$("#region-value").value, "New Brand");
  await ui.submit("#template-form", '[data-use-spool="true"]');
  assert.equal(ui.$("#f-brand").value, "New Brand");
  assert.equal(ui.$("#f-productLine").value, "PLA Matte");
  assert.match(ui.$("#f-name").value, /New Brand.*PLA Matte/);
  assert.doesNotMatch(ui.$("#f-name").value, /Old Brand|Economy/);
});

test("a blank taught field removes the generic reader's incorrect guess before spool review", async (t) => {
  const ui = await openWorkspace(t, {
    genericFields: {
      brand: "Incorrect Generic Brand",
      material: "PLA",
      productLine: "PLA Basic",
      name: "Incorrect Generic Brand PLA Basic",
    },
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  ui.$('[data-action="teach-label"]').click();
  ui.$('[data-action="add-region"]').click();
  assert.equal(ui.$("#region-value").value, "");
  await ui.submit("#template-form", '[data-use-spool="true"]');
  assert.equal(
    ui.$("#f-brand").value,
    "",
    "an unmapped/blank corrected brand must not keep a known-wrong generic guess",
  );
  assert.equal(ui.$("#f-material").value, "PLA");
  assert.equal(ui.$("#f-productLine").value, "PLA Basic");
  assert.doesNotMatch(ui.$("#f-name").value, /Incorrect Generic Brand/);
});

test("typing a correction while region OCR is in flight keeps the user's text", async (t) => {
  const ui = await openWorkspace(t, { deferRegionRead: true });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  ui.$('[data-action="teach-label"]').click();
  ui.$('[data-action="add-region"]').click();
  ui.$('[data-action="read-regions"]').click();
  await ui.settle();
  ui.input("#region-value", "My precise company spelling");
  ui.releaseRegionRead();
  await ui.settle();
  assert.equal(ui.$("#region-value").value, "My precise company spelling");
  await ui.submit("#template-form");
  const save = ui.requests.find(
    (request) => request.path === "/api/templates" && request.method === "POST",
  );
  assert.equal(save.body.regions[0].value, "My precise company spelling");
  assert.equal(save.body.regions[0].recognizedText, "My Unkn0wn Brand");
});

test("scan alignment uses the template aspect ratio and sends the adjusted photo to OCR", async (t) => {
  const template = {
    id: "square-template",
    name: "Square label",
    exampleImage: photo,
    imageWidth: 500,
    imageHeight: 500,
    regions: [
      {
        id: "brand-fixed",
        field: "brand",
        x: 0.2,
        y: 0.1,
        width: 0.5,
        height: 0.15,
        value: "My Unknown Brand",
      },
    ],
  };
  const ui = await openWorkspace(t, { savedTemplates: [template] });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  ui.input("#scan-template", template.id, "change");
  const canvas = ui.$("#photo-canvas"),
    box = ui.$(".scan-region-preview rect");
  assert.equal(canvas.width, 500);
  assert.equal(canvas.height, 500);
  const bounds = ["x", "y", "width", "height"].map((k) => box.getAttribute(k));
  ui.input("#scan-photo-angle", "12.5");
  ui.input("#scan-photo-zoom", "175");
  ui.input('[data-photo-scope="scan"][data-photo-value="panX"]', "10");
  ui.input('[data-photo-scope="scan"][data-photo-value="panY"]', "-5");
  assert.deepEqual(
    ["x", "y", "width", "height"].map((k) => box.getAttribute(k)),
    bounds,
  );
  assert.equal(ui.$("#scan-photo-angle").value, "12.5");
  canvas.toDataURL = () => "data:image/jpeg;base64,YWxpZ25lZC1waG90bw==";
  ui.$("#read-label").click();
  await ui.settle();
  const first = ui.requests.filter((r) => r.path === "/api/scan").at(-1);
  assert.equal(first.body.image, canvas.toDataURL());
  assert.equal(first.body.imageWidth, 500);
  assert.equal(first.body.imageHeight, 500);
  assert.equal(first.body.templateId, template.id);
  assert.match(ui.$("#read-label").textContent, /Review/);
  ui.input("#scan-photo-angle", "13");
  assert.match(ui.$("#read-label").textContent, /Read label/);
  ui.$("#read-label").click();
  await ui.settle();
  assert.equal(
    ui.requests.filter((r) => r.path === "/api/scan").length,
    3,
    "adjusting after recognition must trigger another read, not review stale fields",
  );
  ui.$('[data-photo-scope="scan"][data-photo-command="reset"]').click();
  assert.equal(ui.$("#scan-photo-angle").value, "0");
  assert.equal(ui.$("#scan-photo-zoom").value, "100");
});

test("template photo pans beneath fixed boxes and saves the same aligned image used for region recognition", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  ui.$('[data-action="teach-label"]').click();
  ui.$('[data-action="add-region"]').click();
  const before = {
    x: ui.$("#region-x").value,
    y: ui.$("#region-y").value,
    width: ui.$("#region-width").value,
    height: ui.$("#region-height").value,
  };
  ui.$('[data-photo-scope="template"][data-photo-mode="pan"]').click();
  const overlay = ui.$(".annotation-overlay");
  overlay.getBoundingClientRect = () => ({
    left: 100,
    top: 50,
    width: 400,
    height: 200,
  });
  for (const [type, x, y] of [
    ["pointerdown", 180, 100],
    ["pointermove", 220, 120],
    ["pointerup", 220, 120],
  ]) {
    const event = new ui.window.Event(type, {
      bubbles: true,
      cancelable: true,
    });
    Object.assign(event, { clientX: x, clientY: y, pointerId: 1, button: 0 });
    overlay.dispatchEvent(event);
  }
  assert.equal(
    ui.$('[data-photo-scope="template"][data-photo-value="panX"]').value,
    "10",
  );
  assert.equal(
    ui.$('[data-photo-scope="template"][data-photo-value="panY"]').value,
    "10",
  );
  assert.equal(
    ui.$$("[data-select-region]").length,
    1,
    "panning must not draw another field",
  );
  assert.deepEqual(
    {
      x: ui.$("#region-x").value,
      y: ui.$("#region-y").value,
      width: ui.$("#region-width").value,
      height: ui.$("#region-height").value,
    },
    before,
  );
  ui.input("#template-photo-angle", "-3.5");
  ui.input("#template-photo-zoom", "220");
  const canvas = ui.$("#region-editor > canvas");
  canvas.toDataURL = () => "data:image/jpeg;base64,YWxpZ25lZC1sYWJlbA==";
  ui.$('[data-action="read-regions"]').click();
  await ui.settle();
  const read = ui.requests.find(
    (r) => r.path === "/api/scan" && r.body.regions,
  );
  assert.equal(read.body.image, canvas.toDataURL());
  ui.input("#region-value", "My Unknown Brand");
  await ui.submit("#template-form");
  const saved = ui.requests.find(
    (r) => r.path === "/api/templates" && r.method === "POST",
  );
  assert.equal(saved.body.exampleImage, read.body.image);
  assert.equal(saved.body.regions[0].x, 0.1);
  assert.equal(saved.body.regions[0].width, 0.4);
});

test("region OCR results are discarded if the photo is adjusted while reading", async (t) => {
  const ui = await openWorkspace(t, { deferRegionRead: true });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  ui.$('[data-action="teach-label"]').click();
  ui.$('[data-action="add-region"]').click();
  ui.$('[data-action="read-regions"]').click();
  await ui.settle();
  ui.input("#template-photo-angle", "9");
  ui.releaseRegionRead();
  await ui.settle();
  assert.equal(ui.$("#region-value").value, "");
  assert.match(ui.$("#template-status").textContent, /Photo adjusted/);
});

test("photo guidance and automatic orientation prepare a horizontal OCR preview", async (t) => {
  const ui = await openWorkspace(t, {
    orientation: {
      angle: 90,
      reliable: true,
      message: "Orientation corrected.",
    },
  });
  ui.$('[data-action="scan"]').click();
  assert.match(ui.$(".photo-guide").textContent, /horizontally/);
  assert.match(ui.$(".photo-guide").textContent, /glare/);
  await ui.usePhoto();
  assert.equal(
    ui.requests.filter((r) => r.path === "/api/photo/orient").length,
    1,
  );
  assert.equal(ui.$("#scan-photo-angle").value, "90");
  assert.equal(ui.$("#photo-canvas").width, 1000);
  assert.equal(ui.$("#photo-canvas").height, 1000);
  assert.equal(ui.$("#scan-photo-processing").value, "enhanced");
  assert.equal(ui.$("#read-label").disabled, false);
  assert.match(
    ui.$("#scan-photo-preparation-status").textContent,
    /label area/,
  );
  ui.$("#auto-orient-photo").checked = false;
  await ui.usePhoto();
  assert.equal(
    ui.requests.filter((r) => r.path === "/api/photo/orient").length,
    1,
  );
  assert.equal(ui.$("#scan-photo-angle").value, "0");
});

test("late automatic orientation cannot replace a manual photo adjustment", async (t) => {
  const ui = await openWorkspace(t, {
    deferOrientation: true,
    orientation: { angle: 90, reliable: true, message: "Corrected" },
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  assert.equal(ui.$("#read-label").disabled, true);
  ui.input("#scan-photo-angle", "7");
  ui.releaseOrientation();
  await ui.settle();
  assert.equal(ui.$("#scan-photo-angle").value, "7");
  assert.match(
    ui.$("#scan-photo-preparation-status").textContent,
    /adjustments kept/,
  );
  assert.equal(ui.$("#read-label").disabled, false);
  assert.equal(ui.$("#photo-canvas").width, 1000);
});

test("OCR preview changes invalidate scans and corner clicks keep confirmed template boxes fixed", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  assert.match(ui.$("#read-label").textContent, /Review/);
  ui.input("#scan-photo-processing", "binary", "change");
  assert.match(ui.$("#read-label").textContent, /Read label/);
  ui.$('[data-action="teach-label"]').click();
  ui.$('[data-action="add-region"]').click();
  ui.input("#region-value", "My verified brand");
  const before = ["x", "y", "width", "height"].map(
    (k) => ui.$(`#region-${k}`).value,
  );
  ui.input("#template-photo-contrast", "60");
  assert.equal(ui.$("#region-value").value, "My verified brand");
  const canvas = ui.$("#region-editor canvas");
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  });
  let corners;
  // Real projective pixels are covered in photo-alignment tests; here verify tap order/routing.
  ui.window.PhotoAlignment.prototype.rectify = function (points) {
    corners = structuredClone(points);
    this.update({ angle: 0 });
  };
  ui.$('[data-photo-scope="template"][data-photo-command="corners"]').click();
  for (const [x, y] of [
    [10, 10],
    [90, 15],
    [85, 90],
    [15, 85],
  ]) {
    ui.$("#region-editor svg").dispatchEvent(
      new ui.window.MouseEvent("click", {
        bubbles: true,
        clientX: x,
        clientY: y,
      }),
    );
  }
  assert.deepEqual(
    corners.map((p) => [p.x, p.y]),
    [
      [0.1, 0.1],
      [0.9, 0.15],
      [0.85, 0.9],
      [0.15, 0.85],
    ],
  );
  assert.deepEqual(
    ["x", "y", "width", "height"].map((k) => ui.$(`#region-${k}`).value),
    before,
  );
  assert.equal(ui.$("#region-value").value, "My verified brand");
  assert.equal(ui.$$(".photo-corner").length, 0);
  assert.match(
    ui.$("#template-photo-preparation-status").textContent,
    /straightened/,
  );
});

test("Prusa QR identity appears before catalog suggestions and stays in the review form", async (t) => {
  const ui = await openWorkspace(t, {
    qrResult: qrEvidence(["https://prusa.io/s/test-only-id"]),
    genericFields: { brand: "Prusament", manufacturer: "Prusa Research" },
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  assert.equal(
    ui.$("#scan-status").firstElementChild.className,
    "qr-scan-results",
  );
  assert.match(
    ui.$(".qr-scan-results").textContent,
    /Recognized: Prusa Research \/ Prusament/,
  );
  assert.match(
    ui.$(".qr-scan-results").textContent,
    /does not directly encode the material or color/,
  );
  ui.$("#read-label").click();
  assert.equal(ui.$("#f-brand").value, "Prusament");
  assert.equal(ui.$("#f-manufacturer").value, "Prusa Research");
  assert.equal(ui.$("#f-material").value, "");
});

test("large camera uploads preserve a higher resolution QR source while keeping the OCR preview bounded", async (t) => {
  const ui = await openWorkspace(t, { photoWidth: 6000, photoHeight: 4000 });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  const read = ui.requests.find((r) => r.path === "/api/scan");
  assert.ok(read.body.qrImage);
  assert.equal(ui.$("#photo-canvas").width, 1800);
  assert.ok(
    ui.photoExports.some(
      (p) => p.width === 3200 && p.height === 2133 && p.type === "image/jpeg",
    ),
  );
});

test("online spool details show the full Signal White name and verified tare, while current weight stays separate", async (t) => {
  const report = parsePrusaSpool(prusaHTML(), {
    spoolId: "abc123ff",
    url: prusaURL,
  });
  const fields = mergeSpoolReport(
    { material: "ASA", colorName: "White", initialWeight: 850 },
    report,
  ).fields;
  const ui = await openWorkspace(t, {
    genericFields: fields,
    qrResult: {
      ...qrEvidence(["https://prusa.io/s/abc123ff"]),
      spoolReport: report,
    },
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  assert.match(ui.$(".qr-spool-report").textContent, /Signal White/);
  assert.match(ui.$(".qr-spool-report").textContent, /866 g/);
  assert.match(ui.$(".qr-spool-report").textContent, /850 g/);
  assert.equal(ui.$(".qr-spool-report a").href, prusaURL);
  assert.equal(
    ui.requests.find((r) => r.path === "/api/scan").body.readSpoolInfo,
    true,
  );
  ui.$('#modal [data-action="add"]').click();
  assert.equal(ui.$("#f-colorName").value, "Signal White");
  assert.equal(ui.$("#f-colorHex").value, "#e3dfd9");
  assert.equal(ui.$("#f-material").value, "ASA");
  assert.equal(ui.$("#f-initialWeight").value, "866");
  assert.equal(ui.$("#f-emptySpoolWeight").value, "186");
  assert.equal(ui.$("#f-remainingWeight").value, "");
  assert.equal(ui.$(".review-photo-panel img").src, photo);
  ui.input("#f-grossWeight", "500");
  assert.equal(ui.$("#f-remainingWeight").value, "314");
  await ui.submit("#spool-form");
  assert.equal(ui.store.list()[0].remainingWeight, 314);
  assert.match(ui.store.list()[0].notes, /spoolId=abc123ff/);
  assert.equal(ui.store.customFilaments()[0].colorName, "Signal White");
});

test("online spool lookup can be disabled and changing that option waits for a manual reread", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="scan"]').click();
  ui.input("#scan-read-spool-info", "", "change");
  ui.$("#scan-read-spool-info").checked = false;
  await ui.usePhoto();
  const scans = () => ui.requests.filter((r) => r.path === "/api/scan");
  assert.equal(scans().length, 1);
  assert.equal(scans()[0].body.readSpoolInfo, false);
  ui.$("#scan-read-spool-info").checked = true;
  ui.$("#scan-read-spool-info").dispatchEvent(
    new ui.window.Event("change", { bubbles: true }),
  );
  await ui.settle();
  assert.equal(scans().length, 1);
  ui.$("#read-label").click();
  await ui.settle();
  assert.equal(scans().length, 2);
  assert.equal(scans()[1].body.readSpoolInfo, true);
});

test("combined QR review displays safe links and saves QR references with a measured spool", async (t) => {
  const payload = "https://addnorth.com/product/PLA-Economy-Black",
    qr = qrEvidence([payload]);
  const ui = await openWorkspace(t, {
    qrResult: qr,
    genericFields: {
      name: "PLA Economy Black",
      brand: "Add-North",
      material: "PLA",
      productLine: "PLA Economy",
      colorName: "Black",
      colorHex: "#000000",
      initialWeight: 1000,
      emptySpoolWeight: 238,
    },
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  const request = ui.requests.find((r) => r.path === "/api/scan");
  assert.equal(request.body.readQR, true);
  assert.equal(request.body.qrImage, photo);
  assert.match(ui.$(".qr-scan-results").textContent, /Recognized: Add-North/);
  assert.equal(ui.$(".qr-scan-code a").href, payload);
  assert.equal(ui.$(".qr-scan-code a").rel, "noopener noreferrer");
  assert.equal(
    ui.requests.some((r) => r.path === payload),
    false,
  );
  ui.$('[data-action="read-label"]').click();
  assert.deepEqual(JSON.parse(ui.$('[name="qrCodes"]').value), [payload]);
  assert.equal(ui.$("#f-remainingWeight").value, "");
  ui.input("#f-grossWeight", "738");
  await ui.submit("#spool-form");
  assert.equal(ui.store.list()[0].remainingWeight, 500);
  assert.deepEqual(ui.store.list()[0].qrCodes, [payload]);
});

test("QR reading can be disabled and unknown QR text is escaped in the review", async (t) => {
  const payload = '<img src=x onerror="alert(1)">';
  const ui = await openWorkspace(t, { qrResult: qrEvidence([payload]) });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  assert.equal(ui.$(".qr-scan-code img"), null);
  assert.match(ui.$(".qr-scan-code pre").textContent, /<img/);
  ui.$("#scan-read-qr").checked = false;
  ui.$("#scan-read-qr").dispatchEvent(
    new ui.window.Event("change", { bubbles: true }),
  );
  ui.$('[data-action="read-label"]').click();
  await ui.settle();
  assert.equal(
    ui.requests.filter((r) => r.path === "/api/scan").at(-1).body.readQR,
    false,
  );
  assert.match(ui.$("#scan-status").textContent, /QR reading is disabled/);
  assert.equal(ui.$(".qr-scan-results"), null);
});

test("portrait photos open in a square frame and automatically zoom to readable text", async (t) => {
  const ui = await openWorkspace(t, {
    photoWidth: 900,
    photoHeight: 1600,
    focusResult: {
      bounds: { x: 0.4, y: 0.3, width: 0.2, height: 0.3 },
      confidence: 90,
    },
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  assert.equal(ui.$("#photo-canvas").width, 1600);
  assert.equal(ui.$("#photo-canvas").height, 1600);
  assert.equal(ui.$("#scan-frame").style.width, "100%");
  assert.equal(ui.$("#scan-frame").style.height, "100%");
  assert.equal(ui.$(".photo-guide").open, false);
  assert.equal(ui.$("#scan-photo-zoom").value, "280");
  assert.match(
    ui.$("#scan-photo-preparation-status").textContent,
    /Zoomed to readable/,
  );
  assert.equal(
    ui.requests.filter((r) => r.path === "/api/photo/focus").length,
    1,
  );
  const scan = ui.requests.find((r) => r.path === "/api/scan");
  assert.equal(scan.body.imageWidth, 1600);
  assert.equal(scan.body.imageHeight, 1600);
  ui.$('[data-photo-scope="scan"][data-photo-command="fit"]').click();
  assert.equal(ui.$("#scan-photo-zoom").value, "100");
});

test("old portrait template frames stay proportional within a square viewport", async (t) => {
  const template = {
    id: "portrait",
    name: "Portrait",
    exampleImage: photo,
    imageWidth: 450,
    imageHeight: 800,
    regions: [
      {
        id: "brand",
        field: "brand",
        x: 0.2,
        y: 0.3,
        width: 0.5,
        height: 0.1,
        value: "Example",
      },
    ],
  };
  const ui = await openWorkspace(t, { savedTemplates: [template] });
  ui.$('[data-action="scan"]').click();
  ui.input("#scan-template", template.id, "change");
  await ui.usePhoto();
  assert.equal(ui.$("#photo-canvas").width, 450);
  assert.equal(ui.$("#photo-canvas").height, 800);
  assert.equal(ui.$("#scan-frame").style.width, "56.25%");
  assert.equal(ui.$("#scan-frame").style.height, "100%");
  assert.equal(ui.$(".scan-region-preview").parentElement.id, "scan-frame");
  assert.equal(
    ui.requests.filter((r) => r.path === "/api/photo/focus").length,
    0,
  );
  ui.$('[data-action="teach-label"]').click();
  assert.ok(ui.$(".annotation-viewport #region-editor"));
  assert.equal(ui.$("#region-editor").style.width, "56.25%");
  assert.equal(ui.$("#region-editor canvas").width, 450);
  assert.equal(ui.$("#region-editor canvas").height, 800);
});

test("manual photo adjustments win over late automatic label zoom", async (t) => {
  const ui = await openWorkspace(t, {
    deferFocus: true,
    focusResult: {
      bounds: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 },
      confidence: 90,
    },
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  assert.equal(ui.$("#read-label").disabled, true);
  ui.input("#scan-photo-zoom", "175");
  ui.releaseFocus();
  await ui.settle();
  assert.equal(ui.$("#scan-photo-zoom").value, "175");
  assert.match(
    ui.$("#scan-photo-preparation-status").textContent,
    /adjustments kept/,
  );
  assert.equal(ui.$("#read-label").disabled, false);
});

test("upload waits for alignment and zoom, shows each busy stage, then reads exactly once", async (t) => {
  const ui = await openWorkspace(t, {
    deferOrientation: true,
    deferFocus: true,
    deferRead: true,
    focusResult: {
      bounds: { x: 0.3, y: 0.3, width: 0.4, height: 0.3 },
      confidence: 90,
    },
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  assert.equal(ui.$("#scan-zone").getAttribute("aria-busy"), "true");
  assert.equal(ui.$("#scan-processing").getAttribute("role"), "status");
  assert.match(ui.$("#scan-processing").textContent, /Aligning/);
  assert.equal(ui.requests.filter((r) => r.path === "/api/scan").length, 0);
  assert.equal(ui.$("#scan-photo-controls .photo-adjustment").open, false);
  ui.releaseOrientation();
  await ui.settle();
  assert.match(ui.$("#scan-processing").textContent, /Zooming/);
  assert.equal(ui.requests.filter((r) => r.path === "/api/scan").length, 0);
  ui.releaseFocus();
  await ui.settle();
  assert.match(ui.$("#scan-processing").textContent, /Reading/);
  assert.equal(ui.requests.filter((r) => r.path === "/api/scan").length, 1);
  assert.equal(ui.$("#read-label").disabled, true);
  ui.releaseRead();
  await ui.settle();
  assert.equal(ui.$("#scan-processing"), null);
  assert.equal(ui.$("#scan-zone").getAttribute("aria-busy"), "false");
  assert.match(ui.$("#scan-status").textContent, /Ready for a quick review/);
  assert.equal(ui.$("#spool-form"), null);
  assert.equal(ui.store.list().length, 0);
  assert.deepEqual(
    ui.requests
      .filter((r) =>
        ["/api/photo/orient", "/api/photo/focus", "/api/scan"].includes(r.path),
      )
      .map((r) => r.path),
    ["/api/photo/orient", "/api/photo/focus", "/api/scan"],
  );
  ui.$("#scan-photo-controls .photo-adjustment").open = true;
  ui.input("#scan-photo-angle", "5");
  await ui.settle();
  assert.equal(ui.requests.filter((r) => r.path === "/api/scan").length, 1);
  assert.match(ui.$("#read-label").textContent, /Read label again/);
  ui.$("#read-label").click();
  await ui.settle();
  assert.match(ui.$("#scan-processing").textContent, /Reading/);
  ui.releaseRead();
  await ui.settle();
  assert.equal(ui.requests.filter((r) => r.path === "/api/scan").length, 2);
});

test("a failed automatic read clears the overlay and allows a manual retry without an automatic loop", async (t) => {
  const ui = await openWorkspace(t, { failFirstRead: true });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  assert.equal(ui.$("#scan-processing"), null);
  assert.equal(ui.$("#read-label").disabled, false);
  assert.match(ui.$("#scan-status").textContent, /unavailable/);
  await ui.settle();
  assert.equal(ui.requests.filter((r) => r.path === "/api/scan").length, 1);
  ui.$("#read-label").click();
  await ui.settle();
  assert.equal(ui.requests.filter((r) => r.path === "/api/scan").length, 2);
  assert.match(ui.$("#scan-status").textContent, /Ready for a quick review/);
  assert.equal(ui.$("#scan-processing"), null);
});

test("a replacement photo queues its automatic read and owns the busy overlay", async (t) => {
  const ui = await openWorkspace(t, {
    deferRead: true,
    genericFields: (read) => ({ material: "PLA", name: `Photo ${read}` }),
  });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  assert.match(ui.$("#scan-processing").textContent, /Reading/);
  await ui.usePhoto();
  assert.equal(ui.requests.filter((r) => r.path === "/api/scan").length, 1);
  assert.match(ui.$("#scan-processing").textContent, /Preparing/);
  ui.releaseRead();
  await ui.settle();
  assert.equal(ui.requests.filter((r) => r.path === "/api/scan").length, 2);
  assert.match(ui.$("#scan-processing").textContent, /Reading/);
  assert.equal(ui.$("#read-label").disabled, true);
  ui.releaseRead();
  await ui.settle();
  assert.equal(ui.$("#scan-processing"), null);
  ui.$("#read-label").click();
  assert.equal(ui.$("#f-name").value, "Photo 2");
  assert.equal(ui.store.list().length, 0);
});

test("closing a scan during its automatic read never opens a spool form", async (t) => {
  const ui = await openWorkspace(t, { deferRead: true });
  ui.$('[data-action="scan"]').click();
  await ui.usePhoto();
  ui.$('.modal-heading [data-action="close"]').click();
  ui.releaseRead();
  await ui.settle();
  assert.equal(ui.$("#modal").open, false);
  assert.equal(ui.$("#scan-processing"), null);
  assert.equal(ui.$("#spool-form"), null);
  assert.equal(ui.store.list().length, 0);
});

test("upload still reads once when optional alignment and zoom are disabled; changing options does not auto-read", async (t) => {
  const ui = await openWorkspace(t);
  ui.$('[data-action="scan"]').click();
  ui.$("#auto-orient-photo").checked = false;
  ui.$("#auto-focus-label").checked = false;
  await ui.usePhoto();
  assert.equal(
    ui.requests.filter(
      (r) => r.path === "/api/photo/orient" || r.path === "/api/photo/focus",
    ).length,
    0,
  );
  assert.equal(ui.requests.filter((r) => r.path === "/api/scan").length, 1);
  ui.input("#scan-mode", "ocr", "change");
  ui.input("#scan-template", "", "change");
  await ui.settle();
  assert.equal(ui.requests.filter((r) => r.path === "/api/scan").length, 1);
});
