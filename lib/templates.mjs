import { randomUUID } from "node:crypto";
import { ValidationError } from "./store.mjs";

export const regionFields = new Set([
  "brand",
  "vendor",
  "manufacturer",
  "material",
  "productLine",
  "temperatureRange",
  "colorName",
  "initialWeight",
  "emptySpoolWeight",
]);

export function imageData(image, maxBytes = 10 * 1024 * 1024) {
  if (
    typeof image !== "string" ||
    !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(image)
  )
    throw new ValidationError("Choose a JPEG, PNG or WebP photo.");
  const bytes = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
  if (bytes.length > maxBytes)
    throw new ValidationError(
      `Photo must be smaller than ${maxBytes / 1024 / 1024} MB.`,
      413,
    );
  let width, height;
  if (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const size = bytes.readUInt16BE(offset);
      if (size < 2 || offset + size > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        size >= 7
      ) {
        height = bytes.readUInt16BE(offset + 3);
        width = bytes.readUInt16BE(offset + 5);
        break;
      }
      offset += size;
    }
  } else if (
    bytes.length >= 30 &&
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  ) {
    const type = bytes.subarray(12, 16).toString();
    if (type === "VP8X") {
      width = bytes.readUIntLE(24, 3) + 1;
      height = bytes.readUIntLE(27, 3) + 1;
    } else if (
      type === "VP8 " &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      width = bytes.readUInt16LE(26) & 0x3fff;
      height = bytes.readUInt16LE(28) & 0x3fff;
    } else if (type === "VP8L" && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
  }
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 12000 ||
    height > 12000 ||
    width * height > 40_000_000
  )
    throw new ValidationError(
      "This photo is damaged, unsupported, or too large to read safely.",
    );
  return { bytes, width, height };
}

export function validateRegions(regions) {
  if (!Array.isArray(regions) || regions.length < 1 || regions.length > 20)
    throw new ValidationError("Mark between 1 and 20 label regions.");
  const used = new Set();
  const usedIds = new Set();
  return regions.map((region) => {
    if (
      !region ||
      typeof region !== "object" ||
      !regionFields.has(region.field)
    )
      throw new ValidationError(
        "Choose a supported field for each label region.",
      );
    if (used.has(region.field))
      throw new ValidationError("Use one label region per field.");
    used.add(region.field);
    for (const key of ["x", "y", "width", "height"]) {
      if (
        typeof region[key] !== "number" ||
        !Number.isFinite(region[key]) ||
        region[key] < 0 ||
        region[key] > 1
      )
        throw new ValidationError(
          "Label regions must use image coordinates between 0 and 1.",
        );
    }
    if (
      region.width < 0.002 ||
      region.height < 0.002 ||
      region.x + region.width > 1.000001 ||
      region.y + region.height > 1.000001
    )
      throw new ValidationError(
        "Each label region must fit inside the photo and have a visible area.",
      );
    const recognizedText =
      region.recognizedText ?? region.sourceText ?? region.ocrText ?? "";
    region = { ...region, recognizedText };
    for (const key of ["value", "recognizedText"]) {
      if (
        region[key] !== undefined &&
        (typeof region[key] !== "string" || region[key].length > 300)
      )
        throw new ValidationError(
          "Region values must be text of at most 300 characters.",
        );
    }
    const id =
      typeof region.id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(region.id)
        ? region.id
        : randomUUID();
    if (usedIds.has(id))
      throw new ValidationError("Each label region needs a unique ID.");
    usedIds.add(id);
    return {
      id,
      field: region.field,
      x: region.x,
      y: region.y,
      width: Math.min(region.width, 1 - region.x),
      height: Math.min(region.height, 1 - region.y),
      value: (region.value || "").trim(),
      recognizedText: (region.recognizedText || "").trim(),
    };
  });
}

export function validateTemplate(input, previous) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError("Template must be an object.");
  const value = { ...previous, ...input };
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 120
  )
    throw new ValidationError(
      "Give this label template a name of at most 120 characters.",
    );
  const { width, height } = imageData(value.exampleImage, 3 * 1024 * 1024);
  const regions = validateRegions(value.regions);
  const time = new Date().toISOString();
  return {
    id: previous?.id || randomUUID(),
    name: value.name.trim(),
    exampleImage: value.exampleImage,
    imageWidth: width,
    imageHeight: height,
    regions,
    createdAt: previous?.createdAt || time,
    updatedAt: time,
  };
}

export function summarizeTemplate(template) {
  const { exampleImage, ...metadata } = template;
  return metadata;
}

export const normalizeRegionText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

export function correctedRegionText(region, text) {
  const company = ["brand", "vendor", "manufacturer"].includes(region.field);
  // Punctuation distinguishes real product lines (PLA versus PLA+) and
  // quantities (1.5 kg versus 15 kg). Only company matching may discard it.
  const normalize = company
    ? normalizeRegionText
    : (value) =>
        String(value || "")
          .normalize("NFKC")
          .toLowerCase()
          .replace(/\s+/g, "")
          .replace(/[–—−]/g, "-");
  const actual = normalize(text);
  if (!actual || !region.value) return text;
  const previous = normalize(region.recognizedText);
  const expected = normalize(region.value);
  // Learn a demonstrated OCR correction only. Never copy a different example's
  // material, product name, color or weights onto a new spool.
  if ((previous && actual === previous) || (expected && actual === expected))
    return region.value;
  if (company) {
    const anchor = previous || expected;
    if (anchor.length >= 5 && actual.length >= 5) {
      const costs = Array.from({ length: anchor.length + 1 }, (_, i) => i);
      for (let j = 1; j <= actual.length; j++) {
        let diagonal = costs[0];
        costs[0] = j;
        for (let i = 1; i <= anchor.length; i++) {
          const old = costs[i];
          costs[i] = Math.min(
            costs[i] + 1,
            costs[i - 1] + 1,
            diagonal + (anchor[i - 1] === actual[j - 1] ? 0 : 1),
          );
          diagonal = old;
        }
      }
      if (costs[anchor.length] / Math.max(anchor.length, actual.length) <= 0.15)
        return region.value;
    }
  }
  return text;
}

export function suggestTemplates(text, templates = []) {
  const actual = normalizeRegionText(text);
  return templates
    .filter((t) =>
      t.regions.some(
        (r) =>
          ["brand", "vendor", "manufacturer"].includes(r.field) &&
          [r.value, r.recognizedText].some((v) => {
            const anchor = normalizeRegionText(v);
            return anchor.length >= 5 && actual.includes(anchor);
          }),
      ),
    )
    .map(({ id, name }) => ({ id, name }));
}
