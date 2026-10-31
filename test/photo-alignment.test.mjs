import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { recognizeImage, readableTextBounds } from "../lib/recognition.mjs";

const script = readFileSync(
  new URL("../public/photo-alignment.js", import.meta.url),
  "utf8",
);
function workspace(
  t,
  width = 100,
  height = 100,
  source = createCanvas(width, height),
) {
  const dom = new JSDOM("<div id='target'></div>", {
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  dom.window.eval(script);
  const createElement = dom.window.document.createElement.bind(
    dom.window.document,
  );
  dom.window.document.createElement = (tag, ...args) =>
    tag === "canvas" ? createCanvas(1, 1) : createElement(tag, ...args);
  const output = createCanvas(width, height);
  const alignment = new dom.window.PhotoAlignment({
    source,
    canvas: output,
    frameWidth: width,
    frameHeight: height,
  });
  return {
    window: dom.window,
    alignment,
    source,
    output,
    target: dom.window.document.querySelector("#target"),
  };
}
const pixel = (canvas, x, y) => [
  ...canvas.getContext("2d").getImageData(x, y, 1, 1).data,
];
function pointer(window, target, type, x, y, id = 1) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: id, button: 0 });
  target.dispatchEvent(event);
}

test("rotation, zoom and pan change real output pixels without degrading the original photo", (t) => {
  const { alignment, source, output } = workspace(t);
  const ctx = source.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 100, 100);
  ctx.fillStyle = "red";
  ctx.fillRect(35, 35, 10, 10);
  const original = source.toBuffer("image/png");
  alignment.update({ angle: 90, zoom: 2, panX: 10, panY: -10 });
  assert.deepEqual(pixel(output, 80, 20), [255, 0, 0, 255]);
  assert.deepEqual(pixel(output, 40, 40), [255, 255, 255, 255]);
  assert.equal(alignment.canvas.width, 100);
  assert.equal(alignment.canvas.height, 100);
  assert.deepEqual(source.toBuffer("image/png"), original);
  alignment.reset();
  assert.deepEqual(pixel(output, 40, 40), [255, 0, 0, 255]);
  assert.deepEqual(pixel(output, 80, 20), [255, 255, 255, 255]);
});

test("a portrait template frame keeps its shape when a landscape photo rotates and fits", (t) => {
  const source = createCanvas(200, 100),
    { alignment, output } = workspace(t, 100, 200, source);
  alignment.rotate(90);
  alignment.fit();
  assert.equal(output.width, 100);
  assert.equal(output.height, 200);
  for (const [x, y] of [
    [0, 0],
    [200, 0],
    [200, 100],
    [0, 100],
  ]) {
    const point = alignment.sourceToFrame(x, y);
    assert.ok(point.x >= -0.001 && point.x <= 100.001);
    assert.ok(point.y >= -0.001 && point.y <= 200.001);
  }
  assert.ok(Math.abs(alignment.view.zoom - 2) < 0.000001);
  alignment.update({ angle: 2.5, zoom: 1.75, panX: 13, panY: -7 });
  assert.equal(alignment.view.angle, 2.5);
  assert.equal(output.width, 100);
  assert.equal(output.height, 200);
});

test("touch pan and pinch zoom respect interaction mode and cancel restores the previous position", (t) => {
  const { window, alignment, target } = workspace(t, 200, 100);
  target.getBoundingClientRect = () => ({
    left: 100,
    top: 50,
    width: 200,
    height: 100,
  });
  let enabled = false;
  alignment.bind(target, () => enabled);
  pointer(window, target, "pointerdown", 150, 75);
  pointer(window, target, "pointermove", 190, 85);
  pointer(window, target, "pointerup", 190, 85);
  assert.equal(alignment.view.panX, 0);
  enabled = true;
  pointer(window, target, "pointerdown", 150, 75);
  pointer(window, target, "pointermove", 190, 85);
  assert.ok(Math.abs(alignment.view.panX - 20) < 0.001);
  assert.ok(Math.abs(alignment.view.panY - 10) < 0.001);
  pointer(window, target, "pointercancel", 190, 85);
  assert.equal(alignment.view.panX, 0);
  assert.equal(alignment.view.panY, 0);
  pointer(window, target, "pointerdown", 150, 100, 1);
  pointer(window, target, "pointerdown", 250, 100, 2);
  pointer(window, target, "pointermove", 100, 100, 1);
  pointer(window, target, "pointermove", 300, 100, 2);
  assert.equal(alignment.view.zoom, 2);
  assert.ok(Math.abs(alignment.view.panX) < 0.001);
  pointer(window, target, "pointerup", 100, 100, 1);
  pointer(window, target, "pointerup", 300, 100, 2);
  alignment.unbind();
});

