// Render only this project's isolated, in-memory demo app. Never attach to an
// existing browser profile or open a real inventory to make public screenshots.
import { chromium } from "playwright-core";
import { createCanvas } from "@napi-rs/canvas";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = resolve(root, "docs/screenshots");
await mkdir(output, { recursive: true });
const app = createApp({
  database: ":memory:",
  seed: false,
  catalogDirectory: null,
  catalogAutoUpdate: false,
  host: "127.0.0.1",
  port: 0,
});
const ago = (days) =>
  new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
app.store.updateSettings({
  appName: "Spoolspace Demo",
  lowStockThreshold: 200,
});
const example = {
  name: "PLA Matte · Charcoal",
  brand: "Bambu Lab",
  manufacturer: "Bambu Lab",
  material: "PLA",
  productLine: "PLA Matte",
  colorName: "Charcoal",
  colorHex: "#343d40",
  initialWeight: 1000,
  emptySpoolWeight: 250,
  temperatureMin: 190,
  temperatureMax: 230,
  storage: "Sealed bag",
  notes:
    "Documentation demo. Example weights only; verify your physical spool.",
};
const charcoal = app.store.add({
  ...example,
  remainingWeight: 640,
  location: "AMS · Slot 2",
  storage: "AMS",
  openedDate: ago(10),
  status: "in-use",
  lastDriedAt: ago(3),
});
for (let i = 1; i <= 3; i++)
  app.store.add({
    ...example,
    remainingWeight: 1000,
    location: `Shelf A · Box 0${i}`,
    status: "available",
  });
for (const data of [
  [
    "PETG HF · Forest Green",
    "Bambu Lab",
    "PETG",
    "PETG HF",
    "Forest Green",
    "#46745b",
    920,
    "Dry box",
  ],
  [
    "PLA · Terracotta",
    "Polymaker",
    "PLA",
    "PolyTerra",
    "Terracotta",
    "#ce775d",
    350,
    "Sealed bag",
  ],
  [
    "PETG · Prusa Orange",
    "Prusament",
    "PETG",
    "PETG",
    "Prusa Orange",
    "#f48c37",
    165,
    "Open shelf",
  ],
  [
    "TPU 95A · Sky Blue",
    "eSUN",
    "TPU",
    "TPU 95A",
    "Sky Blue",
    "#76aebe",
    780,
    "Sealed bag",
  ],
  [
    "PLA Silk · Copper",
    "eSUN",
    "PLA",
    "PLA Silk",
    "Copper",
    "#ac7555",
    95,
    "Dry box",
  ],
]) {
  const [
    name,
    brand,
    material,
    productLine,
    colorName,
    colorHex,
    remainingWeight,
    storage,
  ] = data;
  app.store.add({
    name,
    brand,
    manufacturer: brand,
    material,
    productLine,
    colorName,
    colorHex,
    remainingWeight,
    storage,
    initialWeight: 1000,
    emptySpoolWeight: 220,
    location: "Shelf B · Box 02",
    openedDate: ago(35),
    lastDriedAt: ago(30),
    notes: "Documentation demo. Example tare only.",
  });
}
const canvas = createCanvas(1000, 1000),
  ctx = canvas.getContext("2d");
