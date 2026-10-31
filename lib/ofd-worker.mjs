import { parentPort, workerData } from "node:worker_threads";
import { OFDCatalog } from "./ofd-catalog.mjs";
const catalog = new OFDCatalog({ directory: workerData.directory });
const allowed = new Set([
  "status",
  "configure",
  "startAutomatic",
  "startSync",
  "sync",
  "search",
  "match",
  "getProduct",
  "close",
]);
parentPort.on("message", async ({ id, method, args = [] }) => {
  try {
    if (!allowed.has(method)) throw Error("Unknown catalog operation.");
    const result = await catalog[method](...args);
    parentPort.postMessage({ id, result });
    if (method === "close") parentPort.close();
  } catch (error) {
    parentPort.postMessage({
      id,
      error: { message: error.message, status: error.status || 500 },
    });
  }
});
