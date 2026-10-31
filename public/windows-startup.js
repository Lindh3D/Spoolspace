"use strict";
(() => {
  let generation = 0;
  const choices = [
    [
      "manual",
      "Only when I open Spoolspace",
      "No automatic startup. Open the desktop shortcut when needed.",
    ],
    [
      "login",
      "In the background at Windows sign-in",
      "Starts after a Windows user signs in, without opening the browser.",
    ],
    [
      "service",
      "As a server when Windows starts",
      "Runs as a Windows service, even when nobody signs in.",
    ],
  ];
  async function render() {
    const panel = document.querySelector("#windows-startup-panel");
    if (!panel) return;
    const current = ++generation;
    panel.innerHTML =
      '<h2>Windows startup</h2><p role="status">Reading Windows startup settings…</p>';
    let status;
    try {
      const response = await fetch("/api/windows/startup", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      status = await response.json();
    } catch {
      if (current !== generation || !panel.isConnected) return;
      panel.innerHTML =
        '<h2>Windows startup</h2><p role="status">Could not read startup settings. Try refreshing this page.</p>';
      return;
    }
    if (current !== generation || !panel.isConnected) return;
    if (!status.installed) {
      panel.innerHTML =
        "<h2>Windows startup</h2><p>Startup controls are available in the installed Windows version. Portable and source copies start when you launch them.</p>";
      return;
    }
    const local =
      status.canConfigure &&
      ["localhost", "127.0.0.1", "[::1]"].includes(
        location.hostname.toLowerCase(),
      );
    panel.innerHTML = `<h2>Windows startup</h2><p>Choose how this computer starts Spoolspace.</p><form id="windows-startup-form"><div class="field"><label for="windows-startup-mode">Startup mode</label><select id="windows-startup-mode" ${local ? "" : "disabled"}>${status.mode ? "" : '<option value="" selected disabled>Unable to read current setting</option>'}${choices.map(([value, title]) => `<option value="${value}" ${status.mode === value ? "selected" : ""}>${title}</option>`).join("")}</select><small id="windows-startup-description"></small></div><p>Changes take effect at the next Windows startup. The current server keeps running. Closing the browser leaves it running; use the notification-area menu or Windows Services to stop it.</p><p id="windows-startup-status" role="status"></p><div class="form-actions">${local ? '<a class="btn primary" id="windows-startup-open" href="spoolspace://startup">Review and apply in Windows</a>' : "<span>To change this setting, open http://localhost on the Windows server using its configured port, then go to Settings.</span>"}<button class="btn" type="button" id="windows-startup-refresh">Refresh setting</button></div></form>`;
    const select = panel.querySelector("select"),
      link = panel.querySelector("#windows-startup-open");
    const update = () => {
      panel.querySelector("#windows-startup-description").textContent =
        choices.find(([value]) => value === select.value)?.[2] ||
        "Select a startup mode to review it in Windows.";
      if (link)
        link.href = `spoolspace://startup${select.value ? "/" + select.value : ""}`;
    };
    update();
    select.addEventListener("change", update);
    panel
      .querySelector("form")
      .addEventListener("submit", (event) => event.preventDefault());
    panel
      .querySelector("#windows-startup-refresh")
      .addEventListener("click", render);
    const message = panel.querySelector("#windows-startup-status");
    message.textContent =
      status.error ||
      (status.conflict
        ? "Windows has conflicting startup entries. Review and apply a mode to correct them."
        : "");
    link?.addEventListener("click", () => {
      message.textContent =
        "Allow your browser to open Spoolspace. Save in the Windows dialog and approve the Windows administrator prompt. Return here and refresh the setting. Cancelling either dialog keeps your setting unchanged.";
    });
  }
  window.addEventListener("focus", () => {
    if (document.querySelector("#windows-startup-panel")) render();
  });
  window.SpoolspaceWindowsStartup = { render };
})();
