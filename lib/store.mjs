import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { validateTemplate, summarizeTemplate } from "./templates.mjs";

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const textFields = {
  name: 160,
  brand: 100,
  vendor: 100,
  manufacturer: 100,
  productLine: 120,
  formulation: 120,
  catalogProductId: 160,
  catalogVariantId: 160,
  catalogSizeId: 160,
  catalogVersion: 80,
  ocrText: 12000,
  material: 40,
  colorName: 80,
  location: 100,
  storage: 100,
  notes: 4000,
  purchaseDate: 10,
  openedDate: 10,
  lastDriedAt: 35,
};
const weightFields = ["initialWeight", "remainingWeight", "emptySpoolWeight"];
const statuses = ["available", "in-use", "empty"];
const now = () => new Date().toISOString();
const identityDefaults = {
  vendor: "",
  manufacturer: "",
  productLine: "",
  formulation: "",
  catalogProductId: "",
  catalogVariantId: "",
  catalogSizeId: "",
  catalogVersion: "",
  ocrText: "",
  qrCodes: [],
  temperatureMin: null,
  temperatureMax: null,
};
const normalizeSpool = (value) => ({ ...identityDefaults, ...value });
const customFields = [
  "brand",
  "material",
  "productLine",
  "formulation",
  "manufacturer",
  "colorName",
  "colorHex",
  "temperatureMin",
  "temperatureMax",
];
const customKey = (spool) =>
  JSON.stringify(
    customFields.slice(0, 7).map((key) =>
      String(
        key === "formulation" ? spool[key] || spool.material : spool[key] || "",
      )
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase(),
    ),
  );
const customName = (spool) =>
  [
    spool.brand,
    spool.productLine || spool.formulation || spool.material,
    spool.colorName,
  ]
    .filter(Boolean)
    .join(" · ");

export function validateSpool(input, previous) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError("Spool must be an object.");
  const value = previous
    ? normalizeSpool(previous)
    : {
        id: randomUUID(),
        name: "",
        brand: "",
        ...identityDefaults,
        material: "PLA",
        colorName: "",
        colorHex: "#8295a8",
        initialWeight: 1000,
        remainingWeight: 1000,
        emptySpoolWeight: 0,
        location: "",
        storage: "Sealed bag",
        status: "available",
        purchaseDate: "",
        openedDate: "",
        lastDriedAt: "",
        notes: "",
        createdAt: now(),
        updatedAt: now(),
      };
  for (const [key, limit] of Object.entries(textFields)) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "string" || input[key].length > limit)
        throw new ValidationError(
          `${key} must be text, at most ${limit} characters.`,
        );
      value[key] = key === "ocrText" ? input[key] : input[key].trim();
    }
  }
  if (!value.name) throw new ValidationError("Give this spool a name.");
  if (!value.material) throw new ValidationError("Choose a filament material.");
  if (
    !previous &&
    (input.catalogVariantId || input.ocrText || input.qrCodes?.length) &&
    (!Number.isFinite(input.initialWeight) ||
      !Number.isFinite(input.remainingWeight))
  )
    throw new ValidationError(
      "Enter the filament capacity and actual remaining weight for a recognized/catalog spool.",
    );
  if (input.qrCodes !== undefined) {
    if (
      !Array.isArray(input.qrCodes) ||
      input.qrCodes.length > 5 ||
      input.qrCodes.some((c) => typeof c !== "string" || c.length > 4096)
    )
      throw new ValidationError(
        "QR codes must contain at most five text values of up to 4096 characters.",
      );
    value.qrCodes = [...new Set(input.qrCodes)];
  }
  for (const key of ["temperatureMin", "temperatureMax"]) {
    if (input[key] !== undefined) {
      if (
        input[key] !== null &&
        (typeof input[key] !== "number" ||
          !Number.isFinite(input[key]) ||
          input[key] < 20 ||
          input[key] > 500)
      )
        throw new ValidationError(
          `${key} must be blank or between 20 and 500 degrees C.`,
        );
      value[key] = input[key];
    }
  }
  if (
    value.temperatureMin !== null &&
    value.temperatureMax !== null &&
    value.temperatureMin > value.temperatureMax
  )
    throw new ValidationError(
      "Minimum print temperature cannot exceed the maximum.",
    );
  for (const key of weightFields) {
    if (input[key] !== undefined) {
      if (
        typeof input[key] !== "number" ||
        !Number.isFinite(input[key]) ||
        input[key] < 0 ||
        input[key] > 100000
      )
        throw new ValidationError(
          `${key} must be between 0 and 100,000 grams.`,
        );
      value[key] = Math.round(input[key] * 100) / 100;
    }
  }
  if (value.initialWeight <= 0)
    throw new ValidationError("Starting filament weight must be above zero.");
  if (value.remainingWeight > value.initialWeight)
    throw new ValidationError(
      "Remaining filament cannot exceed its starting weight.",
    );
  if (input.colorHex !== undefined) {
    if (
      typeof input.colorHex !== "string" ||
      !/^#[\da-f]{6}$/i.test(input.colorHex)
    )
      throw new ValidationError("Choose a valid six-digit color.");
    value.colorHex = input.colorHex;
  }
  if (input.status !== undefined) {
    if (!statuses.includes(input.status))
      throw new ValidationError("Unknown spool status.");
    value.status = input.status;
  }
  for (const key of ["purchaseDate", "openedDate"]) {
    if (
      value[key] &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value[key]) ||
        !Number.isFinite(Date.parse(value[key])))
    )
      throw new ValidationError(`${key} must be a date in YYYY-MM-DD format.`);
  }
  if (value.lastDriedAt && !Number.isFinite(Date.parse(value.lastDriedAt)))
    throw new ValidationError("Invalid drying date.");
  if (value.remainingWeight === 0) value.status = "empty";
  else if (value.status === "empty") value.status = "available";
  value.updatedAt = now();
  return value;
}

