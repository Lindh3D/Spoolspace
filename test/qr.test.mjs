import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import QRCode from "qrcode";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readQRCodes } from "../lib/qr.mjs";
import { parseQRCode, qrEvidence, mergeQRFields } from "../lib/qr-evidence.mjs";
import { OFDCatalog } from "../lib/ofd-catalog.mjs";
import { createOFDFixture } from "./helpers/ofd-fixture.mjs";
import { createApp } from "../server.mjs";
import { createStore } from "../lib/store.mjs";

const codeURL =
  "https://addnorth.com/product/PLA-Economy-Black?sku=QR-ECONOMY-BLACK";
const qrImage = async (text, options = {}) =>
  "data:image/png;base64," +
  (await QRCode.toBuffer(text, { width: 320, margin: 4, ...options })).toString(
    "base64",
  );
function workspace(t) {
  const directory = mkdtempSync(join(tmpdir(), "spoolspace-qr-test-")),
    fixture = createOFDFixture(join(directory, "source.db"));
  const db = new DatabaseSync(fixture);
  db.exec(
    "ALTER TABLE size ADD COLUMN qr_identifier TEXT; ALTER TABLE size ADD COLUMN gtin TEXT; ALTER TABLE size ADD COLUMN article_number TEXT;",
  );
  db.prepare(
    "UPDATE size SET qr_identifier=?,gtin=?,article_number=? WHERE id=?",
  ).run(codeURL, "1234567890128", "QR-ECONOMY-BLACK", "economy-black-1000");
  db.close();
  const catalog = new OFDCatalog({ directory: join(directory, "cache") });
  catalog.adoptSnapshot(fixture);
  t.after(async () => {
    await catalog.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return catalog;
}

test("local QR decoder reads rotated JPEGs, inverted codes and multiple codes without a camera API", async () => {
  const payload = "https://prusament.com/spool/test-only-id",
    normal = await qrImage(payload),
    inverted = await qrImage(payload, {
      color: { dark: "#ffffff", light: "#000000" },
    });
  assert.deepEqual((await readQRCodes([normal])).codes, [payload]);
  assert.deepEqual((await readQRCodes(["invalid image", normal])).codes, [
    payload,
  ]);
  assert.deepEqual((await readQRCodes([inverted])).codes, [payload]);
  const decoded = await loadImage(Buffer.from(normal.split(",")[1], "base64")),
    sideways = createCanvas(320, 320),
    ctx = sideways.getContext("2d");
  ctx.translate(320, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(decoded, 0, 0);
  assert.deepEqual(
    (await readQRCodes([sideways.toDataURL("image/jpeg", 0.95)])).codes,
    [payload],
  );
  const pair = createCanvas(660, 340),
    pairCtx = pair.getContext("2d");
  pairCtx.fillStyle = "white";
  pairCtx.fillRect(0, 0, 660, 340);
  pairCtx.drawImage(decoded, 0, 10);
  pairCtx.drawImage(
    await loadImage(
      Buffer.from((await qrImage(codeURL)).split(",")[1], "base64"),
    ),
    340,
    10,
  );
  assert.deepEqual(
    new Set((await readQRCodes([pair.toDataURL("image/png")])).codes),
    new Set([payload, codeURL]),
  );
});

test("manufacturer URLs provide brand clues without inventing a filament from a spool ID", () => {
  for (const [raw, brand] of [
    ["prusa.io/s/test-id", "Prusament"],
    ["https://prusament.com/spool/12345678", "Prusament"],
    [codeURL, "Add-North"],
    ["https://bambulab.com/support/spool/opaque-id", "Bambu Lab"],
    ["http://www.torwell3d.com", "Torwell"],
    ["https://www.torwelltech.com", "Torwell"],
  ]) {
    const result = parseQRCode(raw);
    assert.equal(result.brandHint, brand);
    assert.equal(result.fields.material, undefined);
    assert.equal(result.fields.colorName, undefined);
    if (brand === "Prusament")
      assert.equal(result.fields.manufacturer, "Prusa Research");
  }
  assert.equal(
    parseQRCode("https://addnorth.com.evil.example/product/PLA").brandHint,
    "",
  );
  assert.equal(parseQRCode("https://prusa3d.com/printer/").brandHint, "");
  assert.equal(
    parseQRCode("https://prusa.io.evil.example/s/test").fields.manufacturer,
    undefined,
  );
  assert.equal(parseQRCode("https://torwell3d.com.evil.example").brandHint, "");
  for (const raw of [
    "javascript:alert(1)",
    "file:///C:/private",
    "https://user:pass@addnorth.com/private",
  ])
    assert.equal(parseQRCode(raw).url, null);
  assert.equal(parseQRCode("1234567890128").url, null);
});

test("dotted Prusa-style codes decode in both polarities after reconnecting printed dots", async () => {
  const payload = "https://prusa.io/s/test01";
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const pitch = 8,
    margin = 2,
    side = (qr.modules.size + margin * 2) * pitch;
  for (const inverted of [true, false]) {
    const canvas = createCanvas(side, side),
      ctx = canvas.getContext("2d");
    ctx.fillStyle = inverted ? "#191919" : "#e2e2e2";
    ctx.fillRect(0, 0, side, side);
    ctx.fillStyle = inverted ? "#e2e2e2" : "#191919";
    for (let row = 0; row < qr.modules.size; row++) {
      for (let column = 0; column < qr.modules.size; column++) {
        if (!qr.modules.get(row, column)) continue;
        ctx.beginPath();
        ctx.arc(
          (column + margin + 0.5) * pitch,
          (row + margin + 0.5) * pitch,
          3.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    const result = await readQRCodes([canvas.toDataURL("image/jpeg", 0.85)]);
    assert.deepEqual(result.codes, [payload]);
    assert.equal(parseQRCode(result.codes[0]).brandHint, "Prusament");
  }
});

test("a small QR inside a large photo keeps enough original detail for decoding", async () => {
  const payload = "https://prusa.io/s/test01";
  const code = await loadImage(
    await QRCode.toBuffer(payload, {
      width: 58,
      margin: 2,
      errorCorrectionLevel: "M",
    }),
  );
  const photo = createCanvas(3200, 2400),
    ctx = photo.getContext("2d");
  ctx.fillStyle = "#b9b9b9";
  ctx.fillRect(0, 0, 3200, 2400);
  ctx.drawImage(code, 1100, 900);
  assert.deepEqual((await readQRCodes([photo.toDataURL("image/png")])).codes, [
    payload,
  ]);
});

test("explicit QR filament data supplements OCR but conflicts remain visible and remaining weight is ignored", () => {
  const raw = JSON.stringify({
    brand: "Add-North",
    material: "PLA",
    productLine: "PLA Economy",
    colorName: "Black",
    colorHex: "#000000",
    initialWeight: 1000,
    emptySpoolWeight: 238,
    remainingWeight: 999,
    temperatureMin: 190,
    temperatureMax: 230,
  });
  const qr = qrEvidence([raw]),
    merged = mergeQRFields({ brand: "Bambu Lab", material: "PETG" }, qr);
  assert.equal(merged.fields.brand, "Bambu Lab");
  assert.equal(merged.fields.material, "PETG");
  assert.equal(merged.fields.productLine, "PLA Economy");
  assert.equal(merged.fields.emptySpoolWeight, 238);
  assert.equal(merged.fields.remainingWeight, undefined);
  assert.equal(merged.conflicts.length, 2);
  assert.equal(
    mergeQRFields({}, qrEvidence([raw, codeURL])).fields.brand,
    undefined,
  );
});

test("exact QR, GTIN and article identifiers match a local catalog size, with conflict guards", (t) => {
  const catalog = workspace(t);
  for (const code of [
    codeURL,
    "1234567890128",
    JSON.stringify({ sku: "QR-ECONOMY-BLACK" }),
  ]) {
    const result = catalog.match({ text: "", qrCodes: [code] });
    assert.equal(result.candidates[0].catalogVariantId, "uuid-economy-black");
    assert.equal(result.candidates[0].catalogSizeId, "uuid-economy-black-1000");
    assert.equal(result.bestCandidateId, "uuid-economy-black");
    assert.match(result.candidates[0].matchMethod, /Exact QR/);
    assert.equal(result.candidates[0].remainingWeight, undefined);
  }
  const conflict = catalog.match({
    text: "Bambu Lab\nPLA Basic\nColor: Blue",
    fields: {
      brand: "Bambu Lab",
      material: "PLA",
      productLine: "PLA Basic",
      colorName: "Blue",
    },
    qrCodes: [codeURL],
  });
  assert.equal(conflict.bestCandidateId, null);
  assert.ok(conflict.candidates[0].conflicts.length);
  const unknown = catalog.match({
    text: "",
    qrCodes: ["https://prusament.com/spool/no-local-identifier"],
  });
  assert.equal(unknown.bestCandidateId, null);
  const injected = catalog.match({
    text: "",
    qrCodes: ["' OR 1=1; DROP TABLE size; --"],
  });
  assert.equal(injected.qr.exactMatches, 0);
  assert.ok(catalog.getProduct("uuid-economy-black"));
  const multi = catalog.match({ text: "", qrCodes: [codeURL, "second-code"] });
  assert.equal(multi.qr.exactMatches, 0);
});

test("HTTP scan combines real QR and OCR and keeps QR-only scans useful without saving inventory", async (t) => {
  const app = createApp({
    database: ":memory:",
    seed: false,
    host: "127.0.0.1",
    port: 0,
  });
  const address = await app.listen(),
    base = `http://127.0.0.1:${address.port}`;
  t.after(() => app.close());
  const label =
    "data:image/png;base64," +
    readFileSync(
      new URL("./fixtures/sample-label.png", import.meta.url),
    ).toString("base64");
  const request = (body) =>
    fetch(base + "/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const raw = JSON.stringify({
    brand: "Bambu Lab",
    material: "PETG",
    productLine: "PETG Basic",
    initialWeight: 1000,
  });
  const combined = await request({ image: label, qrImage: await qrImage(raw) });
  assert.equal(combined.status, 200);
  const result = await combined.json();
  assert.equal(result.fields.brand, "Bambu Lab");
  assert.equal(result.fields.material, "PETG");
  assert.match(result.text, /PETG/);
  assert.equal(result.qr.codes[0].text, raw);
  assert.equal(result.fields.remainingWeight, undefined);
  const onlyQR = await request({
    image: await qrImage(codeURL),
    mode: "ollama",
  });
  assert.equal(onlyQR.status, 200);
  const only = await onlyQR.json();
  assert.equal(only.fields.brand, "Add-North");
  assert.equal(only.fields.material, undefined);
  assert.equal(only.method, "Local QR");
  const disabled = await request({
    image: label,
    qrImage: await qrImage(raw),
    readQR: false,
  });
  assert.equal((await disabled.json()).qr.skipped, true);
  assert.equal(
    (await (await fetch(base + "/api/bootstrap")).json()).spools.length,
    0,
  );
});

test("decoded QR references round trip with inventory backups and require explicit remaining grams", () => {
  const store = createStore(":memory:", { seed: false });
  try {
    const spool = {
      name: "Test",
      brand: "Prusament",
      material: "PLA",
      qrCodes: ["prusa.io/s/test-id"],
    };
    assert.throws(() => store.add(spool), /actual remaining/);
    const added = store.add({
      ...spool,
      initialWeight: 1000,
      remainingWeight: 400,
    });
    assert.deepEqual(added.qrCodes, spool.qrCodes);
    const backup = store.backup();
    store.restore(backup);
    assert.deepEqual(store.get(added.id).qrCodes, spool.qrCodes);
    assert.throws(
      () => store.update(added.id, { qrCodes: ["x".repeat(4097)] }),
      /QR codes/,
    );
    assert.deepEqual(store.get(added.id).qrCodes, spool.qrCodes);
  } finally {
    store.close();
  }
});
