import { DatabaseSync } from "node:sqlite";
// A small offline fixture using the independently inspected upstream table and
// column names. Product names here are test data, never matcher special cases.
export function createOFDFixture(
  path,
  { version = "test.1", includeGlitz = true } = {},
) {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE brand(id TEXT PRIMARY KEY,uuid TEXT,name TEXT NOT NULL,slug TEXT NOT NULL);
    CREATE TABLE material(id TEXT PRIMARY KEY,uuid TEXT,brand_id TEXT NOT NULL,material TEXT NOT NULL);
    CREATE TABLE filament(id TEXT PRIMARY KEY,uuid TEXT,brand_id TEXT NOT NULL,material_id TEXT NOT NULL,name TEXT NOT NULL,material TEXT NOT NULL,min_print_temperature INTEGER,max_print_temperature INTEGER);
    CREATE TABLE variant(id TEXT PRIMARY KEY,uuid TEXT,filament_id TEXT NOT NULL,name TEXT NOT NULL,color_hex TEXT NOT NULL);
    CREATE TABLE size(id TEXT PRIMARY KEY,uuid TEXT,variant_id TEXT NOT NULL,filament_weight INTEGER NOT NULL,diameter REAL NOT NULL,empty_spool_weight INTEGER);
    CREATE TABLE store(id TEXT PRIMARY KEY,name TEXT NOT NULL);
    CREATE TABLE purchase_link(id TEXT PRIMARY KEY,size_id TEXT NOT NULL,store_id TEXT NOT NULL);
    CREATE INDEX ix_filament_brand ON filament(brand_id);CREATE INDEX ix_variant_filament ON variant(filament_id);CREATE INDEX ix_size_variant ON size(variant_id);`);
  db.prepare("INSERT INTO meta VALUES (?,?)").run("version", version);
  db.prepare("INSERT INTO meta VALUES (?,?)").run(
    "generated_at",
    "2026-10-27T01:00:00Z",
  );
  for (const [id, name, slug] of [
    ["north", "Add-North", "add_north"],
    ["bambu", "Bambu Lab", "bambu_lab"],
    ["other", "Different Brand", "different_brand"],
  ])
    db.prepare("INSERT INTO brand VALUES (?,?,?,?)").run(
      id,
      "uuid-" + id,
      name,
      slug,
    );
  for (const [id, brand, material] of [
    ["pla-n", "north", "PLA"],
    ["petg-n", "north", "PETG"],
    ["pa-n", "north", "PA12"],
    ["pla-b", "bambu", "PLA"],
    ["pla-o", "other", "PLA"],
  ])
    db.prepare("INSERT INTO material VALUES (?,?,?,?)").run(
      id,
      "uuid-" + id,
      brand,
      material,
    );
  const lines = [
    ["economy", "north", "pla-n", "PLA Economy", "PLA", 190, 230],
    ["basic", "north", "pla-n", "PLA Basic", "PLA", 190, 220],
    ["plus", "north", "pla-n", "PLA+", "PLA", 200, 230],
    ["carbon", "north", "pa-n", "PA12-CF", "PA12-CF", 260, 290],
    ["bambu-basic", "bambu", "pla-b", "PLA Basic", "PLA", null, null],
    ["other-economy", "other", "pla-o", "PLA Economy", "PLA", null, null],
  ];
  if (includeGlitz)
    lines.push(["glitz", "north", "petg-n", "PETG Glitz", "PETG", 225, 260]);
  for (const [id, brand, mat, name, material, min, max] of lines) {
    db.prepare("INSERT INTO filament VALUES (?,?,?,?,?,?,?,?)").run(
      id,
      "uuid-" + id,
      brand,
      mat,
      name,
      material,
      min,
      max,
    );
    for (const [color, hex] of [
      ["Black", "#000000"],
      ["Grey", "#808080"],
      ["Light Grey", "#d3d3d3"],
      ["Blue", "#0000ff"],
    ]) {
      const variant = id + "-" + color.toLowerCase().replaceAll(" ", "-");
      db.prepare("INSERT INTO variant VALUES (?,?,?,?,?)").run(
        variant,
        "uuid-" + variant,
        id,
        color,
        hex,
      );
      const size = variant + "-1000";
      db.prepare("INSERT INTO size VALUES (?,?,?,?,?,?)").run(
        size,
        "uuid-" + size,
        variant,
        1000,
        1.75,
        id === "economy" ? 238 : null,
      );
    }
  }
  db.prepare("INSERT INTO store VALUES (?,?)").run("shop", "Local Test Shop");
  db.prepare("INSERT INTO purchase_link VALUES (?,?,?)").run(
    "link",
    "economy-black-1000",
    "shop",
  );
  db.close();
  return path;
}
