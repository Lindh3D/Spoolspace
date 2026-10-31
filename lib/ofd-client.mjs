import { Worker } from "node:worker_threads";
import { ValidationError } from "./store.mjs";

// SQLite validation/search and fuzzy matching run away from the HTTP/UI event
// loop. Only bounded search results and progress snapshots reach the browser.
export class OFDClient {
  constructor(directory) {
    // The catalog is a file worker; stdin/test/native-image CLI flags from the
    // caller are not valid worker startup options and are not needed here.
    this.worker = new Worker(new URL("./ofd-worker.mjs", import.meta.url), {
      workerData: { directory },
      execArgv: [],
    });
    this.pending = new Map();
    this.sequence = 0;
    this.worker.on("message", ({ id, result, error }) => {
      const item = this.pending.get(id);
      if (!item) return;
      this.pending.delete(id);
      clearTimeout(item.timer);
      error
        ? item.reject(new ValidationError(error.message, error.status))
        : item.resolve(result);
    });
    this.worker.on("error", (error) => this.fail(error));
    this.worker.on("exit", (code) => {
      if (!this.closing)
        this.fail(
          new Error(
            `The filament catalog worker stopped (${code}). Restart the app to reconnect.`,
          ),
        );
    });
  }
  fail(error) {
    this.failure = error;
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(new ValidationError(error.message, 503));
    }
    this.pending.clear();
  }
  call(method, ...args) {
    if (this.failure || this.closed)
      return Promise.reject(
        new ValidationError(
          this.failure?.message || "The filament catalog is closed.",
          503,
        ),
      );
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new ValidationError("The filament catalog operation timed out.", 503),
        );
      }, 150000);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.worker.postMessage({ id, method, args });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new ValidationError(error.message, 503));
      }
    });
  }
  status() {
    return this.call("status");
  }
  search(query) {
    return this.call("search", query);
  }
  match(input) {
    return this.call("match", input);
  }
  getProduct(id) {
    return this.call("getProduct", id);
  }
  configure(input) {
    return this.call("configure", input);
  }
  startSync() {
    return this.call("startSync");
  }
  startAutomatic() {
    return this.call("startAutomatic");
  }
  close() {
    if (this.closePromise) return this.closePromise;
    this.closing = true;
    this.closePromise = (async () => {
      try {
        if (!this.failure) await this.call("close");
      } finally {
        this.closed = true;
        await this.worker.terminate();
      }
    })();
    return this.closePromise;
  }
}