const defaultSettings = {
  appName: "Spoolspace",
  ollamaModel: "",
  lowStockThreshold: 200,
  demoData: true,
  customMaterials: [],
  spoolDefaults: null,
};

function materialName(value) {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value))
    throw new ValidationError("Enter a filament type on one line.");
  const name = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  if (!name || name.length > 40)
    throw new ValidationError("Filament type must be 1–40 characters.");
  return name;
}

function validateSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError("Settings must be an object.");
  const result = {};
  if (input.spoolDefaults !== undefined) {
    const defaults = input.spoolDefaults;
    if (defaults === null) result.spoolDefaults = null;
    else {
      if (!defaults || typeof defaults !== "object" || Array.isArray(defaults))
        throw new ValidationError(
          "Spool defaults must contain a location and storage type.",
        );
      result.spoolDefaults = {};
      for (const key of ["location", "storage"]) {
        if (
          typeof defaults[key] !== "string" ||
          defaults[key].length > textFields[key]
        )
          throw new ValidationError(
            `Default ${key} must be text, at most ${textFields[key]} characters.`,
          );
        result.spoolDefaults[key] = defaults[key].trim();
      }
    }
  }
  if (input.customMaterials !== undefined) {
    if (
      !Array.isArray(input.customMaterials) ||
      input.customMaterials.length > 200
    )
      throw new ValidationError("Save at most 200 custom filament types.");
    result.customMaterials = [
      ...new Set(input.customMaterials.map(materialName)),
    ];
  }
  if (input.appName !== undefined) {
    if (
      typeof input.appName !== "string" ||
      !input.appName.trim() ||
      input.appName.length > 80
    )
      throw new ValidationError("App name must be 1–80 characters.");
    result.appName = input.appName.trim();
  }
  if (input.ollamaModel !== undefined) {
    if (
      typeof input.ollamaModel !== "string" ||
      input.ollamaModel.length > 100 ||
      !/^[a-zA-Z0-9._:/-]*$/.test(input.ollamaModel)
    )
      throw new ValidationError("Enter a valid installed Ollama model name.");
    result.ollamaModel = input.ollamaModel;
  }
  if (input.lowStockThreshold !== undefined) {
    if (
      typeof input.lowStockThreshold !== "number" ||
      !Number.isFinite(input.lowStockThreshold) ||
      input.lowStockThreshold < 0 ||
      input.lowStockThreshold > 100000
    )
      throw new ValidationError(
        "Low stock threshold must be between 0 and 100,000 g.",
      );
    result.lowStockThreshold = input.lowStockThreshold;
  }
  return result;
}

