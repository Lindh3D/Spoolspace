import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  copyFileSync,
  statSync,
} from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { ValidationError } from "./store.mjs";
import { compactText, materialIdentity } from "./filament-normalize.mjs";
import { rankCatalog } from "./ofd-match.mjs";
import { prepareCatalogInput } from "./catalog-input.mjs";

export const OFD_URL =
  "https://api.openfilamentdatabase.org/sqlite/filaments.db";
const DAY = 24 * 60 * 60 * 1000,
  MAX_BYTES = 80 * 1024 * 1024;
const required = {
  meta: ["key", "value"],
  brand: ["id", "name", "slug"],
  material: ["id", "brand_id", "material"],
  filament: [
    "id",
    "brand_id",
    "material_id",
    "name",
    "material",
    "min_print_temperature",
    "max_print_temperature",
  ],
  variant: ["id", "filament_id", "name", "color_hex"],
  size: [
    "id",
    "variant_id",
    "filament_weight",
    "diameter",
    "empty_spool_weight",
  ],
  store: ["id", "name"],
  purchase_link: ["size_id", "store_id"],
};
const safeJSON = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const timestamp = () => new Date().toISOString();
const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => "\\" + c);
const notNull = (value) => value !== null && value !== undefined;

export function validateCatalogFile(path) {
  let db;
  try {
    const size = statSync(path).size;
    if (size < 100 || size > MAX_BYTES)
      throw Error("Catalog file size is invalid.");
    db = new DatabaseSync(path, { readOnly: true });
    db.exec("PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;");
    const integrity = db.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok")
      throw Error("SQLite integrity check failed.");
    const schema = {};
    for (const [table, columns] of Object.entries(required)) {
      if (
        !db
          .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
          .get(table)
      )
        throw Error(`Required table ${table} is missing.`);
      schema[table] = new Set(
        db
          .prepare(`PRAGMA table_info("${table}")`)
          .all()
          .map((c) => c.name),
      );
      for (const column of columns)
        if (!schema[table].has(column))
          throw Error(`Required column ${table}.${column} is missing.`);
    }
    const meta = Object.fromEntries(
      db
        .prepare("SELECT key,value FROM meta")
        .all()
        .map((row) => [row.key, row.value]),
    );
    const counts = db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM brand) brands,(SELECT COUNT(*) FROM filament) productLines,(SELECT COUNT(*) FROM variant) colorVariants,(SELECT COUNT(*) FROM size) sizes,(SELECT COUNT(*) FROM store) vendors",
      )
      .get();
    if (!counts.brands || !counts.productLines || !counts.colorVariants)
      throw Error("The catalog contains no usable filament products.");
    return {
      version: meta.version || null,
      generatedAt: meta.generated_at || null,
      counts,
      schema: Object.fromEntries(
        Object.entries(schema).map(([table, columns]) => [table, [...columns]]),
      ),
      bytes: size,
    };
  } catch (error) {
    throw new ValidationError(
      `OFD catalog validation failed: ${error.message}`,
      422,
    );
  } finally {
    db?.close();
  }
}

