import { materialIdentity } from "./filament-normalize.mjs";
import { printedBrand } from "./brand-evidence.mjs";

const colorMap = {
  "jade white": "#e4e8de",
  "ivory white": "#eeeadc",
  "matte black": "#303234",
  charcoal: "#343d40",
  "forest green": "#46745b",
  "sky blue": "#76aebe",
  terracotta: "#ce775d",
  orange: "#f48c37",
  black: "#292c2f",
  white: "#eeeeea",
  red: "#d74e47",
  blue: "#467fbc",
  green: "#4b936b",
  yellow: "#e8bc4b",
  purple: "#916bbb",
  pink: "#e69aaf",
  grey: "#939a9b",
  gray: "#939a9b",
  silver: "#b1b5b7",
  gold: "#c7a550",
  copper: "#ac7555",
  brown: "#8d6552",
  transparent: "#dde8e7",
};

const clean = (value, limit = 160) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, limit);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const labelAliases = {
  brand: ["brand"],
  vendor: ["vendor", "seller", "sold by"],
  manufacturer: ["manufacturer", "manufactured by", "made by"],
  material: ["material", "material type", "filament type"],
  productLine: [
    "filament brand",
    "product line",
    "product name",
    "variant",
    "series",
  ],
  colorName: ["color", "colour", "color name", "colour name"],
  temperatureRange: [
    "nozzle",
    "nozzle temperature",
    "nozzle temp",
    "print temperature",
    "print temp",
    "pint temp",
    "pint temperature",
    "printing temperature",
    "printing temp",
    "extruder temperature",
    "extrusion temperature",
  ],
  bedTemperatureRange: [
    "bed",
    "bed temperature",
    "bed temp",
    "heatbed temperature",
  ],
  dryingTemperatureRange: [
    "drying",
    "drying temperature",
    "drying temp",
    "dry temperature",
  ],
  initialWeight: ["net weight", "filament weight", "weight"],
  grossWeight: [
    "gross weight",
    "combined weight",
    "total weight",
    "loaded spool weight",
    "spool weight",
    "spool mass",
  ],
  emptySpoolWeight: [
    "empty spool weight",
    "empty spool mass",
    "empty weight",
    "tare",
  ],
};
const aliasFields = new Map(
  Object.entries(labelAliases).flatMap(([key, aliases]) =>
    aliases.map((alias) => [alias, key]),
  ),
);
const labelPattern = new RegExp(
  `\\b(${[...aliasFields.keys()]
    .sort((a, b) => b.length - a.length)
    .map((alias) => escapeRegex(alias).replace(/ /g, "\\s+"))
    .join("|")})\\s*[:=]\\s*`,
  "gi",
);

function labelledValues(text) {
  const matches = [...text.matchAll(labelPattern)];
  const values = {};
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const key = aliasFields.get(match[1].toLowerCase().replace(/\s+/g, " "));
    // A field's value ends at the next field or line. This avoids treating the
    // material/weight printed under an unknown brand as part of its name.
    const raw = text
      .slice(
        match.index + match[0].length,
        matches[i + 1]?.index ?? text.length,
      )
      .trim()
      .split(/[\r\n;]/)[0];
    const value = clean(raw)
      .replace(/[,;|]+$/, "")
      .trim();
    if (value) values[key] = value;
  }
  return values;
}

function knownBrand(text) {
  return printedBrand(text);
}

function materialFields(text) {
  const identity = materialIdentity(text);
  if (
    identity &&
    (identity.material.includes("-") || identity.material === "TPE")
  )
    return {
      material: identity.material,
      ...(identity.formulation !== identity.material
        ? { productLine: identity.formulation }
        : {}),
    };
  const matched = text.match(
    /(?<![a-z0-9])((?:[EXR][-\s\u2010-\u2015\u2212]?P\s*L\s*A|PLA)(?:\+|[\s-]+(?:BASIC|ECONOMY|MATTE|MATT|SILK|GLITZ|CF|GF|PLUS|PRO|HIGH[ -]SPEED|HS))?|PETG(?:[\s-]+(?:HF|CF|GF|BASIC|ECONOMY|MATTE|MATT|GLITZ|PRO|PLUS))?|ABS(?:[\s-]+CF)?|ASA|TPU(?:[\s-]*\d{2}[AD]?)?|PA(?:6|12)?(?:[\s-]+(?:CF|GF))?|NYLON|PC(?:[\s-]+CF)?|PVA|HIPS)(?![a-z0-9])/i,
  );
  if (!matched) {
    const identity = materialIdentity(text);
    return identity
      ? {
          material: identity.material,
          ...(identity.formulation !== identity.material
            ? { productLine: identity.formulation }
            : {}),
        }
      : {};
  }
  const product = clean(matched[1]);
  const upper = product.toUpperCase().replace(/[\u2010-\u2015\u2212]/g, "-");
  const material = /^(?:[EXR][-\s]?P\s*L\s*A|PLA)/.test(upper)
    ? "PLA"
    : upper.startsWith("PETG")
      ? "PETG"
      : upper.startsWith("TPU")
        ? "TPU"
        : upper.startsWith("PA") || upper === "NYLON"
          ? "PA"
          : upper.startsWith("PC")
            ? "PC"
            : upper.startsWith("ABS")
              ? "ABS"
              : upper;
  return { material, ...(upper !== material ? { productLine: product } : {}) };
}

