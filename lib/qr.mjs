import { Worker } from "node:worker_threads";
import { imageData } from "./templates.mjs";
let active = 0;
export async function readQRCodes(images) {
  if (active >= 2)
    return { codes: [], error: "QR reader is busy. Try another scan shortly." };
  const bytes = [];
  for (const image of [...new Set(images.filter(Boolean))].slice(0, 2)) {
    try {
      bytes.push(imageData(image).bytes);
    } catch {
      /* Try the other photo source. */
    }
  }
  if (!bytes.length) {
    return {
      codes: [],
      error: "QR image is invalid. Try a closer photo of the code.",
    };
  }
  active++;
  try {
    return await new Promise((resolve) => {
      let worker,
        timer,
        complete = false;
      const finish = (result) => {
        if (complete) return;
        complete = true;
        clearTimeout(timer);
        worker?.terminate();
        resolve(result);
      };
      try {
        worker = new Worker(new URL("./qr-worker.mjs", import.meta.url), {
          workerData: { images: bytes },
          execArgv: [],
        });
        timer = setTimeout(
          () =>
            finish({
              codes: [],
              error: "QR reading timed out. Try a close-up of the code.",
            }),
          20000,
        );
        worker.once("message", finish);
        worker.once("error", () =>
          finish({
            codes: [],
            error:
              "QR reader unavailable. Text recognition is still available.",
          }),
        );
        worker.once("exit", () =>
          finish({
            codes: [],
            error: "QR reader stopped. Try scanning again.",
          }),
        );
      } catch {
        finish({ codes: [], error: "QR reader unavailable." });
      }
    });
  } finally {
    active--;
  }
}
