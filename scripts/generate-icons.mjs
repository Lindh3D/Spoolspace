import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const logo = await loadImage(readFileSync(resolve(root, "public/favicon.svg")));
function icon(size) {
  const canvas = createCanvas(size, size),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "#172a27";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(logo, size * 0.1, size * 0.1, size * 0.8, size * 0.8);
  return canvas.toBuffer("image/png");
}
mkdirSync(resolve(root, "public/icons"), { recursive: true });
for (const size of [192, 512])
  writeFileSync(resolve(root, `public/icons/icon-${size}.png`), icon(size));
writeFileSync(resolve(root, "public/apple-touch-icon.png"), icon(180));
const sizes = [16, 32, 48, 256],
  images = sizes.map(icon);
const directory = Buffer.alloc(6 + images.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(images.length, 4);
let offset = directory.length;
images.forEach((bytes, i) => {
  const entry = 6 + i * 16;
  directory[entry] = sizes[i] === 256 ? 0 : sizes[i];
  directory[entry + 1] = directory[entry];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(bytes.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += bytes.length;
});
writeFileSync(
  resolve(root, "platform/windows/Spoolspace.ico"),
  Buffer.concat([directory, ...images]),
);