ctx.fillStyle = "#f5f2e9";
ctx.fillRect(0, 0, 1000, 1000);
ctx.fillStyle = "#ffffff";
ctx.fillRect(65, 65, 870, 870);
ctx.strokeStyle = "#1e2e27";
ctx.lineWidth = 3;
ctx.strokeRect(65, 65, 870, 870);
ctx.fillStyle = "#162c26";
ctx.fillRect(65, 65, 870, 70);
ctx.fillStyle = "#fff";
ctx.font = "bold 25px Arial";
ctx.fillText("DOCUMENTATION DEMO LABEL", 105, 110);
ctx.fillStyle = "#172a27";
for (const [text, size, y] of [
  ["add:north", 76, 245],
  ["PLA Economy", 58, 375],
  ["Color: Black", 46, 475],
  ["Nozzle: 200-220 C", 40, 585],
  ["Diameter: 1.75 mm", 40, 675],
  ["Net weight: 1 kg", 40, 765],
]) {
  ctx.font = `bold ${size}px Arial`;
  ctx.fillText(text, 110, y);
}
ctx.font = "24px Arial";
ctx.fillText("SAMPLE DATA - NOT A MANUFACTURER LABEL", 110, 875);
const label = canvas.toDataURL("image/png");
app.store.saveTemplate({
  name: "Demo PLA label layout",
  exampleImage: label,
  regions: [
    {
      field: "brand",
      x: 0.1,
      y: 0.165,
      width: 0.7,
      height: 0.11,
      value: "add:north",
    },
    {
      field: "productLine",
      x: 0.1,
      y: 0.31,
      width: 0.75,
      height: 0.095,
      value: "PLA Economy",
    },
    {
      field: "colorName",
      x: 0.1,
      y: 0.42,
      width: 0.7,
      height: 0.075,
      value: "Black",
    },
    {
      field: "temperatureRange",
      x: 0.1,
      y: 0.53,
      width: 0.75,
      height: 0.08,
      value: "200-220 C",
    },
  ],
});
let browser;
try {
  const address = await app.listen(),
    base = `http://127.0.0.1:${address.port}`;
  const installed = [
    process.env.SPOOLSPACE_DOCS_BROWSER,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((path) => path && existsSync(path));
  if (!installed)
    throw new Error(
      "Set SPOOLSPACE_DOCS_BROWSER to an installed Chrome/Edge executable.",
    );
  browser = await chromium.launch({
    executablePath: installed,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    deviceScaleFactor: 1,
    locale: "en-GB",
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) =>
    route
      .request()
      .url()
      .startsWith(base + "/")
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.locator(".spool-card").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  const shot = async (name, locator = page) => {
    await locator.screenshot({
      path: resolve(output, name + ".png"),
      animations: "disabled",
    });
    console.log(`Captured ${name}.png`);
  };
  await shot("inventory");
  await page.locator("article.spool-group-card").click();
  await page.locator(".group-stock").waitFor();
  await shot("grouped-spools", page.locator("#modal"));
  await page.locator("#modal [data-action=close]").first().click();
  await page.locator("article.spool-group-card").click();
  await page.locator(`[data-detail="${charcoal.id}"]`).first().click();
  await page.locator("#gross-weight").fill("890");
  await shot("spool-details", page.locator("#modal"));
  await page.locator("#modal [data-action=close]").first().click();
  await page.locator('[data-action="scan"]').first().click();
  await page.locator("#scan-read-spool-info").uncheck();
  await page.locator("#scan-file").setInputFiles({
    name: "demo-label.png",
    mimeType: "image/png",
    buffer: canvas.toBuffer("image/png"),
  });
  await page.waitForFunction(
    () =>
      document
        .querySelector("#read-label")
        ?.textContent.includes("Review & add spool"),
    { timeout: 90000 },
  );
  if (await page.locator(".photo-guide[open]").count())
    await page.locator(".photo-guide summary").click();
  await page.locator("#modal .modal-body").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.locator("#read-label").click();
  await page.locator("#spool-form").waitFor();
  await shot("scan-label", page.locator("#modal"));
  await page.locator("#modal [data-action=close]").first().click();
  await page.locator('[data-view="templates"]').first().click();
  await page.locator("[data-edit-template]").first().click();
  await page.locator("#region-editor canvas").waitFor();
  await shot("label-template", page.locator("#modal"));
  await page.locator("#modal [data-action=close]").first().click();
  await page.locator('[data-view="drying"]').first().click();
  await page.locator(".dry-row").first().waitFor();
  await shot("drying-room");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.locator(".spool-card").first().waitFor();
  await shot("phone-inventory");
  await page.locator('[data-view="settings"]:visible').first().click();
  await page.locator("#phone-install-panel h2").waitFor();
  await shot("phone-shortcut", page.locator("#phone-install-panel"));
  if (errors.length)
    throw new Error(
      "Browser errors during documentation capture: " + errors.join("; "),
    );
  console.log(
    "Screenshots contain only in-memory demo data; no external requests or real inventory were used.",
  );
} finally {
  await browser?.close();
  await app.close();
}
