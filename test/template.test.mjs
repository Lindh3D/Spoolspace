import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../lib/store.mjs";
import { imageData, correctedRegionText } from "../lib/templates.mjs";
import { recognizeImage } from "../lib/recognition.mjs";
import { createApp } from "../server.mjs";

const exampleImage =
  "data:image/png;base64," +
  readFileSync(new URL("fixtures/sample-label.png", import.meta.url)).toString(
    "base64",
  );
const sample = () => ({
  name: "Bambu rectangular label",
  exampleImage,
  imageWidth: 1200,
  imageHeight: 650,
  regions: [
    {
      field: "brand",
      x: 0.04,
      y: 0.06,
      width: 0.31,
      height: 0.09,
      value: "Bambu Lab",
      recognizedText: "BAMBU LAB",
    },
    {
      field: "material",
      x: 0.04,
      y: 0.16,
      width: 0.24,
      height: 0.09,
      value: "PETG HF",
      recognizedText: "PETG HF",
    },
    {
      field: "colorName",
      x: 0.04,
      y: 0.26,
      width: 0.39,
      height: 0.09,
      value: "Forest Green",
      recognizedText: "FOREST GREEN",
    },
  ],
});

test("saved label templates persist locally with verified dimensions and optional fields", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "spoolspace-templates-")),
    file = join(dir, "spools.sqlite");
  let store = createStore(file, { seed: false });
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const added = store.saveTemplate({
    ...sample(),
    imageWidth: 200,
    imageHeight: 400,
  });
  assert.equal(added.imageWidth, 1200);
  assert.equal(added.imageHeight, 650);
  assert.equal(store.listTemplates()[0].exampleImage, undefined);
  assert.equal(store.getTemplate(added.id).exampleImage, exampleImage);
  store.close();
  store = createStore(file, { seed: false });
  assert.equal(store.getTemplate(added.id).regions.length, 3);
  const updated = store.saveTemplate(
    { name: "Known new name", regions: sample().regions.slice(0, 1) },
    added.id,
  );
  assert.equal(updated.regions.length, 1);
  assert.equal(updated.exampleImage, exampleImage);
});

test("invalid template coordinates and invalid temperature ranges do not change stored records", (t) => {
  const store = createStore(":memory:", { seed: false });
  t.after(() => store.close());
  const spool = store.add({
    name: "PLA Basic",
    material: "PLA",
    productLine: "PLA Basic",
    vendor: "Local shop",
    manufacturer: "Factory",
    temperatureMin: 190,
    temperatureMax: 220,
  });
  assert.equal(store.get(spool.id).material, "PLA");
  assert.equal(store.get(spool.id).productLine, "PLA Basic");
  assert.throws(
    () => store.update(spool.id, { temperatureMin: 250, temperatureMax: 220 }),
    /Minimum/,
  );
  assert.equal(store.get(spool.id).temperatureMin, 190);
  assert.throws(
    () =>
      store.saveTemplate({
        ...sample(),
        regions: [{ ...sample().regions[0], x: 0.9, width: 0.2 }],
      }),
    /inside/,
  );
  assert.throws(
    () =>
      store.saveTemplate({
        ...sample(),
        regions: [sample().regions[0], sample().regions[0]],
      }),
    /one label region/,
  );
  assert.equal(store.listTemplates().length, 0);
  // Legacy JSON records have additive defaults without an inventory rewrite.
  const data = { ...spool };
  delete data.productLine;
  delete data.temperatureMin;
  delete data.vendor;
  store.db
    .prepare("UPDATE spools SET data=? WHERE id=?")
    .run(JSON.stringify(data), spool.id);
  assert.equal(store.get(spool.id).productLine, "");
  assert.equal(store.get(spool.id).vendor, "");
  assert.equal(store.get(spool.id).temperatureMin, null);
});

