import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../lib/store.mjs";
import { createApp } from "../server.mjs";
import { parseLabel, parseRegion } from "../lib/parser.mjs";
import { materialIdentity } from "../lib/filament-normalize.mjs";
import { exportPreset } from "../lib/exports.mjs";

test("custom filament types persist independently of spools and survive backup restore", () => {
  const directory = mkdtempSync(join(tmpdir(), "spoolspace-types-")),
    path = join(directory, "inventory.sqlite");
  let store = createStore(path, { seed: false });
  try {
    const spool = store.add({
      name: "My spool",
      brand: "My brand",
      material: "PLA",
      initialWeight: 1000,
      remainingWeight: 500,
    });
    store.addMaterial({ name: " TPE " });
    store.addMaterial({ name: "pc-abs" });
    store.addMaterial({ name: "PC-ABS" });
    assert.deepEqual(store.settings().customMaterials, ["TPE", "PC-ABS"]);
    assert.deepEqual(store.get(spool.id), spool);
    for (const name of ["", " ", "x".repeat(41), "PC\nABS", 42])
      assert.throws(() => store.addMaterial({ name }));
    const backup = store.backup();
    store.addMaterial({ name: "Custom Mix" });
    store.restore(backup);
    assert.deepEqual(store.settings().customMaterials, ["TPE", "PC-ABS"]);
    assert.throws(() =>
      store.restore({
        ...backup,
        settings: { ...backup.settings, customMaterials: ["x".repeat(41)] },
      }),
    );
    assert.deepEqual(store.settings().customMaterials, ["TPE", "PC-ABS"]);
    store.close();
    store = createStore(path, { seed: false });
    assert.deepEqual(store.settings().customMaterials, ["TPE", "PC-ABS"]);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the material API saves validated names without creating an inventory spool", async (t) => {
  const app = createApp({
      database: ":memory:",
      seed: false,
      port: 0,
      host: "127.0.0.1",
    }),
    address = await app.listen();
  t.after(() => app.close());
  const base = `http://127.0.0.1:${address.port}`;
  const add = (name, headers = {}) =>
    fetch(base + "/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name }),
    });
  const saved = await add("pc-abs");
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).material, "PC-ABS");
  assert.equal((await add("")).status, 400);
  assert.equal(
    (await add("TPE", { Origin: "https://unrelated.example" })).status,
    403,
  );
  const data = await (await fetch(base + "/api/bootstrap")).json();
  assert.deepEqual(data.settings.customMaterials, ["PC-ABS"]);
  assert.equal(data.spools.length, 0);
});

test("polymer blends, TPE and arbitrary custom types retain their identity in slicer exports", () => {
  for (const name of ["PC-ABS", "TPE", "PC-PBT"]) {
    assert.equal(materialIdentity(name).material, name);
    assert.equal(
      parseLabel(`Brand: My brand\nMaterial: ${name}`).material,
      name,
    );
    assert.equal(parseRegion("material", name).material, name);
  }
  assert.equal(materialIdentity("PLA-CF").material, "PLA");
  assert.equal(materialIdentity("PC-ABS-CF").material, "PC-ABS");
  for (const material of ["PC-ABS", "TPE", "PC-PBT", "MY-PETG-BLEND"]) {
    const spool = {
      name: "Custom spool",
      brand: "Custom",
      material,
      colorHex: "#000000",
    };
    assert.equal(
      JSON.parse(exportPreset(spool, "bambu", "Installed parent").text)
        .filament_type[0],
      material,
    );
    assert.equal(
      JSON.parse(exportPreset(spool, "orca", "Installed parent").text)
        .filament_type[0],
      material,
    );
    assert.ok(
      exportPreset(spool, "prusa").text.includes(
        `filament_type = ${material}\n`,
      ),
    );
  }
});
