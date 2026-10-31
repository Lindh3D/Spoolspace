import { materialIdentity, normalizeText } from "./filament-normalize.mjs";
import { parseQRCode } from "./qr-evidence.mjs";

const MAX_PAGE_BYTES = 1024 * 1024;
const number = (value, min, max) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max
    ? value
    : null;
const text = (value, limit = 160) =>
  typeof value === "string" && value.trim().length <= limit ? value.trim() : "";

export function prusaSpoolURL(raw) {
  const decoded = parseQRCode(raw);
  if (!decoded?.url) return null;
  const url = new URL(decoded.url);
  if (url.port || url.username || url.password) return null;
  let id;
  if (["prusa.io", "www.prusa.io"].includes(url.hostname))
    id = url.pathname.match(/^\/s\/([a-f0-9]{6,32})\/?$/i)?.[1];
  else if (
    ["prusament.com", "www.prusament.com"].includes(url.hostname) &&
    /^\/spool\/?$/.test(url.pathname)
  )
    id = url.searchParams.get("spoolId");
  if (!id || !/^[a-f0-9]{6,32}$/i.test(id)) return null;
  return {
    spoolId: id.toLowerCase(),
    url: `https://prusament.com/spool/?spoolId=${id.toLowerCase()}`,
  };
}

export function parsePrusaSpool(html, source) {
  // Parse the site's JSON string as data, never execute its scripts.
  const raw = html.match(
    /\bvar\s+spoolData\s*=\s*'((?:\\.|[^'\\])*)'\s*;/,
  )?.[1];
  if (!raw) throw new Error("The spool report has no supported product data.");
  const data = JSON.parse(raw);
  const filament = data?.filament;
  if (data.sample || !filament || typeof filament !== "object")
    throw new Error("This is not an individual spool report.");
  const material = text(filament.material, 40),
    colorName = text(filament.color_name, 80);
  if (!material || !colorName)
    throw new Error("The spool report is missing its material or color.");
  const identity = materialIdentity(material);
  const fields = {
    brand: "Prusament",
    manufacturer: "Prusa Research",
    material: identity?.material || material,
    formulation: identity?.formulation || material,
    productLine: material,
    colorName,
  };
  if (/^#[\da-f]{6}$/i.test(filament.color_rgb))
    fields.colorHex = filament.color_rgb.toLowerCase();
  const min = number(filament.he_min, 20, 500),
    max = number(filament.he_max, 20, 500);
  if (min !== null && max !== null && min <= max) {
    fields.temperatureMin = min;
    fields.temperatureMax = max;
  }
  const factoryWeight = number(data.weight, 1, 100000),
    tare = number(data.spool_weight, 1, 100000);
  const productName = text(filament.name);
  const size = productName.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
  const nominalWeight = size
    ? Number(size[1].replace(",", ".")) *
      (size[2].toLowerCase() === "kg" ? 1000 : 1)
    : null;
  if (factoryWeight !== null) fields.initialWeight = factoryWeight;
  else if (nominalWeight > 0 && nominalWeight <= 100000)
    fields.initialWeight = nominalWeight;
  if (tare !== null) fields.emptySpoolWeight = tare;
  fields.name = [fields.brand, fields.productLine, fields.colorName].join(
    " · ",
  );
  const bedMin = number(filament.hb_min, 20, 200),
    bedMax = number(filament.hb_max, 20, 200);
  const metadata = {
    productName,
    nominalWeight,
    factoryWeight,
    lengthMetres: number(data.length, 1, 100000),
    manufactureDate: text(data.manufacture_date, 40),
    bedMin:
      bedMin !== null && bedMax !== null && bedMin <= bedMax ? bedMin : null,
    bedMax:
      bedMin !== null && bedMax !== null && bedMin <= bedMax ? bedMax : null,
  };
  const summary = [
    `Prusament spool report: ${source.spoolId}`,
    `Source: ${source.url}`,
    productName && `Product: ${productName}`,
    factoryWeight !== null &&
      `Factory filament weight: ${factoryWeight} g (original, not current remaining weight)`,
    nominalWeight && `Nominal marketed size: ${nominalWeight} g`,
    tare !== null && `Empty spool weight from manufacturer: ${tare} g`,
    metadata.bedMin !== null &&
      `Heatbed: ${metadata.bedMin}–${metadata.bedMax} °C`,
    metadata.manufactureDate && `Manufactured: ${metadata.manufactureDate}`,
    metadata.lengthMetres !== null &&
      `Original length: ${metadata.lengthMetres} m`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    status: "ok",
    source: "Prusament spool report",
    ...source,
    fields,
    metadata,
    summary,
  };
}

