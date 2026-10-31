import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { OFDCatalog, validateCatalogFile } from "../lib/ofd-catalog.mjs";
import { OFDClient } from "../lib/ofd-client.mjs";
import { createApp } from "../server.mjs";
import { materialIdentity } from "../lib/filament-normalize.mjs";
import { parseLabel } from "../lib/parser.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { createOFDFixture } from "./helpers/ofd-fixture.mjs";

function setup(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), "spoolspace-ofd-")),
    fixture = createOFDFixture(join(directory, "upstream.db"), options);
  const bytes = readFileSync(fixture);
  let fetches = 0;
  const requests = [];
  const service = new OFDCatalog({
    directory: join(directory, "cache"),
    fetchImpl: async (url, init) => {
      fetches++;
      requests.push({ url, headers: init.headers });
      return new Response(bytes, {
        status: 200,
        headers: {
          etag: '"dataset-one"',
          "content-length": String(bytes.length),
          "last-modified": "Tue, 27 Oct 2026 01:00:00 GMT",
        },
      });
    },
  });
  t.after(async () => {
    await service.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    directory,
    fixture,
    bytes,
    service,
    requests,
    fetches: () => fetches,
  };
}
test("Torwell OCR and QR evidence cannot turn generic filament text into another brand", async (t) => {
  const { service, fixture } = setup(t),
    db = new DatabaseSync(fixture);
  db.exec(
    "UPDATE brand SET name='FilamentPM',slug='filamentpm' WHERE id='other'; UPDATE variant SET name='Copper',color_hex='#F67405' WHERE id='other-economy-black';",
  );
  db.close();
  service.adoptSnapshot(fixture);
  const text =
    "— ©\n2 mam Metal Filament\nTORWELL 5 ro\n} ii adel; Eases Diameter: 1.75mm\nga 3 [IRS 3 Color: Copper\n5 Net Weight: 1kg\nwww.torwell3d.com pint temp: 190-240C";
  for (const qrCodes of [[], ["http://www.torwell3d.com"]]) {
    const result = service.match({
      text,
      qrCodes,
      fields: { brand: "FilamentPM" },
    });
    assert.equal(result.fields.brand, "Torwell");
    assert.equal(result.fields.material, undefined);
    assert.equal(result.fields.productLine, "Metal Filament");
    assert.deepEqual(result.candidates, []);
    assert.equal(result.bestCandidateId, null);
    assert.match(result.message, /Torwell/);
    assert.match(result.message, /not present/);
  }
  const noBrand = service.match({
    text: "Metal Filament\nColor: Copper\nNet Weight: 1kg",
  });
  assert.ok(noBrand.candidates.every((p) => p.fieldScores.brand === null));
  const explicitUnknown = service.match({
    text: "Brand: Unlisted Company\nPLA Economy\nColor: Copper\nNet weight: 1kg",
  });
  assert.deepEqual(explicitUnknown.candidates, []);
  const fromQR = service.match({
    text: "Color: Copper\nNet weight: 1kg",
    qrCodes: ["http://www.torwell3d.com"],
  });
  assert.equal(fromQR.fields.brand, "Torwell");
  assert.deepEqual(fromQR.candidates, []);
  const disagreement = service.match({
    text,
    qrCodes: ["https://addnorth.com/"],
  });
  assert.equal(disagreement.fields.brand, "Torwell");
  assert.deepEqual(disagreement.candidates, []);
  assert.ok(disagreement.qr.conflicts.some((c) => c.field === "brand"));
});