test("local OCR reads the actual aligned canvas after correcting a sideways label photo", async (t) => {
  const original = await loadImage(
    readFileSync(new URL("./fixtures/sample-label.png", import.meta.url)),
  );
  const sideways = createCanvas(original.height, original.width),
    ctx = sideways.getContext("2d");
  ctx.translate(sideways.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(original, 0, 0);
  const { alignment } = workspace(t, original.width, original.height, sideways);
  alignment.rotate(-90);
  alignment.fit();
  const result = await recognizeImage(alignment.exportImage());
  assert.equal(result.fields.brand, "Bambu Lab");
  assert.equal(result.fields.material, "PETG");
  assert.equal(result.fields.initialWeight, 1000);
});

test("OCR enhancements preserve a separate aligned color photo and emphasize text edges", (t) => {
  const { alignment, source, output } = workspace(t, 100, 100);
  const ctx = source.getContext("2d");
  ctx.fillStyle = "#b5b5b5";
  ctx.fillRect(0, 0, 100, 100);
  ctx.fillStyle = "#777777";
  ctx.fillRect(20, 20, 30, 60);
  ctx.fillStyle = "#c83232";
  ctx.fillRect(70, 10, 20, 20);
  alignment.render();
  const originalEdge = pixel(output, 20, 40)[0];
  const originalColor = pixel(output, 80, 20);
  alignment.setProcessing("enhanced");
  assert.ok(pixel(output, 20, 40)[0] < originalEdge);
  const gray = pixel(output, 80, 20);
  assert.equal(gray[0], gray[1]);
  assert.equal(gray[1], gray[2]);
  assert.deepEqual(pixel(alignment.colorCanvas, 80, 20), originalColor);
  alignment.setProcessing("binary");
  const values = new Set(
    output
      .getContext("2d")
      .getImageData(0, 0, 100, 100)
      .data.filter((_, i) => i % 4 !== 3),
  );
  assert.deepEqual([...values].sort(), [0, 255]);
  alignment.setProcessing("original");
  assert.deepEqual(pixel(output, 80, 20), originalColor);
  assert.deepEqual(pixel(source, 80, 20), originalColor);
});

test("projective correction maps four label corners to a rectangle and rejects crossed corners", (t) => {
  const { alignment, source, window } = workspace(t, 200, 160);
  const points = [
    { x: 0.2, y: 0.15 },
    { x: 0.8, y: 0.25 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.85 },
  ];
  const map = window.PhotoAlignment.cornerMap(points);
  for (const [i, u, v] of [
    [0, 0, 0],
    [1, 1, 0],
    [2, 1, 1],
    [3, 0, 1],
  ]) {
    const [x, y] = map(u, v);
    assert.ok(Math.abs(x - points[i].x) < 1e-9);
    assert.ok(Math.abs(y - points[i].y) < 1e-9);
  }
  assert.throws(
    () =>
      window.PhotoAlignment.cornerMap([
        points[0],
        points[2],
        points[1],
        points[3],
      ]),
    /clockwise/,
  );
  const ctx = source.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 200, 160);
  ctx.fillStyle = "#b02060";
  const [u, v] = map(0.5, 0.5);
  ctx.fillRect(u * 199 - 6, v * 159 - 6, 12, 12);
  alignment.render();
  alignment.rectify(points);
  assert.deepEqual(pixel(alignment.canvas, 100, 80), [176, 32, 96, 255]);
  assert.equal(alignment.canvas.width, 200);
  assert.equal(alignment.canvas.height, 160);
  alignment.reset();
  assert.equal(alignment.source, source);
  assert.equal(alignment.view.angle, 0);
});

test("radial lens correction changes bowed-edge geometry and reset restores original pixels", (t) => {
  const { alignment, source, output } = workspace(t, 100, 100);
  const ctx = source.getContext("2d");
  ctx.fillStyle = "#438960";
  ctx.fillRect(0, 0, 100, 100);
  alignment.render();
  const original = pixel(output, 2, 2);
  alignment.update({ lens: 30 });
  assert.deepEqual(pixel(output, 2, 2), [255, 255, 255, 255]);
  assert.deepEqual(pixel(alignment.colorCanvas, 50, 50), original);
  alignment.reset();
  assert.deepEqual(pixel(output, 2, 2), original);
});

