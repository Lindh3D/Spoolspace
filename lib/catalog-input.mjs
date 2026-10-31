import { ValidationError } from "./store.mjs";
import { validateRegions } from "./templates.mjs";
import { parseLabel, parseRegion } from "./parser.mjs";
import { qrEvidence, mergeQRFields } from "./qr-evidence.mjs";

// Both catalog sources use the same OCR/QR conflict rules and confirmed regions.
export function prepareCatalogInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError("Send a label matching object.");
  let { text, fields = {}, regions, qrCodes = [] } = input;
  if (
    !Array.isArray(qrCodes) ||
    qrCodes.length > 5 ||
    qrCodes.some((c) => typeof c !== "string" || c.length > 4096)
  )
    throw new ValidationError(
      "Send at most five decoded QR values, each at most 4096 characters.",
    );
  if (
    typeof text !== "string" ||
    text.length > 12000 ||
    !fields ||
    typeof fields !== "object" ||
    Array.isArray(fields)
  )
    throw new ValidationError(
      "Send label text of at most 12,000 characters and optional recognized fields.",
    );
  const qr = qrEvidence(qrCodes);
  const allowed = new Set([
    "brand",
    "manufacturer",
    "vendor",
    "material",
    "productLine",
    "colorName",
    "initialWeight",
    "emptySpoolWeight",
    "temperatureMin",
    "temperatureMax",
  ]);
  fields = Object.fromEntries(
    Object.entries(fields).filter(
      ([key, value]) =>
        allowed.has(key) &&
        ((typeof value === "string" && value.length <= 200) ||
          (typeof value === "number" && Number.isFinite(value))),
    ),
  );
  const qrMerged = mergeQRFields({ ...fields, ...parseLabel(text) }, qr);
  fields = qrMerged.fields;
  const confirmedFields = [];
  if (regions?.length) {
    for (const region of validateRegions(regions)) {
      const targets =
        region.field === "temperatureRange"
          ? ["temperatureMin", "temperatureMax"]
          : region.field === "colorName"
            ? ["colorName", "colorHex"]
            : [region.field];
      targets.forEach((key) => {
        delete fields[key];
        confirmedFields.push(key);
      });
      const extracted = parseRegion(region.field, region.value);
      confirmedFields.push(...Object.keys(extracted));
      Object.assign(fields, extracted);
    }
  }
  return {
    text,
    fields,
    confirmedFields,
    qr,
    qrMerged,
    supplementalText: qr.searchText,
    qrBrand:
      qr.codes.length === 1
        ? qr.codes[0].fields.brand || qr.codes[0].brandHint
        : "",
  };
}