export class OFDCatalog {
  constructor({
    directory,
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
  } = {}) {
    this.directory = directory;
    this.fetch = fetchImpl;
    this.now = now;
    this.path = join(directory, "open_filament_database.db");
    this.statePath = join(directory, "open_filament_database.state.json");
    mkdirSync(directory, { recursive: true });
    this.state = {
      autoUpdate: true,
      lastCheckedAt: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastDownloadedAt: null,
      etag: null,
      lastModified: null,
      ...(existsSync(this.statePath)
        ? safeJSON(readFileSync(this.statePath, "utf8"), {})
        : {}),
    };
    this.phase = "idle";
    this.error = this.state.lastError || null;
    this.available = false;
    this.closed = false;
    if (existsSync(this.path)) {
      try {
        this.info = validateCatalogFile(this.path);
        this.open();
      } catch (error) {
        this.error = error.message;
      }
    }
  }
  persist() {
    const temp = this.statePath + ".tmp";
    writeFileSync(temp, JSON.stringify(this.state, null, 2));
    renameSync(temp, this.statePath);
  }
  open() {
    this.db = new DatabaseSync(this.path, { readOnly: true });
    this.db.exec("PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;");
    this.db.function("ofd_norm", { deterministic: true }, (value) =>
      compactText(value),
    );
    this.db.function(
      "ofd_base",
      { deterministic: true },
      (value) =>
        materialIdentity(value)?.material || String(value || "").toUpperCase(),
    );
    this.schema = this.info.schema;
    this.brands = this.db.prepare("SELECT id,name,slug FROM brand").all();
    this.lines = this.db
      .prepare(
        "SELECT f.id,f.name,f.material,f.brand_id brandId,b.name brand FROM filament f JOIN brand b ON b.id=f.brand_id",
      )
      .all();
    this.available = true;
    this.statements = new Map();
  }
  status() {
    return {
      source: "Open Filament Database",
      sourceUrl: OFD_URL,
      available: this.available,
      busy: Boolean(this.syncPromise),
      phase: this.phase,
      error: this.error,
      usingCached: this.available && Boolean(this.error),
      autoUpdate: this.state.autoUpdate,
      version: this.info?.version || null,
      generatedAt: this.info?.generatedAt || null,
      lastCheckedAt: this.state.lastCheckedAt,
      lastSuccessAt: this.state.lastSuccessAt,
      lastDownloadedAt: this.state.lastDownloadedAt,
      lastAttemptAt: this.state.lastAttemptAt,
      counts: this.info?.counts || {
        brands: 0,
        productLines: 0,
        colorVariants: 0,
        sizes: 0,
        vendors: 0,
      },
      downloadedBytes: this.downloadedBytes || 0,
      totalBytes: this.totalBytes || null,
      progress: this.totalBytes
        ? Math.min(
            99,
            Math.floor(((this.downloadedBytes || 0) / this.totalBytes) * 100),
          )
        : null,
      path: this.path,
      unsupportedFields: ["manufacturer"],
      limitations: [
        "The current OFD schema has no separate manufacturer column.",
        "Spool weights, temperatures, colors and seller links can be missing. Remaining filament is never supplied by this catalog.",
      ],
    };
  }
  configure(input) {
    if (typeof input?.autoUpdate !== "boolean")
      throw new ValidationError(
        "Automatic updates must be enabled or disabled.",
      );
    this.state.autoUpdate = input.autoUpdate;
    this.persist();
    if (input.autoUpdate && this.automaticStarted) this.maybeSync();
    return this.status();
  }
  startAutomatic() {
    if (this.automaticStarted) return this.status();
    this.automaticStarted = true;
    this.timer = setInterval(() => this.maybeSync(), 60 * 60 * 1000);
    this.timer.unref();
    this.maybeSync();
    return this.status();
  }
  maybeSync() {
    const last = Date.parse(this.state.lastAttemptAt || "");
    if (
      !this.closed &&
      this.state.autoUpdate &&
      !this.syncPromise &&
      (!Number.isFinite(last) || this.now() - last >= DAY)
    )
      this.startSync();
  }
  startSync() {
    if (!this.syncPromise) this.sync().catch(() => {});
    return this.status();
  }
  sync() {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.download().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }
  async download() {
    this.phase = "checking";
    this.error = null;
    this.downloadedBytes = 0;
    this.totalBytes = null;
    this.state.lastAttemptAt = new Date(this.now()).toISOString();
    this.persist();
    const temporary = join(
      this.directory,
      `open_filament_database.${randomUUID()}.download`,
    );
    let file;
    this.abort = new AbortController();
    try {
      const headers = {
        Accept: "application/octet-stream",
        "Accept-Encoding": "identity",
      };
      if (this.available && this.state.etag)
        headers["If-None-Match"] = this.state.etag;
      else if (this.available && this.state.lastModified)
        headers["If-Modified-Since"] = this.state.lastModified;
      const response = await this.fetch(OFD_URL, {
        headers,
        signal: AbortSignal.any([
          this.abort.signal,
          AbortSignal.timeout(120000),
        ]),
      });
      this.state.lastCheckedAt = new Date(this.now()).toISOString();
      if (response.status === 304) {
        if (!this.available)
          throw Error(
            "The server reported an unchanged catalog but no local copy is available.",
          );
        this.phase = "unchanged";
        this.state.lastError = null;
        this.state.lastSuccessAt = this.state.lastCheckedAt;
        this.persist();
        return this.status();
      }
      if (!response.ok)
        throw Error(`OFD download failed (HTTP ${response.status}).`);
      const declared = Number(response.headers.get("content-length"));
      if (
        !response.headers.get("content-encoding") &&
        Number.isFinite(declared) &&
        declared > 0
      )
        this.totalBytes = declared;
      if (this.totalBytes > MAX_BYTES)
        throw Error("The catalog exceeds the 80 MB download limit.");
      if (!response.body) throw Error("The catalog response was empty.");
      this.phase = "downloading";
      file = await open(temporary, "wx");
      for await (const chunk of response.body) {
        this.downloadedBytes += chunk.byteLength;
        if (this.downloadedBytes > MAX_BYTES)
          throw Error("The catalog exceeds the 80 MB download limit.");
        await file.writeFile(chunk);
      }
      await file.sync();
      await file.close();
      file = null;
      if (this.totalBytes && this.downloadedBytes !== this.totalBytes)
        throw Error("The catalog download was incomplete.");
      this.phase = "validating";
      const info = validateCatalogFile(temporary);
      this.install(temporary, info);
      Object.assign(this.state, {
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        lastSuccessAt: new Date(this.now()).toISOString(),
        lastDownloadedAt: new Date(this.now()).toISOString(),
      });
      this.phase = "updated";
      this.state.lastError = null;
      this.persist();
      return this.status();
    } catch (error) {
      this.error = `${error.message} ${this.available ? "Using the previous local catalog." : "Connect to the internet and try Update Filament Database."}`;
      this.state.lastError = this.error;
      this.phase = "failed";
      this.persist();
      throw new ValidationError(this.error, 503);
    } finally {
      await file?.close();
      if (existsSync(temporary)) unlinkSync(temporary);
      this.abort = null;
    }
  }
  install(temporary, info) {
    this.db?.close();
    this.db = null;
    try {
      renameSync(temporary, this.path);
      this.info = info;
      this.open();
    } catch (error) {
      if (existsSync(this.path)) {
        this.info = validateCatalogFile(this.path);
        this.open();
      }
      throw error;
    }
  }
  // Used to adopt a previously downloaded official snapshot without fetching it
  // a second time. No file-path import is exposed through the HTTP API.
  adoptSnapshot(path, metadata = {}) {
    const info = validateCatalogFile(path),
      bytes = readFileSync(path);
    if (
      metadata.sha256 &&
      createHash("sha256").update(bytes).digest("hex") !== metadata.sha256
    )
      throw new ValidationError(
        "The downloaded snapshot checksum does not match OFD.",
        422,
      );
    const temporary = join(
      this.directory,
      `open_filament_database.${randomUUID()}.download`,
    );
    copyFileSync(path, temporary);
    try {
      this.install(temporary, info);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
    Object.assign(this.state, {
      lastCheckedAt: timestamp(),
      lastAttemptAt: timestamp(),
      lastSuccessAt: timestamp(),
      lastDownloadedAt: timestamp(),
      etag: metadata.etag || null,
      lastModified: metadata.lastModified || null,
      lastError: null,
    });
    this.phase = "updated";
    this.error = null;
    this.persist();
    return this.status();
  }
  prepare(sql) {
    let statement = this.statements.get(sql);
    if (!statement) {
      statement = this.db.prepare(sql);
      if (this.statements.size >= 80) this.statements.clear();
      this.statements.set(sql, statement);
    }
    return statement;
  }
  selectSQL() {
    const optional = (table, column, alias) =>
      this.schema[table].includes(column) ? `${alias}.${column}` : "NULL";
    return `SELECT b.id brandId,b.name brand,f.id lineId,${optional("filament", "uuid", "f")} productUUID,f.name productLine,f.material formulation,f.min_print_temperature temperatureMin,f.max_print_temperature temperatureMax,v.id variantId,${optional("variant", "uuid", "v")} variantUUID,v.name colorName,v.color_hex colorHex,${optional("variant", "color_standards", "v")} colorStandards,${optional("variant", "hex_variants", "v")} hexVariants,s.id sizeId,${optional("size", "uuid", "s")} sizeUUID,s.filament_weight initialWeight,s.empty_spool_weight emptySpoolWeight,s.diameter diameter,(SELECT json_group_array(DISTINCT st.name) FROM purchase_link pl JOIN store st ON st.id=pl.store_id WHERE pl.size_id=s.id) vendors FROM filament f JOIN brand b ON b.id=f.brand_id JOIN material m ON m.id=f.material_id JOIN variant v ON v.filament_id=f.id LEFT JOIN size s ON s.variant_id=v.id`;
  }
  products(rows) {
    const grouped = new Map();
    for (const row of rows) {
      const id = row.variantUUID || row.variantId;
      let product = grouped.get(id);
      if (!product) {
        product = {
          source: "Open Filament Database",
          catalogProductId: row.productUUID || row.lineId,
          catalogVariantId: id,
          catalogVersion: this.info.version,
          brandId: row.brandId,
          lineId: row.lineId,
          name: [row.brand, row.productLine, row.colorName]
            .filter(Boolean)
            .join(" · "),
          brand: row.brand,
          manufacturer: null,
          material:
            materialIdentity(row.formulation)?.material || row.formulation,
          formulation: row.formulation,
          productLine: row.productLine,
          colorName: row.colorName,
          colorHex: /^#[0-9a-f]{6}$/i.test(row.colorHex) ? row.colorHex : null,
          temperatureMin: row.temperatureMin,
          temperatureMax: row.temperatureMax,
          vendors: [],
          sizes: [],
        };
        grouped.set(id, product);
      }
      product.colorCodes = safeJSON(row.colorStandards, {}) || {};
      product.hexVariants = safeJSON(row.hexVariants, []) || [];
      const vendors = safeJSON(row.vendors, []);
      for (const vendor of vendors)
        if (vendor && !product.vendors.includes(vendor))
          product.vendors.push(vendor);
      if (
        row.sizeId &&
        !product.sizes.some(
          (s) => s.catalogSizeId === (row.sizeUUID || row.sizeId),
        )
      )
        product.sizes.push({
          catalogSizeId: row.sizeUUID || row.sizeId,
          initialWeight: row.initialWeight,
          emptySpoolWeight: row.emptySpoolWeight,
          diameter: row.diameter,
          vendors,
        });
    }
    return [...grouped.values()];
  }
  search(input = {}) {
    if (!this.available)
      return {
        items: [],
        available: false,
        message:
          "No local OFD catalog yet. Open Settings and update the filament database.",
      };
    if (input.manufacturer)
      return {
        items: [],
        available: true,
        message:
          "The current OFD schema does not provide a separate manufacturer field.",
      };
    const conditions = [],
      params = [];
    const like = (expression, value) => {
      if (value !== undefined && String(value).trim()) {
        conditions.push(`${expression} LIKE ? ESCAPE '\\'`);
        params.push(
          "%" +
            escapeLike(compactText(value).replace(/bambulabs/g, "bambulab")) +
            "%",
        );
      }
    };
    const extraColors = ["color_standards", "hex_variants"]
      .filter((column) => this.schema.variant.includes(column))
      .map((column) => ` || ' ' || COALESCE(v.${column},'')`)
      .join("");
    like("ofd_norm(b.name || ' ' || b.slug)", input.brand);
    like("ofd_norm(f.name)", input.productLine);
    like(
      `ofd_norm(v.name || ' ' || v.color_hex${extraColors})`,
      input.color || input.colorHex,
    );
    if (input.material) {
      conditions.push("ofd_base(f.material)=?");
      params.push(
        materialIdentity(input.material)?.material ||
          String(input.material).toUpperCase(),
      );
    }
    if (input.vendor) {
      conditions.push(
        "EXISTS(SELECT 1 FROM purchase_link link JOIN store seller ON seller.id=link.store_id WHERE link.size_id=s.id AND ofd_norm(seller.name) LIKE ? ESCAPE '\\')",
      );
      params.push("%" + escapeLike(compactText(input.vendor)) + "%");
    }
    for (const [key, column, operator] of [
      ["weight", "s.filament_weight", "="],
      ["spoolWeight", "s.empty_spool_weight", "="],
      ["temperatureMin", "f.min_print_temperature", ">="],
      ["temperatureMax", "f.max_print_temperature", "<="],
    ])
      if (notNull(input[key]) && input[key] !== "") {
        const value = Number(input[key]);
        if (!Number.isFinite(value) || value < 0 || value > 100000)
          throw new ValidationError(`Invalid ${key} filter.`);
        conditions.push(`${column} ${operator} ?`);
        params.push(value);
      }
    const q = String(input.q || "")
      .slice(0, 300)
      .trim();
    const terms = q.split(/\s+/).map(compactText).filter(Boolean).slice(0, 10);
    if (q && !terms.length)
      return {
        items: [],
        available: true,
        message: "Enter a brand, product, material or color.",
      };
    const colorStandards = extraColors;
    for (const term of terms) {
      conditions.push(
        `(ofd_norm(b.name || ' ' || f.name || ' ' || f.material || ' ' || v.name || ' ' || v.color_hex${colorStandards} || ' ' || COALESCE(s.filament_weight,'') || ' ' || COALESCE(s.empty_spool_weight,'') || ' ' || COALESCE(f.min_print_temperature,'') || ' ' || COALESCE(f.max_print_temperature,'')) LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM purchase_link link JOIN store seller ON seller.id=link.store_id WHERE link.size_id=s.id AND ofd_norm(seller.name) LIKE ? ESCAPE '\\'))`,
      );
      const value =
        "%" + escapeLike(term.replace(/bambulabs/g, "bambulab")) + "%";
      params.push(value, value);
    }
    const limit = Math.floor(
      Math.min(100, Math.max(1, Number(input.limit) || 30)),
    );
    const rows = this.prepare(
      this.selectSQL() +
        (conditions.length ? " WHERE " + conditions.join(" AND ") : "") +
        " ORDER BY b.name,f.name,v.name,s.filament_weight LIMIT ?",
    ).all(...params, limit * 8);
    return {
      items: this.products(rows).slice(0, limit),
      available: true,
      version: this.info.version,
      limited: rows.length >= limit * 8,
    };
  }
  getProduct(id) {
    if (!this.available)
      throw new ValidationError(
        "The local filament database is not available.",
        503,
      );
    if (typeof id !== "string" || id.length > 160)
      throw new ValidationError("Invalid catalog identifier.");
    const hasUUID = this.schema.variant.includes("uuid");
    const rows = this.prepare(
      this.selectSQL() +
        ` WHERE (v.id=?${hasUUID ? " OR v.uuid=?" : ""}) ORDER BY s.filament_weight LIMIT 100`,
    ).all(...(hasUUID ? [id, id] : [id]));
    const product = this.products(rows)[0];
    if (!product) throw new ValidationError("Catalog product not found.", 404);
    return product;
  }
  match(input = {}) {
    const prepared = prepareCatalogInput(input);
    const { text, fields, qr, qrMerged } = prepared;
    if (!this.available)
      return {
        originalText: text,
        candidates: [],
        bestCandidateId: null,
        available: false,
        message:
          "No local filament catalog is available. Update Filament Database in Settings; manual entry and local OCR remain available.",
      };
    const result = rankCatalog({
      ...prepared,
      brands: this.brands,
      lines: this.lines,
      readProducts: (ids) =>
        ids.length
          ? this.products(
              this.prepare(
                this.selectSQL() +
                  ` WHERE f.id IN (${ids.map(() => "?").join(",")}) LIMIT 3000`,
              ).all(...ids),
            )
          : [],
    });
    const exact = [],
      excludedMaterials = [];
    const expectedMaterial = materialIdentity(
      result.fields.material || result.fields.productLine,
    )?.material;
    if (qr.codes.length === 1) {
      const columns = [
        "qr_identifier",
        "barcode_identifier",
        "gtin",
        "article_number",
        "uuid",
      ].filter((c) => this.schema.size.includes(c));
      for (const identifier of qr.codes[0].identifiers) {
        const clauses = columns.map((c) => `CAST(s.${c} AS TEXT)=?`),
          params = columns.map(() => identifier);
        if (this.schema.purchase_link.includes("url")) {
          clauses.push(
            "EXISTS(SELECT 1 FROM purchase_link qpl WHERE qpl.size_id=s.id AND qpl.url=?)",
          );
          params.push(identifier);
        }
        if (!clauses.length) continue;
        for (const p of this.products(
          this.prepare(
            this.selectSQL() +
              " WHERE (" +
              clauses.join(" OR ") +
              ") LIMIT 100",
          ).all(...params),
        )) {
          if (
            [...exact, ...excludedMaterials].some(
              (c) => c.catalogVariantId === p.catalogVariantId,
            )
          )
            continue;
          if (expectedMaterial && p.material !== expectedMaterial) {
            excludedMaterials.push({
              catalogVariantId: p.catalogVariantId,
              name: p.name,
              material: p.material,
              expectedMaterial,
            });
            continue;
          }
          const size = p.sizes.length === 1 ? p.sizes[0] : null;
          const conflicts = [...qrMerged.conflicts];
          for (const key of ["brand", "material", "productLine", "colorName"])
            if (fields[key] && compactText(fields[key]) !== compactText(p[key]))
              conflicts.push({
                field: key,
                textValue: fields[key],
                qrValue: p[key],
              });
          exact.push({
            ...p,
            ...(size
              ? {
                  catalogSizeId: size.catalogSizeId,
                  initialWeight: size.initialWeight,
                  emptySpoolWeight: size.emptySpoolWeight,
                }
              : {}),
            score: conflicts.length ? 79 : 100,
            fieldScores: {},
            matchMethod: "Exact QR identifier in the local catalog",
            conflicts,
          });
        }
      }
    }
    return {
      ...result,
      ...(excludedMaterials.length
        ? {
            message: `${result.message} QR catalog ${[...new Set(excludedMaterials.map((p) => p.material))].join(", ")} entries were excluded because the label or confirmed field identifies ${expectedMaterial}.`,
          }
        : exact.length
          ? {
              message:
                "An exact QR catalog identifier was found. Review the product, color and size before saving.",
            }
          : {}),
      originalText: text,
      candidates: [
        ...exact,
        ...result.candidates.filter(
          (p) => !exact.some((e) => e.catalogVariantId === p.catalogVariantId),
        ),
      ].slice(0, 5),
      bestCandidateId:
        exact.length === 1 && !exact[0].conflicts.length
          ? exact[0].catalogVariantId
          : exact.length
            ? null
            : result.bestCandidateId,
      qr: {
        ...qr,
        conflicts: qrMerged.conflicts,
        exactMatches: exact.length,
        excludedMaterials,
      },
      available: true,
      version: this.info.version,
    };
  }
  async close() {
    this.closed = true;
    clearInterval(this.timer);
    this.abort?.abort();
    if (this.syncPromise) await this.syncPromise.catch(() => {});
    this.db?.close();
    this.db = null;
  }
}