test("automatic local orientation corrects quarter turns and small tilt before OCR", async (t) => {
  const original = await loadImage(
    readFileSync(new URL("./fixtures/sample-label.png", import.meta.url)),
  );
  for (const angle of [0, 90, 180, 270, 6]) {
    await t.test(`input ${angle} degrees`, async (t) => {
      const radians = (angle * Math.PI) / 180,
        width = Math.ceil(
          Math.abs(Math.cos(radians)) * original.width +
            Math.abs(Math.sin(radians)) * original.height,
        ),
        height = Math.ceil(
          Math.abs(Math.sin(radians)) * original.width +
            Math.abs(Math.cos(radians)) * original.height,
        ),
        source = createCanvas(width, height),
        ctx = source.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.translate(width / 2, height / 2);
      ctx.rotate(radians);
      ctx.drawImage(original, -original.width / 2, -original.height / 2);
      const result = await recognizeImage(
        source.toDataURL("image/png"),
        "ocr",
        "",
        { orientationOnly: true },
      );
      assert.equal(result.reliable, true, JSON.stringify(result));
      const residual =
        ((((angle + result.angle + 180) % 360) + 360) % 360) - 180;
      assert.ok(Math.abs(residual) < 2, JSON.stringify({ angle, ...result }));
      const { alignment } = workspace(t, width, height, source);
      alignment.rotate(result.angle);
      alignment.fit();
      alignment.setProcessing("enhanced");
      const read = await recognizeImage(alignment.exportImage());
      assert.equal(read.fields.brand, "Bambu Lab");
      assert.equal(read.fields.material, "PETG");
      if (angle === 0) {
        alignment.setProcessing("binary");
        const binary = await recognizeImage(alignment.exportImage());
        assert.equal(binary.fields.brand, "Bambu Lab");
        assert.equal(binary.fields.material, "PETG");
      }
    });
  }
});

test("automatic orientation leaves an unreadable photo for manual correction", async () => {
  const blank = createCanvas(240, 160),
    ctx = blank.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 240, 160);
  const result = await recognizeImage(blank.toDataURL("image/png"), "ocr", "", {
    orientationOnly: true,
  });
  assert.equal(result.reliable, false);
  assert.equal(result.angle, 0);
});

test("focusing a label uses the square frame with a margin and preserves the source", (t) => {
  const { alignment, source } = workspace(t, 100, 100);
  alignment.update({ zoom: 1.2, panX: 10, panY: -5 });
  const a = alignment.sourceToFrame(55, 40),
    b = alignment.sourceToFrame(75, 60);
  assert.equal(
    alignment.focus({
      x: a.x / 100,
      y: a.y / 100,
      width: (b.x - a.x) / 100,
      height: (b.y - a.y) / 100,
    }),
    true,
  );
  const nextA = alignment.sourceToFrame(55, 40),
    nextB = alignment.sourceToFrame(75, 60);
  assert.ok(Math.abs(nextA.x - 8) < 1e-8);
  assert.ok(Math.abs(nextB.x - 92) < 1e-8);
  assert.ok(Math.abs(nextA.y - 8) < 1e-8);
  assert.ok(Math.abs(nextB.y - 92) < 1e-8);
  assert.equal(alignment.source, source);
  assert.equal(alignment.canvas.width, alignment.canvas.height);
  assert.equal(
    alignment.focus({ x: NaN, y: 0, width: 0.1, height: 0.1 }),
    false,
  );
});

test("real OCR locates a small label and reads it after zooming into a square", async (t) => {
  const label = await loadImage(
      readFileSync(new URL("./fixtures/sample-label.png", import.meta.url)),
    ),
    source = createCanvas(1200, 1200),
    ctx = source.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1200, 1200);
  ctx.drawImage(label, 400, 600, 600, (600 * label.height) / label.width);
  const { alignment } = workspace(t, 1200, 1200, source),
    initial = await recognizeImage(alignment.exportImage(), "ocr", "", {
      focusOnly: true,
    });
  assert.ok(initial.bounds, JSON.stringify(initial));
  assert.ok(initial.bounds.width < 0.6);
  assert.ok(initial.bounds.height < 0.4);
  alignment.focus(initial.bounds);
  assert.ok(alignment.view.zoom > 1.5);
  const focused = await recognizeImage(alignment.exportImage(), "ocr", "", {
    focusOnly: true,
  });
  assert.ok(
    Math.abs(Math.max(focused.bounds.width, focused.bounds.height) - 0.84) <
      0.04,
  );
  const read = await recognizeImage(alignment.exportImage());
  assert.equal(read.fields.brand, "Bambu Lab");
  assert.equal(read.fields.material, "PETG");
  assert.equal(
    readableTextBounds({ confidence: 0, blocks: [] }, 1200, 1200),
    null,
  );
});
