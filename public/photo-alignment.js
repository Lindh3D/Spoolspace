"use strict";

// Render the photo into a fixed output frame. Region boxes live in that frame;
// only image pixels move. OCR and saved templates use this same rendered canvas.
class PhotoAlignment {
  constructor({
    source,
    canvas = document.createElement("canvas"),
    frameWidth = source.width,
    frameHeight = source.height,
    onChange,
  }) {
    this.source = source;
    this.originalSource = source;
    this.canvas = canvas;
    this.onChange = onChange;
    this.view = {
      angle: 0,
      zoom: 1,
      panX: 0,
      panY: 0,
      lens: 0,
      contrast: 30,
      sharpness: 40,
    };
    this.processing = "original";
    this.pointers = new Map();
    this.setFrame(frameWidth, frameHeight, false);
  }

  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  static angle(value) {
    return ((((value + 180) % 360) + 360) % 360) - 180;
  }

  setFrame(width, height, notify = true) {
    if (!(width > 0 && height > 0)) return;
    const factor = Math.min(1, 1800 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * factor)),
      h = Math.max(1, Math.round(height * factor));
    if (this.canvas.width === w && this.canvas.height === h && this.initialized)
      return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.baseScale = Math.min(w / this.source.width, h / this.source.height);
    this.initialized = true;
    this.fit(notify);
  }

  update(values, notify = true) {
    for (const [key, value] of Object.entries(values)) {
      if (!Number.isFinite(value)) continue;
      if (key === "angle") this.view.angle = PhotoAlignment.angle(value);
      if (key === "zoom") this.view.zoom = PhotoAlignment.clamp(value, 0.1, 8);
      if (key === "lens") this.view.lens = PhotoAlignment.clamp(value, -40, 40);
      if (key === "contrast" || key === "sharpness")
        this.view[key] = PhotoAlignment.clamp(value, 0, 100);
      if (key === "panX" || key === "panY")
        this.view[key] = PhotoAlignment.clamp(value, -400, 400);
    }
    this.render();
    if (notify) this.onChange?.(this);
  }

  fit(notify = true) {
    const radians = (this.view.angle * Math.PI) / 180;
    const rotatedWidth =
      Math.abs(Math.cos(radians)) * this.source.width +
      Math.abs(Math.sin(radians)) * this.source.height;
    const rotatedHeight =
      Math.abs(Math.sin(radians)) * this.source.width +
      Math.abs(Math.cos(radians)) * this.source.height;
    this.update(
      {
        zoom:
          Math.min(
            this.canvas.width / rotatedWidth,
            this.canvas.height / rotatedHeight,
          ) / this.baseScale,
        panX: 0,
        panY: 0,
      },
      notify,
    );
  }

  focus(bounds, padding = 0.08) {
    if (
      !bounds ||
      ![bounds.x, bounds.y, bounds.width, bounds.height].every(
        Number.isFinite,
      ) ||
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      bounds.x < 0 ||
      bounds.y < 0 ||
      bounds.x + bounds.width > 1.000001 ||
      bounds.y + bounds.height > 1.000001
    )
      return false;
    const margin = PhotoAlignment.clamp(padding, 0.02, 0.25),
      factor = Math.min(
        (1 - 2 * margin) / bounds.width,
        (1 - 2 * margin) / bounds.height,
      ),
      zoom = PhotoAlignment.clamp(this.view.zoom * factor, 0.1, 8),
      ratio = zoom / this.view.zoom;
    this.update({
      zoom,
      panX:
        ratio * (this.view.panX - (bounds.x + bounds.width / 2 - 0.5) * 100),
      panY:
        ratio * (this.view.panY - (bounds.y + bounds.height / 2 - 0.5) * 100),
    });
    return true;
  }

  reset() {
    this.source = this.originalSource;
    this.view.lens = 0;
    this.processing = "original";
    this.baseScale = Math.min(
      this.canvas.width / this.source.width,
      this.canvas.height / this.source.height,
    );
    this.view.angle = 0;
    this.fit();
  }
  rotate(degrees) {
    this.update({ angle: this.view.angle + degrees });
  }

  render() {
    const { width, height } = this.canvas,
      ctx = this.canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(
      width / 2 + (this.view.panX * width) / 100,
      height / 2 + (this.view.panY * height) / 100,
    );
    ctx.rotate((this.view.angle * Math.PI) / 180);
    ctx.scale(this.baseScale * this.view.zoom, this.baseScale * this.view.zoom);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      this.lensSource(),
      -this.source.width / 2,
      -this.source.height / 2,
    );
    ctx.restore();
    // Keep color pixels independent of the OCR display and preserve the source.
    this.colorCanvas ||= this.makeCanvas(width, height);
    this.colorCanvas.width = width;
    this.colorCanvas.height = height;
    this.colorCanvas.getContext("2d").drawImage(this.canvas, 0, 0);
    if (
      this.processing !== "original" &&
      ctx.getImageData &&
      ctx.putImageData
    ) {
      const image = ctx.getImageData(0, 0, width, height);
      PhotoAlignment.enhance(
        image,
        this.processing,
        this.view.contrast,
        this.view.sharpness,
      );
      ctx.putImageData(image, 0, 0);
    }
  }

  makeCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  setProcessing(mode, notify = true) {
    if (!["original", "enhanced", "grayscale", "binary"].includes(mode)) return;
    this.processing = mode;
    this.render();
    if (notify) this.onChange?.(this);
  }
  lensSource() {
    if (!this.view.lens) return this.source;
    if (
      this.lensCache?.source === this.source &&
      this.lensCache.amount === this.view.lens
    )
      return this.lensCache.canvas;
    const input = this.makeCanvas(this.source.width, this.source.height),
      ctx = input.getContext("2d");
    ctx.drawImage(this.source, 0, 0);
    if (!ctx.getImageData) return this.source;
    const pixels = ctx.getImageData(0, 0, input.width, input.height),
      strength = this.view.lens / 100;
    const canvas = this.remap(pixels, input.width, input.height, (u, v) => {
      const x = u * 2 - 1,
        y = v * 2 - 1,
        factor = 1 + strength * (x * x + y * y);
      return [(x * factor + 1) / 2, (y * factor + 1) / 2];
    });
    this.lensCache = { source: this.source, amount: this.view.lens, canvas };
    return canvas;
  }
  remap(input, width, height, map) {
    const output = this.makeCanvas(width, height),
      ctx = output.getContext("2d"),
      image = ctx.createImageData(width, height);
    image.data.fill(255);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const [u, v] = map(
            x / Math.max(1, width - 1),
            y / Math.max(1, height - 1),
          ),
          sx = u * (input.width - 1),
          sy = v * (input.height - 1);
        if (
          !Number.isFinite(sx + sy) ||
          sx < 0 ||
          sy < 0 ||
          sx > input.width - 1 ||
          sy > input.height - 1
        )
          continue;
        const x0 = Math.floor(sx),
          y0 = Math.floor(sy),
          x1 = Math.min(input.width - 1, x0 + 1),
          y1 = Math.min(input.height - 1, y0 + 1),
          dx = sx - x0,
          dy = sy - y0,
          offset = (y * width + x) * 4;
        for (let c = 0; c < 3; c++)
          image.data[offset + c] =
            input.data[(y0 * input.width + x0) * 4 + c] * (1 - dx) * (1 - dy) +
            input.data[(y0 * input.width + x1) * 4 + c] * dx * (1 - dy) +
            input.data[(y1 * input.width + x0) * 4 + c] * (1 - dx) * dy +
            input.data[(y1 * input.width + x1) * 4 + c] * dx * dy;
      }
    ctx.putImageData(image, 0, 0);
    return output;
  }
  // Map a rectangle to a photographed quadrilateral with a projective transform.
  static cornerMap(points) {
    if (
      points.length !== 4 ||
      points.some(
        (p) =>
          !Number.isFinite(p.x + p.y) ||
          p.x < 0 ||
          p.x > 1 ||
          p.y < 0 ||
          p.y > 1,
      )
    )
      throw new Error("Mark four corners inside the photo.");
    for (let i = 0; i < 4; i++) {
      const a = points[i],
        b = points[(i + 1) % 4],
        c = points[(i + 2) % 4];
      if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) < 0.001)
        throw new Error(
          "Mark a clear rectangle clockwise: top left, top right, bottom right, bottom left.",
        );
    }
    const [a, b, c, d] = points,
      dx1 = b.x - c.x,
      dx2 = d.x - c.x,
      dx3 = a.x - b.x + c.x - d.x,
      dy1 = b.y - c.y,
      dy2 = d.y - c.y,
      dy3 = a.y - b.y + c.y - d.y,
      det = dx1 * dy2 - dx2 * dy1,
      g = (dx3 * dy2 - dx2 * dy3) / det,
      h = (dx1 * dy3 - dx3 * dy1) / det;
    return (u, v) => {
      const den = g * u + h * v + 1;
      return [
        ((b.x - a.x + g * b.x) * u + (d.x - a.x + h * d.x) * v + a.x) / den,
        ((b.y - a.y + g * b.y) * u + (d.y - a.y + h * d.y) * v + a.y) / den,
      ];
    };
  }
  rectify(points) {
    const map = PhotoAlignment.cornerMap(points),
      input = this.colorCanvas
        .getContext("2d")
        .getImageData(0, 0, this.canvas.width, this.canvas.height),
      distance = (a, b) =>
        Math.hypot((a.x - b.x) * input.width, (a.y - b.y) * input.height),
      width = Math.max(
        16,
        Math.round(
          (distance(points[0], points[1]) + distance(points[3], points[2])) / 2,
        ),
      ),
      height = Math.max(
        16,
        Math.round(
          (distance(points[0], points[3]) + distance(points[1], points[2])) / 2,
        ),
      );
    const limit = Math.min(1, 1800 / Math.max(width, height));
    this.source = this.remap(
      input,
      Math.max(1, Math.round(width * limit)),
      Math.max(1, Math.round(height * limit)),
      map,
    );
    this.view.angle = this.view.lens = 0;
    this.baseScale = Math.min(
      this.canvas.width / this.source.width,
      this.canvas.height / this.source.height,
    );
    this.fit();
  }
  static enhance(image, mode, contrast, sharpness) {
    const { data, width, height } = image,
      gray = new Float32Array(width * height),
      hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) {
      gray[i] = Math.round(
        data[i * 4] * 0.2126 +
          data[i * 4 + 1] * 0.7152 +
          data[i * 4 + 2] * 0.0722,
      );
      hist[gray[i]]++;
    }
    let low = 0,
      high = 255,
      sum = 0;
    for (; low < 254; low++) {
      sum += hist[low];
      if (sum > gray.length * 0.01) break;
    }
    sum = 0;
    for (; high > low + 1; high--) {
      sum += hist[high];
      if (sum > gray.length * 0.01) break;
    }
    const amount = mode === "grayscale" ? 0 : contrast / 100,
      sharpen = mode === "grayscale" ? 0 : sharpness / 100;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x,
          value = gray[i],
          neighbours =
            (gray[y * width + Math.max(0, x - 1)] +
              gray[y * width + Math.min(width - 1, x + 1)] +
              gray[Math.max(0, y - 1) * width + x] +
              gray[Math.min(height - 1, y + 1) * width + x]) /
            4;
        let next =
          value +
          (Math.max(
            0,
            Math.min(255, ((value - low) * 255) / Math.max(32, high - low)),
          ) -
            value) *
            amount;
        next = Math.max(
          0,
          Math.min(255, next + (value - neighbours) * sharpen),
        );
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = next;
      }
    if (mode === "binary") {
      // Otsu threshold keeps glyphs filled; edge-only outlines destroy OCR strokes.
      const histogram = new Uint32Array(256);
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        histogram[data[i]]++;
        total += data[i];
      }
      let background = 0,
        weighted = 0,
        best = -1,
        threshold = 127;
      for (let t = 0; t < 256; t++) {
        background += histogram[t];
        weighted += t * histogram[t];
        const foreground = gray.length - background;
        if (!background || !foreground) continue;
        const score =
          background *
          foreground *
          (weighted / background - (total - weighted) / foreground) ** 2;
        if (score > best) {
          best = score;
          threshold = t;
        }
      }
      for (let i = 0; i < data.length; i += 4)
        data[i] = data[i + 1] = data[i + 2] = data[i] <= threshold ? 0 : 255;
    }
  }

  // Used for coordinate reasoning and tests; returns output pixels.
  sourceToFrame(x, y) {
    const angle = (this.view.angle * Math.PI) / 180,
      scale = this.baseScale * this.view.zoom;
    const dx = (x - this.source.width / 2) * scale,
      dy = (y - this.source.height / 2) * scale;
    return {
      x:
        this.canvas.width / 2 +
        (this.view.panX * this.canvas.width) / 100 +
        dx * Math.cos(angle) -
        dy * Math.sin(angle),
      y:
        this.canvas.height / 2 +
        (this.view.panY * this.canvas.height) / 100 +
        dx * Math.sin(angle) +
        dy * Math.cos(angle),
    };
  }

  exportImage() {
    return this.canvas.toDataURL("image/jpeg", 0.9);
  }
  snapshot(color = false) {
    const copy = document.createElement("canvas");
    copy.width = this.canvas.width;
    copy.height = this.canvas.height;
    copy
      .getContext("2d")
      .drawImage(color ? this.colorCanvas : this.canvas, 0, 0);
    return copy;
  }

  zoomAt(zoom, point) {
    const next = PhotoAlignment.clamp(zoom, 0.1, 8),
      ratio = next / this.view.zoom;
    this.update({
      zoom: next,
      panX:
        this.view.panX +
        (point.x - 0.5 - this.view.panX / 100) * 100 * (1 - ratio),
      panY:
        this.view.panY +
        (point.y - 0.5 - this.view.panY / 100) * 100 * (1 - ratio),
    });
  }

  bind(target, canPan = () => true) {
    this.unbind();
    this.target = target;
    const point = (event) => {
      const r = target.getBoundingClientRect();
      return r.width && r.height
        ? {
            x: (event.clientX - r.left) / r.width,
            y: (event.clientY - r.top) / r.height,
          }
        : null;
    };
    const begin = () => {
      const points = [...this.pointers.values()];
      if (!points.length) {
        this.gesture = null;
        return;
      }
      const mid =
        points.length > 1
          ? {
              x: (points[0].x + points[1].x) / 2,
              y: (points[0].y + points[1].y) / 2,
            }
          : points[0];
      this.gesture = {
        ...this.view,
        mid,
        distance:
          points.length > 1
            ? Math.hypot(
                (points[1].x - points[0].x) * this.canvas.width,
                (points[1].y - points[0].y) * this.canvas.height,
              )
            : null,
      };
    };
    const down = (e) => {
      if (!canPan() || (e.button && e.button !== 0)) return;
      const p = point(e);
      if (!p || this.pointers.size >= 2) return;
      e.preventDefault();
      this.pointers.set(e.pointerId, p);
      begin();
      try {
        target.setPointerCapture(e.pointerId);
      } catch {}
    };
    const move = (e) => {
      if (!this.pointers.has(e.pointerId) || !canPan()) return;
      const p = point(e);
      if (!p) return;
      e.preventDefault();
      this.pointers.set(e.pointerId, p);
      const points = [...this.pointers.values()],
        g = this.gesture;
      if (!g) return;
      if (points.length === 1)
        this.update({
          panX: g.panX + (p.x - g.mid.x) * 100,
          panY: g.panY + (p.y - g.mid.y) * 100,
        });
      else {
        const mid = {
          x: (points[0].x + points[1].x) / 2,
          y: (points[0].y + points[1].y) / 2,
        };
        const distance = Math.hypot(
          (points[1].x - points[0].x) * this.canvas.width,
          (points[1].y - points[0].y) * this.canvas.height,
        );
        const zoom = PhotoAlignment.clamp(
            (g.zoom * distance) / Math.max(0.001, g.distance),
            0.1,
            8,
          ),
          ratio = zoom / g.zoom;
        this.update({
          zoom,
          panX:
            g.panX +
            (mid.x - g.mid.x) * 100 +
            (g.mid.x - 0.5 - g.panX / 100) * 100 * (1 - ratio),
          panY:
            g.panY +
            (mid.y - g.mid.y) * 100 +
            (g.mid.y - 0.5 - g.panY / 100) * 100 * (1 - ratio),
        });
      }
    };
    const up = (e) => {
      this.pointers.delete(e.pointerId);
      begin();
    };
    const cancel = (e) => {
      if (this.gesture && this.pointers.has(e.pointerId))
        this.update(this.gesture);
      this.pointers.clear();
      this.gesture = null;
    };
    const wheel = (e) => {
      if (!canPan()) return;
      const p = point(e);
      if (!p) return;
      e.preventDefault();
      this.zoomAt(this.view.zoom * Math.exp(-e.deltaY * 0.0015), p);
    };
    this.handlers = {
      pointerdown: down,
      pointermove: move,
      pointerup: up,
      pointercancel: cancel,
      wheel,
    };
    for (const [event, handler] of Object.entries(this.handlers))
      target.addEventListener(event, handler, { passive: false });
  }

  unbind() {
    if (this.target && this.handlers)
      for (const [event, handler] of Object.entries(this.handlers))
        this.target.removeEventListener(event, handler);
    this.pointers.clear();
    this.gesture = null;
    this.target = null;
    this.handlers = null;
  }
}
window.PhotoAlignment = PhotoAlignment;
