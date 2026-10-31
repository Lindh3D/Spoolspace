import { parseLabel, parseRegion } from "./parser.mjs";
import { compactText } from "./filament-normalize.mjs";
import { brandForDomain } from "./brand-evidence.mjs";

const keys = [
  "brand",
  "material",
  "productLine",
  "colorName",
  "colorHex",
  "initialWeight",
  "emptySpoolWeight",
  "temperatureMin",
  "temperatureMax",
];
export function parseQRCode(raw) {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 4096) return null;
  const text = raw.trim(),
    fields = {},
    identifiers = [text];
  let url = null,
    brandHint = "",
    searchText = "",
    format = "text";
  try {
    if (!/^(?:https?:\/\/|(?:[a-z\d-]+\.)+[a-z]{2,}\/)/i.test(text))
      throw Error("Not a web link");
    const candidate = new URL(
      /^https?:\/\//i.test(text) ? text : `https://${text}`,
    );
    if (
      /^https?:$/.test(candidate.protocol) &&
      !candidate.username &&
      !candidate.password &&
      candidate.hostname.includes(".") &&
      !/[\s<>]/.test(text)
    ) {
      url = candidate.href;
      identifiers.push(url);
      const host = candidate.hostname.toLowerCase(),
        belongs = (domain) => host === domain || host.endsWith(`.${domain}`);
      brandHint = brandForDomain(host);
      if (
        belongs("prusament.com") ||
        (belongs("prusa.io") && /^\/s\//.test(candidate.pathname)) ||
        (belongs("prusa3d.com") && /prusament/i.test(candidate.pathname))
      ) {
        brandHint = "Prusament";
        fields.manufacturer = "Prusa Research";
      }
      for (const key of ["gtin", "ean", "sku", "article_number"]) {
        const value = candidate.searchParams.get(key);
        if (value && value.length <= 160) identifiers.push(value);
      }
      if (brandHint) {
        // Descriptive paths can aid search, but opaque spool IDs imply no material/color.
        searchText = `${brandHint} ${parseLabel(decodeURIComponent(candidate.pathname).replace(/[_/]+/g, " ")).productLine || ""}`;
      }
      format = "url";
    }
  } catch {
    /* Not a URL; structured or printed text may still be useful. */
  }
  let object;
  try {
    object = JSON.parse(text);
  } catch {
    /* Plain text is also supported. */
  }
  if (object && typeof object === "object" && !Array.isArray(object)) {
    format = "filament-json";
    for (const key of keys) {
      const value = object[key];
      if (
        [
          "initialWeight",
          "emptySpoolWeight",
          "temperatureMin",
          "temperatureMax",
        ].includes(key)
      ) {
        if (
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= (key.startsWith("temperature") ? 20 : 0) &&
          value <= (key.startsWith("temperature") ? 500 : 100000)
        )
          fields[key] = value;
      } else if (
        typeof value === "string" &&
        value.trim() &&
        value.length <= 160
      ) {
        if (key === "colorHex") {
          if (/^#[\da-f]{6}$/i.test(value)) fields[key] = value;
        } else Object.assign(fields, parseRegion(key, value));
      }
    }
    for (const key of ["gtin", "ean", "sku", "article_number"])
      if (typeof object[key] === "string" && object[key].length <= 160)
        identifiers.push(object[key]);
    searchText = [
      fields.brand,
      fields.material,
      fields.productLine,
      fields.colorName,
      fields.colorHex,
    ]
      .filter(Boolean)
      .join("\n");
  } else if (
    !url &&
    !/^[a-z][\w+.-]*:/i.test(text) &&
    /\b(?:PLA|PETG|ABS|ASA|TPU|TPE|PA\d*|PC|PVA)\b/i.test(text)
  ) {
    const parsed = parseLabel(text);
    for (const key of keys)
      if (parsed[key] !== undefined) fields[key] = parsed[key];
    searchText = text;
  }
  if (fields.temperatureMin > fields.temperatureMax) {
    delete fields.temperatureMin;
    delete fields.temperatureMax;
  }
  return {
    text: raw,
    url,
    brandHint,
    fields,
    format,
    identifiers: [...new Set(identifiers)],
    searchText,
  };
}

export function qrEvidence(values = []) {
  const codes = [...new Set(values)]
    .slice(0, 5)
    .map(parseQRCode)
    .filter(Boolean);
  return {
    codes,
    multiple: codes.length > 1,
    searchText: codes.length === 1 ? codes[0].searchText : "",
  };
}
export function mergeQRFields(fields, qr) {
  const merged = { ...fields },
    conflicts = [];
  if (qr.codes.length !== 1) return { fields: merged, conflicts };
  const code = qr.codes[0],
    supplied = { ...code.fields };
  if (!supplied.brand && code.brandHint) supplied.brand = code.brandHint;
  for (const [key, value] of Object.entries(supplied)) {
    if (merged[key] == null || merged[key] === "") merged[key] = value;
    else if (compactText(String(merged[key])) !== compactText(String(value)))
      conflicts.push({ field: key, textValue: merged[key], qrValue: value });
  }
  return { fields: merged, conflicts };
}
