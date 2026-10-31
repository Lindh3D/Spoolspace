import { createServer } from "node:http";
import { createServer as createSecureServer } from "node:https";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join, extname, sep, dirname } from "node:path";
import { networkInterfaces, hostname } from "node:os";
import QRCode from "qrcode";
import { createStore, ValidationError } from "./lib/store.mjs";
import { exportPreset } from "./lib/exports.mjs";
import { recognizeImage } from "./lib/recognition.mjs";
import { catalog, parseRegion } from "./lib/parser.mjs";
import { OFDClient } from "./lib/ofd-client.mjs";
import { LocalCatalog } from "./lib/local-catalog.mjs";
import { PrusaSpoolReports, mergeSpoolReport } from "./lib/prusa-spool.mjs";
import { readQRCodes } from "./lib/qr.mjs";
import { qrEvidence, mergeQRFields } from "./lib/qr-evidence.mjs";
import { configureHttps, certificateNames } from "./lib/local-https.mjs";
import { phoneSetupPage } from "./lib/phone-setup.mjs";
import {
  windowsStartupStatus,
  isLocalStartupClient,
} from "./lib/windows-startup.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const version = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
).version;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};
const writeMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);
function networkUrls(port) {
  return [
    ...new Set(
      Object.values(networkInterfaces())
        .flat()
        .filter((item) => item?.family === "IPv4" && !item.internal)
        .map((item) => `http://${item.address}:${port}`),
    ),
  ];
}
async function body(req, max = 15 * 1024 * 1024) {
  if (!req.headers["content-type"]?.includes("application/json"))
    throw new ValidationError("Send a JSON request.", 415);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > max) throw new ValidationError("Request is too large.", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new ValidationError("Invalid JSON request.");
  }
}