export function createStore(filename, { seed = true } = {}) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS spools (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, at TEXT NOT NULL, type TEXT NOT NULL, spoolId TEXT, spoolName TEXT, message TEXT NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS label_templates (id TEXT PRIMARY KEY, data TEXT NOT NULL);",
  );
  const hadCustomTable = Boolean(
    db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='custom_filaments'",
      )
      .get(),
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS custom_filaments (id TEXT PRIMARY KEY, identity TEXT NOT NULL UNIQUE, data TEXT NOT NULL)",
  );
  const insertSpool = db.prepare("INSERT INTO spools (id,data) VALUES (?,?)");
  const updateSpool = db.prepare("UPDATE spools SET data=? WHERE id=?");
  const settings = () => ({
    ...defaultSettings,
    ...Object.fromEntries(
      db
        .prepare("SELECT key,value FROM settings")
        .all()
        .map((r) => [r.key, JSON.parse(r.value)]),
    ),
  });
  const writeSettings = (items) => {
    const stmt = db.prepare(
      "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    );
    for (const [key, value] of Object.entries(items))
      stmt.run(key, JSON.stringify(value));
    return settings();
  };
  const transact = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const get = (id) => {
    const row = db.prepare("SELECT data FROM spools WHERE id=?").get(id);
    if (!row) throw new ValidationError("Spool not found.", 404);
    return normalizeSpool(JSON.parse(row.data));
  };
  const fullTemplates = () =>
    db
      .prepare("SELECT data FROM label_templates ORDER BY rowid DESC")
      .all()
      .map((r) => JSON.parse(r.data));
  const getTemplate = (id) => {
    if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id))
      throw new ValidationError("Invalid label template ID.");
    const row = db
      .prepare("SELECT data FROM label_templates WHERE id=?")
      .get(id);
    if (!row) throw new ValidationError("Label template not found.", 404);
    return JSON.parse(row.data);
  };
  const log = (type, spool, message, data = {}) => {
    db.prepare(
      "INSERT INTO activity (id,at,type,spoolId,spoolName,message,data) VALUES (?,?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      now(),
      type,
      spool?.id || null,
      spool?.name || null,
      message,
      JSON.stringify(data),
    );
  };
  const save = (spool) => {
    updateSpool.run(JSON.stringify(spool), spool.id);
    return spool;
  };
  const rememberStorage = (spool) =>
    writeSettings({
      spoolDefaults: { location: spool.location, storage: spool.storage },
    });
  const customFilaments = () =>
    db
      .prepare("SELECT data FROM custom_filaments ORDER BY rowid DESC")
      .all()
      .map((row) => JSON.parse(row.data));
  const rememberFilament = (spool, force = false) => {
    if (
      !spool.brand ||
      !spool.material ||
      (spool.catalogVariantId &&
        !spool.catalogVariantId.startsWith("custom-") &&
        !force)
    )
      return;
    const key = customKey(spool);
    const row =
      db
        .prepare("SELECT data FROM custom_filaments WHERE identity=?")
        .get(key) ||
      (force && spool.catalogVariantId.startsWith("custom-")
        ? db
            .prepare("SELECT data FROM custom_filaments WHERE id=?")
            .get(spool.catalogVariantId)
        : null);
    const previous = row ? JSON.parse(row.data) : null;
    const id = previous?.catalogVariantId || `custom-${randomUUID()}`;
    const sizes = [...(previous?.sizes || [])];
    const size = {
      catalogSizeId:
        sizes.find((s) => s.initialWeight === spool.initialWeight)
          ?.catalogSizeId || `custom-size-${randomUUID()}`,
      initialWeight: spool.initialWeight,
      emptySpoolWeight:
        spool.emptySpoolWeight > 0 ? spool.emptySpoolWeight : null,
      diameter: null,
      vendors: spool.vendor ? [spool.vendor] : [],
    };
    const sizeIndex = sizes.findIndex(
      (s) => s.initialWeight === spool.initialWeight,
    );
    if (sizeIndex < 0) sizes.push(size);
    else
      sizes[sizeIndex] = {
        ...size,
        emptySpoolWeight:
          size.emptySpoolWeight ?? sizes[sizeIndex].emptySpoolWeight,
        vendors: [...new Set([...sizes[sizeIndex].vendors, ...size.vendors])],
      };
    const product = {
      source: "custom",
      catalogProductId: id,
      catalogVariantId: id,
      catalogVersion: "custom",
      ...Object.fromEntries(customFields.map((key) => [key, spool[key]])),
      formulation: spool.formulation || spool.material,
      name: customName(spool),
      sizes,
      vendors: [
        ...new Set([
          ...(previous?.vendors || []),
          ...(spool.vendor ? [spool.vendor] : []),
        ]),
      ],
      createdAt: previous?.createdAt || now(),
      updatedAt: now(),
    };
    db.prepare(
      "INSERT INTO custom_filaments(id,identity,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET identity=excluded.identity,data=excluded.data",
    ).run(id, key, JSON.stringify(product));
    return product;
  };
  const linkCustomFilament = (spool, product) => {
    if (!product || !spool.catalogVariantId.startsWith("custom-")) return;
    spool.catalogProductId = product.catalogProductId;
    spool.catalogVariantId = product.catalogVariantId;
    spool.catalogSizeId = product.sizes.find(
      (size) => size.initialWeight === spool.initialWeight,
    ).catalogSizeId;
    spool.catalogVersion = "custom";
  };
  const add = (input, remember = true) =>
    transact(() => {
      const spool = validateSpool(input);
      if (remember) {
        rememberStorage(spool);
        linkCustomFilament(spool, rememberFilament(spool));
      }
      insertSpool.run(spool.id, JSON.stringify(spool));
      log("added", spool, `Added ${spool.name}`, {
        grams: spool.remainingWeight,
      });
      return spool;
    });
  if (!db.prepare("SELECT value FROM settings WHERE key='initialized'").get()) {
    transact(() =>
      writeSettings({ ...defaultSettings, initialized: true, demoData: seed }),
    );
    if (seed) seedInventory((input) => add(input, false));
  }
  if (!hadCustomTable && !settings().demoData) {
    transact(() => {
      for (const row of db
        .prepare("SELECT data FROM spools ORDER BY rowid ASC")
        .all())
        rememberFilament(normalizeSpool(JSON.parse(row.data)));
    });
  }
  return {
    db,
    close: () => db.close(),
    get,
    settings,
    customFilaments,
    getCustomFilament: (id) => {
      const row = db
        .prepare("SELECT data FROM custom_filaments WHERE id=?")
        .get(id);
      if (!row) throw new ValidationError("Custom filament not found.", 404);
      return JSON.parse(row.data);
    },
    list: () =>
      db
        .prepare("SELECT data FROM spools ORDER BY rowid DESC")
        .all()
        .map((r) => normalizeSpool(JSON.parse(r.data))),
    listTemplates: () => fullTemplates().map(summarizeTemplate),
    getTemplate,
    saveTemplate: (input, id) =>
      transact(() => {
        const template = validateTemplate(
          input,
          id ? getTemplate(id) : undefined,
        );
        const existing = fullTemplates().filter((t) => t.id !== template.id);
        if (
          existing.length >= 250 ||
          existing.reduce((n, t) => n + JSON.stringify(t).length, 0) +
            JSON.stringify(template).length >
            32 * 1024 * 1024
        )
          throw new ValidationError(
            "The local template library is full. Remove an unused template before adding another.",
            413,
          );
        db.prepare(
          "INSERT INTO label_templates (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        ).run(template.id, JSON.stringify(template));
        log("template_saved", null, `Saved label template ${template.name}`);
        return template;
      }),
    deleteTemplate: (id) =>
      transact(() => {
        const template = getTemplate(id);
        db.prepare("DELETE FROM label_templates WHERE id=?").run(id);
        log(
          "template_deleted",
          null,
          `Removed label template ${template.name}`,
        );
        return { ok: true };
      }),
    activity: () =>
      db
        .prepare("SELECT * FROM activity ORDER BY at DESC,rowid DESC LIMIT 200")
        .all()
        .map((r) => ({ ...r, data: JSON.parse(r.data) })),
    add,
    update: (id, input) =>
      transact(() => {
        const previous = get(id);
        const spool = validateSpool(input, previous);
        const product = rememberFilament(
          spool,
          [...customFields, "initialWeight", "emptySpoolWeight"].some(
            (key) => spool[key] !== previous[key],
          ),
        );
        linkCustomFilament(spool, product);
        save(spool);
        if (
          spool.location !== previous.location ||
          spool.storage !== previous.storage
        )
          rememberStorage(spool);
        log("updated", spool, `Updated ${spool.name}`);
        return spool;
      }),
    remove: (id) =>
      transact(() => {
        const spool = get(id);
        db.prepare("DELETE FROM spools WHERE id=?").run(id);
        log("deleted", spool, `Removed ${spool.name}`);
        return { ok: true };
      }),
    start: (id) =>
      transact(() => {
        const spool = get(id);
        if (spool.remainingWeight <= 0)
          throw new ValidationError("An empty spool cannot be started.");
        if (spool.openedDate && spool.status === "in-use") return spool;
        const result = validateSpool(
          {
            openedDate: spool.openedDate || now().slice(0, 10),
            status: "in-use",
          },
          spool,
        );
        save(result);
        log("opened", spool, "Started using this spool");
        return result;
      }),
    use: (id, input) =>
      transact(() => {
        const spool = get(id);
        const grams = input?.grams;
        if (
          typeof grams !== "number" ||
          !Number.isFinite(grams) ||
          grams <= 0 ||
          grams > spool.remainingWeight
        )
          throw new ValidationError(
            "Print usage must be above zero and cannot exceed the remaining filament.",
          );
        if (
          input.note !== undefined &&
          (typeof input.note !== "string" || input.note.length > 500)
        )
          throw new ValidationError(
            "Print note must be at most 500 characters.",
          );
        const result = validateSpool(
          {
            openedDate: spool.openedDate || now().slice(0, 10),
            status: "in-use",
            remainingWeight: Math.max(
              0,
              Math.round((spool.remainingWeight - grams) * 100) / 100,
            ),
          },
          spool,
        );
        save(result);
        log(
          "print",
          spool,
          `Used ${grams} g${input.note ? ` · ${input.note}` : ""}`,
          { grams, note: input.note || "" },
        );
        return result;
      }),
    weigh: (id, input) =>
      transact(() => {
        const spool = get(id);
        const weight = input?.grossWeight;
        if (spool.emptySpoolWeight <= 0)
          throw new ValidationError(
            "Record a measured empty spool weight before using scale updates.",
          );
        if (
          typeof weight !== "number" ||
          !Number.isFinite(weight) ||
          weight < spool.emptySpoolWeight ||
          weight - spool.emptySpoolWeight > spool.initialWeight
        )
          throw new ValidationError(
            `Total scale weight must be between ${spool.emptySpoolWeight} and ${spool.emptySpoolWeight + spool.initialWeight} g. Check your empty spool weight.`,
          );
        const result = validateSpool(
          {
            remainingWeight:
              Math.round((weight - spool.emptySpoolWeight) * 100) / 100,
          },
          spool,
        );
        save(result);
        log(
          "weighed",
          spool,
          `Weighed spool · ${result.remainingWeight} g remaining`,
          { grossWeight: weight, emptySpoolWeight: spool.emptySpoolWeight },
        );
        return result;
      }),
    dry: (id, input) =>
      transact(() => {
        const spool = get(id);
        for (const [key, min, max] of [
          ["temperature", 20, 150],
          ["hours", 0.1, 72],
        ])
          if (
            typeof input?.[key] !== "number" ||
            !Number.isFinite(input[key]) ||
            input[key] < min ||
            input[key] > max
          )
            throw new ValidationError(
              `${key} must be between ${min} and ${max}.`,
            );
        const result = validateSpool({ lastDriedAt: now() }, spool);
        save(result);
        log(
          "dried",
          spool,
          `Dried at ${input.temperature} °C for ${input.hours} hours`,
          { temperature: input.temperature, hours: input.hours },
        );
        return result;
      }),
    updateSettings: (input) => writeSettings(validateSettings(input)),
    addMaterial: (input) =>
      transact(() => {
        const material = materialName(input?.name),
          customMaterials = [
            ...new Set([...(settings().customMaterials || []), material]),
          ];
        writeSettings(validateSettings({ customMaterials }));
        return { material, customMaterials };
      }),
    clearDemo: () =>
      transact(() => {
        db.exec("DELETE FROM spools; DELETE FROM activity;");
        writeSettings({ demoData: false });
        return { ok: true };
      }),
    backup: () => ({
      version: 1,
      exportedAt: now(),
      spools: db
        .prepare("SELECT data FROM spools")
        .all()
        .map((r) => normalizeSpool(JSON.parse(r.data))),
      templates: fullTemplates(),
      settings: settings(),
      customFilaments: customFilaments(),
      activity: db
        .prepare("SELECT * FROM activity ORDER BY at ASC,rowid ASC")
        .all()
        .map((r) => ({ ...r, data: JSON.parse(r.data) })),
    }),
    restore: (input) => {
      if (
        input?.version !== 1 ||
        !Array.isArray(input.spools) ||
        input.spools.length > 10000
      )
        throw new ValidationError(
          "Choose a Spoolspace version 1 JSON backup with at most 10,000 spools.",
        );
      const restoredSettings =
        input.settings === undefined ? {} : validateSettings(input.settings);
      let customProducts = null;
      if (input.customFilaments !== undefined) {
        if (
          !Array.isArray(input.customFilaments) ||
          input.customFilaments.length > 10000
        )
          throw new ValidationError(
            "Backup contains too many custom filaments.",
          );
        const ids = new Set(),
          keys = new Set();
        customProducts = input.customFilaments.map((product) => {
          if (
            !product ||
            typeof product !== "object" ||
            !/^custom-[a-zA-Z0-9-]{1,80}$/.test(product.catalogVariantId) ||
            !Array.isArray(product.sizes) ||
            !product.sizes.length ||
            product.sizes.length > 10000 ||
            !Array.isArray(product.vendors) ||
            product.vendors.some(
              (vendor) => typeof vendor !== "string" || vendor.length > 100,
            )
          )
            throw new ValidationError(
              "Backup contains an invalid custom filament.",
            );
          const clean = validateSpool({
            ...product,
            name: "Custom filament",
            initialWeight: 1000,
            remainingWeight: 1000,
          });
          const key = customKey(clean);
          if (
            !clean.brand ||
            ids.has(product.catalogVariantId) ||
            keys.has(key)
          )
            throw new ValidationError(
              "Backup contains duplicate or unidentified custom filaments.",
            );
          ids.add(product.catalogVariantId);
          keys.add(key);
          const sizeIds = new Set();
          const sizes = product.sizes.map((size) => {
            if (
              !size ||
              !/^custom-size-[a-zA-Z0-9-]{1,80}$/.test(size.catalogSizeId) ||
              sizeIds.has(size.catalogSizeId) ||
              !Array.isArray(size.vendors) ||
              size.vendors.some(
                (vendor) => typeof vendor !== "string" || vendor.length > 100,
              ) ||
              !Number.isFinite(size.initialWeight) ||
              size.initialWeight <= 0 ||
              (size.emptySpoolWeight !== null &&
                !Number.isFinite(size.emptySpoolWeight))
            )
              throw new ValidationError(
                "Backup contains an invalid custom spool size.",
              );
            sizeIds.add(size.catalogSizeId);
            validateSpool({
              name: "Custom size",
              initialWeight: size.initialWeight,
              remainingWeight: size.initialWeight,
              emptySpoolWeight: size.emptySpoolWeight ?? 0,
            });
            return {
              catalogSizeId: size.catalogSizeId,
              initialWeight: size.initialWeight,
              emptySpoolWeight: size.emptySpoolWeight,
              diameter: null,
              vendors: [...size.vendors],
            };
          });
          return {
            source: "custom",
            catalogProductId: product.catalogVariantId,
            catalogVariantId: product.catalogVariantId,
            catalogVersion: "custom",
            ...Object.fromEntries(customFields.map((key) => [key, clean[key]])),
            name: customName(clean),
            sizes,
            vendors: product.vendors,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
          };
        });
      }
      let templates = null;
      if (input.templates !== undefined) {
        if (!Array.isArray(input.templates) || input.templates.length > 250)
          throw new ValidationError(
            "Backup contains too many label templates.",
          );
        const templateIds = new Set();
        templates = input.templates.map((item) => {
          const template = validateTemplate(item);
          if (
            typeof item.id === "string" &&
            /^[a-zA-Z0-9-]{1,80}$/.test(item.id)
          )
            template.id = item.id;
          if (templateIds.has(template.id))
            throw new ValidationError(
              "Backup contains duplicate template IDs.",
            );
          templateIds.add(template.id);
          if (
            typeof item.createdAt === "string" &&
            Number.isFinite(Date.parse(item.createdAt))
          )
            template.createdAt = item.createdAt;
          return template;
        });
        if (JSON.stringify(templates).length > 32 * 1024 * 1024)
          throw new ValidationError(
            "Backup template library exceeds 32 MB.",
            413,
          );
      }
      if (
        input.activity !== undefined &&
        (!Array.isArray(input.activity) || input.activity.length > 50000)
      )
        throw new ValidationError(
          "Backup history must contain at most 50,000 activity entries.",
        );
      const activityIds = new Set();
      const activity = (input.activity || []).map((item) => {
        if (
          !item ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          typeof item.id !== "string" ||
          !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) ||
          activityIds.has(item.id)
        )
          throw new ValidationError(
            "Backup contains an invalid or duplicate activity ID.",
          );
        activityIds.add(item.id);
        if (
          typeof item.at !== "string" ||
          item.at.length > 35 ||
          !Number.isFinite(Date.parse(item.at))
        )
          throw new ValidationError(
            "Backup contains an invalid activity date.",
          );
        if (
          typeof item.type !== "string" ||
          !/^[a-zA-Z0-9_-]{1,40}$/.test(item.type)
        )
          throw new ValidationError(
            "Backup contains an invalid activity type.",
          );
        if (
          item.spoolId !== null &&
          (typeof item.spoolId !== "string" ||
            !/^[a-zA-Z0-9-]{1,80}$/.test(item.spoolId))
        )
          throw new ValidationError(
            "Backup contains an invalid activity spool ID.",
          );
        if (
          item.spoolName !== null &&
          (typeof item.spoolName !== "string" || item.spoolName.length > 160)
        )
          throw new ValidationError(
            "Backup contains an invalid activity spool name.",
          );
        if (typeof item.message !== "string" || item.message.length > 1500)
          throw new ValidationError(
            "Backup contains an invalid activity message.",
          );
        if (
          !item.data ||
          typeof item.data !== "object" ||
          Array.isArray(item.data) ||
          JSON.stringify(item.data).length > 10000
        )
          throw new ValidationError(
            "Backup contains invalid activity details.",
          );
        return {
          id: item.id,
          at: item.at,
          type: item.type,
          spoolId: item.spoolId,
          spoolName: item.spoolName,
          message: item.message,
          data: item.data,
        };
      });
      const ids = new Set();
      const spools = input.spools.map((item) => {
        const spool = validateSpool(item);
        if (typeof item.id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(item.id))
          spool.id = item.id;
        if (ids.has(spool.id))
          throw new ValidationError("Backup contains duplicate spool IDs.");
        ids.add(spool.id);
        if (
          typeof item.createdAt === "string" &&
          Number.isFinite(Date.parse(item.createdAt))
        )
          spool.createdAt = item.createdAt;
        return spool;
      });
      return transact(() => {
        db.exec("DELETE FROM spools; DELETE FROM activity;");
        for (const spool of spools)
          insertSpool.run(spool.id, JSON.stringify(spool));
        if (customProducts !== null) {
          db.exec("DELETE FROM custom_filaments");
          const insert = db.prepare(
            "INSERT INTO custom_filaments(id,identity,data) VALUES (?,?,?)",
          );
          for (const product of customProducts)
            insert.run(
              product.catalogVariantId,
              customKey(product),
              JSON.stringify(product),
            );
        } else {
          for (const spool of spools) rememberFilament(spool);
        }
        if (templates !== null) {
          db.exec("DELETE FROM label_templates;");
          const insertTemplate = db.prepare(
            "INSERT INTO label_templates (id,data) VALUES (?,?)",
          );
          for (const template of templates)
            insertTemplate.run(template.id, JSON.stringify(template));
        }
        const insertActivity = db.prepare(
          "INSERT INTO activity (id,at,type,spoolId,spoolName,message,data) VALUES (?,?,?,?,?,?,?)",
        );
        for (const item of activity)
          insertActivity.run(
            item.id,
            item.at,
            item.type,
            item.spoolId,
            item.spoolName,
            item.message,
            JSON.stringify(item.data),
          );
        writeSettings({
          ...restoredSettings,
          spoolDefaults: restoredSettings.spoolDefaults ?? null,
          demoData: false,
        });
        log("restored", null, `Restored ${spools.length} spools from a backup`);
        return { ok: true, count: spools.length };
      });
    },
  };
}

