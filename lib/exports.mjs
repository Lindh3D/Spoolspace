import { ValidationError } from "./store.mjs";
import { parseRegion } from "./parser.mjs";
import { compactText } from "./filament-normalize.mjs";

const densities = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  ASA: 1.07,
  TPU: 1.21,
  PA: 1.14,
  PC: 1.2,
  PVA: 1.23,
  HIPS: 1.04,
};
const sanitize = (value) =>
  String(value || "")
    .replace(/[\r\n;\[\]\\]/g, " ")
    .trim()
    .slice(0, 160);
export function exportPreset(spool, format, parent = "", printer = "") {
  if (!["bambu", "orca", "prusa"].includes(format))
    throw new ValidationError(
      "Choose Bambu Studio, OrcaSlicer or PrusaSlicer.",
    );
  const productLine = sanitize(spool.productLine);
  const variantSuffix =
    productLine &&
    !String(spool.name).toLowerCase().includes(productLine.toLowerCase())
      ? ` (${productLine})`
      : "";
  const name = sanitize(`Spoolspace - ${spool.name}${variantSuffix}`);
  const parsed = parseRegion("material", spool.material),
    recognizedWholeType =
      compactText(parsed.productLine || parsed.material || "") ===
      compactText(spool.material);
  const material = sanitize(
    recognizedWholeType ? parsed.material : spool.material,
  );
  const brand = sanitize(spool.brand || spool.manufacturer || "Generic");
  const color = spool.colorHex.toUpperCase();
  const density = densities[material] || 1.24;
  const filename =
    name.replace(/[^a-zA-Z0-9 ._-]/g, "").slice(0, 110) ||
    "Spoolspace filament";
  if (format === "prusa") {
    const text = `# Spoolspace filament-only preset. Verify print temperatures and profile before printing.\n[filament:${name}]\nfilament_vendor = ${brand}\nfilament_type = ${material}\nfilament_colour = ${color}\nfilament_diameter = 1.75\nfilament_density = ${density}\n${parent.trim() ? `inherits = ${sanitize(parent)}\n` : ""}`;
    return {
      text,
      filename: `${filename}.ini`,
      type: "text/plain; charset=utf-8",
    };
  }
  if (!parent.trim())
    throw new ValidationError(
      "Enter the exact installed parent filament preset name from your slicer.",
    );
  if (
    parent.length > 200 ||
    printer.length > 200 ||
    /[\r\n]/.test(parent + printer)
  )
    throw new ValidationError(
      "Parent preset and printer names must be single lines, at most 200 characters each.",
    );
  const preset = {
    type: "filament",
    name,
    filament_settings_id: [name],
    version: "1.0.0.0",
    from: "User",
    inherits: parent.trim(),
    instantiation: "true",
    filament_vendor: [brand],
    filament_type: [material],
    filament_colour: [color],
    filament_diameter: ["1.75"],
    filament_density: [String(density)],
  };
  if (printer.trim()) preset.compatible_printers = [printer.trim()];
  return {
    text: JSON.stringify(preset, null, 2),
    filename: `${filename}.json`,
    type: "application/json; charset=utf-8",
  };
}