export class PrusaSpoolReports {
  constructor({ fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
    this.fetch = fetchImpl;
    this.now = now;
    this.cache = new Map();
    this.pending = new Map();
  }
  async lookup(codes, enabled = true) {
    if (!Array.isArray(codes) || codes.length !== 1) return null;
    const source = prusaSpoolURL(codes[0]);
    if (!source) return null;
    if (!enabled)
      return {
        ...source,
        status: "disabled",
        message:
          "Online spool details are disabled. Label and local catalog recognition remain available.",
      };
    const cached = this.cache.get(source.spoolId);
    if (cached && cached.expires > this.now()) return cached.value;
    if (this.pending.has(source.spoolId))
      return this.pending.get(source.spoolId);
    const request = this.read(source)
      .then((value) => {
        if (value.status !== "ok") return value;
        if (this.cache.size >= 200)
          this.cache.delete(this.cache.keys().next().value);
        this.cache.set(source.spoolId, {
          value,
          expires: this.now() + 86400000,
        });
        return value;
      })
      .finally(() => this.pending.delete(source.spoolId));
    this.pending.set(source.spoolId, request);
    return request;
  }
  async read(source) {
    try {
      // Only this fixed HTTPS endpoint is contacted. QR-provided hosts, ports,
      // credentials and redirects never become network destinations.
      const response = await this.fetch(source.url, {
        redirect: "error",
        signal: AbortSignal.timeout(8000),
        headers: { accept: "text/html" },
      });
      if (
        !response.ok ||
        !/text\/html/i.test(response.headers.get("content-type") || "")
      )
        throw new Error("Spool report unavailable.");
      if (Number(response.headers.get("content-length")) > MAX_PAGE_BYTES) {
        await response.body?.cancel();
        throw new Error("Spool report too large.");
      }
      const chunks = [],
        reader = response.body.getReader();
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > MAX_PAGE_BYTES) {
            await reader.cancel();
            throw new Error("Spool report too large.");
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
      return parsePrusaSpool(Buffer.concat(chunks).toString("utf8"), source);
    } catch {
      return {
        ...source,
        status: "unavailable",
        message:
          "Could not retrieve Prusa spool details. The label text, QR brand and local catalog are still available. Check your internet connection or retry the scan.",
      };
    }
  }
}

export function mergeSpoolReport(
  original,
  report,
  { confirmed = [], ocrText = "" } = {},
) {
  const fields = { ...original },
    conflicts = [];
  if (report?.status !== "ok") return { fields, conflicts };
  for (const key of ["brand", "material"]) {
    if (
      fields[key] &&
      normalizeText(fields[key]) !== normalizeText(report.fields[key])
    )
      conflicts.push({
        field: key,
        labelValue: fields[key],
        reportValue: report.fields[key],
      });
  }
  const identityConflict = conflicts.length > 0;
  for (const [key, value] of Object.entries(report.fields)) {
    if (key === "name") continue;
    if (identityConflict) continue;
    const previous = fields[key];
    if (
      confirmed.includes(key) &&
      normalizeText(previous) !== normalizeText(value)
    ) {
      conflicts.push({
        field: key,
        labelValue: previous ?? "",
        reportValue: value,
      });
      continue;
    }
    if (
      previous === undefined ||
      previous === null ||
      previous === "" ||
      normalizeText(previous) === normalizeText(value)
    ) {
      fields[key] = value;
      continue;
    }
    const refinement =
      !confirmed.includes(key) &&
      ((key === "colorName" &&
        normalizeText(value).split(" ").includes(normalizeText(previous))) ||
        (key === "colorHex" && !/#[\da-f]{6}\b/i.test(ocrText)) ||
        (key === "initialWeight" &&
          previous === report.metadata.nominalWeight));
    if (refinement) fields[key] = value;
    else
      conflicts.push({ field: key, labelValue: previous, reportValue: value });
  }
  fields.notes = [fields.notes, report.summary]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);
  fields.name = [
    fields.brand,
    fields.productLine || fields.material,
    fields.colorName,
  ]
    .filter(Boolean)
    .join(" · ");
  return { fields, conflicts };
}