function seedInventory(add) {
  const today = new Date();
  const ago = (days) =>
    new Date(today.getTime() - days * 86400000).toISOString();
  const samples = [
    [
      "PLA Basic · Jade White",
      "Bambu Lab",
      "PLA",
      "Jade White",
      "#e4e8de",
      820,
      250,
      "AMS · Slot 1",
      "AMS",
      "in-use",
      4,
    ],
    [
      "PLA Matte · Charcoal",
      "Bambu Lab",
      "PLA",
      "Charcoal",
      "#343d40",
      640,
      250,
      "AMS · Slot 2",
      "AMS",
      "in-use",
      8,
    ],
    [
      "PETG HF · Forest Green",
      "Bambu Lab",
      "PETG",
      "Forest Green",
      "#46745b",
      920,
      250,
      "Shelf A · Box 02",
      "Dry box",
      "available",
      2,
    ],
    [
      "PLA · Terracotta",
      "PolyMaker",
      "PLA",
      "Terracotta",
      "#ce775d",
      350,
      140,
      "Shelf A · Box 01",
      "Sealed bag",
      "available",
      18,
    ],
    [
      "PETG · Prusa Orange",
      "Prusament",
      "PETG",
      "Prusa Orange",
      "#f48c37",
      165,
      200,
      "Shelf B · Box 03",
      "Open air",
      "available",
      45,
    ],
    [
      "TPU 95A · Sky Blue",
      "eSUN",
      "TPU",
      "Sky Blue",
      "#76aebe",
      780,
      230,
      "Shelf B · Box 01",
      "Sealed bag",
      "available",
      40,
    ],
    [
      "ABS · Signal Yellow",
      "SUNLU",
      "ABS",
      "Signal Yellow",
      "#e8bc4b",
      480,
      180,
      "Shelf A · Box 03",
      "Dry box",
      "available",
      1,
    ],
    [
      "PLA Silk · Copper",
      "eSUN",
      "PLA",
      "Copper",
      "#ac7555",
      95,
      230,
      "Shelf B · Box 02",
      "Sealed bag",
      "available",
      25,
    ],
  ];
  for (const [
    name,
    brand,
    material,
    colorName,
    colorHex,
    remainingWeight,
    emptySpoolWeight,
    location,
    storage,
    status,
    dried,
  ] of samples)
    add({
      name,
      brand,
      material,
      colorName,
      colorHex,
      initialWeight: 1000,
      remainingWeight,
      emptySpoolWeight,
      location,
      storage,
      status,
      purchaseDate: ago(50).slice(0, 10),
      openedDate: ago(30).slice(0, 10),
      lastDriedAt: ago(dried),
      notes:
        "Demo spool — replace with your own inventory. Empty spool weight is an example; weigh your actual spool.",
    });
}
