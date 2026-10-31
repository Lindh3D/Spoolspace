import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { createStore } from "../lib/store.mjs";
import { OFDCatalog } from "../lib/ofd-catalog.mjs";
import { LocalCatalog } from "../lib/local-catalog.mjs";
import { createApp } from "../server.mjs";
import { createOFDFixture } from "./helpers/ofd-fixture.mjs";

const filament = {
  name: "My bronze spool",
  brand: "Nova Maker",
  material: "PLA",
  productLine: "PLA Economy",
  formulation: "PLA",
  colorName: "Bronze",
  colorHex: "#b88035",
  manufacturer: "Nova Factory",
  vendor: "My supplier",
  initialWeight: 1000,
  remainingWeight: 600,
  emptySpoolWeight: 210,
  temperatureMin: 190,
  temperatureMax: 230,
  location: "Cabinet A",
  storage: "Dry box",
  notes: "Private physical spool note",
};
const label = "Brand: Nova Maker\nPLA Economy\nColor: Bronze\nNet weight: 1kg";
const directory = () => mkdtempSync(join(tmpdir(), "spoolspace-custom-"));

test("manual filaments are deduplicated by product, retain sizes, persist independently of stock and round trip in backups", () => {
  const dir = directory(),
    path = join(dir, "inventory.sqlite");
  let store = createStore(path, { seed: false });
  try {
    const first = store.add(filament);
    store.add({
      ...filament,
      name: "Another physical spool",
      remainingWeight: 300,
      location: "Elsewhere",
    });
    store.add({
      ...filament,
      initialWeight: 500,
      remainingWeight: 500,
      emptySpoolWeight: 150,
    });
    assert.equal(store.customFilaments().length, 1);
    const product = store.customFilaments()[0];
    assert.equal(product.source, "custom");
    assert.deepEqual(
      product.sizes.map((s) => s.initialWeight),
      [1000, 500],
    );
    assert.equal(product.sizes[0].emptySpoolWeight, 210);
    for (const field of [
      "remainingWeight",
      "openedDate",
      "location",
      "storage",
      "notes",
      "ocrText",
      "qrCodes",
    ])
      assert.equal(product[field], undefined);
    store.use(first.id, { grams: 100 });
    store.remove(first.id);
    assert.deepEqual(store.customFilaments()[0], product);
    const backup = store.backup();
    store.close();
    store = createStore(path, { seed: false });
    assert.deepEqual(store.customFilaments()[0], product);
    store.add({ ...filament, productLine: "PLA Silk" });
    store.restore(backup);
    assert.deepEqual(store.customFilaments(), [product]);
    const before = store.backup();
    const invalid = structuredClone(backup);
    invalid.customFilaments[0].sizes[0].initialWeight = -20;
    assert.throws(() => store.restore(invalid));
    assert.deepEqual(store.customFilaments(), before.customFilaments);
    assert.deepEqual(store.list(), before.spools.reverse());
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("custom text and QR brand clues work offline while conflicting polymers stay excluded", async () => {
  const store = createStore(":memory:", { seed: false });
  try {
    store.add(filament);
    const catalog = new LocalCatalog(store, null);
    const result = await catalog.match({ text: label });
    assert.equal(result.candidates[0].source, "custom");
    assert.equal(result.candidates[0].brand, "Nova Maker");
    assert.equal(result.bestCandidateId, result.candidates[0].catalogVariantId);
    const wrong = await catalog.match({
      text: label.replace("PLA Economy", "PETG Economy"),
    });
    assert.equal(wrong.candidates.length, 0);
    store.add({
      ...filament,
      brand: "Torwell",
      productLine: "Metal Filament",
      colorName: "Copper",
    });
    const qrMatch = await catalog.match({
      text: "Metal Filament\nColor: Copper\nNet Weight: 1kg",
      qrCodes: ["http://www.torwell3d.com"],
    });
    assert.equal(qrMatch.candidates[0].brand, "Torwell");
    assert.equal(
      qrMatch.bestCandidateId,
      null,
      "Missing material still requires verification",
    );
    const search = await catalog.search({
      source: "custom",
      manufacturer: "Nova",
      color: "bronze",
      weight: 1000,
    });
    assert.equal(search.items.length, 1);
    assert.equal(search.items[0].manufacturer, "Nova Factory");
    assert.equal((await catalog.search({ q: "' OR 1=1 --" })).items.length, 0);
    await assert.rejects(catalog.search({ weight: "bad" }), /Invalid weight/);
    await assert.rejects(
      catalog.match({ text: label, source: "invalid" }),
      /catalog source/,
    );
  } finally {
    store.close();
  }
});

test("successful, failed and repeated upstream updates cannot change custom definitions or stock", async () => {
  const dir = directory(),
    path = join(dir, "inventory.sqlite");
  const first = createOFDFixture(join(dir, "first.db"), {
    version: "source.1",
  });
  const second = createOFDFixture(join(dir, "second.db"), {
    version: "source.2",
  });
  let bytes = readFileSync(first);
  const store = createStore(path, { seed: false });
  const upstream = new OFDCatalog({
    directory: join(dir, "cache"),
    fetchImpl: async () => new Response(bytes),
  });
  try {
    store.add(filament);
    const custom = store.customFilaments(),
      stock = store.list();
    await upstream.sync();
    const local = new LocalCatalog(store, upstream);
    assert.equal(
      (await local.search({ source: "ofd", brand: "Add-North" })).items[0]
        .brand,
      "Add-North",
    );
    bytes = readFileSync(second);
    await upstream.sync();
    assert.equal(upstream.status().version, "source.2");
    bytes = Buffer.from("broken download");
    await assert.rejects(upstream.sync());
    assert.deepEqual(store.customFilaments(), custom);
    assert.deepEqual(store.list(), stock);
    assert.equal(
      (await local.match({ text: label })).candidates[0].catalogVariantId,
      custom[0].catalogVariantId,
    );
    assert.equal(
      (await local.getProduct(custom[0].catalogVariantId)).source,
      "custom",
    );
  } finally {
    await upstream.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("catalog references avoid copying upstream products; manual corrections become custom definitions", () => {
  const store = createStore(":memory:", { seed: true });
  try {
    assert.equal(store.customFilaments().length, 0);
    store.clearDemo();
    const spool = store.add({
      ...filament,
      catalogVariantId: "upstream-variant",
      catalogVersion: "source.1",
    });
    assert.equal(store.customFilaments().length, 0);
    store.update(spool.id, { location: "Moved" });
    assert.equal(store.customFilaments().length, 0);
    store.update(spool.id, { productLine: "PLA Special" });
    assert.equal(store.customFilaments()[0].productLine, "PLA Special");
  } finally {
    store.close();
  }
});

test("adding a new color based on a custom catalog selection keeps the original definition", () => {
  const store = createStore(":memory:", { seed: false });
  try {
    store.add(filament);
    const original = store.customFilaments()[0];
    const added = store.add({
      ...filament,
      catalogVariantId: original.catalogVariantId,
      catalogProductId: original.catalogProductId,
      catalogVersion: "custom",
      colorName: "Blue",
      colorHex: "#0055ff",
    });
    assert.equal(store.customFilaments().length, 2);
    assert.deepEqual(
      store.getCustomFilament(original.catalogVariantId),
      original,
    );
    assert.equal(store.customFilaments()[0].colorName, "Blue");
    assert.notEqual(
      store.customFilaments()[0].catalogVariantId,
      original.catalogVariantId,
    );
    assert.equal(
      added.catalogVariantId,
      store.customFilaments()[0].catalogVariantId,
    );
    assert.equal(
      store.getCustomFilament(store.get(added.id).catalogVariantId).colorName,
      "Blue",
    );
  } finally {
    store.close();
  }
});

test("existing manual inventory is learned once when the custom table is introduced", () => {
  const dir = directory(),
    path = join(dir, "inventory.sqlite");
  let store = createStore(path, { seed: false });
  try {
    store.add(filament);
    store.add({ ...filament, catalogVariantId: "upstream-variant" });
    const stock = store.list();
    store.db.exec("DROP TABLE custom_filaments");
    store.close();
    store = createStore(path, { seed: false });
    assert.equal(store.customFilaments().length, 1);
    assert.deepEqual(store.list(), stock);
    const oldBackup = store.backup();
    delete oldBackup.customFilaments;
    store.restore(oldBackup);
    assert.equal(store.customFilaments().length, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("matching considers every custom color of a product line", async () => {
  const store = createStore(":memory:", { seed: false });
  try {
    for (let i = 0; i < 40; i++)
      store.add({ ...filament, colorName: `Bronze ${i}` });
    const result = await new LocalCatalog(store, null).match({
      text: label.replace("Bronze", "Bronze 0"),
    });
    assert.equal(result.candidates[0].colorName, "Bronze 0");
  } finally {
    store.close();
  }
});

test("a Prusa spool link identifies its brand and manufacturer without guessing catalog materials or colors", async () => {
  const store = createStore(":memory:", { seed: false });
  try {
    store.add({
      ...filament,
      brand: "Prusament",
      productLine: "PLA",
      colorName: "Anthracite Grey",
    });
    store.add({
      ...filament,
      brand: "Prusament",
      material: "PETG",
      formulation: "PETG",
      productLine: "PETG",
      colorName: "Blue",
    });
    const local = new LocalCatalog(store, null);
    const result = await local.match({
      text: "Ely fa]\n\ntd ry\nor pores\n[EE\n",
      qrCodes: ["https://prusa.io/s/test-only-id"],
    });
    assert.equal(result.fields.brand, "Prusament");
    assert.equal(result.fields.manufacturer, "Prusa Research");
    assert.equal(result.fields.material, undefined);
    assert.equal(result.fields.colorName, undefined);
    assert.deepEqual(result.candidates, []);
    assert.equal(result.bestCandidateId, null);
    assert.match(result.message, /Recognized brand: Prusament/);
    assert.match(result.message, /still unknown/);
    const withLabel = await local.match({
      text: "Prusament\nPLA\nColor: Anthracite Grey",
      qrCodes: ["https://prusa.io/s/test-only-id"],
    });
    assert.equal(withLabel.candidates[0].material, "PLA");
    assert.equal(withLabel.candidates[0].colorName, "Anthracite Grey");
  } finally {
    store.close();
  }
});

test("HTTP saving teaches a custom product and a later real photo scan finds it without saving another spool", async (t) => {
  const app = createApp({
    database: ":memory:",
    seed: false,
    port: 0,
    host: "127.0.0.1",
  });
  const address = await app.listen();
  t.after(() => app.close());
  const base = `http://127.0.0.1:${address.port}`;
  const post = async (path, body) => {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.ok(response.ok, `${path}: ${await response.clone().text()}`);
    return response.json();
  };
  await post("/api/spools", filament);
  const canvas = createCanvas(1000, 420),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1000, 420);
  ctx.fillStyle = "black";
  ctx.font = "38px Arial";
  label.split("\n").forEach((line, i) => ctx.fillText(line, 40, 75 + i * 85));
  const result = await post("/api/scan", {
    image: canvas.toDataURL("image/png"),
    mode: "ocr",
    readQR: false,
  });
  assert.equal(result.catalogMatch.candidates[0].source, "custom");
  assert.equal(result.catalogMatch.candidates[0].brand, "Nova Maker");
  const id = result.catalogMatch.candidates[0].catalogVariantId;
  const product = await (
    await fetch(`${base}/api/filament-database/products/${id}`)
  ).json();
  assert.equal(product.colorName, "Bronze");
  const status = await (
    await fetch(base + "/api/filament-database/status")
  ).json();
  assert.equal(status.customCount, 1);
  const search = await (
    await fetch(base + "/api/filament-database/search?source=custom&q=Nova")
  ).json();
  assert.equal(search.items.length, 1);
  assert.equal(app.store.list().length, 1);
  assert.equal(app.store.customFilaments().length, 1);
});