export function createApp({
  database = resolve(
    process.env.DATA_DIR || join(root, "data"),
    "spoolspace.sqlite",
  ),
  seed = process.env.SEED_DEMO !== "false",
  port = Number(process.env.PORT || 4173),
  host = process.env.HOST || "0.0.0.0",
  catalogDirectory = database === ":memory:" ? null : dirname(database),
  filamentCatalog = null,
  catalogAutoUpdate = false,
  spoolReportFetch = globalThis.fetch,
  startupStatus = windowsStartupStatus,
  tls = null,
  httpsInfo = { mode: tls ? "custom" : "off" },
  publicCertificate = null,
  redirectHttps = Boolean(tls),
  renewHttps = null,
  httpsPort = Number(process.env.HTTPS_PORT || 4174),
  allowedHosts = (process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
} = {}) {
  if (
    !Array.isArray(allowedHosts) ||
    allowedHosts.some(
      (value) => typeof value !== "string" || !/^[a-z\d.-]+$/i.test(value),
    )
  )
    throw new ValidationError(
      "ALLOWED_HOSTS must contain hostnames separated by commas.",
    );
  const dataId = createHash("sha256")
    .update(
      (database === ":memory:" ? database : dirname(resolve(database)))
        .replace(/[\\/]+$/, "")
        .toLowerCase(),
    )
    .digest("hex")
    .slice(0, 16);
  const catalogPath =
    filamentCatalog?.path ||
    (catalogDirectory
      ? resolve(catalogDirectory, "open_filament_database.db")
      : null);
  if (
    database !== ":memory:" &&
    catalogPath &&
    resolve(database) === resolve(catalogPath)
  )
    throw new ValidationError(
      "The filament catalog must be separate from the user inventory database.",
    );
  const store = createStore(database, { seed });
  const filamentDatabase =
    filamentCatalog ||
    (catalogDirectory ? new OFDClient(catalogDirectory) : null);
  const localCatalog = new LocalCatalog(store, filamentDatabase);
  const spoolReports = new PrusaSpoolReports({ fetchImpl: spoolReportFetch });
  const unavailable = {
    available: false,
    busy: false,
    phase: "idle",
    counts: { brands: 0, productLines: 0, colorVariants: 0, sizes: 0 },
    autoUpdate: true,
    message:
      "Update Filament Database in Settings to enable local catalog matching.",
  };
  const catalogStatus = async () => {
    try {
      return {
        ...(filamentDatabase ? await filamentDatabase.status() : unavailable),
        customCount: store.customFilaments().length,
      };
    } catch (error) {
      return {
        ...unavailable,
        error: error.message,
        customCount: store.customFilaments().length,
      };
    }
  };
  const publicRoot = join(root, "public");
  const handler = async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    res.setHeader("Cache-Control", "no-store");
    const json = (value, code = 200) => {
      res.writeHead(code, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(value));
    };
    try {
      const authority = req.headers.host;
      if (!authority || !/^[a-zA-Z0-9.[\]:_-]+$/.test(authority))
        throw new ValidationError("Invalid host.", 400);
      const url = new URL(req.url, `http://${authority}`);
      const localHosts = new Set([
        "localhost",
        "127.0.0.1",
        "[::1]",
        "0.0.0.0",
        hostname().toLowerCase(),
        `${hostname().toLowerCase()}.local`,
        host.toLowerCase(),
        ...allowedHosts.map((value) => value.toLowerCase()),
        ...Object.values(networkInterfaces())
          .flat()
          .filter(Boolean)
          .map((item) =>
            item.family === "IPv6"
              ? `[${item.address.toLowerCase()}]`
              : item.address,
          ),
      ]);
      if (!localHosts.has(url.hostname.toLowerCase()))
        throw new ValidationError(
          "Open the app using this computer’s local address.",
          403,
        );
      if (writeMethods.has(req.method)) {
        if (req.headers["sec-fetch-site"] === "cross-site")
          throw new ValidationError(
            "Cross-site requests are not allowed.",
            403,
          );
        if (
          req.headers.origin &&
          req.headers.origin !== `http://${authority}` &&
          req.headers.origin !== `https://${authority}`
        )
          throw new ValidationError(
            "Use the app from its own local address.",
            403,
          );
      }
      const path = url.pathname;
      const actualPort = req.socket.localPort || port;
      const scheme = req.socket.encrypted ? "https" : "http";
      const securePort = secureServer?.address()?.port || httpsPort;
      const secureOrigin = `https://${url.hostname}:${securePort}`;
      if (
        (path === "/connect" || path === "/connect/") &&
        req.method === "GET" &&
        secureServer
      ) {
        const page = phoneSetupPage({
          httpsUrl: secureOrigin + "/",
          info: httpsInfo,
        });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(page);
      }
      if (
        path === "/local-ca.crt" &&
        req.method === "GET" &&
        publicCertificate
      ) {
        res.writeHead(200, {
          "Content-Type": "application/x-x509-ca-cert",
          "Content-Disposition":
            'attachment; filename="Spoolspace-Local-CA.crt"',
        });
        return res.end(publicCertificate);
      }
      if (
        secureServer &&
        redirectHttps &&
        !req.socket.encrypted &&
        path !== "/api/health"
      ) {
        if (req.method !== "GET" && req.method !== "HEAD")
          return json(
            { error: "Open Spoolspace over HTTPS before making changes." },
            426,
          );
        res.writeHead(308, {
          Location: secureOrigin + url.pathname + url.search,
        });
        return res.end();
      }
      if (path === "/api/health" && req.method === "GET")
        return json({
          app: "Spoolspace",
          version,
          dataId,
          httpsPort: secureServer?.address()?.port || null,
        });
      if (path === "/api/windows/startup" && req.method === "GET") {
        const status = await startupStatus();
        return json({
          ...status,
          canConfigure:
            status.installed &&
            isLocalStartupClient(req.socket.remoteAddress, url.hostname),
        });
      }
      if (path === "/api/bootstrap" && req.method === "GET")
        return json({
          version,
          spools: store.list(),
          activity: store.activity(),
          settings: store.settings(),
          templates: store.listTemplates(),
          filamentDatabase: await catalogStatus(),
          network: {
            urls: networkUrls(secureServer ? securePort : actualPort).map(
              (value) =>
                value.replace(/^http:/, secureServer ? "https:" : scheme + ":"),
            ),
            port: actualPort,
            httpsPort: secureServer?.address()?.port || null,
            setupUrls: secureServer
              ? networkUrls(server.address().port).map(
                  (value) => value + "/connect",
                )
              : [],
            https: httpsInfo,
          },
          scan: {
            ocr: true,
            ollama: Boolean(
              store.settings().ollamaModel || process.env.OLLAMA_MODEL,
            ),
            model:
              store.settings().ollamaModel || process.env.OLLAMA_MODEL || "",
          },
        });
      if (path === "/api/spools" && req.method === "GET")
        return json(store.list());
      if (path === "/api/spools" && req.method === "POST")
        return json(store.add(await body(req)), 201);
      const spoolRoute = path.match(
        /^\/api\/spools\/([a-zA-Z0-9-]+)(?:\/(usage|weigh|dry|start))?$/,
      );
      if (spoolRoute) {
        const [, id, action] = spoolRoute;
        if (!action && req.method === "GET") return json(store.get(id));
        if (!action && req.method === "PATCH")
          return json(store.update(id, await body(req)));
        if (!action && req.method === "DELETE") return json(store.remove(id));
        if (action && req.method === "POST")
          return json(
            store[action === "usage" ? "use" : action](id, await body(req)),
          );
      }
      if (path === "/api/activity" && req.method === "GET")
        return json(store.activity());
      if (path === "/api/catalog" && req.method === "GET") return json(catalog);
      if (path === "/api/filament-database/status" && req.method === "GET")
        return json(await catalogStatus());
      if (path === "/api/filament-database/sync" && req.method === "POST") {
        if (!filamentDatabase)
          throw new ValidationError(
            "Filament catalog storage is not configured.",
            503,
          );
        return json(
          {
            ...(await filamentDatabase.startSync()),
            customCount: store.customFilaments().length,
          },
          202,
        );
      }
      if (
        path === "/api/filament-database/settings" &&
        req.method === "PATCH"
      ) {
        if (!filamentDatabase)
          throw new ValidationError(
            "Filament catalog storage is not configured.",
            503,
          );
        return json({
          ...(await filamentDatabase.configure(await body(req))),
          customCount: store.customFilaments().length,
        });
      }
      if (path === "/api/filament-database/search" && req.method === "GET")
        return json(
          await localCatalog.search(Object.fromEntries(url.searchParams)),
        );
      if (path === "/api/filament-database/match" && req.method === "POST") {
        const input = await body(req, 100 * 1024);
        return json(await localCatalog.match(input));
      }
      const catalogProductRoute = path.match(
        /^\/api\/filament-database\/products\/([^/]+)$/,
      );
      if (catalogProductRoute && req.method === "GET") {
        return json(
          await localCatalog.getProduct(
            decodeURIComponent(catalogProductRoute[1]),
          ),
        );
      }
      if (path === "/api/templates" && req.method === "GET")
        return json(store.listTemplates());
      const templateRoute = path.match(/^\/api\/templates\/([a-zA-Z0-9-]+)$/);
      if (
        (path === "/api/templates" && req.method === "POST") ||
        (templateRoute && req.method === "PATCH")
      ) {
        const template = store.saveTemplate(
          await body(req),
          templateRoute?.[1],
        );
        const fields = Object.assign(
          {},
          ...[...template.regions]
            .sort(
              (a, b) =>
                Number(a.field === "productLine") -
                Number(b.field === "productLine"),
            )
            .map((r) => parseRegion(r.field, r.value)),
        );
        return json({ ...template, fields }, templateRoute ? 200 : 201);
      }
      if (templateRoute && req.method === "GET")
        return json(store.getTemplate(templateRoute[1]));
      if (templateRoute && req.method === "DELETE")
        return json(store.deleteTemplate(templateRoute[1]));
      if (path === "/api/settings" && req.method === "PATCH")
        return json(store.updateSettings(await body(req)));
      if (path === "/api/demo/clear" && req.method === "POST") {
        if (!store.settings().demoData)
          throw new ValidationError("Demo inventory has already been cleared.");
        return json(store.clearDemo());
      }
      if (path === "/api/backup" && req.method === "GET") {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="spoolspace-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        );
        return json(store.backup());
      }
      if (path === "/api/materials" && req.method === "POST")
        return json(store.addMaterial(await body(req)), 201);
      if (path === "/api/restore" && req.method === "POST")
        return json(store.restore(await body(req, 40 * 1024 * 1024)));
      if (path === "/api/photo/orient" && req.method === "POST") {
        const input = await body(req);
        return json(
          await recognizeImage(input?.image, "ocr", "", {
            orientationOnly: true,
          }),
        );
      }
      if (path === "/api/photo/focus" && req.method === "POST") {
        const input = await body(req);
        return json(
          await recognizeImage(input?.image, "ocr", "", { focusOnly: true }),
        );
      }
      if (path === "/api/scan" && req.method === "POST") {
        const input = await body(req);
        const qrTask =
          input?.readQR === false
            ? Promise.resolve({ codes: [], skipped: true })
            : readQRCodes([input?.qrImage, input?.image]);
        const [ocrRead, qrRead, reportRead] = await Promise.allSettled([
          recognizeImage(
            input?.image,
            input?.mode || "ocr",
            store.settings().ollamaModel || process.env.OLLAMA_MODEL || "",
            {
              template: input?.templateId
                ? store.getTemplate(input.templateId)
                : null,
              regions: input?.regions,
              templates: store.listTemplates(),
            },
          ),
          qrTask,
          qrTask.then((decoded) =>
            spoolReports.lookup(decoded.codes, input?.readSpoolInfo !== false),
          ),
        ]);
        const decoded =
          qrRead.status === "fulfilled"
            ? qrRead.value
            : {
                codes: [],
                error: "QR reader unavailable. OCR remains available.",
              };
        if (ocrRead.status === "rejected" && !decoded.codes.length)
          throw ocrRead.reason;
        const recognition =
            ocrRead.status === "fulfilled"
              ? ocrRead.value
              : {
                  text: "",
                  fields: {},
                  regions: [],
                  warnings: [
                    "Text could not be read. QR data is available; review and enter missing details manually.",
                  ],
                  method: "Local QR",
                },
          qr = qrEvidence(decoded.codes),
          merged = mergeQRFields(recognition.fields, qr);
        recognition.fields = { ...merged.fields, qrCodes: decoded.codes };
        if (!recognition.fields.name && recognition.fields.material)
          recognition.fields.name = [
            recognition.fields.brand,
            recognition.fields.productLine || recognition.fields.material,
            recognition.fields.colorName,
          ]
            .filter(Boolean)
            .join(" · ");
        recognition.qr = {
          ...qr,
          conflicts: merged.conflicts,
          error: decoded.error,
          skipped: decoded.skipped,
        };
        const report =
          reportRead.status === "fulfilled" ? reportRead.value : null;
        if (report) {
          const confirmed = recognition.regions.flatMap((region) =>
            region.field === "temperatureRange"
              ? ["temperatureMin", "temperatureMax"]
              : region.field === "colorName" &&
                  /#[\da-f]{6}/i.test(region.correctedText || region.text)
                ? ["colorName", "colorHex"]
                : [region.field],
          );
          const enriched = mergeSpoolReport(recognition.fields, report, {
            confirmed,
            ocrText: recognition.text,
          });
          recognition.fields = enriched.fields;
          recognition.qr.spoolReport = report;
          recognition.qr.reportConflicts = enriched.conflicts;
          if (report.status === "unavailable")
            recognition.warnings.push(report.message);
          if (enriched.conflicts.length)
            recognition.warnings.push(
              "The manufacturer spool report and label disagree. Label and confirmed values were kept; compare them with the report before saving.",
            );
        }
        if (qr.multiple)
          recognition.warnings.push(
            "Multiple QR codes found. QR fields were not applied; take a closer photo with one spool code.",
          );
        if (merged.conflicts.length)
          recognition.warnings.push(
            "QR data and label text disagree. Text fields were kept; compare both sources before saving.",
          );
        let catalogMatch;
        try {
          catalogMatch = await localCatalog.match({
            text: recognition.text,
            fields: recognition.fields,
            qrCodes: decoded.codes,
            regions: recognition.regions.map((r) => ({
              id: r.id,
              field: r.field,
              x: 0,
              y: 0,
              width: 1,
              height: 1,
              value: r.correctedText || r.text,
            })),
          });
        } catch (error) {
          catalogMatch = {
            ...unavailable,
            candidates: [],
            error: error.message,
          };
        }
        return json({ ...recognition, catalogMatch });
      }
      const exportRoute = path.match(/^\/api\/export\/([a-zA-Z0-9-]+)$/);
      if (exportRoute && req.method === "GET") {
        const exported = exportPreset(
          store.get(exportRoute[1]),
          url.searchParams.get("format") || "bambu",
          url.searchParams.get("parent") || "",
          url.searchParams.get("printer") || "",
        );
        res.writeHead(200, {
          "Content-Type": exported.type,
          "Content-Disposition": `attachment; filename="${exported.filename}"`,
        });
        return res.end(exported.text);
      }
      if (path === "/api/qr" && req.method === "GET") {
        let target;
        try {
          target = new URL(url.searchParams.get("url"));
        } catch {
          throw new ValidationError("Invalid local URL.");
        }
        const allowed = new Set([
          `${scheme}://${authority}`,
          `${scheme}://localhost:${actualPort}`,
          `${scheme}://127.0.0.1:${actualPort}`,
          ...networkUrls(actualPort).map((value) =>
            value.replace(/^http:/, scheme + ":"),
          ),
          ...networkUrls(server.address().port),
          `http://localhost:${server.address().port}`,
          `http://127.0.0.1:${server.address().port}`,
          ...(secureServer
            ? networkUrls(securePort).map((value) =>
                value.replace(/^http:/, "https:"),
              )
            : []),
        ]);
        if (!allowed.has(target.origin) || target.username || target.password)
          throw new ValidationError("Only this local server can be shared.");
        const svg = await QRCode.toString(target.href, {
          type: "svg",
          margin: 1,
          color: { dark: "#263f37", light: "#ffffff" },
        });
        res.writeHead(200, { "Content-Type": "image/svg+xml" });
        return res.end(svg);
      }
      if (path.startsWith("/api/"))
        throw new ValidationError("Endpoint not found.", 404);
      if (req.method !== "GET" && req.method !== "HEAD")
        throw new ValidationError("Method not allowed.", 405);
      let decoded;
      try {
        decoded = decodeURIComponent(path);
      } catch {
        throw new ValidationError("Invalid path.");
      }
      const file = resolve(
        publicRoot,
        `.${decoded === "/" ? "/index.html" : decoded}`,
      );
      if (!file.startsWith(publicRoot + sep))
        throw new ValidationError("Not found.", 404);
      let info;
      try {
        info = await stat(file);
      } catch {
        throw new ValidationError("Not found.", 404);
      }
      if (!info.isFile()) throw new ValidationError("Not found.", 404);
      const content = await readFile(file);
      res.writeHead(200, {
        "Content-Type":
          contentTypes[extname(file)] || "application/octet-stream",
      });
      return res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (res.headersSent) return res.end();
      const status = error instanceof ValidationError ? error.status : 500;
      if (status === 500) console.error("Request failed:", error);
      return json(
        {
          error:
            status === 500
              ? "Something went wrong on the local server."
              : error.message,
        },
        status,
      );
    }
  };
  const server = createServer(handler);
  const secureServer = tls ? createSecureServer(tls, handler) : null;
  let certificateTimer = null,
    refreshingCertificate = false;
  const refreshHttps = async () => {
    if (!secureServer || !renewHttps || refreshingCertificate) return;
    refreshingCertificate = true;
    try {
      const refreshed = await renewHttps();
      if (!refreshed.tls)
        throw new Error("HTTPS certificate renewal returned no certificate.");
      secureServer.setSecureContext(refreshed.tls);
      Object.assign(httpsInfo, refreshed.info);
    } finally {
      refreshingCertificate = false;
    }
  };
  server.requestTimeout = 180000;
  if (secureServer) secureServer.requestTimeout = 180000;
  return {
    server,
    secureServer,
    refreshHttps,
    store,
    filamentDatabase,
    listen: async () => {
      const listen = (target, targetPort) =>
        new Promise((resolveListen, reject) => {
          const error = (value) => reject(value);
          target.once("error", error);
          target.listen(targetPort, host, () => {
            target.removeListener("error", error);
            resolveListen();
          });
        });
      try {
        await listen(server, port);
        if (secureServer) await listen(secureServer, httpsPort);
      } catch (error) {
        await Promise.all(
          [server, secureServer]
            .filter((target) => target?.listening)
            .map(
              (target) =>
                new Promise((resolveClose) => target.close(resolveClose)),
            ),
        );
        throw error;
      }
      if (catalogAutoUpdate && filamentDatabase)
        Promise.resolve(filamentDatabase.startAutomatic()).catch(() => {});
      if (secureServer && renewHttps) {
        certificateTimer = setInterval(
          () =>
            refreshHttps().catch((error) =>
              console.error("HTTPS renewal failed:", error.message),
            ),
          6 * 60 * 60 * 1000,
        );
        certificateTimer.unref();
      }
      return server.address();
    },
    close: async () => {
      clearInterval(certificateTimer);
      await Promise.all(
        [server, secureServer]
          .filter((target) => target?.listening)
          .map(
            (target) =>
              new Promise((resolveClose, reject) =>
                target.close((error) =>
                  error ? reject(error) : resolveClose(),
                ),
              ),
          ),
      );
      await filamentDatabase?.close();
      store.close();
    },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const httpsSettings = {
    dataDir: resolve(process.env.DATA_DIR || join(root, "data")),
    mode: process.env.HTTPS_MODE || "off",
    certFile: process.env.TLS_CERT_FILE,
    keyFile: process.env.TLS_KEY_FILE,
  };
  const renewHttps = () =>
    configureHttps({
      ...httpsSettings,
      names: certificateNames({
        extra: (process.env.ALLOWED_HOSTS || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    });
  const https = await renewHttps();
  const app = createApp({
    catalogAutoUpdate: process.env.CATALOG_AUTO_UPDATE !== "false",
    tls: https.tls,
    httpsInfo: https.info,
    publicCertificate: https.publicCertificate,
    renewHttps: https.tls ? renewHttps : null,
  });
  try {
    const address = await app.listen();
    const securePort = app.secureServer?.address()?.port;
    console.log(
      `\n  Spoolspace is ready\n  This computer: ${securePort ? "https" : "http"}://localhost:${securePort || address.port}\n${networkUrls(
        securePort || address.port,
      )
        .map(
          (url) =>
            `  Phone / Wi-Fi: ${securePort ? url.replace(/^http:/, "https:") : url}`,
        )
        .join(
          "\n",
        )}\n\n  Local SQLite: ${resolve(process.env.DATA_DIR || join(root, "data"), "spoolspace.sqlite")}\n  Keep this terminal open. Press Ctrl+C to stop.\n`,
    );
    if (securePort)
      console.log(
        `  First-time phone setup: http://localhost:${address.port}/connect\n${networkUrls(
          address.port,
        )
          .map((url) => "  " + url + "/connect")
          .join(
            "\n",
          )}\n${https.info.fingerprint ? "  Certificate SHA-256: " + https.info.fingerprint + "\n" : ""}`,
      );
    let stopping = false;
    const shutdown = async () => {
      if (stopping) return;
      stopping = true;
      await app.close();
      process.exit(0);
    };
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, shutdown);
    if (process.env.SPOOLSPACE_SUPERVISED === "1") {
      const input = createInterface({ input: process.stdin });
      input.on("line", (value) => {
        if (value.trim() === "shutdown") shutdown();
      });
      input.on("close", shutdown);
    }
  } catch (error) {
    console.error(`Could not start Spoolspace: ${error.message}`);
    app.store.close();
    await app.filamentDatabase?.close();
    process.exitCode = 1;
  }
}
