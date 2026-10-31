"use strict";

// Geometry is stored as fractions of the complete photo, so the same label
// layout can be reused at a different resolution. No photo leaves this server.
class LabelRegionEditor {
  static fields = [
    ["brand", "Filament brand", "#e6a052"],
    ["vendor", "Vendor / seller", "#5b9fc8"],
    ["manufacturer", "Manufacturer", "#b48bc7"],
    ["material", "Base material", "#5da980"],
    ["productLine", "Product line / variant", "#d57b8f"],
    ["temperatureRange", "Print temperature range", "#cf8454"],
    ["colorName", "Color name / code", "#7c94d2"],
    ["initialWeight", "Net filament weight", "#91a84f"],
    ["emptySpoolWeight", "Empty spool weight", "#a3947c"],
  ];

  constructor({ container, image, canvas, regions = [], onChange }) {
    this.container = container;
    this.regions = regions.map((r) => ({ ...r }));
    this.field = "brand";
    this.selected = this.regions[0]?.id || null;
    this.onChange = onChange;
    this.mode = "draw";
    const img = document.createElement("img");
    img.src = image;
    img.alt = "Spool label. Draw a box around one printed field at a time.";
    img.draggable = false;
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.classList.add("annotation-overlay");
    this.svg.setAttribute("viewBox", "0 0 1000 1000");
    this.svg.setAttribute("preserveAspectRatio", "none");
    this.svg.setAttribute(
      "aria-label",
      "Draw a rectangle around the selected label field",
    );
    this.svg.addEventListener("pointerdown", (e) => this.start(e));
    this.svg.addEventListener("pointermove", (e) => this.move(e));
    this.svg.addEventListener("pointerup", (e) => this.finish(e));
    this.svg.addEventListener("pointercancel", () => {
      this.drag = null;
      this.draw();
    });
    container.replaceChildren(canvas || img, this.svg);
    this.draw();
  }

  point(event) {
    const rect = this.svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  start(event) {
    if (this.mode !== "draw") return;
    if (event.button && event.button !== 0) return;
    const selected = event.target.closest("[data-region-id]");
    if (selected) {
      this.select(selected.dataset.regionId);
      return;
    }
    const point = this.point(event);
    if (!point) return;
    event.preventDefault();
    this.drag = { from: point, to: point };
    try {
      this.svg.setPointerCapture(event.pointerId);
    } catch {}
  }

  move(event) {
    if (!this.drag) return;
    event.preventDefault();
    this.drag.to = this.point(event) || this.drag.to;
    this.draw();
  }

  finish(event) {
    if (!this.drag) return;
    const to = this.point(event) || this.drag.to;
    const { from } = this.drag;
    this.drag = null;
    const bounds = {
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
      width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y),
    };
    if (bounds.width >= 0.005 && bounds.height >= 0.005) this.add(bounds);
    else this.draw();
  }

  add(bounds = { x: 0.1, y: 0.1, width: 0.4, height: 0.12 }) {
    const previous = this.regions.find((r) => r.field === this.field);
    const region = {
      id:
        previous?.id ||
        `region-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      field: this.field,
      ...bounds,
      value: "",
    };
    this.regions = this.regions
      .filter((r) => r.field !== this.field)
      .concat(region);
    this.selected = region.id;
    this.changed("draw");
  }

  select(id) {
    this.selected = id;
    const region = this.regions.find((r) => r.id === id);
    if (region) this.field = region.field;
    this.changed();
  }

  remove(id) {
    this.regions = this.regions.filter((r) => r.id !== id);
    this.selected = this.regions[0]?.id || null;
    this.changed();
  }

  bounds(values) {
    const region = this.regions.find((r) => r.id === this.selected);
    if (!region) return;
    if (!Object.values(values).every(Number.isFinite)) return;
    const x = Math.max(0, Math.min(0.995, values.x)),
      y = Math.max(0, Math.min(0.995, values.y));
    Object.assign(region, {
      x,
      y,
      width: Math.max(0.005, Math.min(1 - x, values.width)),
      height: Math.max(0.005, Math.min(1 - y, values.height)),
    });
    this.changed();
  }

  changed(reason = "change") {
    this.draw();
    this.onChange?.(this.regions, this.selected, reason);
  }

  draw() {
    const items = this.regions.concat(
      this.drag
        ? [
            {
              field: this.field,
              id: "drawing",
              x: Math.min(this.drag.from.x, this.drag.to.x),
              y: Math.min(this.drag.from.y, this.drag.to.y),
              width: Math.abs(this.drag.from.x - this.drag.to.x),
              height: Math.abs(this.drag.from.y - this.drag.to.y),
            },
          ]
        : [],
    );
    this.svg.replaceChildren();
    for (const item of items) {
      const meta = LabelRegionEditor.fields.find(([key]) => key === item.field);
      const group = document.createElementNS(this.svg.namespaceURI, "g");
      group.dataset.regionId = item.id;
      const rect = document.createElementNS(this.svg.namespaceURI, "rect");
      for (const key of ["x", "y", "width", "height"])
        rect.setAttribute(key, String(item[key] * 1000));
      rect.setAttribute("fill", meta?.[2] || "#5da980");
      rect.setAttribute(
        "fill-opacity",
        item.id === this.selected ? ".22" : ".10",
      );
      rect.setAttribute("stroke", meta?.[2] || "#5da980");
      rect.setAttribute("stroke-width", item.id === this.selected ? "3" : "2");
      rect.setAttribute("vector-effect", "non-scaling-stroke");
      const title = document.createElementNS(this.svg.namespaceURI, "title");
      title.textContent = meta?.[1] || item.field;
      group.append(title, rect);
      this.svg.append(group);
    }
  }
}
window.LabelRegionEditor = LabelRegionEditor;