function temperatureFields(text) {
  if (/\d\s*°?\s*F\b/i.test(text)) return {};
  const tolerance = text.match(
    /\b(\d{2,3}(?:[.,]\d+)?)\s*(?:±|\+\s*\/\s*-|\+)\s*(\d{1,2}(?:[.,]\d+)?)\s*°?\s*C\b/i,
  );
  if (tolerance) {
    const center = Number(tolerance[1].replace(",", ".")),
      delta = Number(tolerance[2].replace(",", "."));
    if (delta <= 50 && center - delta >= 20 && center + delta <= 500)
      return { temperatureMin: center - delta, temperatureMax: center + delta };
    return {};
  }
  const range = text.match(
    /\b(\d{2,3}(?:[.,]\d+)?)\s*(?:°\s*C|C)?\s*(?:-|–|—|~|to)\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:°\s*C|C)?\b/i,
  );
  const single = !range && text.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*°?\s*C\b/i);
  if (!range && !single) return {};
  const min = Number((range || single)[1].replace(",", "."));
  const max = range ? Number(range[2].replace(",", ".")) : min;
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min < 20 ||
    max > 500 ||
    min > max
  )
    return {};
  return { temperatureMin: min, temperatureMax: max };
}

function weightValue(text, allowBare = false) {
  const value =
    text.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|g|grams?)\b/i) ||
    (allowBare ? text.match(/^\s*(\d+(?:[.,]\d+)?)\s*$/) : null);
  if (!value) return undefined;
  const grams =
    Number(value[1].replace(",", ".")) *
    (/kg/i.test(value[2] || "g") ? 1000 : 1);
  return grams >= 0 && grams <= 100000 ? grams : undefined;
}

function colorFields(text) {
  const result = {};
  const printedHex = text.match(/#([\da-f]{6})\b/i);
  if (printedHex) result.colorHex = `#${printedHex[1]}`;
  for (const [name, color] of Object.entries(colorMap)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) {
      result.colorName = name.replace(/\b\w/g, (char) => char.toUpperCase());
      result.colorHex ||= color;
      break;
    }
  }
  return result;
}
function descriptiveColor(text, fields, colorName) {
  if (!colorName) return colorName;
  const color = new RegExp(`\\b${escapeRegex(colorName)}\\b`, "i");
  const product = fields.productLine || fields.material;
  for (let line of text.split(/[\r\n]/)) {
    if (product) {
      const match = new RegExp(`\\b${escapeRegex(product)}\\b`, "i").exec(line);
      if (match) line = line.slice(match.index + match[0].length);
    }
    line = line.replace(/^[^\p{L}]+/u, "");
    const match = color.exec(line);
    if (!match) continue;
    const candidate = line.slice(0, match.index + match[0].length).trim();
    if (
      /^[\p{L}]+(?:[ -][\p{L}]+){0,3}$/u.test(candidate) &&
      !/\b(?:brand|manufacturer|filament|material|color|colour|temperature|nozzle|weight|research)\b/i.test(
        candidate,
      )
    )
      return clean(candidate, 80)
        .toLowerCase()
        .replace(/(^|[\s-])\p{L}/gu, (part) => part.toUpperCase());
  }
  return colorName;
}

// A region has already been identified by the user, so an unknown company or
// color can safely be retained verbatim without a built-in brand vocabulary.
export function parseRegion(field, raw) {
  const text = clean(raw, 200);
  if (!text) return {};
  const labels = labelledValues(String(raw));
  const value = labels[field] || text;
  if (["brand", "vendor", "manufacturer", "productLine"].includes(field))
    return {
      [field]:
        field === "brand"
          ? knownBrand(value) || clean(value, 100)
          : clean(value, field === "productLine" ? 120 : 100),
    };
  if (field === "material") return materialFields(value);
  if (field === "temperatureRange") return temperatureFields(value);
  if (field === "colorName")
    return { ...colorFields(value), colorName: clean(value, 80) };
  if (["initialWeight", "emptySpoolWeight"].includes(field)) {
    const grams = weightValue(value, true);
    return grams === undefined ? {} : { [field]: grams };
  }
  return {};
}