test("first OFD sync validates the actual schema and installs a separate SQLite cache", async (t) => {
  const { service, fetches } = setup(t);
  assert.equal(service.status().available, false);
  await service.sync();
  const status = service.status();
  assert.equal(fetches(), 1);
  assert.equal(status.available, true);
  assert.equal(status.version, "test.1");
  assert.equal(status.counts.brands, 3);
  assert.equal(status.counts.productLines, 7);
  assert.match(status.path, /open_filament_database\.db$/);
  assert.equal(validateCatalogFile(status.path).counts.colorVariants, 28);
  assert.ok(status.lastSuccessAt);
});
test("conditional updates reuse the existing file without downloading an unchanged catalog", async (t) => {
  const { service, requests } = setup(t);
  await service.sync();
  const before = readFileSync(service.path);
  service.fetch = async (_url, init) => {
    requests.push({ headers: init.headers });
    return new Response(null, { status: 304 });
  };
  await service.sync();
  assert.equal(requests.at(-1).headers["If-None-Match"], '"dataset-one"');
  assert.deepEqual(readFileSync(service.path), before);
  assert.equal(service.status().phase, "unchanged");
});
test("failed, corrupt and changed-schema downloads preserve the working cached catalog", async (t) => {
  const { service, directory } = setup(t);
  await service.sync();
  const before = readFileSync(service.path);
  for (const fetchImpl of [
    async () => {
      throw Error("Offline");
    },
    async () => new Response("this is not SQLite"),
  ]) {
    service.fetch = fetchImpl;
    await assert.rejects(service.sync());
    assert.equal(service.status().usingCached, true);
    assert.deepEqual(readFileSync(service.path), before);
    assert.ok(
      service.search({ brand: "addnorth", color: "Black" }).items.length,
    );
  }
  const bad = createOFDFixture(join(directory, "changed.db"));
  const db = new DatabaseSync(bad);
  db.exec("ALTER TABLE variant RENAME COLUMN color_hex TO renamed_color");
  db.close();
  service.fetch = async () => new Response(readFileSync(bad));
  await assert.rejects(service.sync(), /column variant.color_hex/);
  assert.deepEqual(readFileSync(service.path), before);
});
test("automatic update checks happen at most once in 24 hours, including failed checks", async (t) => {
  const { service, fetches } = setup(t);
  let now = Date.parse("2026-10-27T10:00:00Z");
  service.now = () => now;
  await service.sync();
  service.startAutomatic();
  assert.equal(fetches(), 1);
  now += 23 * 60 * 60 * 1000;
  service.maybeSync();
  assert.equal(fetches(), 1);
  now += 60 * 60 * 1000;
  service.maybeSync();
  await service.syncPromise;
  assert.equal(fetches(), 2);
  service.configure({ autoUpdate: false });
  now += 48 * 60 * 60 * 1000;
  service.maybeSync();
  assert.equal(fetches(), 2);
  let failures = 0;
  service.fetch = async () => {
    failures++;
    throw Error("Offline");
  };
  service.configure({ autoUpdate: true });
  if (service.syncPromise) await service.syncPromise.catch(() => {});
  assert.equal(failures, 1);
  service.maybeSync();
  assert.equal(failures, 1);
});
test("cached search is offline, case-insensitive, parameterized and maps only supplied values", async (t) => {
  const { service } = setup(t);
  await service.sync();
  service.fetch = async () => {
    throw Error("No network allowed during search");
  };
  const black = service.search({
    brand: "ADD NORTH",
    productLine: "economy",
    color: "black",
    material: "PLA",
    vendor: "test shop",
    weight: 1000,
  }).items[0];
  assert.equal(black.brand, "Add-North");
  assert.equal(black.colorName, "Black");
  assert.equal(black.manufacturer, null);
  assert.equal(black.sizes[0].emptySpoolWeight, 238);
  assert.deepEqual(black.vendors, ["Local Test Shop"]);
  const missing = service.search({
    brand: "BambuLabs",
    productLine: "Basic",
    color: "#000000",
  }).items[0];
  assert.equal(missing.temperatureMin, null);
  assert.equal(missing.sizes[0].emptySpoolWeight, null);
  assert.equal(service.search({ manufacturer: "unknown" }).items.length, 0);
  assert.equal(
    service.search({ q: "' OR 1=1; DROP TABLE brand; --" }).items.length,
    0,
  );
  assert.equal(service.status().counts.brands, 3);
});
test("noisy real label text matches brand, PLA Economy and Black without turning noise into fields", async (t) => {
  const { service } = setup(t);
  await service.sync();
  const text = `od be "8 000 0 Sa\ned Yee Sse yy (&\nRT Po pT yids\nOPA To, - :\nwr . —\nbay 08 =\nP add:north\nv 3D-F AMENT\nPLA Economy\nDiameter [175 mem a\nColor | Biack FR\nSedtemn | Motori 050 Bias\n: 20 2031302238062\nA UO`;
  const result = service.match({ text });
  assert.equal(result.originalText, text);
  assert.ok(result.candidates.length <= 5);
  const best = result.candidates[0];
  assert.equal(best.brand, "Add-North");
  assert.equal(best.material, "PLA");
  assert.equal(best.productLine, "PLA Economy");
  assert.equal(best.colorName, "Black");
  assert.ok(best.score >= 95);
  assert.ok(best.consistent);
  assert.equal(best.manufacturer, null);
  assert.equal(best.remainingWeight, undefined);
  assert.match(best.catalogVariantId, /uuid/);
});
test("the requested fuzzy Glitz example ranks an existing row and never invents an absent product", async (t) => {
  const { service } = setup(t);
  await service.sync();
  const result = service.match({ text: "Add Nort89 PETG Glitz Grey 1kg" });
  assert.equal(result.candidates[0].brand, "Add-North");
  assert.equal(result.candidates[0].productLine, "PETG Glitz");
  assert.equal(result.candidates[0].colorName, "Grey");
  assert.ok(result.candidates[0].score >= 80);
  assert.equal(result.candidates[0].initialWeight, 1000);
  assert.equal(
    service.match({ text: "Add-North PETG Glitz Emerald 1kg" }).bestCandidateId,
    null,
  );
});
test("base material normalization retains formulation distinctions and avoids net/gross confusion", () => {
  for (const [text, base] of [
    ["PLA+", "PLA"],
    ["PLA-CF", "PLA"],
    ["PETG-HF", "PETG"],
    ["PA12-CF", "PA"],
    ["TPU 95A", "TPU"],
  ]) {
    const value = materialIdentity(text);
    assert.equal(value.material, base);
    assert.equal(value.formulation, text);
  }
  assert.equal(
    parseLabel("PLA\nGross weight 1250g\nTare 250g").initialWeight,
    undefined,
  );
  assert.equal(
    parseLabel("PLA\nGross weight: 1250g\nTare: 250g").initialWeight,
    undefined,
  );
  assert.equal(
    parseLabel("PLA\nSpool weight: 1250g").emptySpoolWeight,
    undefined,
  );
  assert.equal(
    parseLabel("PLA\nNet weight: 1000g\nGross weight: 1250g").initialWeight,
    1000,
  );
});
test("color codes, formulations and contradictory weights cannot become strong false matches", async (t) => {
  const { service, fixture } = setup(t);
  const db = new DatabaseSync(fixture);
  db.exec("ALTER TABLE variant ADD COLUMN color_standards TEXT");
  db.prepare("UPDATE variant SET color_standards=? WHERE id=?").run(
    '{"ral":"9005"}',
    "economy-black",
  );
  db.close();
  service.fetch = async () => new Response(readFileSync(fixture));
  await service.sync();
  assert.equal(
    service.search({ q: "Add North PLA Economy RAL9005" }).items[0].colorName,
    "Black",
  );
  assert.equal(
    service.match({ text: "Add-North PLA Economy\nColor: RAL 9005" })
      .candidates[0].colorName,
    "Black",
  );
  const mismatch = service.match({ text: "Add-North PLA Economy Black 750g" });
  assert.equal(mismatch.candidates[0].sizeConflict, true);
  assert.equal(mismatch.bestCandidateId, null);
  assert.equal(mismatch.candidates[0].catalogSizeId, null);
  assert.ok(mismatch.candidates[0].score < 80);
  assert.ok(
    service
      .match({ text: "Add-North PLA+ Black" })
      .candidates.every((p) => p.productLine === "PLA+"),
  );
  const confirmed = service.match({
    text: "Add-North PLA Economy Color: Black",
    regions: [
      {
        id: "color",
        field: "colorName",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        value: "Blue",
      },
    ],
  });
  assert.equal(confirmed.candidates[0].colorName, "Blue");
});
test("clear label text outranks contradictory model guesses, while confirmed template corrections take precedence", async (t) => {
  const { service } = setup(t);
  await service.sync();
  const text = "Add-North PLA Economy\nColor: Black";
  const uncertain = service.match({
    text,
    fields: {
      brand: "Bambu Lab",
      material: "PETG",
      productLine: "PLA Basic",
      colorName: "Blue",
    },
  });
  assert.equal(uncertain.candidates[0].brand, "Add-North");
  assert.equal(uncertain.candidates[0].productLine, "PLA Economy");
  assert.equal(uncertain.candidates[0].colorName, "Black");
  const regions = [
    ["brand", "Bambu Lab"],
    ["material", "PLA"],
    ["productLine", "PLA Basic"],
    ["colorName", "Blue"],
  ].map(([field, value]) => ({
    id: field,
    field,
    value,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  }));
  const confirmed = service.match({ text, regions });
  assert.equal(confirmed.candidates[0].brand, "Bambu Lab");
  assert.equal(confirmed.candidates[0].productLine, "PLA Basic");
  assert.equal(confirmed.candidates[0].colorName, "Blue");
});

