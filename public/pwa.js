"use strict";
(() => {
  let pending = null,
    network = {},
    workerState = "not started",
    workerError = "",
    message = "",
    prompting = false;
  let installed = Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
    navigator.standalone,
  );
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function render(value) {
    if (value) network = value;
    const panel = document.querySelector("#phone-install-panel");
    if (!panel) return;
    const secure = window.isSecureContext === true;
    if (location.protocol === "http:") {
      panel.innerHTML =
        '<h2>Use on your phone</h2><p>Open Spoolspace over your home Wi-Fi. No certificates are needed.</p><ol class="guide-list"><li><strong>Android:</strong> Open this address in Chrome, tap ⋮ → Add to Home screen → Create shortcut (or the available Home Screen option).</li><li><strong>iPhone / iPad:</strong> Open in Safari, choose Share → Add to Home Screen.</li></ol><p class="section-note" id="pwa-connection-note">This address uses HTTP. Your browser can create a Home Screen shortcut. Full PWA installation may be unavailable over HTTP.</p><p class="section-note">Keep your home server running and use the same Wi-Fi when opening the shortcut.</p>';
      return;
    }
    panel.innerHTML = `<h2>Install on your phone</h2><p>Open Spoolspace as an app from your Home Screen. Keep your home server running and reachable on Wi-Fi.</p><p class="section-note" id="pwa-connection-note"></p>${installed ? "<p>You are already using the installed app.</p>" : pending && secure && !workerError ? `<button class="btn primary" id="install-pwa" type="button" ${prompting ? "disabled" : ""}>Install Spoolspace</button>` : '<p id="pwa-not-ready">The browser has not offered an install prompt yet. Follow the steps below.</p>'}${network.https?.mode === "local" ? `<div class="setting-row"><div><h3>Trust this server on your phone once</h3><p>Download the public certificate, compare its fingerprint with this Windows computer, and install it as a CA certificate in your phone’s Settings.</p></div><a class="btn" href="/local-ca.crt" download="Spoolspace-Local-CA.crt">Download public certificate</a></div><p class="section-note">SHA-256: <code style="overflow-wrap:anywhere">${escape(network.https.fingerprint)}</code></p>` : ""}<p><a id="pwa-setup-link" href="/connect" target="_blank" rel="noopener">Open phone HTTPS setup instructions</a></p><ol class="guide-list"><li><strong>Android:</strong> Open the HTTPS address in normal Chrome (not Incognito or an in-app browser). There must be no certificate warning. Interact with the page and stay for at least 30 seconds; Chrome may then offer installation.</li><li>If no button appears, open Chrome’s ⋮ menu → Add to Home screen → Install. A shortcut is different from an installed app.</li><li><strong>iPhone / iPad:</strong> Open in Safari, choose Share → Add to Home Screen. Enable Open as Web App if offered.</li></ol><p class="section-note" id="pwa-worker-status" role="status"></p><p class="section-note" id="pwa-install-status" role="status"></p>`;
    panel.querySelector("#pwa-connection-note").textContent = secure
      ? "Secure browser context available. HTTPS must be trusted on this device; bypassing a certificate warning is not sufficient."
      : location.protocol === "https:"
        ? "HTTPS is open, but the browser does not consider it secure. Trust this server's CA certificate on your phone, close and reopen Chrome, then return here."
        : "This address uses HTTP. Open the HTTPS server address and trust its certificate before installing. HTTP only supports a Home Screen shortcut.";
    const setup = panel.querySelector("#pwa-setup-link");
    if (!network.httpsPort && location.protocol !== "https:")
      setup.hidden = true;
    panel.querySelector("#pwa-worker-status").textContent = workerError
      ? "App setup failed: " +
        workerError +
        ". Check certificate trust, close and reopen Chrome, then reload this page."
      : secure
        ? "App support: " + workerState + "."
        : "App support requires a trusted secure connection.";
    panel.querySelector("#pwa-install-status").textContent = message;
    const button = panel.querySelector("#install-pwa");
    if (button)
      button.addEventListener("click", async () => {
        if (!pending || prompting) return;
        const request = pending;
        pending = null;
        prompting = true;
        try {
          // Invoke during this click's activation, before awaiting anything.
          const result = request.prompt();
          render();
          await result;
          const choice = await request.userChoice;
          message =
            choice.outcome === "accepted"
              ? "Installation requested. Look for Spoolspace on your Home Screen."
              : "Installation cancelled. You can install later from Chrome's menu.";
        } catch (error) {
          message =
            "The browser could not open installation. Use Chrome's menu → Add to Home screen → Install. " +
            (error.message || "");
        } finally {
          prompting = false;
          render();
        }
      });
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pending = event;
    render();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    pending = null;
    message = "Spoolspace was installed.";
    render();
  });
  let registered = false;
  async function register() {
    if (registered || !window.isSecureContext || location.protocol === "http:")
      return;
    registered = true;
    if (!("serviceWorker" in navigator)) {
      workerError = "service workers are unavailable in this browser";
      render();
      return;
    }
    workerState = "setting up";
    render();
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      workerState = "registered";
      navigator.serviceWorker.ready
        ?.then(() => {
          workerState = "ready";
          render();
        })
        .catch(() => {});
    } catch (error) {
      workerError = error.message || "service worker registration failed";
    }
    render();
  }
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
  window.SpoolspacePWA = { render };
})();
