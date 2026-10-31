import test from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import {
  PrusaSpoolReports,
  parsePrusaSpool,
  prusaSpoolURL,
  mergeSpoolReport,
} from "../lib/prusa-spool.mjs";
import { parseLabel } from "../lib/parser.mjs";
import { createApp } from "../server.mjs";
import {
  prusaURL,
  prusaData,
  prusaHTML,
  noisyPrusaLabel,
} from "./helpers/prusa-report.mjs";

test("the noisy ASA label retains Signal White and its nozzle tolerance without internet", () => {
  const result = parseLabel(noisyPrusaLabel);
  assert.equal(result.material, "ASA");
  assert.equal(result.colorName, "Signal White");
  assert.equal(parseLabel("ASA SIGNAL WHITE").colorName, "Signal White");
  assert.equal(result.temperatureMin, 250);
  assert.equal(result.temperatureMax, 270);
  assert.equal(result.initialWeight, undefined);
  assert.equal(result.remainingWeight, undefined);
  assert.equal(
    parseLabel("Prusament\nASA\nSignal White\nNozzle: 260 ±10 °C").colorName,
    "Signal White",
  );
  assert.equal(
    parseLabel("PLA Economy Black\nNozzle: 210 °C").colorName,
    "Black",
  );
  assert.equal(
    parseLabel("Material: PLA\nColor: My Special White").colorName,
    "My Special White",
  );
});

test("manufacturer JSON supplies exact color, temperatures and tare while original and nominal weights remain distinct", () => {
  const result = parsePrusaSpool(prusaHTML(), {
    spoolId: "abc123ff",
    url: prusaURL,
  });
  assert.equal(result.fields.colorName, "Signal White");
  assert.equal(result.fields.colorHex, "#e3dfd9");
  assert.equal(result.fields.material, "ASA");
  assert.equal(result.fields.temperatureMin, 250);
  assert.equal(result.fields.temperatureMax, 270);
  assert.equal(result.fields.initialWeight, 866);
  assert.equal(result.fields.emptySpoolWeight, 186);
  assert.equal(result.fields.remainingWeight, undefined);
  assert.equal(result.metadata.nominalWeight, 850);
  assert.equal(result.metadata.factoryWeight, 866);
  assert.equal(result.metadata.bedMin, 100);
  assert.equal(result.metadata.bedMax, 120);
  assert.match(result.summary, /original, not current remaining/);
  assert.match(result.summary, /Source: https:\/\/prusament.com/);
  assert.throws(() =>
    parsePrusaSpool("<script>globalThis.spoolParserExecuted=true</script>", {}),
  );
  assert.equal(globalThis.spoolParserExecuted, undefined);
  assert.throws(() =>
    parsePrusaSpool(prusaHTML({ ...prusaData, sample: true }), {}),
  );
});

test("only recognized spool IDs reach the fixed endpoint; lookup respects opt out, single-code selection and its cache", async () => {
  const requests = [];
  let now = 0;
  const service = new PrusaSpoolReports({
    now: () => now,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(prusaHTML(), {
        headers: { "content-type": "text/html" },
      });
    },
  });
  for (const raw of [
    "http://127.0.0.1/private",
    "https://prusa.io.evil.example/s/abc123ff",
    "https://prusament.com:8443/spool/?spoolId=abc123ff",
    "https://user:password@prusament.com/spool/?spoolId=abc123ff",
    "https://prusa.io/s/../../admin",
    "https://prusament.com/spool/?spoolId=https://localhost",
    "file:///C:/private",
  ]) {
    assert.equal(prusaSpoolURL(raw), null);
    assert.equal(await service.lookup([raw]), null);
  }
  assert.equal(
    (await service.lookup(["prusa.io/s/abc123ff"], false)).status,
    "disabled",
  );
  assert.equal(
    await service.lookup(["prusa.io/s/abc123ff", "prusa.io/s/deadbeef"]),
    null,
  );
  assert.equal(requests.length, 0);
  await Promise.all([
    service.lookup(["prusa.io/s/abc123ff"]),
    service.lookup([prusaURL]),
  ]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, prusaURL);
  assert.equal(requests[0].options.redirect, "error");
  assert.ok(requests[0].options.signal instanceof AbortSignal);
  assert.equal(requests[0].options.body, undefined);
  await service.lookup([
    "https://prusa.io/s/abc123ff?url=http://localhost/private",
  ]);
  assert.equal(requests.length, 1);
  now = 86400001;
  await service.lookup([prusaURL]);
  assert.equal(requests.length, 2);
});

