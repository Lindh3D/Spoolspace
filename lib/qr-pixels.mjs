// Reconnect the small gaps between printed round QR dots. This fallback runs
// only after normal decoding, so its altered pixels cannot replace a good read.
export function reconnectQRDots({ data, width, height }, foreground) {
  const count = width * height;
  const gray = new Uint8Array(count),
    histogram = new Uint32Array(256);
  let total = 0;
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    const value = (77 * data[p] + 150 * data[p + 1] + 29 * data[p + 2]) >> 8;
    gray[i] = value;
    histogram[value]++;
    total += value;
  }
  let threshold = 128,
    weight = 0,
    sum = 0,
    best = -1;
  for (let value = 0; value < 256; value++) {
    weight += histogram[value];
    sum += value * histogram[value];
    if (!weight || weight === count) continue;
    const difference = sum / weight - (total - sum) / (count - weight);
    const variance = weight * (count - weight) * difference * difference;
    if (variance > best) {
      best = variance;
      threshold = value;
    }
  }
  const horizontal = new Uint8Array(count);
  const isForeground = (i) =>
    foreground === 255 ? gray[i] > threshold : gray[i] <= threshold;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      horizontal[i] =
        isForeground(i) ||
        (x > 0 && isForeground(i - 1)) ||
        (x + 1 < width && isForeground(i + 1))
          ? 1
          : 0;
    }
  }
  const output = new Uint8ClampedArray(count * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const on =
        horizontal[i] ||
        (y > 0 && horizontal[i - width]) ||
        (y + 1 < height && horizontal[i + width]);
      const value = on ? foreground : 255 - foreground;
      output[i * 4] = output[i * 4 + 1] = output[i * 4 + 2] = value;
      output[i * 4 + 3] = 255;
    }
  }
  return { data: output, width, height };
}
