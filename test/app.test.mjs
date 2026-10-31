import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { createStore, ValidationError } from "../lib/store.mjs";
import { parseLabel } from "../lib/parser.mjs";
import { exportPreset } from "../lib/exports.mjs";
import { createApp } from "../server.mjs";
import { recognizeImage } from "../lib/recognition.mjs";

const spool = {
  name: "Test PLA",
  brand: "Bambu Lab",
  material: "PLA",
  colorHex: "#ee8833",
  initialWeight: 1000,
  remainingWeight: 800,
  emptySpoolWeight: 250,
};

test("inventory survives database reopen and demo data is never reseeded", () => {
  const directory = mkdtempSync(join(tmpdir(), "spoolspace-"));
  try {
    const path = join(directory, "test.sqlite");
    const first = createStore(path);
    assert.equal(first.list().length, 8);
    first.clearDemo();
    const saved = first.add(spool);
    first.close();
    const second = createStore(path);
    assert.equal(second.list().length, 1);
    assert.equal(second.get(saved.id).remainingWeight, 800);
    assert.equal(second.settings().demoData, false);
    second.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("print usage and total scale weights update net filament atomically", () => {
  const store = createStore(":memory:", { seed: false });
  try {
    const saved = store.add(spool);
    assert.equal(
      store.use(saved.id, { grams: 50, note: "bracket" }).remainingWeight,
      750,
    );
    assert.throws(() => store.use(saved.id, { grams: 751 }), ValidationError);
    assert.throws(() => store.use(saved.id, { grams: -10 }), ValidationError);
    assert.equal(store.get(saved.id).remainingWeight, 750);
    assert.equal(
      store.weigh(saved.id, { grossWeight: 900 }).remainingWeight,
      650,
    );
    assert.throws(
      () => store.weigh(saved.id, { grossWeight: 200 }),
      ValidationError,
    );
    assert.throws(
      () => store.update(saved.id, { remainingWeight: 1001 }),
      ValidationError,
    );
    assert.equal(store.weigh(saved.id, { grossWeight: 250 }).status, "empty");
    assert.equal(
      store.weigh(saved.id, { grossWeight: 350 }).status,
      "available",
    );
    assert.equal(
      store.activity().filter((x) => x.type === "weighed").length,
      3,
    );
    const noTare = store.add({
      ...spool,
      name: "Unknown tare",
      emptySpoolWeight: 0,
    });
    assert.throws(
      () => store.weigh(noTare.id, { grossWeight: 800 }),
      /measured empty spool weight/,
    );
  } finally {
    store.close();
  }
});

test("invalid backup preserves inventory; valid backup replaces inventory", () => {
  const store = createStore(":memory:", { seed: false });
  try {
    store.add(spool);
    store.updateSettings({ lowStockThreshold: 150, appName: "My shelf" });
    const backup = store.backup();
    assert.throws(
      () =>
        store.restore({
          version: 1,
          spools: [{ ...spool }, { ...spool, remainingWeight: -2 }],
        }),
      ValidationError,
    );
    assert.equal(store.list().length, 1);
    assert.throws(
      () =>
        store.restore({
          ...backup,
          activity: [{ ...backup.activity[0], at: "bad" }],
        }),
      ValidationError,
    );
    assert.equal(store.list().length, 1);
    store.add({ ...spool, name: "Other spool" });
    store.updateSettings({ lowStockThreshold: 300 });
    assert.equal(store.restore(backup).count, 1);
    assert.equal(store.list()[0].id, backup.spools[0].id);
    assert.equal(store.settings().lowStockThreshold, 150);
    assert.equal(store.settings().appName, "My shelf");
    assert.equal(
      store.activity().filter((item) => item.type === "added").length,
      1,
    );
    assert.equal(
      store.activity().filter((item) => item.type === "restored").length,
      1,
    );
  } finally {
    store.close();
  }
});

test("label parser extracts printed brand, material, net weight and tare separately", () => {
  const fields = parseLabel(
    "Bambu Lab PETG HF\nForest Green\n1.75mm Net weight: 1 kg\nEmpty spool weight: 250 g",
  );
  assert.equal(fields.brand, "Bambu Lab");
  assert.equal(fields.material, "PETG");
  assert.equal(fields.initialWeight, 1000);
  assert.equal(fields.emptySpoolWeight, 250);
  assert.equal(fields.colorName, "Forest Green");
  assert.equal(parseLabel("eSUN PLA+ 1.75mm 1kg White").initialWeight, 1000);
  assert.equal(parseLabel("SUNLU TPU 95A Black 500 g").material, "TPU");
  assert.equal(
    parseLabel("Polymaker PLA Matte Terracotta 1 kg").brand,
    "Polymaker",
  );
  assert.equal(
    parseLabel("PETG empty spool weight: 250 g").initialWeight,
    undefined,
  );
});

test("slicer exports require an installed parent and do not emit empty printer compatibility", () => {
  assert.throws(() => exportPreset(spool, "bambu"), ValidationError);
  const json = JSON.parse(
    exportPreset(spool, "bambu", "Generic PLA @BBL X1C").text,
  );
  assert.deepEqual(json.filament_settings_id, ["Spoolspace - Test PLA"]);
  assert.equal(json.inherits, "Generic PLA @BBL X1C");
  assert.equal(json.compatible_printers, undefined);
  assert.equal(
    JSON.parse(exportPreset(spool, "orca", "Generic PLA", "My printer").text)
      .compatible_printers[0],
    "My printer",
  );
  assert.match(
    exportPreset(spool, "prusa").text,
    /\[filament:Spoolspace - Test PLA\]/,
  );
});

test("offline OCR reads bundled sample label with local language data", async () => {
  const image =
    "data:image/png;base64," +
    readFileSync(
      new URL("./fixtures/sample-label.png", import.meta.url),
    ).toString("base64");
  const result = await recognizeImage(image);
  assert.equal(result.fields.brand, "Bambu Lab");
  assert.equal(result.fields.material, "PETG");
  assert.equal(result.fields.initialWeight, 1000);
  assert.equal(result.fields.emptySpoolWeight, 250);
  assert.equal(result.fields.colorName, "Forest Green");
  assert.equal(result.method, "Offline OCR · Tesseract");
});

test("damaged photos produce a recoverable OCR error rather than crashing the server", async () => {
  const broken = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(100)]);
  await assert.rejects(
    recognizeImage("data:image/jpeg;base64," + broken.toString("base64")),
    (error) => error instanceof ValidationError && error.status === 400,
  );
});

test("HTTP routes save real data, reject cross-origin writes and restrict QR URLs", async () => {
  const app = createApp({
    database: ":memory:",
    seed: false,
    host: "127.0.0.1",
    port: 0,
  });
  const address = await app.listen();
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path, value, headers = {}) =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(value),
    });
  try {
    const created = await request("/api/spools", spool);
    assert.equal(created.status, 201);
    const saved = await created.json();
    assert.equal(
      (await (await fetch(base + "/api/bootstrap")).json()).spools.length,
      1,
    );
    assert.equal(
      (await request(`/api/spools/${saved.id}/usage`, { grams: 25 })).status,
      200,
    );
    assert.equal(
      (await request("/api/spools", spool, { Origin: "https://bad.example" }))
        .status,
      403,
    );
    assert.equal(
      (await request("/api/spools", spool, { "Sec-Fetch-Site": "cross-site" }))
        .status,
      403,
    );
    const reboundStatus = await new Promise((resolveStatus, reject) => {
      const req = httpRequest(
        base + "/api/bootstrap",
        { headers: { Host: `evil.example:${address.port}` } },
        (response) => {
          response.resume();
          resolveStatus(response.statusCode);
        },
      );
      req.on("error", reject);
      req.end();
    });
    assert.equal(reboundStatus, 403);
    assert.equal(
      (await request("/api/spools", { ...spool, colorHex: "javascript:bad" }))
        .status,
      400,
    );
    assert.equal(
      (await fetch(base + "/api/qr?url=https%3A%2F%2Fexample.com")).status,
      400,
    );
    assert.equal(
      (
        await fetch(
          base + "/api/qr?url=" + encodeURIComponent(base + "/?scan=1"),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(
          base +
            "/api/export/" +
            saved.id +
            "?format=bambu&parent=Generic%20PLA",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/scan", {
          image: "data:image/jpeg;base64,YWJj",
          mode: "ocr",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/photo/orient", {
          image: "data:image/jpeg;base64,YWJj",
        })
      ).status,
      400,
    );
    const oriented = await request("/api/photo/orient", {
      image:
        "data:image/png;base64," +
        readFileSync(
          new URL("./fixtures/sample-label.png", import.meta.url),
        ).toString("base64"),
    });
    assert.equal(oriented.status, 200);
    assert.equal((await oriented.json()).reliable, true);
    const focused = await request("/api/photo/focus", {
      image:
        "data:image/png;base64," +
        readFileSync(
          new URL("./fixtures/sample-label.png", import.meta.url),
        ).toString("base64"),
    });
    assert.equal(focused.status, 200);
    const focus = await focused.json();
    assert.ok(focus.bounds.width > 0 && focus.bounds.width <= 1);
    assert.ok(focus.bounds.height > 0 && focus.bounds.height <= 1);
    assert.equal(
      (await (await fetch(base + "/api/bootstrap")).json()).spools.length,
      1,
    );
  } finally {
    await app.close();
  }
});
