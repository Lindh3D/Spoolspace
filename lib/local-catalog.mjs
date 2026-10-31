import { ValidationError } from "./store.mjs";
import {
  compactText,
  materialIdentity,
  brandKey,
} from "./filament-normalize.mjs";
import { rankCatalog } from "./ofd-match.mjs";
import { prepareCatalogInput } from "./catalog-input.mjs";

const asProduct = (product) => ({
  ...product,
  brandId: `custom-brand-${brandKey(product.brand)}`,
  lineId: JSON.stringify([
    brandKey(product.brand),
    product.material,
    compactText(product.productLine || product.formulation || product.material),
  ]),
  material: materialIdentity(product.material)?.material || product.material,
});
const limitFor = (input) =>
  Math.floor(Math.min(100, Math.max(1, Number(input.limit) || 30)));
const validSource = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError("Send catalog search or matching fields.");
  const source = input.source || "all";
  if (!["all", "custom", "ofd"].includes(source))
    throw new ValidationError(
      "Choose all, custom or OFD as the catalog source.",
    );
  return source;
};

// The upstream worker owns its replaceable cache. Custom products live only in
// the inventory store; no sync operation is given access to that table.
export class LocalCatalog {
  constructor(store, upstream) {
    this.store = store;
    this.upstream = upstream;
  }
  products() {
    return this.store.customFilaments().map(asProduct);
  }
  async search(input = {}) {
    const source = validSource(input);
    const numbers = {};
    for (const key of [
      "weight",
      "spoolWeight",
      "temperatureMin",
      "temperatureMax",
    ]) {
      if (input[key] === undefined || input[key] === null || input[key] === "")
        continue;
      const value = Number(input[key]);
      if (!Number.isFinite(value) || value < 0 || value > 100000)
        throw new ValidationError(`Invalid ${key} filter.`);
      numbers[key] = value;
    }
    const contains = (value, needle) =>
      !String(needle || "").trim() ||
      compactText(value).includes(compactText(needle));
    const terms = String(input.q || "")
      .slice(0, 300)
      .split(/\s+/)
      .map(compactText)
      .filter(Boolean)
      .slice(0, 10);
    const items =
      source === "ofd"
        ? []
        : this.products().filter((p) => {
            if (
              !contains(p.brand, input.brand) ||
              !contains(p.productLine, input.productLine) ||
              !contains(
                `${p.colorName} ${p.colorHex}`,
                input.color || input.colorHex,
              ) ||
              !contains(p.manufacturer, input.manufacturer) ||
              !contains(p.vendors.join(" "), input.vendor)
            )
              return false;
            if (
              input.material &&
              p.material !==
                (materialIdentity(input.material)?.material ||
                  String(input.material).toUpperCase())
            )
              return false;
            if (
              numbers.temperatureMin !== undefined &&
              (p.temperatureMin == null ||
                p.temperatureMin < numbers.temperatureMin)
            )
              return false;
            if (
              numbers.temperatureMax !== undefined &&
              (p.temperatureMax == null ||
                p.temperatureMax > numbers.temperatureMax)
            )
              return false;
            if (
              !p.sizes.some(
                (s) =>
                  (numbers.weight === undefined ||
                    s.initialWeight === numbers.weight) &&
                  (numbers.spoolWeight === undefined ||
                    s.emptySpoolWeight === numbers.spoolWeight),
              )
            )
              return false;
            const haystack = compactText(
              [
                p.name,
                p.material,
                p.formulation,
                p.manufacturer,
                p.colorHex,
                ...p.vendors,
                ...p.sizes.map(
                  (s) => `${s.initialWeight} ${s.emptySpoolWeight ?? ""}`,
                ),
              ].join(" "),
            );
            return terms.every((term) => haystack.includes(term));
          });
    let remote = { items: [], available: false };
    if (source !== "custom" && this.upstream) {
      try {
        remote = await this.upstream.search(input);
      } catch (error) {
        if (error.status === 400) throw error;
        remote.error = error.message;
      }
    }
    return {
      ...remote,
      items: [...items, ...(remote.items || [])].slice(0, limitFor(input)),
      available: remote.available || items.length > 0,
      customCount: this.store.customFilaments().length,
      message: items.length
        ? "Includes your custom filaments. Review the product and size before saving a spool."
        : remote.message,
    };
  }
  async getProduct(id) {
    if (id.startsWith("custom-"))
      return asProduct(this.store.getCustomFilament(id));
    if (!this.upstream)
      throw new ValidationError(
        "The upstream filament catalog is not available.",
        503,
      );
    return this.upstream.getProduct(id);
  }
  async match(input) {
    const source = validSource(input);
    const prepared = prepareCatalogInput(input);
    const products = source === "ofd" ? [] : this.products();
    const brands = [
      ...new Map(
        products.map((p) => [
          p.brandId,
          { id: p.brandId, name: p.brand, slug: p.brand },
        ]),
      ).values(),
    ];
    const local = rankCatalog({
      ...prepared,
      brands,
      lines: [
        ...new Map(
          products.map((p) => [
            p.lineId,
            {
              id: p.lineId,
              name: p.productLine || p.formulation || p.material,
              material: p.material,
              brandId: p.brandId,
              brand: p.brand,
            },
          ]),
        ).values(),
      ],
      readProducts: (ids) => products.filter((p) => ids.includes(p.lineId)),
    });
    let remote = { candidates: [], available: false };
    if (source !== "custom" && this.upstream) {
      try {
        remote = await this.upstream.match(input);
      } catch (error) {
        if (error.status === 400) throw error;
        remote.error = error.message;
      }
    }
    const candidates = [...local.candidates, ...(remote.candidates || [])]
      .sort(
        (a, b) =>
          b.score - a.score ||
          Number(b.source === "custom") - Number(a.source === "custom"),
      )
      .slice(0, 5);
    const first = candidates[0];
    return {
      ...remote,
      originalText: prepared.text,
      fields:
        first?.source === "custom"
          ? local.fields
          : remote.fields || local.fields,
      candidates,
      bestCandidateId:
        first &&
        ((first.consistent && first.score >= 80) ||
          (first.matchMethod &&
            first.score === 100 &&
            !first.conflicts?.length))
          ? first.catalogVariantId
          : null,
      available: remote.available || products.length > 0,
      customCount: this.store.customFilaments().length,
      qr: remote.qr || {
        ...prepared.qr,
        conflicts: prepared.qrMerged.conflicts,
      },
      message: candidates.some((p) => p.source === "custom")
        ? "Includes matches from your custom filament database. Review the product, color and size before saving."
        : (remote.available ? remote.message : local.message) || remote.message,
    };
  }
}
