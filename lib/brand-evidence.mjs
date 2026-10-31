import { brandKey, normalizeText, textWindows } from "./filament-normalize.mjs";

// Brand identity is separate from polymer, product description, color and seller.
// Verified domains provide brand clues only; they never supply a product type.
export const brandReferences = [
  {
    name: "Bambu Lab",
    aliases: ["Bambu", "BambuLabs"],
    domains: ["bambulab.com"],
  },
  { name: "Prusament", domains: ["prusament.com"] },
  {
    name: "Add-North",
    aliases: ["addnorth", "add north"],
    domains: ["addnorth.com", "addnorth.se"],
  },
  { name: "Torwell", domains: ["torwell3d.com", "torwelltech.com"] },
  ...[
    "Polymaker",
    "eSUN",
    "SUNLU",
    "Overture",
    "Creality",
    "Hatchbox",
    "Elegoo",
    "Anycubic",
    "Fiberlogy",
    "Fillamentum",
    "Extrudr",
    "Flashforge",
    "3DJake",
    "ColorFabb",
    "Spectrum",
  ].map((name) => ({ name })),
];
const genericWords = new Set(
  "filament filaments metal metallic printing print printer 3d material materials plastic plastics diameter color colour copper black white silver gold red blue green grey gray net weight spool roll kg mm g pla petg abs asa tpu pa pc pva hips basic economy matte matt silk pro plus temperature temp www com net org shop store support".split(
    " ",
  ),
);
export function isGenericBrandText(value) {
  const words = normalizeText(value).split(" ").filter(Boolean);
  return (
    !words.length ||
    words.every(
      (word) => genericWords.has(word) || /^[\d.]+(?:kg|g|mm|c)?$/.test(word),
    )
  );
}
export function brandForDomain(hostname) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");
  return (
    brandReferences.find((brand) =>
      (brand.domains || []).some(
        (domain) => host === domain || host.endsWith(`.${domain}`),
      ),
    )?.name || ""
  );
}
export function printedBrand(text) {
  const windows = textWindows(String(text || "")).filter(
      (part) => !isGenericBrandText(part),
    ),
    keys = new Set(windows.map(brandKey));
  const names = brandReferences
    .filter((brand) =>
      [brand.name, ...(brand.aliases || [])].some((name) =>
        keys.has(brandKey(name)),
      ),
    )
    .map((brand) => brand.name);
  if (names.length === 1) return names[0];
  if (names.length > 1) return undefined;
  // An unknown printed name may still be corroborated by its printed website.
  // Require a separate word: never turn a domain alone into an invented brand.
  const hosts = [
      ...String(text).matchAll(
        /\b(?:https?:\/\/)?(?:www\.)?([a-z\d-]+(?:\.[a-z\d-]+)*\.[a-z]{2,})(?:\b|\/)/gi,
      ),
    ].map((match) => match[1].toLowerCase()),
    words =
      String(text)
        .replace(
          /(?:https?:\/\/)?(?:www\.)?[a-z\d-]+(?:\.[a-z\d-]+)+[^\s]*/gi,
          " ",
        )
        .match(/\b[A-Z][A-Z\d-]{3,29}\b/g) || [];
  const corroborated = words.filter(
    (word) =>
      !isGenericBrandText(word) &&
      hosts.some((host) =>
        host
          .split(".")
          .slice(0, -1)
          .some(
            (part) =>
              brandKey(part.replace(/(?:3d|tech|filaments?)$/i, "")) ===
              brandKey(word),
          ),
      ),
  );
  const unique = [...new Set(corroborated)];
  return unique.length === 1 ? unique[0] : undefined;
}
