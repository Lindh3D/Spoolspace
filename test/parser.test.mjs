import test from "node:test";
import assert from "node:assert/strict";
import { parseLabel, parseRegion } from "../lib/parser.mjs";
import { exportPreset } from "../lib/exports.mjs";
import { materialIdentity } from "../lib/filament-normalize.mjs";
import { recognizeImage } from "../lib/recognition.mjs";
import { readFileSync } from "node:fs";

test("E-PLA variants retain their printed range name and use PLA as the base polymer", () => {
  for (const variant of [
    "E-PLA",
    "ePLA",
    "E PLA",
    "E\u2011PLA",
    "E-PL A",
    "E-P L A",
  ]) {
    const fields = parseLabel(
      `Add-North\n${variant}\nColor: Black\nNet weight: 1kg`,
    );
    assert.equal(fields.material, "PLA", variant);
    assert.equal(fields.productLine, variant, variant);
    assert.equal(parseRegion("material", variant).material, "PLA", variant);
    assert.equal(materialIdentity(variant).material, "PLA", variant);
    assert.notEqual(materialIdentity(variant).formulation, "PLA", variant);
  }
  assert.equal(parseLabel("MyPLA Company").material, undefined);
});

test("local AI field guesses cannot replace clearly transcribed E-PLA with PETG", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => (globalThis.fetch = originalFetch));
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        response: JSON.stringify({
          text: "Add-North\nE-PLA\nColor: Black",
          fields: {
            brand: "Add-North",
            material: "PETG",
            productLine: "PETG Glitz",
            name: "Add-North PETG Glitz Black",
          },
        }),
      }),
    );
  const photo =
    "data:image/png;base64," +
    readFileSync(
      new URL("./fixtures/sample-label.png", import.meta.url),
    ).toString("base64");
  const result = await recognizeImage(photo, "ollama", "test-local-model");
  assert.equal(result.fields.material, "PLA");
  assert.equal(result.fields.productLine, "E-PLA");
  assert.equal(result.fields.name, "Add-North · E-PLA · Black");
});

test("Torwell label retains its printed brand and metal description without assuming PLA", () => {
  const fields = parseLabel(
    "— ©\n2 mam Metal Filament\nTORWELL 5 ro\n} ii adel; Eases Diameter: 1.75mm\nga 3 [IRS 3 Color: Copper\n5 Net Weight: 1kg\nwww.torwell3d.com pint temp: 190-240C",
  );
  assert.equal(fields.brand, "Torwell");
  assert.equal(fields.productLine, "Metal Filament");
  assert.equal(fields.colorName, "Copper");
  assert.equal(fields.initialWeight, 1000);
  assert.equal(fields.temperatureMin, 190);
  assert.equal(fields.temperatureMax, 240);
  assert.equal(fields.material, undefined);
  assert.equal(fields.manufacturer, undefined);
  assert.equal(fields.vendor, undefined);
  assert.equal(fields.name, "Torwell · Metal Filament · Copper");
});

test("a new brand can be corroborated by its printed website without treating generic label words as brands", () => {
  assert.equal(
    parseLabel("NEONWORKS\nPLA\nwww.neonworks3d.com").brand,
    "NEONWORKS",
  );
  assert.equal(
    parseLabel("Metal Filament\nColor: Copper\nNet weight: 1kg").brand,
    undefined,
  );
  assert.equal(parseLabel("PLA\nwww.neonworks3d.com").brand, undefined);
});

test("material remains PLA while marketed PLA product lines are retained", () => {
  for (const variant of [
    "X-PLA",
    "PLA Economy",
    "PLA Basic",
    "PLA Matte",
    "PLA matt",
    "PLA+",
    "PLA Plus",
    "PLA-CF",
  ]) {
    const fields = parseLabel(`Bambu Lab\n${variant}\nBlack\nNet weight: 1kg`);
    assert.equal(fields.material, "PLA", variant);
    assert.equal(fields.productLine, variant, variant);
    assert.ok(fields.name.includes(variant), variant);
    assert.equal(fields.initialWeight, 1000);
  }
  assert.equal(parseLabel("Bambu Lab PLA Black").productLine, undefined);
  assert.equal(parseLabel("MyPLA Company").material, undefined);
});

