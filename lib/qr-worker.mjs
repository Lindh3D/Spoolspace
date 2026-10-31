import { parentPort, workerData } from "node:worker_threads";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import jsQR from "jsqr";
import { reconnectQRDots } from "./qr-pixels.mjs";

const codes = [];
function decode(image) {
  const { width, height } = image;
  let decoded = false;
  for (let count = 0; count < 5; count++) {
    const found = jsQR(image.data, width, height, {
      inversionAttempts: "attemptBoth",
    });
    if (!found) break;
    decoded = true;
    if (found.data && found.data.length <= 4096 && !codes.includes(found.data))
      codes.push(found.data);
    const corners = [
      found.location.topLeftCorner,
      found.location.topRightCorner,
      found.location.bottomLeftCorner,
      found.location.bottomRightCorner,
    ];
    const left = Math.max(
      0,
      Math.floor(Math.min(...corners.map((p) => p.x))) - 3,
    );
    const right = Math.min(
      width,
      Math.ceil(Math.max(...corners.map((p) => p.x))) + 3,
    );
    const top = Math.max(
      0,
      Math.floor(Math.min(...corners.map((p) => p.y))) - 3,
    );
    const bottom = Math.min(
      height,
      Math.ceil(Math.max(...corners.map((p) => p.y))) + 3,
    );
    for (let y = top; y < bottom; y++)
      image.data.fill(255, (y * width + left) * 4, (y * width + right) * 4);
    if (codes.length >= 5) break;
  }
  return decoded;
}
try {
  for (const bytes of workerData.images) {
    const source = await loadImage(Buffer.from(bytes));
    const tried = new Set();
    let decoded = false,
      repairImage = null;
    // Fast passes first, then preserve detail for small codes in large photos.
    for (const bound of [1800, 1000, 3200]) {
      if (bound === 3200 && decoded) break;
      const scale = Math.min(1, bound / Math.max(source.width, source.height)),
        width = Math.max(1, Math.round(source.width * scale)),
        height = Math.max(1, Math.round(source.height * scale)),
        dimensions = `${width}x${height}`;
      if (tried.has(dimensions)) continue;
      tried.add(dimensions);
      const canvas = createCanvas(width, height),
        ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(source, 0, 0, width, height);
      const image = ctx.getImageData(0, 0, width, height);
      decoded = decode(image) || decoded;
      if (
        !repairImage ||
        width * height > repairImage.width * repairImage.height
      )
        repairImage = image;
      if (codes.length >= 5) break;
    }
    if (!decoded && repairImage) {
      decoded = decode(reconnectQRDots(repairImage, 255));
      if (!decoded) decode(reconnectQRDots(repairImage, 0));
    }
    if (codes.length >= 5) break;
  }
  parentPort.postMessage({ codes });
} catch {
  parentPort.postMessage({
    codes,
    error:
      "QR image could not be decoded. Text recognition is still available.",
  });
}