test("E-PLA text excludes PETG from fuzzy and exact QR catalog recommendations", async (t) => {
  const { service, fixture } = setup(t),
    db = new DatabaseSync(fixture);
  db.prepare("UPDATE filament SET name=? WHERE id=?").run("E-PLA", "economy");
  db.exec("ALTER TABLE size ADD COLUMN qr_identifier TEXT");
  db.prepare("UPDATE size SET qr_identifier=? WHERE id=?").run(
    "urn:spool:petg-only",
    "glitz-black-1000",
  );
  db.close();
  service.adoptSnapshot(fixture);
  for (const variant of ["E-PLA", "ePLA", "E\u2011PLA", "E-PL A"]) {
    const result = service.match({
      text: `Add-North\n${variant}\nColor: Black\nNet weight: 1kg`,
      fields: { material: "PETG", productLine: "PETG Glitz" },
      qrCodes: ["urn:spool:petg-only"],
    });
    assert.equal(result.fields.material, "PLA", variant);
    assert.equal(result.fields.productLine, variant, variant);
    assert.ok(result.candidates.length, variant);
    assert.ok(
      result.candidates.every((p) => p.material === "PLA"),
      variant,
    );
    assert.equal(result.candidates[0].productLine, "E-PLA", variant);
    assert.equal(result.qr.excludedMaterials.length, 1, variant);
    assert.equal(result.qr.excludedMaterials[0].material, "PETG", variant);
    assert.match(result.message, /PETG entries were excluded/);
  }
});
test("photo recognition is enriched with real local catalog matches but never saves inventory", async (t) => {
  const { service } = setup(t);
  await service.sync();
  const app = createApp({
    database: ":memory:",
    seed: false,
    port: 0,
    host: "127.0.0.1",
    filamentCatalog: service,
  });
  const address = await app.listen();
  const canvas = createCanvas(1200, 450),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1200, 450);
  ctx.fillStyle = "black";
  ctx.font = "bold 52px Arial";
  ["Add-North", "PLA Economy", "Color: Black", "Net weight: 1kg"].forEach(
    (line, i) => ctx.fillText(line, 50, 80 + i * 85),
  );
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: canvas.toDataURL("image/png"),
        mode: "ocr",
      }),
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.catalogMatch.candidates[0].productLine, "PLA Economy");
    assert.equal(result.catalogMatch.candidates[0].colorName, "Black");
    assert.equal(result.catalogMatch.originalText, result.text);
    assert.equal(app.store.list().length, 0);
    assert.throws(
      () =>
        app.store.add({
          name: "Unconfirmed",
          catalogVariantId: "uuid-economy-black",
          initialWeight: 1000,
        }),
      /remaining/,
    );
    assert.equal(
      app.store.add({
        name: "High-temperature source entry",
        initialWeight: 1000,
        remainingWeight: 100,
        temperatureMax: 480,
      }).temperatureMax,
      480,
    );
  } finally {
    await app.close();
  }
});
test("catalog worker reuses the local file and HTTP updates never replace the user inventory", async (t) => {
  const { directory, service } = setup(t);
  await service.sync();
  const worker = new OFDClient(join(directory, "cache"));
  assert.equal((await worker.status()).version, "test.1");
  assert.ok(
    (await worker.search({ brand: "Add North", color: "Black" })).items.length,
  );
  await worker.close();
  const app = createApp({
    database: join(directory, "inventory.sqlite"),
    seed: false,
    port: 0,
    host: "127.0.0.1",
    filamentCatalog: service,
  });
  const address = await app.listen();
  const spool = app.store.add({
    name: "My used spool",
    brand: "My own",
    initialWeight: 1000,
    remainingWeight: 123,
    emptySpoolWeight: 0,
  });
  try {
    const base = `http://127.0.0.1:${address.port}`;
    const response = await fetch(base + "/api/filament-database/sync", {
      method: "POST",
    });
    assert.equal(response.status, 202);
    if (service.syncPromise) await service.syncPromise;
    const matched = await (
      await fetch(base + "/api/filament-database/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "add:north PLA Economy Color | Biack" }),
      })
    ).json();
    assert.equal(matched.candidates[0].productLine, "PLA Economy");
    assert.equal(app.store.get(spool.id).remainingWeight, 123);
    assert.equal(app.store.list().length, 1);
    assert.notEqual(service.path, join(directory, "inventory.sqlite"));
  } finally {
    await app.close();
  }
});
test("a failed catalog worker fails fast while the HTTP inventory remains available", async (t) => {
  const { directory, service } = setup(t);
  await service.sync();
  const client = new OFDClient(join(directory, "cache"));
  await client.status();
  await client.worker.terminate();
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(client.status(), /catalog worker stopped/);
  const app = createApp({
    database: ":memory:",
    seed: false,
    port: 0,
    host: "127.0.0.1",
    filamentCatalog: client,
  });
  const address = await app.listen();
  try {
    app.store.add({
      name: "Still here",
      initialWeight: 1000,
      remainingWeight: 432,
    });
    const boot = await (
      await fetch(`http://127.0.0.1:${address.port}/api/bootstrap`)
    ).json();
    assert.equal(boot.spools[0].remainingWeight, 432);
    assert.equal(boot.filamentDatabase.available, false);
  } finally {
    await app.close();
  }
  const collision = join(directory, "open_filament_database.db");
  assert.throws(
    () => createApp({ database: collision, catalogDirectory: directory }),
    /separate/,
  );
  assert.equal(existsSync(collision), false);
});
