import { parseLabel } from "./parser.mjs";
import { isGenericBrandText } from "./brand-evidence.mjs";
import {
  materialIdentity,
  normalizeText,
  compactText,
  brandKey,
  ocrWord,
  textSimilarity,
  textWindows,
  bestEvidence,
  formulationCompatible,
} from "./filament-normalize.mjs";

const useful = (value) => typeof value === "string" && value.trim();
function labelColor(text, fields) {
  const line = String(text)
    .split(/[\r\n]/)
    .find((line) => /\bcolou?r(?:\s+name)?\s*[:=|\[]?/i.test(line));
  if (line)
    return line
      .replace(/^.*?\bcolou?r(?:\s+name)?\s*[:=|\[\]]?\s*/i, "")
      .trim();
  return fields.colorName || "";
}
function lineName(line) {
  // Some upstream names repeat their brand. Remove only an exact brand prefix.
  const name = normalizeText(line.name),
    brand = normalizeText(line.brand);
  return name.startsWith(brand + " ") ? name.slice(brand.length + 1) : name;
}
function productScore(line, requested, windows, base) {
  const name = lineName(line);
  if (requested) {
    if (!formulationCompatible(requested, `${line.material} ${line.name}`))
      return 0;
    const exact = textSimilarity(name, requested);
    const words = normalizeText(requested).split(" ").filter(Boolean);
    const coverage = words.length
      ? words.reduce(
          (sum, word) => sum + bestEvidence(word, textWindows(name, 3)).score,
          0,
        ) / words.length
      : 0;
    return Math.min(1, exact * 0.8 + coverage * 0.2);
  }
  const evidence = bestEvidence(name, windows);
  return compactText(name) === compactText(base)
    ? Math.min(0.65, evidence.score)
    : evidence.score;
}
function colorEvidence(product, colorText, windows, printedHex) {
  const named = bestEvidence(product.colorName, windows),
    observed = colorText || named.text;
  const standard = observed.match(
    /\b(ral|pantone|pms)\s*[:#]?\s*([0-9][a-z0-9-]*)\b/i,
  );
  if (standard) {
    const key = standard[1].toLowerCase().replace("pms", "pantone"),
      stored = Object.entries(product.colorCodes || {}).find(
        ([name]) => name.toLowerCase() === key,
      )?.[1];
    if (stored != null)
      return {
        score: ocrWord(stored) === ocrWord(standard[2]) ? 1 : 0,
        text: standard[0],
      };
  }
  const numbers = observed.match(/\d{2,}/g) || [],
    candidateNumbers = product.colorName.match(/\d{2,}/g) || [];
  if (
    numbers.length &&
    candidateNumbers.length &&
    numbers.join("|") !== candidateNumbers.join("|")
  )
    return { score: 0, text: observed };
  if (printedHex && (product.colorHex || product.hexVariants?.length)) {
    const matching = [
      product.colorHex,
      ...(Array.isArray(product.hexVariants) ? product.hexVariants : []),
    ].some((hex) => String(hex).toLowerCase() === printedHex.toLowerCase());
    if (!matching) return { score: 0, text: printedHex };
    const words = observed.replace(/#[0-9a-foil]{6}/gi, "").trim();
    return { score: words ? named.score : 1, text: observed || printedHex };
  }
  return named;
}

export function rankCatalog({
  text,
  fields: supplied = {},
  confirmedFields = [],
  brands,
  lines,
  readProducts,
  supplementalText = "",
  qrBrand = "",
}) {
  const original = String(text || "").slice(0, 12000),
    parsed = parseLabel(original);
  const fields = {
    ...Object.fromEntries(
      Object.entries(supplied || {}).filter(
        ([, v]) => v !== null && v !== undefined && v !== "",
      ),
    ),
    ...parsed,
  };
  for (const field of confirmedFields)
    if (
      supplied[field] === null ||
      supplied[field] === undefined ||
      supplied[field] === ""
    )
      delete fields[field];
    else fields[field] = supplied[field];
  const windows = textWindows(
      [original, supplementalText].filter(Boolean).join("\n"),
    ),
    brandWindows = windows.filter((part) => !isGenericBrandText(part)),
    hints = textWindows(fields.brand || "").filter(
      (part) => !isGenericBrandText(part),
    );
  const brandEvidence = brands.map((brand) => {
    const aliases = [brand.name, brand.slug, ...(brand.aliases || [])];
    const find = (parts) =>
      aliases.reduce(
        (best, alias) => {
          const value = bestEvidence(alias, parts, brandKey);
          return value.score > best.score ? value : best;
        },
        { score: 0, text: "" },
      );
    return { brand, raw: find(brandWindows), hint: find(hints) };
  });
  let restrictedBrand = confirmedFields.includes("brand")
    ? fields.brand || ""
    : parsed.brand || qrBrand || "";
  if (!restrictedBrand) {
    const exact = brandEvidence.filter((entry) => entry.raw.score === 1);
    if (exact.length === 1)
      fields.brand = restrictedBrand = exact[0].brand.name;
  }
  const strongRawBrand = brandEvidence.some((entry) => entry.raw.score >= 0.88);
  const brandScores = brandEvidence
    .map(({ brand, raw, hint }) => ({
      ...brand,
      ...(confirmedFields.includes("brand")
        ? hint
        : strongRawBrand
          ? raw
          : hint.score > raw.score
            ? hint
            : raw),
    }))
    .sort((a, b) => b.score - a.score);
  const bestBrands = (
    restrictedBrand
      ? brandScores.filter((b) =>
          [b.name, b.slug, ...(b.aliases || [])].some(
            (alias) => brandKey(alias) === brandKey(restrictedBrand),
          ),
        )
      : brandScores
  )
    .filter(
      (b) => b.score >= Math.max(0.58, (brandScores[0]?.score || 0) - 0.12),
    )
    .slice(0, 3);
  const brandIds = new Set(bestBrands.map((b) => b.id));
  const identity = materialIdentity(
    fields.material ||
      fields.productLine ||
      (confirmedFields.includes("material") ? "" : original),
  );
  const base = identity?.material || "";
  const requested =
    fields.productLine ||
    (identity && identity.formulation !== identity.material
      ? identity.formulation
      : "");
  const colorText = confirmedFields.includes("colorName")
      ? fields.colorName || ""
      : labelColor(original, fields),
    colorWindows = colorText
      ? textWindows(colorText, 6)
      : confirmedFields.includes("colorName")
        ? []
        : windows;
  const printedHex = (
    confirmedFields.includes("colorName")
      ? String(supplied.colorName || "")
      : original
  )
    .match(/#[0-9a-foil]{6}\b/i)?.[0]
    ?.replace(/[oil]/gi, (c) => (c.toLowerCase() === "o" ? "0" : "1"));
  // A recognized brand alone cannot identify a material, product or color.
  const hasProductDetails = Boolean(
    base || requested || colorText || printedHex,
  );
  const lineCandidates = lines
    .filter((line) => {
      if (!hasProductDetails) return false;
      if ((restrictedBrand || brandIds.size) && !brandIds.has(line.brandId))
        return false;
      const type =
        materialIdentity(line.material)?.material ||
        line.material.toUpperCase();
      return !base || type === base;
    })
    .map((line) => ({
      ...line,
      productScore: productScore(line, requested, windows, base),
    }))
    .filter((line) => line.productScore > 0.28)
    .sort((a, b) => b.productScore - a.productScore)
    .slice(0, 24);
  const lineScores = new Map(lineCandidates.map((line) => [line.id, line]));
  const products = readProducts(lineCandidates.map((line) => line.id));
  const candidates = products
    .map((product) => {
      const brand = brandScores.find((b) => b.id === product.brandId),
        line = lineScores.get(product.lineId);
      const color = colorEvidence(product, colorText, colorWindows, printedHex);
      const colorKnown = Boolean(
        colorText || printedHex || color.score >= 0.78,
      );
      const materialScore = base ? (product.material === base ? 1 : 0) : null;
      const colorScore = colorKnown ? color.score : null;
      const brandScore = brand?.score >= 0.58 ? brand.score : null;
      const productEvidence = line?.productScore || 0;
      const weight = Number(fields.initialWeight);
      const hasWeight = Number.isFinite(weight) && weight > 0;
      const matchingSize = hasWeight
        ? product.sizes.find((s) => s.initialWeight === weight)
        : null;
      const parts = {
        brand: brandScore,
        material: materialScore,
        productLine: productEvidence,
        colorName: colorScore,
        weight: hasWeight ? (matchingSize ? 1 : 0) : null,
      };
      const weights = {
        brand: 25,
        material: 20,
        productLine: 25,
        colorName: 25,
        weight: 5,
      };
      const observed = Object.keys(parts).filter((k) => parts[k] !== null);
      let score =
        (observed.reduce((n, k) => n + parts[k] * weights[k], 0) /
          Math.max(
            1,
            observed.reduce((n, k) => n + weights[k], 0),
          )) *
        100;
      const consistent =
        brandScore >= 0.75 && materialScore === 1 && colorScore >= 0.78;
      if (!consistent)
        score = Math.min(
          score,
          colorScore !== null && colorScore < 0.6 ? 59 : 79,
        );
      if (productEvidence < 0.75) score = Math.min(score, 79);
      if (hasWeight && !matchingSize) score = Math.min(score, 79);
      if (
        requested &&
        !formulationCompatible(
          requested,
          `${product.formulation} ${product.productLine}`,
        )
      )
        score = Math.min(score, 49);
      score = Math.round(score);
      const selected =
        matchingSize ||
        (!hasWeight && product.sizes.length === 1 ? product.sizes[0] : null);
      return {
        ...product,
        sizeConflict: hasWeight && !matchingSize,
        initialWeight: selected?.initialWeight ?? null,
        emptySpoolWeight: selected?.emptySpoolWeight ?? null,
        catalogSizeId: selected?.catalogSizeId ?? null,
        diameter: selected?.diameter ?? null,
        score: Math.round(score),
        confidence:
          score >= 95
            ? "Very strong candidate"
            : score >= 80
              ? "Likely candidate"
              : score >= 60
                ? "Needs verification"
                : "Weak candidate",
        consistent,
        fieldScores: Object.fromEntries(
          Object.entries(parts).map(([key, value]) => [
            key,
            value === null ? null : Math.round(value * 100),
          ]),
        ),
        evidence: {
          brand: brand?.text || "",
          productLine: requested || line?.name || "",
          colorName: color.text || "",
          material: identity?.formulation || "",
        },
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.fieldScores.productLine || 0) - (a.fieldScores.productLine || 0) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 5);
  return {
    originalText: original,
    fields,
    candidates,
    bestCandidateId:
      candidates[0]?.consistent && candidates[0].score >= 80
        ? candidates[0].catalogVariantId
        : null,
    message: candidates.length
      ? "Scores are matching heuristics, not probabilities. Review the product, formulation, color and size before using a candidate."
      : restrictedBrand && !hasProductDetails
        ? `Recognized brand: ${restrictedBrand}. Material, product line and color are still unknown. Read the printed label or review the linked spool information before choosing a product.`
        : restrictedBrand
          ? `Recognized brand: ${restrictedBrand}. ${brandIds.size ? "No matching product was found for this brand." : "This brand is not present in the local filament catalog."} Keep the label details and enter the missing spool information manually.`
          : "No reliable catalog candidate was found. Correct the useful label text or enter the spool manually.",
  };
}
