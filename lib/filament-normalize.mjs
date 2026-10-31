// OCR comparison is intentionally different from stored product data: the
// original text and the source's exact formulation/color names are retained.
export const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/grey/g, "gray")
    .replace(/matt\b/g, "matte")
    .replace(/[^\p{L}\p{N}+.#]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
export const compactText = (value) => normalizeText(value).replace(/\s/g, "");
export const ocrWord = (value) =>
  compactText(value)
    .replace(/[01l]/g, (c) => (c === "0" ? "o" : "i"))
    .replace(/8/g, "b");
export const brandKey = (value) =>
  ocrWord(compactText(value).replace(/bambulabs?/g, "bambulab"));
export function editSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (a.length > 160 || b.length > 160) {
    a = a.slice(0, 160);
    b = b.slice(0, 160);
  }
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = old;
    }
  }
  return Math.max(0, 1 - row[b.length] / Math.max(a.length, b.length));
}
export function textSimilarity(a, b) {
  return editSimilarity(ocrWord(a), ocrWord(b));
}
export function textWindows(text, maxWords = 5) {
  const result = [];
  for (const line of String(text || "")
    .slice(0, 12000)
    .split(/[\r\n]+/)) {
    const words = normalizeText(line).split(" ").filter(Boolean).slice(0, 100);
    for (let start = 0; start < words.length; start++)
      for (
        let count = 1;
        count <= maxWords && start + count <= words.length;
        count++
      )
        result.push(words.slice(start, start + count).join(" "));
  }
  return [...new Set(result)];
}
export function bestEvidence(target, windows, normalizer = ocrWord) {
  const wanted = normalizer(target);
  let score = 0,
    text = "";
  for (const candidate of windows) {
    const key = normalizer(candidate);
    if (Math.abs(key.length - wanted.length) > Math.max(4, wanted.length * 0.5))
      continue;
    const current = editSimilarity(wanted, key);
    if (current > score) {
      score = current;
      text = candidate;
      if (score === 1) break;
    }
  }
  return { score, text };
}
export function materialIdentity(raw) {
  const text = String(raw || "")
    .normalize("NFKC")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .trim();
  const polymer =
      "(?:PETG|PEEK|PLA|PHA|PBT|PET|ABS|ASA|PC|PA12|PA6|PA|TPU|TPE|PPE|PEI|PPS|PP|PE|PS)",
    blend = text.match(
      new RegExp(
        `(?<![a-z0-9])(${polymer}(?:\\s*[-/+]\\s*${polymer}){1,3})(?:[-\\s]+(CF|GF|HF|HS))?(?![a-z0-9])`,
        "i",
      ),
    );
  if (blend) {
    const material = blend[1].toUpperCase().replace(/\s*[-/+]\s*/g, "-");
    return {
      material,
      formulation: material + (blend[2] ? `-${blend[2].toUpperCase()}` : ""),
    };
  }
  const match = text.match(
    /(?<![a-z0-9])((?:[EXR][- ]?P\s*L\s*A|PLA)(?:\+|[- ]?(?:CF|GF|HF|HS))?|r?PETG(?:[- ]?(?:CF|GF|HF|HS))?|ABS(?:[- ]?(?:CF|GF))?|ASA(?:[- ]?(?:CF|GF))?|TPU(?:[- ]?\d{2,3}[AD])?|TPE(?:[- ]?\d{2,3}[AD])?|PA(?:6(?:6)?|11|12)?(?:[- ]?(?:CF|GF))?|NYLON|PC(?:[- ]?(?:CF|GF))?|PVA|HIPS|PPA|PPS|PEEK|PEI|PVDF|PCL|PP)(?![a-z0-9])/i,
  );
  if (!match) return null;
  const formulation = match[1].toUpperCase().replace(/\s+/g, " ");
  let material = formulation;
  if (/^(?:[EXR][- ]?P\s*L\s*A|PLA)/.test(formulation)) material = "PLA";
  else if (/^R?PETG/.test(formulation)) material = "PETG";
  else if (/^PA\d|^NYLON/.test(formulation)) material = "PA";
  else
    for (const base of ["ABS", "ASA", "TPU", "TPE", "PC", "PA"])
      if (formulation.startsWith(base)) {
        material = base;
        break;
      }
  return { material, formulation };
}
export function formulationTags(text) {
  const normalized = normalizeText(text),
    tags = new Set();
  if (/pla\s*\+|\bplus\b/.test(normalized)) tags.add("plus");
  for (const tag of [
    "cf",
    "gf",
    "hf",
    "hs",
    "basic",
    "economy",
    "matte",
    "silk",
    "glitz",
  ]) {
    if (new RegExp(`(?:^|[ -])${tag}(?:$|[ -])`).test(normalized))
      tags.add(tag);
  }
  const pa = normalized.match(/\bpa\s*(6|66|11|12)\b/);
  if (pa) tags.add("pa" + pa[1]);
  const hardness = normalized.match(/\b(\d{2,3}[ad])\b/);
  if (hardness) tags.add(hardness[1]);
  return tags;
}
export function formulationCompatible(requested, candidate) {
  const a = formulationTags(requested),
    b = formulationTags(candidate);
  for (const family of [
    ["basic", "economy", "matte", "silk", "glitz"],
    ["cf", "gf"],
    ["pa6", "pa66", "pa11", "pa12"],
  ]) {
    const left = [...a].filter((x) => family.includes(x)),
      right = [...b].filter((x) => family.includes(x));
    if (left.length && right.length && !left.some((x) => right.includes(x)))
      return false;
  }
  const hardnessA = [...a].find((x) => /^\d+[ad]$/.test(x)),
    hardnessB = [...b].find((x) => /^\d+[ad]$/.test(x));
  if (hardnessA && hardnessB && hardnessA !== hardnessB) return false;
  // A clear formulation on the label must not turn into an unmodified polymer.
  for (const tag of [
    "plus",
    "cf",
    "gf",
    "hf",
    "hs",
    "basic",
    "economy",
    "matte",
    "silk",
    "glitz",
  ])
    if (a.has(tag) && !b.has(tag)) return false;
  return true;
}