export function parseLabel(raw) {
  const text = String(raw || "").replace(/[|]/g, "I");
  const labels = labelledValues(text);
  const fields = {};
  const brand = labels.brand || knownBrand(text);
  if (brand) fields.brand = labels.brand ? knownBrand(brand) || brand : brand;
  for (const field of ["vendor", "manufacturer"])
    if (labels[field]) fields[field] = clean(labels[field], 100);
  Object.assign(
    fields,
    materialFields(labels.material || labels.productLine || text),
  );
  if (labels.productLine) fields.productLine = clean(labels.productLine, 120);
  else if (!fields.productLine && !fields.material) {
    const description = text.match(
      /\bmetal(?:lic)?(?:[- ]filled)?\s+filament\b/i,
    )?.[0];
    if (description) fields.productLine = clean(description, 120);
  }

  const net = labels.initialWeight && weightValue(labels.initialWeight);
  if (net !== undefined && net !== false) fields.initialWeight = net;
  else {
    for (const match of text.matchAll(
      /\b(\d+(?:[.,]\d+)?)\s*(kg|g|grams?)\b/gi,
    )) {
      const line = text.slice(
        Math.max(0, text.lastIndexOf("\n", match.index) + 1),
        match.index,
      );
      if (/\b(?:empty|tare|spool)\b/i.test(line)) continue;
      const grams = weightValue(match[0]);
      if (/\b(?:gross|combined|total)\b/i.test(line)) continue;
      if (grams >= 50 && grams <= 10000) {
        fields.initialWeight = grams;
        break;
      }
    }
  }
  const tareText =
    labels.emptySpoolWeight ||
    text.match(
      /(?:empty\s*(?:spool)?\s*(?:weight|mass)?|tare)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:kg|g)\b/i,
    )?.[0];
  if (tareText) {
    const tare = weightValue(tareText);
    if (tare !== undefined) fields.emptySpoolWeight = tare;
  }
  Object.assign(fields, colorFields(labels.colorName || text));
  if (labels.colorName) fields.colorName = clean(labels.colorName, 80);
  else if (fields.colorName)
    fields.colorName = descriptiveColor(text, fields, fields.colorName);

  // Whole-photo OCR only extracts print/nozzle temperatures. Bed and dryer
  // values are deliberately ignored; a user-labelled temperature region can
  // be read without an accompanying prefix through parseRegion().
  if (labels.temperatureRange)
    Object.assign(fields, temperatureFields(labels.temperatureRange));
  else {
    const nozzle = text.match(
      /\b(?:nozzle|printing|print|extruder|extrusion|hotend)(?:\s+(?:temp(?:erature)?(?:\s+range)?|range))?\s*[:=]?\s*((?:\d[^\r\n]*)?)/i,
    );
    if (nozzle?.[1]) Object.assign(fields, temperatureFields(nozzle[1]));
  }
  if (fields.brand || fields.material || fields.productLine)
    fields.name = [
      fields.brand,
      fields.productLine || fields.material,
      fields.colorName,
    ]
      .filter(Boolean)
      .join(" · ");
  return fields;
}

export const catalog = {
  note: "Reference suggestions only. Empty spool weights vary by spool revision, refill and packaging. Weigh your own empty spool before using scale calculations. Drying values are general starting points; follow the filament and spool manufacturer limits.",
  emptySpools: [
    {
      brand: "Bambu Lab",
      name: "Reusable plastic spool (example)",
      grams: 250,
      source:
        "Approximate community-style reference; not verified for your spool",
      approximate: true,
    },
    {
      brand: "Prusament",
      name: "Plastic/cardboard spool (example)",
      grams: 200,
      source: "Approximate reference; not verified for your spool",
      approximate: true,
    },
    {
      brand: "Polymaker",
      name: "Cardboard spool (example)",
      grams: 140,
      source: "Approximate reference; not verified for your spool",
      approximate: true,
    },
    {
      brand: "eSUN",
      name: "Plastic spool (example)",
      grams: 230,
      source: "Approximate reference; not verified for your spool",
      approximate: true,
    },
    {
      brand: "SUNLU",
      name: "Plastic spool (example)",
      grams: 180,
      source: "Approximate reference; not verified for your spool",
      approximate: true,
    },
  ],
  materials: [
    {
      material: "PLA",
      temperature: 45,
      hours: 6,
      reviewAfterDays: 30,
      sensitivity: "Low",
    },
    {
      material: "PETG",
      temperature: 60,
      hours: 6,
      reviewAfterDays: 14,
      sensitivity: "Medium",
    },
    {
      material: "ABS",
      temperature: 65,
      hours: 6,
      reviewAfterDays: 30,
      sensitivity: "Medium",
    },
    {
      material: "ASA",
      temperature: 65,
      hours: 6,
      reviewAfterDays: 30,
      sensitivity: "Medium",
    },
    {
      material: "TPU",
      temperature: 50,
      hours: 8,
      reviewAfterDays: 7,
      sensitivity: "High",
    },
    {
      material: "PA",
      temperature: 70,
      hours: 8,
      reviewAfterDays: 3,
      sensitivity: "High",
    },
    {
      material: "PC",
      temperature: 70,
      hours: 8,
      reviewAfterDays: 7,
      sensitivity: "High",
    },
    {
      material: "PVA",
      temperature: 45,
      hours: 8,
      reviewAfterDays: 3,
      sensitivity: "High",
    },
  ],
};