test("labelled company fields support unknown companies without guessing their roles", () => {
  const fields = parseLabel(
    "Brand: NeonWorks\nVendor: Shelf Supply\nManufacturer: Polymer Works AB\nMaterial: PLA\nProduct line: PLA Economy\nColor: Moonlight Silver",
  );
  assert.equal(fields.brand, "NeonWorks");
  assert.equal(fields.vendor, "Shelf Supply");
  assert.equal(fields.manufacturer, "Polymer Works AB");
  assert.equal(fields.material, "PLA");
  assert.equal(fields.productLine, "PLA Economy");
  assert.equal(fields.colorName, "Moonlight Silver");
  assert.equal(parseLabel("MYSTERY COMPANY\nPLA Basic").brand, undefined);
  assert.equal(parseLabel("Vendor: Shelf Supply\nPLA").brand, undefined);
  const oneLine = parseLabel(
    "Brand: NeonWorks; Vendor: Shop; Material: PLA; Filament brand: X-PLA",
  );
  assert.equal(oneLine.brand, "NeonWorks");
  assert.equal(oneLine.productLine, "X-PLA");
  assert.equal(oneLine.vendor, "Shop");
});

test("nozzle ranges are separated from bed and drying temperatures", () => {
  for (const range of [
    "190-220°C",
    "190–220 °C",
    "190 ~ 220 C",
    "190 to 220 C",
  ]) {
    const fields = parseLabel(
      `PLA Basic\nDrying: 45-55 C\nBed: 50-70 C\nNozzle temperature: ${range}`,
    );
    assert.equal(fields.temperatureMin, 190, range);
    assert.equal(fields.temperatureMax, 220, range);
  }
  assert.equal(
    parseLabel("PLA\nBed temperature: 50-70 C\nDrying: 45-55 C").temperatureMin,
    undefined,
  );
  assert.equal(
    parseLabel("PLA\nPrinting temperature: 220-190 C").temperatureMin,
    undefined,
  );
  assert.equal(parseLabel("PLA\nNozzle: 190-530 C").temperatureMin, undefined);
  assert.equal(parseLabel("PLA\nNozzle: 390-430 F").temperatureMin, undefined);
  assert.equal(parseLabel("190-220 C").temperatureMin, undefined);
  assert.deepEqual(parseRegion("temperatureRange", "190-220°C"), {
    temperatureMin: 190,
    temperatureMax: 220,
  });
});

test("annotated regions read unfamiliar company and color text directly", () => {
  assert.deepEqual(parseRegion("brand", "NEONWORKS"), { brand: "NEONWORKS" });
  assert.deepEqual(parseRegion("vendor", "Vendor: Shelf Supply"), {
    vendor: "Shelf Supply",
  });
  assert.deepEqual(parseRegion("manufacturer", "Made by: Polymer Works AB"), {
    manufacturer: "Polymer Works AB",
  });
  assert.deepEqual(parseRegion("productLine", "PLA Economy"), {
    productLine: "PLA Economy",
  });
  assert.deepEqual(parseRegion("material", "X-PLA"), {
    material: "PLA",
    productLine: "X-PLA",
  });
  assert.deepEqual(parseRegion("colorName", "Ocean Mist"), {
    colorName: "Ocean Mist",
  });
  assert.deepEqual(parseRegion("initialWeight", "1,1 kg"), {
    initialWeight: 1100,
  });
  assert.deepEqual(parseRegion("emptySpoolWeight", "250"), {
    emptySpoolWeight: 250,
  });
  assert.deepEqual(parseRegion("material", "Unreadable"), {});
  assert.deepEqual(parseRegion("temperatureRange", "no readable text"), {});
});

test("variant exports keep the base material and inherit calibrated temperatures", () => {
  const spool = {
    name: "NeonWorks spool",
    brand: "NeonWorks",
    material: "PLA",
    productLine: "X-PLA",
    colorHex: "#ee8833",
    temperatureMin: 190,
    temperatureMax: 220,
  };
  const exported = JSON.parse(
    exportPreset(spool, "bambu", "Generic PLA @BBL X1C").text,
  );
  assert.equal(exported.filament_type[0], "PLA");
  assert.match(exported.name, /X-PLA/);
  assert.equal(exported.nozzle_temperature, undefined);
  assert.equal(exported.inherits, "Generic PLA @BBL X1C");
  assert.equal(
    JSON.parse(
      exportPreset({ ...spool, material: "PLA Matte" }, "orca", "Generic PLA")
        .text,
    ).filament_type[0],
    "PLA",
  );
});