test("templates and reference photos round trip in backups with atomic validation", (t) => {
  const store = createStore(":memory:", { seed: false });
  t.after(() => store.close());
  const template = store.saveTemplate(sample()),
    spool = store.add({
      name: "A real spool",
      productLine: "PLA Economy",
      temperatureMin: 190,
      temperatureMax: 220,
    });
  const backup = store.backup();
  assert.equal(backup.templates[0].exampleImage, exampleImage);
  const invalid = structuredClone(backup);
  invalid.templates[0].regions[0].height = 0;
  assert.throws(() => store.restore(invalid), /visible area/);
  assert.equal(store.get(spool.id).name, "A real spool");
  assert.equal(store.getTemplate(template.id).name, template.name);
  store.restore(backup);
  assert.equal(store.getTemplate(template.id).exampleImage, exampleImage);
  assert.equal(store.get(spool.id).productLine, "PLA Economy");
  store.restore({ version: 1, spools: [] });
  assert.equal(
    store.listTemplates().length,
    1,
    "old backups preserve an existing label library",
  );
  store.restore({ version: 1, spools: [], templates: [] });
  assert.equal(store.listTemplates().length, 0);
});

test("learned corrections do not copy variable example values onto different products", () => {
  assert.equal(
    correctedRegionText(
      {
        field: "brand",
        value: "Spool Company",
        recognizedText: "SpooI Company",
      },
      "SpooI Company",
    ),
    "Spool Company",
  );
  assert.equal(
    correctedRegionText(
      { field: "colorName", value: "Red", recognizedText: "RED" },
      "FOREST GREEN",
    ),
    "FOREST GREEN",
  );
  assert.equal(
    correctedRegionText(
      { field: "productLine", value: "PLA Basic", recognizedText: "PLA BASIC" },
      "PLA MATTE",
    ),
    "PLA MATTE",
  );
  assert.equal(
    correctedRegionText(
      { field: "initialWeight", value: "1000 g", recognizedText: "1 kg" },
      "750 g",
    ),
    "750 g",
  );
  assert.equal(
    correctedRegionText(
      { field: "productLine", value: "PLA Basic", recognizedText: "PLA" },
      "PLA+",
    ),
    "PLA+",
  );
  assert.equal(
    correctedRegionText(
      { field: "initialWeight", value: "15000 g", recognizedText: "15 kg" },
      "1.5 kg",
    ),
    "1.5 kg",
  );
  assert.equal(
    correctedRegionText(
      { field: "brand", value: "Saved brand", recognizedText: "" },
      "",
    ),
    "",
  );
  assert.throws(
    () =>
      imageData("data:image/png;base64," + Buffer.alloc(30).toString("base64")),
    /damaged/,
  );
});

test("local OCR reads taught rectangles and keeps new color and product text", async () => {
  const template = sample();
  template.id = "test-template";
  template.regions[0].value = "Corrected Spool Company";
  template.regions.push({
    field: "productLine",
    x: 0.04,
    y: 0.16,
    width: 0.24,
    height: 0.09,
    value: "PLA Basic",
    recognizedText: "PLA BASIC",
  });
  template.regions[2].value = "Red";
  template.regions[2].recognizedText = "RED";
  const result = await recognizeImage(exampleImage, "ocr", "", {
    template,
    templates: [template],
  });
  assert.equal(result.fields.brand, "Corrected Spool Company");
  assert.equal(result.fields.material, "PETG");
  assert.match(result.fields.productLine, /PETG HF/i);
  assert.equal(result.fields.colorName, "FOREST GREEN");
  assert.equal(result.regions.length, 4);
  assert.equal(result.template.id, "test-template");
});

test("template HTTP API saves corrections, omits image from lists and reads unsaved boxes", async (t) => {
  const app = createApp({
    database: ":memory:",
    seed: false,
    port: 0,
    host: "127.0.0.1",
  });
  await app.listen();
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (path, body) =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  let response = await post("/api/templates", sample());
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.fields.brand, "Bambu Lab");
  assert.equal(saved.fields.material, "PETG");
  const list = await (await fetch(base + "/api/templates")).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].exampleImage, undefined);
  const full = await (await fetch(base + "/api/templates/" + saved.id)).json();
  assert.equal(full.exampleImage, exampleImage);
  response = await post("/api/scan", {
    image: exampleImage,
    regions: [sample().regions[0]],
  });
  assert.equal(response.status, 200);
  const scan = await response.json();
  assert.equal(scan.fields.brand, "Bambu Lab");
  assert.equal(scan.regions.length, 1);
  response = await post("/api/scan", {
    image: exampleImage,
    templateId: saved.id,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).template.name, saved.name);
});