test("unavailable, redirected, malformed and oversized reports preserve offline recognition", async () => {
  for (const fetchImpl of [
    async () => {
      throw new Error("Offline");
    },
    async () =>
      new Response("redirect", {
        status: 302,
        headers: { location: "http://localhost/private" },
      }),
    async () =>
      new Response("not a report", {
        headers: { "content-type": "text/html" },
      }),
    async () =>
      new Response(prusaHTML(), {
        headers: { "content-type": "application/javascript" },
      }),
    async () =>
      new Response("x".repeat(1024 * 1024 + 1), {
        headers: { "content-type": "text/html" },
      }),
  ]) {
    const report = await new PrusaSpoolReports({ fetchImpl }).lookup([
      "prusa.io/s/abc123ff",
    ]);
    assert.equal(report.status, "unavailable");
    assert.equal(report.fields, undefined);
    const label = parseLabel(noisyPrusaLabel);
    assert.deepEqual(mergeSpoolReport(label, report).fields, label);
  }
});

test("source data refines generic color and nominal weight while keeping manual corrections and conflicting identities", () => {
  const report = parsePrusaSpool(prusaHTML(), {
    spoolId: "abc123ff",
    url: prusaURL,
  });
  const label = {
    brand: "Prusament",
    material: "ASA",
    colorName: "White",
    colorHex: "#eeeeea",
    initialWeight: 850,
    remainingWeight: 300,
  };
  const merged = mergeSpoolReport(label, report);
  assert.equal(merged.fields.colorName, "Signal White");
  assert.equal(merged.fields.colorHex, "#e3dfd9");
  assert.equal(merged.fields.initialWeight, 866);
  assert.equal(merged.fields.remainingWeight, 300);
  assert.match(merged.fields.notes, /abc123ff/);
  const corrected = mergeSpoolReport(label, report, {
    confirmed: ["colorName", "initialWeight"],
  });
  assert.equal(corrected.fields.colorName, "White");
  assert.equal(corrected.fields.initialWeight, 850);
  assert.ok(corrected.conflicts.some((c) => c.field === "colorName"));
  const blank = mergeSpoolReport(
    { brand: "Prusament", material: "ASA" },
    report,
    { confirmed: ["colorName"] },
  );
  assert.equal(blank.fields.colorName, undefined);
  const wrong = mergeSpoolReport(
    { brand: "Bambu Lab", material: "PETG", colorName: "Copper" },
    report,
  );
  assert.equal(wrong.fields.colorName, "Copper");
  assert.equal(wrong.fields.emptySpoolWeight, undefined);
  assert.ok(wrong.conflicts.some((c) => c.field === "brand"));
});

test("HTTP scans combine real QR decoding with spool reports and only teach custom data after the spool is saved", async (t) => {
  let requests = 0;
  const app = createApp({
    database: ":memory:",
    seed: false,
    host: "127.0.0.1",
    port: 0,
    spoolReportFetch: async (url) => {
      requests++;
      assert.equal(url, prusaURL);
      return new Response(prusaHTML(), {
        headers: { "content-type": "text/html" },
      });
    },
  });
  const address = await app.listen();
  t.after(() => app.close());
  const base = `http://127.0.0.1:${address.port}`;
  const post = async (path, body) => {
    const r = await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(r.status, path === "/api/spools" ? 201 : 200);
    return r.json();
  };
  const image = await QRCode.toDataURL("https://prusa.io/s/abc123ff", {
    width: 320,
    margin: 4,
  });
  const result = await post("/api/scan", { image, readSpoolInfo: true });
  assert.equal(result.fields.brand, "Prusament");
  assert.equal(result.fields.material, "ASA");
  assert.equal(result.fields.colorName, "Signal White");
  assert.equal(result.fields.colorHex, "#e3dfd9");
  assert.equal(result.fields.emptySpoolWeight, 186);
  assert.equal(result.fields.initialWeight, 866);
  assert.equal(result.fields.remainingWeight, undefined);
  assert.equal(result.qr.spoolReport.status, "ok");
  assert.equal(requests, 1);
  assert.equal(app.store.list().length, 0);
  assert.equal(app.store.customFilaments().length, 0);
  const saved = await post("/api/spools", {
    ...result.fields,
    remainingWeight: 300,
  });
  assert.equal(saved.remainingWeight, 300);
  assert.match(saved.notes, /Manufacturer|manufacturer/);
  assert.equal(app.store.customFilaments()[0].colorName, "Signal White");
  assert.equal(app.store.customFilaments()[0].sizes[0].emptySpoolWeight, 186);
  const offline = await post("/api/scan", { image, readSpoolInfo: false });
  assert.equal(offline.qr.spoolReport.status, "disabled");
  assert.equal(offline.fields.colorName, undefined);
  assert.equal(requests, 1);
  app.store.restore(app.store.backup());
  assert.match(app.store.get(saved.id).notes, /spoolId=abc123ff/);
});
