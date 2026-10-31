"use strict";

const paths = {
  spool:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/><path d="M21 12v9h2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 5h13M8 12h13M8 19h13"/><circle cx="3" cy="5" r=".7"/><circle cx="3" cy="12" r=".7"/><circle cx="3" cy="19" r=".7"/>',
  dry: '<path d="M7 20c-5-5 4-7 0-13M12 20c-5-5 4-7 0-16M17 20c-5-5 4-7 0-13"/>',
  box: '<path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7.5 5 17 9"/>',
  layers: '<path d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  settings:
    '<path d="m10 3-.8 3-2.6 1-2.7-.8-2 3.6 2 2.2v3l-2 2.2 2 3.5 2.7-.7 2.6 1 .8 2h4l.8-2 2.6-1 2.7.7 2-3.5-2-2.2v-3l2-2.2-2-3.6-2.7.8-2.6-1L14 3Z" transform="translate(0 -1) scale(1 .95)"/><circle cx="12" cy="12" r="3"/>',
  scan: '<path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4M16 21h4a1 1 0 0 0 1-1v-4M3 12h18"/><rect x="7" y="7" width="10" height="10" rx="2"/>',
  camera:
    '<path d="M4 7h4l2-3h4l2 3h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  more: '<circle cx="5" cy="12" r=".7"/><circle cx="12" cy="12" r=".7"/><circle cx="19" cy="12" r=".7"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  weight: '<path d="m6 7-3 14h18L18 7H6Z"/><circle cx="12" cy="5" r="3"/>',
  drop: '<path d="M19 14a7 7 0 0 1-14 0c0-4 7-12 7-12s7 8 7 12Z"/><path d="M8 14c0 2 1 3 3 3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  upload: '<path d="M12 15V3m-4 4 4-4 4 4M4 16v5h16v-5"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  phone:
    '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4M10 5h4"/>',
  link: '<path d="m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0) scale(.92 1)"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  leaf: '<path d="M20 3c-11-2-18 5-15 12s16 6 15-12ZM5 21 16 9M9 13l1 5"/>',
  loading: '<path d="M21 12a9 9 0 1 1-3-6.7"/>',
  printer:
    '<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6Z"/><path d="M17 11h1"/>',
  save: '<path d="M4 3h14l3 3v15H3V3Zm3 0v6h10V3M7 21v-8h10v8"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.spool}</svg>`;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const hex = (value) =>
  /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#a4af98";
const num = (value, digits = 0) =>
  Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
const grams = (value) => `${num(value)} g`;
const when = (value) =>
  value && !isNaN(Date.parse(value))
    ? new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not recorded";
const daysSince = (value) =>
  value ? Math.max(0, (Date.now() - Date.parse(value)) / 86400000) : Infinity;
const pct = (s) =>
  s.initialWeight > 0
    ? Math.max(
        0,
        Math.min(100, Math.round((s.remainingWeight / s.initialWeight) * 100)),
      )
    : 0;
const guides = {
  PLA: { temp: 45, hours: 6, days: 30 },
  PETG: { temp: 60, hours: 6, days: 14 },
  ABS: { temp: 65, hours: 6, days: 30 },
  ASA: { temp: 65, hours: 6, days: 30 },
  TPU: { temp: 50, hours: 8, days: 7 },
  PA: { temp: 70, hours: 8, days: 3 },
  NYLON: { temp: 70, hours: 8, days: 3 },
  PC: { temp: 70, hours: 8, days: 7 },
  PVA: { temp: 45, hours: 8, days: 3 },
};
const guide = (s) =>
  guides[
    Object.keys(guides).find((k) =>
      String(s.material).toUpperCase().startsWith(k),
    )
  ] || { temp: 50, hours: 6, days: 14 };
function drying(s) {
  if (s.remainingWeight <= 0 || s.status === "empty")
    return { due: false, label: "Empty spool", icon: "spool" };
  const opened = Boolean(s.openedDate);
  const sealed = /sealed|dry box|vacuum/i.test(s.storage || "");
  const age = Math.min(daysSince(s.lastDriedAt), daysSince(s.openedDate));
  if (opened && !sealed && age > guide(s).days)
    return { due: true, label: "Drying reminder", icon: "dry" };
  if (sealed) return { due: false, label: "Stored sealed", icon: "shield" };
  if (s.lastDriedAt && daysSince(s.lastDriedAt) < guide(s).days)
    return { due: false, label: "Recently dried", icon: "check" };
  return {
    due: false,
    label: opened ? "Opened spool" : "Unopened spool",
    icon: opened ? "box" : "shield",
  };
}
const reel = (color, className = "") =>
  `<svg class="reel ${className}" style="--spool:${hex(color)}" viewBox="0 0 180 160" aria-hidden="true"><ellipse cx="90" cy="139" rx="47" ry="6" fill="#35422e" opacity=".06"/><circle class="flange" cx="97" cy="80" r="58"/><circle cx="97" cy="80" r="51" fill="#e4e6d8"/><circle class="winding" cx="93" cy="80" r="41" stroke-width="24"/><g fill="none" stroke="#ffffff" stroke-width=".6" opacity=".23">${[31, 34, 37, 40, 43, 46, 49, 52].map((r) => `<circle cx="93" cy="80" r="${r}"/>`).join("")}</g><circle class="flange" cx="83" cy="80" r="57" fill-opacity=".85"/><circle class="winding" cx="83" cy="80" r="40" stroke-width="22"/><g fill="none" stroke="#ffffff" stroke-width=".55" opacity=".26">${[31, 34, 37, 40, 43, 46, 49, 51].map((r) => `<circle cx="83" cy="80" r="${r}"/>`).join("")}</g><circle class="hub" cx="83" cy="80" r="26"/><circle cx="83" cy="80" r="16" fill="#344638"/><circle cx="83" cy="80" r="11" fill="#e7eadf"/><circle cx="80" cy="77" r="8" fill="#f3f4e9"/><g fill="#d1d8c6">${[0, 60, 120, 180, 240, 300].map((a) => `<rect x="80.5" y="31" width="5" height="8" rx="2.5" transform="rotate(${a} 83 80)"/>`).join("")}</g><path d="M133 83v40q0 11 12 11h10" fill="none" stroke="${hex(color)}" stroke-width="2" stroke-linecap="round"/></svg>`;

const state = {
  view: "inventory",
  spools: [],
  activity: [],
  settings: {},
  network: { urls: [], port: 4173 },
  scan: {},
  query: "",
  material: "all",
  stock: "all",
  sort: "recent",
  layout: "grid",
  catalog: null,
  scanImage: null,
  scanFields: null,
  scanText: "",
  scanColor: null,
  scanSequence: 0,
  templates: [],
  filamentDatabase: null,
  catalogPools: {},
};
const lowStock = (s) =>
  s.remainingWeight > 0 &&
  s.remainingWeight <= Number(state.settings.lowStockThreshold ?? 200);
const $ = (selector) => document.querySelector(selector);
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "The server returned an unreadable response." }));
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
async function refresh() {
  const data = await api("/bootstrap");
  Object.assign(state, {
    version: data.version || "0.5.3",
    spools: data.spools,
    activity: data.activity,
    settings: data.settings,
    network: data.network,
    scan: data.scan,
    templates: data.templates || [],
    filamentDatabase: data.filamentDatabase || null,
  });
  render();
}
function toast(message, error = false) {
  const node = document.createElement("div");
  node.className = `toast ${error ? "error" : ""}`;
  node.innerHTML =
    icon(error ? "info" : "check") + `<span>${esc(message)}</span>`;
  $("#toasts").append(node);
  setTimeout(() => node.remove(), 6000);
}
const views = {
  inventory: "Inventory",
  drying: "Drying room",
  profiles: "Slicer profiles",
  templates: "Label templates",
  activity: "Activity",
  settings: "Settings",
};
function render() {
  clearTimeout(state.catalogPollTimer);
  const due = state.spools.filter((s) => drying(s).due).length;
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar"><a class="brand" href="#inventory" aria-label="Spoolspace home"><span class="brand-mark">${icon("spool")}</span>spoolspace<span style="color:#a7bb8c">.</span></a><div class="brand-sub">A home for every spool</div><p class="nav-label">YOUR WORKSPACE</p><nav class="nav" aria-label="Main navigation">${[
      ["inventory", "grid", "Inventory", state.spools.length],
      ["drying", "dry", "Drying room", due],
      ["profiles", "layers", "Slicer profiles"],
      ["templates", "scan", "Label templates"],
      ["activity", "activity", "Activity"],
    ]
      .map(
        ([key, ic, title, count]) =>
          `<button type="button" data-view="${key}" class="${state.view === key ? "active" : ""}" title="${title}" ${state.view === key ? 'aria-current="page"' : ""}>${icon(ic)}<span>${title}</span>${count !== undefined ? `<span class="count">${count}</span>` : ""}</button>`,
      )
      .join(
        "",
      )}</nav><div class="side-bottom"><div class="local-card"><div class="local-title"><span class="dot"></span>Local by design</div><p>Your spools. Your computer.<br>A little space, all your own.</p><button data-action="phone">Connect your phone ${icon("arrow")}</button></div><nav class="nav"><button data-view="settings" class="${state.view === "settings" ? "active" : ""}">${icon("settings")}Settings</button><button data-action="guide">${icon("info")}Getting started</button></nav><div class="sidebar-foot">${icon("spool")}SPOOLSPACE · ${esc(state.version || "0.5.3")}</div></div></aside><main class="main"><header class="topbar"><div class="breadcrumbs">${esc(state.settings.appName || "Workspace")} ${icon("chevron")}<strong>${views[state.view]}</strong></div><div class="top-right"><span class="local-pill"><span class="dot"></span>Local server connected</span><span class="top-divider"></span><button class="avatar" data-view="settings" title="Workspace settings" style="cursor:pointer">MY</button><button class="icon-btn mobile-brand" data-view="settings" aria-label="Settings">${icon("settings")}</button></div></header><div class="content">${page()}<footer class="page-footer"><span>Stored locally in SQLite. Made for your next idea.</span><span class="signature">less searching, more making.</span></footer></div></main></div>`;
  if (state.view === "inventory") renderInventory();
  if (state.view === "settings") {
    $(".settings-stack").insertAdjacentHTML(
      "afterbegin",
      `<section class="panel" id="ofd-database-panel">${filamentDatabasePanel()}</section>`,
    );
    if (state.filamentDatabase) scheduleCatalogPoll();
    $(".settings-stack").insertAdjacentHTML(
      "afterbegin",
      '<section class="panel" id="phone-install-panel"></section>',
    );
    window.SpoolspacePWA?.render(state.network);
    $(".settings-stack").insertAdjacentHTML(
      "afterbegin",
      '<section class="panel" id="windows-startup-panel"></section>',
    );
    window.SpoolspaceWindowsStartup?.render();
  }
  document.title = `${views[state.view]} · Spoolspace`;
}
function page() {
  if (state.view === "inventory") return inventoryPage();
  if (state.view === "drying") return dryingPage();
  if (state.view === "profiles") return profilesPage();
  if (state.view === "templates") return templatesPage();
  if (state.view === "activity") return activityPage();
  return settingsPage();
}
function heading(kicker, title, subtitle, actions = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="subheading">${subtitle}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
}
function inventoryPage() {
  const active = state.spools.filter((s) => s.remainingWeight > 0);
  const total = state.spools.reduce((a, s) => a + s.remainingWeight, 0);
  const low = active.filter(lowStock).length;
  const due = active.filter((s) => drying(s).due).length;
  const brands = new Set(state.spools.map((s) => s.brand)).size;
  return `${heading("A LITTLE ORDER. A LOT MORE MAKING.", "Filament inventory", "Know what you have. Find what you need. Make something great.", `<button class="btn" data-action="scan">${icon("scan")}Scan a spool</button><button class="btn primary" data-action="add">${icon("plus")}Add spool</button>`)}<div class="stats">${[
    [
      "spool",
      "Total spools",
      num(state.spools.length),
      "",
      `${num(brands)} brands in your collection`,
      false,
    ],
    [
      "weight",
      "Filament available",
      num(total / 1000, 2),
      "kg",
      `${num(active.length)} spools with filament`,
      false,
    ],
    [
      "dry",
      "Drying reminders",
      num(due),
      "",
      due
        ? "Worth checking before your next print"
        : "Your drying list is all caught up",
      due > 0,
    ],
    [
      "layers",
      "Running low",
      num(low),
      "",
      `At or below ${grams(state.settings.lowStockThreshold ?? 200)} remaining`,
      low > 0,
    ],
  ]
    .map(
      ([ic, label, value, unit, foot, attention]) =>
        `<div class="stat ${attention ? "attention" : ""}"><div class="stat-label">${icon(ic)}${label}</div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-foot">${foot}</div><div class="stat-illustration">${icon(ic)}</div></div>`,
    )
    .join(
      "",
    )}</div>${state.settings.demoData ? `<div class="demo-banner"><span><strong>A little inspiration to start.</strong> You’re viewing sample spools. Add your own or start with an empty shelf.</span><button data-action="clear-demo">Clear sample inventory</button></div>` : ""}<div class="section-heading"><h2>Your collection <span class="number-badge" id="result-count">${state.spools.length}</span></h2><button class="btn small ghost" data-action="planner">${icon("layers")}Find a spool for a print ${icon("arrow")}</button></div><div class="toolbar"><label class="search">${icon("search")}<input id="search" type="search" placeholder="Search brand, material, color…" aria-label="Search spools" value="${esc(state.query)}"></label><select class="filter" id="filter-material" aria-label="Filter by material"><option value="all">All materials</option>${[
    ...new Set(state.spools.map((s) => s.material)),
  ]
    .sort()
    .map(
      (m) =>
        `<option ${state.material === m ? "selected" : ""} value="${esc(m)}">${esc(m)}</option>`,
    )
    .join(
      "",
    )}</select><select class="filter" id="filter-stock" aria-label="Filter by stock status">${[
    ["all", "All spools"],
    ["available", "Available"],
    ["in-use", "In use"],
    ["low", "Running low"],
    ["dry", "Drying reminder"],
    ["empty", "Empty"],
  ]
    .map(
      ([val, label]) =>
        `<option value="${val}" ${state.stock === val ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select><select class="filter" id="sort" aria-label="Sort spools">${[
    ["recent", "Recently added"],
    ["name", "Name A–Z"],
    ["remaining", "Most filament"],
    ["least", "Least filament"],
    ["material", "Material"],
  ]
    .map(
      ([val, label]) =>
        `<option value="${val}" ${state.sort === val ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select><div class="view-switch" aria-label="View style"><button data-layout="grid" class="${state.layout === "grid" ? "active" : ""}" title="Grid view" aria-label="Grid view">${icon("grid")}</button><button data-layout="list" class="${state.layout === "list" ? "active" : ""}" title="List view" aria-label="List view">${icon("list")}</button></div></div><div id="inventory-results"></div><div class="inventory-bottom"><span id="showing-count"></span><span>${icon("shield")}Saved on this computer</span></div>`;
}
function filtered() {
  const q = state.query.toLowerCase().trim();
  return state.spools
    .filter(
      (s) =>
        (!q ||
          [
            s.name,
            s.brand,
            s.vendor,
            s.manufacturer,
            s.productLine,
            s.material,
            s.colorName,
            s.location,
            s.notes,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (state.material === "all" || s.material === state.material) &&
        (state.stock === "all" ||
          (state.stock === "low" && lowStock(s)) ||
          (state.stock === "dry" && drying(s).due) ||
          (state.stock === "empty" &&
            (s.status === "empty" || s.remainingWeight <= 0)) ||
          s.status === state.stock),
    )
    .sort((a, b) =>
      state.sort === "name"
        ? a.name.localeCompare(b.name)
        : state.sort === "material"
          ? a.material.localeCompare(b.material)
          : state.sort === "remaining"
            ? b.remainingWeight - a.remainingWeight
            : state.sort === "least"
              ? a.remainingWeight - b.remainingWeight
              : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
}
function renderInventory() {
  const spools = filtered();
  const allGroups = collectSpoolGroups(state.spools),
    byKey = new Map(allGroups.map((group) => [group.key, group])),
    matches = new Map();
  for (const spool of spools) {
    const key = spoolGroupKey(spool);
    matches.set(key, (matches.get(key) || 0) + 1);
  }
  const groups = [...matches].map(([key, count]) => ({
    ...byKey.get(key),
    matched: count,
  }));
  if (state.sort === "remaining" || state.sort === "least")
    groups.sort((a, b) =>
      state.sort === "remaining"
        ? b.remaining - a.remaining
        : a.remaining - b.remaining,
    );
  $("#result-count").textContent = groups.length;
  $("#showing-count").textContent = groups.some(
    (group) => group.spools.length > 1,
  )
    ? `Showing ${groups.length} filament groups · ${spools.length} of ${state.spools.length} spools match`
    : `Showing ${spools.length} of ${state.spools.length} spools`;
  $("#inventory-results").innerHTML = spools.length
    ? state.layout === "grid"
      ? `<div class="spool-grid">${groups.map((group) => (group.spools.length === 1 ? spoolCard(group.spools[0]) : spoolGroupCard(group))).join("")}<button class="add-card" data-action="add"><span class="add-circle">${icon("plus")}</span><strong>Room for one more.</strong><p>Add a spool to your collection.<br>Good things start here.</p></button></div>`
      : spoolTable(groups)
    : empty(
        "No spools on this shelf.",
        "Try a different search, or add your first spool.",
        `<button class="btn primary" data-action="add">${icon("plus")}Add a spool</button>`,
      );
}
function spoolGroupKey(spool) {
  const text = (value) =>
    String(value || "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  if (
    !spool.brand?.trim() ||
    !spool.material?.trim() ||
    !spool.colorName?.trim()
  )
    return JSON.stringify(["unidentified", spool.id]);
  return JSON.stringify(
    [
      spool.brand,
      spool.material,
      text(spool.productLine) === text(spool.material) ? "" : spool.productLine,
      spool.formulation || spool.material,
      spool.manufacturer,
      spool.colorName,
      spool.colorHex,
    ]
      .map(text)
      .concat([spool.temperatureMin ?? null, spool.temperatureMax ?? null]),
  );
}
function isUnusedSpool(spool) {
  return (
    !spool.openedDate &&
    spool.status === "available" &&
    spool.initialWeight > 0 &&
    spool.remainingWeight === spool.initialWeight
  );
}
function collectSpoolGroups(spools) {
  const grouped = new Map();
  for (const spool of spools) {
    const key = spoolGroupKey(spool);
    if (!grouped.has(key)) grouped.set(key, { key, spools: [] });
    grouped.get(key).spools.push(spool);
  }
  return [...grouped.values()].map((group) => {
    const batches = new Map(),
      s = group.spools[0];
    for (const spool of group.spools.filter(isUnusedSpool)) {
      if (!batches.has(spool.initialWeight))
        batches.set(spool.initialWeight, {
          capacity: spool.initialWeight,
          spools: [],
        });
      batches.get(spool.initialWeight).spools.push(spool);
    }
    for (const batch of batches.values())
      batch.spools.sort(
        (a, b) =>
          (Date.parse(a.purchaseDate || a.createdAt) || 0) -
            (Date.parse(b.purchaseDate || b.createdAt) || 0) ||
          a.id.localeCompare(b.id),
      );
    return {
      ...group,
      title: [
        s.brand,
        s.productLine || s.formulation || s.material,
        s.colorName,
      ]
        .filter(Boolean)
        .join(" · "),
      remaining: group.spools.reduce(
        (total, spool) => total + spool.remainingWeight,
        0,
      ),
      capacity: group.spools.reduce(
        (total, spool) => total + spool.initialWeight,
        0,
      ),
      batches: [...batches.values()].sort((a, b) => b.capacity - a.capacity),
      unused: group.spools.filter(isUnusedSpool),
      individuals: group.spools.filter((spool) => !isUnusedSpool(spool)),
    };
  });
}
function groupPercentage(group) {
  return group.capacity
    ? Math.round((group.remaining / group.capacity) * 100)
    : 0;
}
function unusedLabel(count) {
  return `${count} new, unused ${count === 1 ? "spool" : "spools"}`;
}
function spoolGroupCard(group) {
  const s = group.spools[0],
    percentage = groupPercentage(group),
    locations = [
      ...new Set(group.spools.map((spool) => spool.location).filter(Boolean)),
    ].join(" / ");
  return `<article class="spool-card spool-group-card" data-open-group="${esc(group.key)}" role="button" tabindex="0" aria-label="Open group ${esc(group.title)}, ${group.spools.length} spools"><div class="spool-art" style="--spool:${hex(s.colorHex)}"><span class="location-tag" title="${esc(locations)}">${icon("layers")}${group.spools.length} spools</span>${reel(s.colorHex)}<button class="card-more" data-open-group="${esc(group.key)}" aria-label="View filament group">${icon("more")}</button></div><div class="card-body"><div class="card-title-line"><h3 class="card-title">${esc(s.productLine || s.formulation || s.name)}</h3><span class="material-tag">${esc(s.material)}</span></div><p class="card-meta"><span class="color-dot" style="--spool:${hex(s.colorHex)}"></span>${esc(s.brand)} · ${esc(s.colorName)}</p><p class="group-stock-summary"><strong>${unusedLabel(group.unused.length)}</strong><span>${group.individuals.length} opened, used or empty</span></p><div class="weight-line"><span><strong>${grams(group.remaining)}</strong> / ${grams(group.capacity)}</span><span class="pct">${percentage}%</span></div><div class="progress"><span style="width:${percentage}%"></span></div><div class="card-footer"><span>View grouped spools</span><span>${group.matched < group.spools.length ? `${group.matched} match filter` : esc(locations || "No location")}</span></div></div></article>`;
}
function openSpoolGroup(key, focusId = null) {
  const group = collectSpoolGroups(state.spools).find(
    (item) => item.key === key,
  );
  if (!group) {
    $("#modal").close();
    return;
  }
  const s = group.spools[0],
    percentage = groupPercentage(group);
  openModal(
    esc(group.title),
    `${group.spools.length} physical spools · ${grams(group.remaining)} remaining in total`,
    `<div class="group-overview"><span class="material-tag">${esc(s.material)}</span><span>${esc(s.formulation || s.productLine || "")}</span><strong>${unusedLabel(group.unused.length)}</strong></div><div class="detail-weight"><div class="weight-line"><strong>${grams(group.remaining)} / ${grams(group.capacity)}</strong><span>${percentage}%</span></div><div class="progress"><span style="width:${percentage}%"></span></div></div><section class="group-stock"><h3>New, unused stock</h3>${group.batches.length ? group.batches.map((batch, index) => `<div class="group-batch"><div><strong>${unusedLabel(batch.spools.length)}</strong><p>${grams(batch.capacity)} of filament each · ${grams(batch.capacity * batch.spools.length)} total</p></div><label for="group-batch-${index}">Choose the physical spool</label><select id="group-batch-${index}">${batch.spools.map((spool) => `<option value="${esc(spool.id)}">${esc([spool.name, spool.location || "No location", spool.vendor, spool.purchaseDate ? `Purchased ${when(spool.purchaseDate)}` : "", `#${spool.id.slice(0, 8)}`].filter(Boolean).join(" · "))}</option>`).join("")}</select><button type="button" class="btn primary small" data-start-group="${esc(group.key)}" data-batch-index="${index}">${icon("spool")}Start using one</button><details class="source-text"><summary>Inspect individual unopened spools</summary>${batch.spools.map((spool) => `<div class="group-record"><span>${esc(spool.name)} · ${esc(spool.location || "No location")} · #${esc(spool.id.slice(0, 8))}</span><button type="button" class="btn small" data-detail="${esc(spool.id)}" data-group-parent="${esc(group.key)}">Details</button></div>`).join("")}</details></div>`).join("") : '<p class="section-note">All spools in this group have been opened, used, or emptied.</p>'}</section><section class="group-opened"><h3>Opened, used and empty spools <span class="number-badge">${group.individuals.length}</span></h3>${group.individuals.length ? group.individuals.map((spool) => `<article class="group-spool ${spool.id === focusId ? "selected" : ""}" data-group-spool="${esc(spool.id)}"><div class="group-spool-heading"><div><strong>${esc(spool.name)}</strong><p>${esc(spool.location || "No location")} · #${esc(spool.id.slice(0, 8))} · ${spool.remainingWeight <= 0 ? "Empty" : spool.openedDate ? `Opened ${when(spool.openedDate)}` : "Partly used"}${spool.status === "in-use" ? " · In use" : ""}</p></div><button type="button" class="btn small" data-detail="${esc(spool.id)}" data-group-parent="${esc(group.key)}">Details</button></div><div class="weight-line"><strong>${grams(spool.remainingWeight)} / ${grams(spool.initialWeight)}</strong><span>${pct(spool)}%</span></div><div class="progress ${lowStock(spool) ? "low" : ""}"><span style="width:${pct(spool)}%"></span></div>${readiness(spool)}${spool.remainingWeight > 0 ? `<form class="group-usage-form" data-id="${esc(spool.id)}" data-group-key="${esc(group.key)}"><div class="field"><label for="group-grams-${esc(spool.id)}">Filament used for this print (g)</label><input id="group-grams-${esc(spool.id)}" name="grams" type="number" min="0.1" max="${spool.remainingWeight}" step="0.1" placeholder="e.g. 42" required></div><button type="submit" class="btn small">Log print</button></form>` : ""}</article>`).join("") : '<p class="section-note">Start one of the unused spools above to record a print.</p>'}</section>`,
    true,
  );
  if (focusId) document.getElementById(`group-grams-${focusId}`)?.focus();
}
function readiness(s) {
  const d = drying(s);
  return `<span class="readiness ${d.due ? "due" : ""}">${icon(d.icon)}${d.label}</span>`;
}
function spoolCard(s) {
  const p = pct(s),
    low = lowStock(s);
  return `<article class="spool-card" data-id="${esc(s.id)}" role="button" tabindex="0" aria-label="Open ${esc(s.name)}, ${esc(s.colorName)}, ${grams(s.remainingWeight)} remaining"><div class="spool-art" style="--spool:${hex(s.colorHex)}"><span class="location-tag">${icon("pin")}${esc(s.location || "No location")}</span>${reel(s.colorHex)}<button class="card-more" data-detail="${esc(s.id)}" aria-label="Manage ${esc(s.name)}">${icon("more")}</button></div><div class="card-body"><div class="card-title-line"><h3 class="card-title">${esc(s.name)}</h3><span class="material-tag">${esc(s.material)}</span></div>${s.productLine && !s.name.toLowerCase().includes(s.productLine.toLowerCase()) ? `<div class="product-line">${esc(s.productLine)}</div>` : ""}<p class="card-meta"><span class="color-dot" style="--spool:${hex(s.colorHex)}"></span>${esc(s.brand)}<span>·</span>${esc(s.colorName || "Custom color")}</p><div class="weight-line"><span><strong class="${low ? "low" : ""}">${grams(s.remainingWeight)}</strong> / ${grams(s.initialWeight)}</span><span class="pct">${p}%</span></div><div class="progress ${low ? "low" : ""}"><span style="width:${p}%"></span></div><div class="card-footer">${readiness(s)}<span class="use-status"><span class="dot"></span>${s.status === "in-use" ? "In use" : s.remainingWeight <= 0 ? "Empty" : "Available"}</span></div></div></article>`;
}
function spoolTable(spools) {
  return `<div class="table-wrap"><table><thead><tr><th>Filament</th><th>Material</th><th>Remaining</th><th>Location</th><th>Condition</th><th></th></tr></thead><tbody>${spools
    .map((item) => {
      if (item.spools?.length > 1) {
        const group = item,
          s = group.spools[0];
        return `<tr data-open-group="${esc(group.key)}" role="button" tabindex="0" aria-label="Open group ${esc(group.title)}"><td><div class="table-spool"><span class="mini-spool" style="--spool:${hex(s.colorHex)}"></span><span><strong>${esc(group.title)}</strong><small>${group.spools.length} spools${group.matched < group.spools.length ? ` · ${group.matched} match filter` : ""}</small></span></div></td><td><span class="material-tag">${esc(s.material)}</span></td><td><div class="table-weight">${grams(group.remaining)} <span class="muted">/ ${grams(group.capacity)}</span><div class="progress"><span style="width:${groupPercentage(group)}%"></span></div></div></td><td>${esc([...new Set(group.spools.map((spool) => spool.location).filter(Boolean))].join(" / ") || "—")}</td><td>${unusedLabel(group.unused.length)}<div class="product-line">${group.individuals.length} opened, used or empty</div></td><td>${icon("chevron")}</td></tr>`;
      }
      const s = item.spools ? item.spools[0] : item;
      return `<tr data-id="${esc(s.id)}" tabindex="0" aria-label="Open ${esc(s.name)}"><td><div class="table-spool"><span class="mini-spool" style="--spool:${hex(s.colorHex)}"></span><span><strong>${esc(s.name)}</strong><small>${esc(s.brand)} · ${esc(s.colorName)}</small></span></div></td><td><span class="material-tag">${esc(s.material)}</span>${s.productLine ? `<div class="product-line">${esc(s.productLine)}</div>` : ""}</td><td><div class="table-weight">${grams(s.remainingWeight)} <span class="muted">/ ${grams(s.initialWeight)}</span><div class="progress ${lowStock(s) ? "low" : ""}"><span style="width:${pct(s)}%"></span></div></div></td><td>${esc(s.location || "—")}</td><td>${readiness(s)}</td><td>${icon("chevron")}</td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}
function empty(title, message, action = "", ic = "spool") {
  return `<div class="empty-state">${icon(ic)}<h3>${title}</h3><p>${message}</p>${action}</div>`;
}
function dryingPage() {
  const spools = state.spools
    .filter((s) => s.remainingWeight > 0)
    .sort((a, b) => Number(drying(b).due) - Number(drying(a).due));
  const due = spools.filter((s) => drying(s).due).length;
  return `${heading("A FRESH START FOR YOUR FILAMENT", "Drying room", "A little preparation for cleaner layers and happier prints.", `<button class="btn" data-action="dry-guide">${icon("info")}About reminders</button>`)}<div class="tip-banner">${icon("dry")}<span><strong>Good storage goes a long way.</strong> Reminders are estimates based on material, open date, and storage. Follow your filament and spool manufacturer’s drying instructions.</span></div><div class="section-heading"><h2>Your drying plan <span class="number-badge">${due} reminders</span></h2><span class="section-note">Log a cycle when it finishes</span></div>${
    spools.length
      ? `<div class="dry-list">${spools
          .map((s) => {
            const g = guide(s),
              d = drying(s);
            return `<article class="dry-row">${reel(s.colorHex)}<div class="dry-info"><h3>${esc(s.name)} <span class="material-tag">${esc(s.material)}</span></h3><p>${esc(s.brand)} · ${esc(s.colorName)} · ${esc(s.storage || "No storage recorded")}</p><p style="margin-top:8px"><span class="badge ${d.due ? "amber" : ""}">${d.label}</span></p></div><div class="dry-recipe">${g.temp}°C <span class="muted">/</span> ${g.hours} hours<small>Example starting point · verify first</small></div><button class="btn small" data-dry="${esc(s.id)}">${icon("check")}Log drying</button></article>`;
          })
          .join("")}</div>`
      : empty(
          "A clean slate.",
          "Add a spool to start tracking its drying history.",
          `<button class="btn primary" data-action="add">Add a spool</button>`,
          "dry",
        )
  }`;
}
function profilesPage() {
  return `${heading("FROM YOUR SHELF TO YOUR SLICER", "Slicer profiles", "Take your material details into the tools you already use.")}<div class="profile-cards">${[
    [
      "Bambu Studio",
      "bambu",
      "JSON filament preset",
      "Import through File → Import → Import Configs.",
    ],
    [
      "OrcaSlicer",
      "orca",
      "JSON filament preset",
      "Import through File → Import → Import Configs.",
    ],
    [
      "PrusaSlicer",
      "prusa",
      "INI config bundle",
      "Import through File → Import → Import Config Bundle.",
    ],
  ]
    .map(
      ([name, key, type, desc]) =>
        `<div class="profile-card"><div class="slicer-logo">${icon(key === "prusa" ? "printer" : "layers")}</div><h3>${name}</h3><p>${desc}</p><code>${type}</code></div>`,
    )
    .join(
      "",
    )}</div><div class="tip-banner">${icon("info")}<span><strong>Your inventory, ready to travel.</strong> Exports carry material, color, and brand. Bambu and Orca need the exact name of a parent preset installed in your slicer. Review inherited print temperatures before printing. AMS assignments and RFID are not synced.</span></div><div class="section-heading"><h2>Choose a spool to export</h2><span class="section-note">Local files. No account needed.</span></div>${state.spools.length ? state.spools.map((s) => `<div class="select-spool-row"><div class="storage-inline"><span class="color-dot" style="--spool:${hex(s.colorHex)};width:13px;height:13px"></span><div><strong>${esc(s.name)}</strong><p>${esc(s.brand)} · ${esc(s.material)} · ${esc(s.colorName)}</p></div></div><button class="btn small" data-export="${esc(s.id)}">${icon("download")}Export preset</button></div>`).join("") : empty("Start with a spool.", "Add a filament to create your first slicer preset.", `<button class="btn primary" data-action="add">Add spool</button>`)}<p class="section-note" style="line-height:1.8;margin-top:20px">Prototype exports use the slicers’ documented file formats. Compatibility still needs checking in your installed slicer and printer profile.</p>`;
}
function activityPage() {
  return `${heading("THE STORY OF YOUR SHELF", "Activity", "Every spool added, every print made, every gram accounted for.")}<div class="section-heading"><h2>Recent activity <span class="number-badge">${state.activity.length}</span></h2><button class="btn small" data-action="refresh">${icon("activity")}Refresh</button></div>${
    state.activity.length
      ? `<div class="activity-list">${state.activity
          .map((a) => {
            const type = String(a.type || a.action || "");
            const ic = /dry/i.test(type)
              ? "dry"
              : /usage|print/i.test(type)
                ? "printer"
                : /weigh/i.test(type)
                  ? "weight"
                  : /delete/i.test(type)
                    ? "trash"
                    : "spool";
            return `<div class="activity-item"><div class="activity-icon">${icon(ic)}</div><div><strong>${esc(a.title || a.spoolName || a.name || type.replaceAll("_", " "))}</strong><p>${esc(a.description || a.message || a.note || "Inventory updated")}</p></div><time datetime="${esc(a.createdAt || a.at)}">${when(a.createdAt || a.at)}</time></div>`;
          })
          .join("")}</div>`
      : empty(
          "Your shelf has a story to tell.",
          "Inventory changes and completed drying cycles will appear here.",
          "",
          "activity",
        )
  }`;
}
function settingsPage() {
  const addresses = state.network.urls || [];
  return `${heading("A SPACE THAT WORKS FOR YOU", "Workspace settings", "Keep your collection local, portable, and easy to reach.")}<div class="settings-stack"><section class="panel"><h2>Your workspace</h2><p>Small preferences for your filament library.</p><form id="settings-form"><div class="form-grid" style="margin-top:20px"><div class="field"><label for="app-name">Workspace name</label><input id="app-name" name="appName" value="${esc(state.settings.appName || "My workshop")}" maxlength="80"></div><div class="field"><label for="low-stock">Low stock threshold (g)</label><input id="low-stock" name="lowStockThreshold" type="number" min="0" max="100000" step="1" value="${Number(state.settings.lowStockThreshold ?? 200)}" required></div><div class="field full"><label for="ollama-model">Local Ollama vision model (optional)</label><input id="ollama-model" name="ollamaModel" placeholder="e.g. llava:7b — must be installed in Ollama" maxlength="100" value="${esc(state.scan.model || state.settings.ollamaModel || "")}"><small>Connects to Ollama on this computer at 127.0.0.1:11434. Leave blank to use offline OCR. No cloud API is used.</small></div></div><div class="form-actions"><button class="btn primary" type="submit">${icon("save")}Save preferences</button></div></form></section><section class="panel"><h2>Bring your phone to the shelf</h2><p>Connect your phone to the same Wi-Fi, then open your computer’s address. The photo picker lets you take a label photo directly from your phone.</p>${
    addresses
      .filter((u) => !u.includes("localhost") && !u.includes("127.0.0.1"))
      .map(
        (url) =>
          `<a class="network-address" href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`,
      )
      .join("") || "<p>No Wi-Fi address detected. Check the server console.</p>"
  }<div class="setting-row"><div><h3>Scan a QR code to connect</h3><p>Windows may ask you to allow Node.js on your private network.</p></div><button class="btn" data-action="phone">${icon("phone")}Show QR code</button></div></section><section class="panel"><h2>A backup for peace of mind</h2><p>Your inventory is saved in a SQLite file on this computer. Download a portable JSON backup before moving or replacing your collection.</p><div class="setting-row"><div><h3>Export inventory</h3><p>Includes spools, your custom filament catalog, preferences, history, and label templates with their example photos.</p></div><a class="btn" href="/api/backup" download>${icon("download")}Download backup</a></div><div class="setting-row"><div><h3>Restore from a backup</h3><p>Replaces the collection and custom catalog included in the backup. You’ll confirm before anything changes.</p></div><label class="btn restore-label">${icon("upload")}Choose backup<input type="file" id="restore-file" class="file-input" accept=".json,application/json"></label></div></section>${state.settings.demoData ? `<section class="panel"><h2>Ready to make it yours?</h2><p>The sample collection helps you explore Spoolspace. Clearing it removes all current spools and history, including any additions you’ve made. Download a backup first if needed.</p><button class="btn danger" data-action="clear-demo">${icon("trash")}Clear sample inventory</button></section>` : ""}<section class="panel"><h2>Local, open, and yours</h2><p>Spoolspace prototype ${esc(state.version || "0.5.3")} · MIT licensed · Node.js + SQLite</p><p>Photo recognition runs on this computer. This server has no login and is intended for trusted home Wi-Fi. Keep it off public networks and do not forward its port to the internet.</p><button class="text-link" data-action="guide">Open the getting started guide</button></section></div>`;
}

function filamentDatabasePanel() {
  const data = state.filamentDatabase || {},
    counts = data.counts || {},
    date = (value) => (value ? new Date(value).toLocaleString() : "Not yet");
  const status = data.busy
    ? {
        checking: "Checking for an update…",
        downloading: "Downloading the filament database…",
        validating: "Checking SQLite integrity and schema…",
      }[data.phase] || "Updating…"
    : data.usingCached
      ? "Offline / update failed — using cached local data"
      : data.available
        ? "Local catalog ready — search works offline"
        : "No local catalog downloaded yet";
  return `<div class="catalog-panel-title"><div><h2>Filament Database</h2><p>Source: <a href="https://api.openfilamentdatabase.org/" target="_blank" rel="noopener">Open Filament Database</a></p></div><span class="badge ${data.error ? "amber" : ""}">${esc(data.version || "Not downloaded")}</span></div><p class="catalog-status" role="status">${esc(status)}</p>${data.busy ? `<progress max="100" ${data.progress != null ? `value="${data.progress}"` : ""} aria-label="Filament database download progress"></progress><p class="section-note">${num((data.downloadedBytes || 0) / 1024 / 1024, 1)} MB${data.totalBytes ? ` / ${num(data.totalBytes / 1024 / 1024, 1)} MB` : ""}</p>` : ""}${data.error ? `<p class="catalog-error">${esc(data.error)}</p>` : ""}<div class="catalog-counts">${[
    ["Brands", counts.brands],
    ["Product lines", counts.productLines],
    ["Color variants", counts.colorVariants],
    ["Sizes", counts.sizes],
  ]
    .map(
      ([label, value]) =>
        `<div><strong>${num(value || 0)}</strong><span>${label}</span></div>`,
    )
    .join(
      "",
    )}</div><dl class="catalog-sync-dates"><div><dt>Catalog downloaded</dt><dd>${esc(date(data.lastDownloadedAt))}</dd></div><div><dt>Last successful check</dt><dd>${esc(date(data.lastSuccessAt))}</dd></div></dl><label class="catalog-auto"><input id="ofd-auto-update" type="checkbox" ${data.autoUpdate !== false ? "checked" : ""}>Check for updates automatically, at most once every 24 hours</label><div class="catalog-panel-actions"><button class="btn primary" data-action="update-filament-database" ${data.busy ? "disabled" : ""}>${icon(data.busy ? "loading" : "download", data.busy ? "spin" : "")}Update Filament Database</button><button class="btn" data-action="open-filament-database">${icon("search")}Search catalog / label text</button></div><p class="section-note" style="line-height:1.8;margin-top:15px">Catalog updates run on this computer. OCR photos stay local. The current source has no separate manufacturer field, and some weights and temperatures are missing.</p><p class="section-note" id="custom-filament-status" style="line-height:1.8;margin-top:15px"><strong>My custom filaments: ${num(data.customCount || 0)}</strong><br>New filament definitions are saved locally for future scans. OFD updates never overwrite your custom table. Search the catalog and choose My custom filaments to browse them.</p>${data.path ? `<details class="source-text"><summary>Local catalog file</summary><code>${esc(data.path)}</code></details>` : ""}`;
}
function renderCatalogStatus() {
  const panel = $("#ofd-database-panel");
  if (panel) panel.innerHTML = filamentDatabasePanel();
}
function scheduleCatalogPoll(delay = 1500) {
  clearTimeout(state.catalogPollTimer);
  state.catalogPollTimer = setTimeout(async () => {
    try {
      state.filamentDatabase = await api("/filament-database/status");
      renderCatalogStatus();
    } catch (error) {
      if (state.filamentDatabase) {
        state.filamentDatabase.error = error.message;
        renderCatalogStatus();
      }
    }
    if (state.view === "settings" || state.filamentDatabase?.busy)
      scheduleCatalogPoll(state.filamentDatabase?.busy ? 1200 : 15000);
  }, delay);
}
async function updateFilamentDatabase() {
  try {
    state.filamentDatabase = await api("/filament-database/sync", {
      method: "POST",
      body: {},
    });
    renderCatalogStatus();
    scheduleCatalogPoll(100);
    toast("Checking the official filament database in the background.");
  } catch (error) {
    toast(error.message, true);
  }
}

function catalogSourceLabel(product, version = "") {
  return product.source === "custom" || product.catalogVersion === "custom"
    ? "My custom filament"
    : `OFD ${product.catalogVersion || version}`;
}
function catalogCandidatesHTML(result, scope) {
  const candidates = (result.candidates || result.items || []).slice(
    0,
    scope === "browser" ? 30 : 5,
  );
  state.catalogPools[scope] = { candidates, result };
  return `<section class="catalog-matches"><div class="section-heading"><h3>${scope === "browser" ? "Catalog results" : "Catalog matches"}</h3><span class="number-badge">${candidates.length}</span></div><p class="section-note">${esc(result.message || "Choose the exact product and size, then review the details. Nothing is added until you save the spool.")}</p>${
    !candidates.length
      ? `<div class="catalog-no-match">${result.available === false ? "Download the filament database in Settings to enable matching." : "No reliable product was found. You can correct the label text, search by brand and material, or continue with manual entry."}</div>`
      : candidates
          .map(
            (p, index) =>
              `<article class="catalog-match ${result.bestCandidateId === p.catalogVariantId ? "best" : ""}"><div class="catalog-match-title"><span class="color-dot" style="--spool:${hex(p.colorHex)}"></span><div><strong>${esc(p.name)}</strong><small>${esc(p.material)} · ${esc(p.productLine)} · ${esc(p.colorName || "Color not provided")}</small></div><span class="catalog-score">${p.matchMethod ? "QR" : p.score != null ? `${p.score}%` : p.source === "custom" ? "Custom" : "OFD"}</span></div>${p.conflicts?.length ? `<p class="catalog-error">QR catalog identity disagrees with label fields: ${p.conflicts.map((c) => `${esc(c.field)} (${esc(c.textValue)} / ${esc(c.qrValue)})`).join("; ")}. Review both sources.</p>` : ""}${
                p.score != null
                  ? `<p class="catalog-confidence">${esc(p.matchMethod || p.confidence)}${result.bestCandidateId === p.catalogVariantId ? " · Strongest consistent candidate" : ""}</p><div class="catalog-field-scores">${Object.entries(
                      p.fieldScores || {},
                    )
                      .map(
                        ([key, value]) =>
                          `<span>${{ brand: "Brand", material: "Material", productLine: "Product", colorName: "Color", weight: "Weight" }[key] || esc(key)} ${value == null ? "—" : value + "%"}</span>`,
                      )
                      .join("")}</div>`
                  : ""
              }${p.colorHex || Object.keys(p.colorCodes || {}).length ? `<p class="catalog-product-meta">${esc([p.colorHex, ...Object.entries(p.colorCodes || {}).map(([key, value]) => `${key.toUpperCase()} ${typeof value === "string" ? value : JSON.stringify(value)}`)].filter(Boolean).join(" ? "))}</p>` : ""}<p class="catalog-product-meta">Print ${p.temperatureMin != null || p.temperatureMax != null ? `${esc(p.temperatureMin ?? "?")}–${esc(p.temperatureMax ?? "?")} °C` : "temperature not provided"} · ${p.emptySpoolWeight != null ? `Empty spool ${grams(p.emptySpoolWeight)}` : "Verify your spool’s tare"}</p>${p.sizeConflict ? '<p class="catalog-error">The label weight does not match a catalog size. Keep the printed capacity or choose a size explicitly.</p>' : ""}<div class="field"><label for="${scope}-catalog-size-${index}">Spool size from the source</label><select id="${scope}-catalog-size-${index}"><option value="">${p.sizes?.length ? "Choose a size, or enter capacity manually" : "No size available — enter capacity manually"}</option>${(p.sizes || []).map((s, i) => `<option value="${i}" ${p.catalogSizeId === s.catalogSizeId || (!p.catalogSizeId && !p.sizeConflict && p.sizes.length === 1) ? "selected" : ""}>${grams(s.initialWeight)} · ${s.diameter != null ? `${num(s.diameter, 2)} mm` : "diameter not recorded"}${s.emptySpoolWeight != null ? ` · empty spool ${grams(s.emptySpoolWeight)}` : " · tare not provided"}</option>`).join("")}</select></div>${p.vendors?.length ? `<div class="field" style="margin-top:10px"><label for="${scope}-catalog-vendor-${index}">Vendor / seller (optional)</label><select id="${scope}-catalog-vendor-${index}"><option value="">Keep my vendor / not specified</option>${p.vendors.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select></div>` : ""}<details class="source-text"><summary>Source & matched clues</summary><p>${esc(catalogSourceLabel(p, result.version))} · ${esc(p.catalogVariantId)}</p>${p.evidence ? `<p>Brand: ${esc(p.evidence.brand || "not found")}<br>Material: ${esc(p.evidence.material || "not found")}<br>Product: ${esc(p.evidence.productLine || "not found")}<br>Color: ${esc(p.evidence.colorName || "not found")}</p>` : ""}</details><button class="btn small ${result.bestCandidateId === p.catalogVariantId ? "primary" : ""}" data-catalog-scope="${scope}" data-catalog-pick="${index}">${icon("check")}${scope === "template" ? "Use for this label" : "Review this product"}</button></article>`,
          )
          .join("")
  }${candidates.some((p) => p.score != null) ? '<p class="section-note" style="line-height:1.7">Scores are heuristic similarities, not calibrated probabilities. Formulation, color, size and remaining filament still need your confirmation.</p>' : ""}</section>`;
}
function openCatalogBrowser(fromForm = false) {
  const form = fromForm ? $("#spool-form") : null;
  state.catalogFormDraft = form
    ? {
        fields: {
          ...Object.fromEntries(new FormData(form)),
          _scan: form.dataset.recognition === "true",
          _catalog: form.dataset.catalog === "true",
          _colorNeedsReview: $("#f-colorHex").dataset.needsReview === "true",
          _reviewPhoto: form.reviewPhoto || null,
        },
        editId: form.dataset.edit || null,
      }
    : null;
  const draft = state.catalogFormDraft?.fields || {};
  openModal(
    "Find the filament behind the label.",
    "Search your custom filaments and the local OFD catalog, or match noisy label text.",
    `<form id="ofd-search-form"><div class="field"><label for="ofd-query">Brand, product, material or color</label><input id="ofd-query" name="q" value="${esc([draft.brand, draft.productLine, draft.colorName].filter(Boolean).join(" "))}" placeholder="e.g. Add North PLA Economy Black" maxlength="300"></div><details class="source-text"><summary>More filters</summary><div class="form-grid">${field("Brand", "brand", "", { maxlength: 100 })}${field("Material", "material", "", { placeholder: "e.g. PLA, PETG, PA12-CF", maxlength: 40 })}${field("Product line", "productLine", "", { maxlength: 120 })}${field("Color name or HEX", "color", "", { maxlength: 80 })}${field("Vendor / seller", "vendor", "", { maxlength: 100 })}${field("Net filament weight (g)", "weight", "", { type: "number" })}${field("Empty spool weight (g)", "spoolWeight", "", { type: "number" })}${field("Print temperature at least (°C)", "temperatureMin", "", { type: "number", max: 500 })}${field("Print temperature at most (°C)", "temperatureMax", "", { type: "number", max: 500 })}</div></details><div class="form-actions"><button class="btn primary" type="submit">${icon("search")}Search local catalog</button></div></form><details class="source-text" ${fromForm ? "" : "open"}><summary>Match pasted OCR / label text</summary><form id="ofd-match-form"><div class="field"><label for="ofd-label-text">Label text</label><textarea id="ofd-label-text" name="text" maxlength="12000" rows="6" placeholder="Paste the useful label text or the complete noisy OCR result…">${esc(draft.ocrText || "")}</textarea><small>Original text is retained. Matching compares separate brand, material, product and color clues.</small></div><div class="form-actions"><button class="btn" type="submit">${icon("scan")}Find matching products</button></div></form></details><div id="ofd-search-results" aria-live="polite"></div>${fromForm ? '<div class="form-actions"><button class="btn" data-action="return-to-spool-form">Back to my spool details</button></div><p class="section-note">Only blank fields will be filled. Your existing entries are kept.</p>' : ""}`,
    true,
  );
  $("#ofd-search-form > .field").insertAdjacentHTML(
    "afterend",
    `<div class="field"><label for="ofd-source">Catalog source</label><select id="ofd-source" name="source"><option value="all">All filaments</option><option value="custom">My custom filaments</option><option value="ofd">Open Filament Database</option></select></div>`,
  );
  state.catalogBrowserOpen = true;
}
function returnToSpoolForm() {
  const draft = state.catalogFormDraft;
  state.catalogBrowserOpen = false;
  if (draft)
    (openSpoolForm(draft.fields, Boolean(draft.editId)),
      draft.editId && ($("#spool-form").dataset.edit = draft.editId));
  else $("#modal").close();
}
function closeCurrentDialog() {
  if (state.catalogBrowserOpen && state.catalogFormDraft) returnToSpoolForm();
  else {
    state.catalogBrowserOpen = false;
    $("#modal").close();
  }
}
async function searchCatalog(values, match = false) {
  const target = $("#ofd-search-results");
  target.innerHTML =
    '<p class="catalog-status">Searching your local catalog…</p>';
  const request = (state.catalogBrowserRequest || 0) + 1;
  state.catalogBrowserRequest = request;
  try {
    const result = match
      ? await api("/filament-database/match", {
          method: "POST",
          body: {
            text: values.text || "",
            source: $("#ofd-source")?.value || "all",
          },
        })
      : await api(
          `/filament-database/search?${new URLSearchParams(Object.entries(values).filter(([, v]) => v !== ""))}`,
        );
    if (!$("#ofd-search-results") || state.catalogBrowserRequest !== request)
      return;
    state.catalogBrowserText = match ? values.text || "" : "";
    target.innerHTML = catalogCandidatesHTML(result, "browser");
  } catch (error) {
    target.innerHTML = `<p class="catalog-error">${esc(error.message)}</p>`;
  }
}
async function rematchScanText() {
  const text = $("#scan-ocr-text")?.value ?? state.scanText;
  const sequence = state.scanSequence;
  try {
    const result = await api("/filament-database/match", {
      method: "POST",
      body: { text, qrCodes: state.scanQRCodes || [] },
    });
    if (!$("#scan-catalog-results") || sequence !== state.scanSequence) return;
    $("#scan-catalog-results").innerHTML = catalogCandidatesHTML(
      result,
      "scan",
    );
  } catch (error) {
    toast(error.message, true);
  }
}
async function matchConfirmedTemplateFields() {
  const editor = state.regionEditor;
  if (!editor?.regions.length) {
    toast("Map at least one field first.", true);
    return;
  }
  const revision = state.templatePhotoRevision;
  try {
    const result = await api("/filament-database/match", {
      method: "POST",
      body: {
        qrCodes: state.templateQRCodes || [],
        text: state.templateOCRText || state.scanText || "",
        regions: editor.regions.map(({ trainingValue, ...r }) => r),
      },
    });
    if (
      state.regionEditor === editor &&
      revision === state.templatePhotoRevision &&
      $("#template-catalog-results")
    )
      $("#template-catalog-results").innerHTML = catalogCandidatesHTML(
        result,
        "template",
      );
  } catch (error) {
    toast(error.message, true);
  }
}
function fieldsFromCatalog(product, size, vendor) {
  const values = {
    name: product.name,
    brand: product.brand,
    material: product.material,
    productLine: product.productLine,
    formulation: product.formulation,
    colorName: product.colorName,
    colorHex: product.colorHex,
    manufacturer: product.manufacturer,
    temperatureMin: product.temperatureMin,
    temperatureMax: product.temperatureMax,
    initialWeight: size?.initialWeight,
    emptySpoolWeight: size?.emptySpoolWeight,
    catalogProductId: product.catalogProductId,
    catalogVariantId: product.catalogVariantId,
    catalogSizeId: size?.catalogSizeId,
    catalogVersion: product.catalogVersion,
  };
  if (vendor) values.vendor = vendor;
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, v]) => v !== null && v !== undefined && v !== "",
    ),
  );
}
async function pickCatalogProduct(scope, index) {
  const pool = state.catalogPools[scope],
    candidate = pool?.candidates[index];
  if (!candidate) return;
  const sequence = state.scanSequence,
    editor = state.regionEditor,
    revision = state.templatePhotoRevision;
  const sizeValue = $(`#${scope}-catalog-size-${index}`)?.value,
    selectedSize =
      sizeValue !== "" && sizeValue !== undefined
        ? candidate.sizes[Number(sizeValue)]
        : null;
  const vendor = $(`#${scope}-catalog-vendor-${index}`)?.value || "";
  try {
    const product = await api(
      `/filament-database/products/${encodeURIComponent(candidate.catalogVariantId)}`,
    );
    if (
      state.catalogPools[scope] !== pool ||
      (scope === "scan" &&
        (sequence !== state.scanSequence || !$("#scan-catalog-results"))) ||
      (scope === "template" &&
        (state.regionEditor !== editor ||
          revision !== state.templatePhotoRevision)) ||
      (scope === "browser" && !state.catalogBrowserOpen)
    )
      return;
    const size = selectedSize
      ? product.sizes.find(
          (s) => s.catalogSizeId === selectedSize.catalogSizeId,
        )
      : null;
    const chosen = fieldsFromCatalog(product, size, vendor);
    if (scope === "template") {
      state.templateCatalogFields = chosen;
      for (const region of state.regionEditor.regions) {
        let value =
          region.field === "temperatureRange"
            ? chosen.temperatureMin != null || chosen.temperatureMax != null
              ? `${chosen.temperatureMin ?? ""}-${chosen.temperatureMax ?? ""} °C`
              : null
            : chosen[region.field];
        if (value !== null && value !== undefined && value !== "") {
          region.value = String(value);
          state.templateDirtyRegions.add(region.id);
        }
      }
      renderRegionControls();
      $("#template-status").textContent =
        "Catalog values applied to the mapped fields for this photo. Review them before saving the template.";
      return;
    }
    let values;
    if (scope === "browser" && state.catalogFormDraft) {
      values = { ...state.catalogFormDraft.fields };
      for (const [key, value] of Object.entries(chosen))
        if (values[key] == null || values[key] === "") values[key] = value;
    } else
      values = {
        ...(scope === "scan" ? state.scanFields : pool.result.fields || {}),
        ...chosen,
        remainingWeight: "",
        _scan: true,
        _catalog: true,
      };
    values.ocrText =
      scope === "scan"
        ? state.scanText
        : state.catalogFormDraft?.fields.ocrText ||
          state.catalogBrowserText ||
          "";
    if (scope === "scan") {
      values.qrCodes = state.scanQRCodes || [];
      values._reviewPhoto = captureReviewPhoto("scan");
    }
    const editId = scope === "browser" ? state.catalogFormDraft?.editId : null;
    state.catalogBrowserOpen = false;
    openSpoolForm(values, Boolean(editId));
    if (editId) $("#spool-form").dataset.edit = editId;
  } catch (error) {
    toast(error.message, true);
  }
}
function openModal(title, subtitle, body, wide = false) {
  state.catalogBrowserOpen = false;
  const m = $("#modal");
  if (m.open) m.close();
  m.className = wide ? "wide" : "";
  m.setAttribute("closedby", "closerequest");
  m.innerHTML = `<header class="modal-heading"><div><h2 id="dialog-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button type="button" class="icon-btn" data-action="close" aria-label="Close dialog">${icon("close")}</button></header><div class="modal-body">${body}</div>`;
  if (!m.querySelector('.modal-body [data-action="close"]'))
    m.insertAdjacentHTML(
      "beforeend",
      '<footer class="modal-footer"><button type="button" class="btn" data-action="close">Close</button></footer>',
    );
  m.showModal();
}
function field(label, name, value = "", options = {}) {
  const attrs = `id="f-${name}" name="${name}" ${options.required ? "required" : ""} ${options.type === "number" ? `step="0.1" min="${options.min ?? 0}" max="${options.max ?? 100000}"` : ""} ${options.maxlength ? `maxlength="${options.maxlength}"` : ""}`;
  return `<div class="field ${options.full ? "full" : ""}"><label for="f-${name}">${label}${options.required ? ' <span class="required">*</span>' : ""}</label>${options.select ? `<select ${attrs}>${options.select.map((v) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>` : options.textarea ? `<textarea ${attrs} maxlength="2000">${esc(value)}</textarea>` : `<input type="${options.type || "text"}" ${attrs} value="${esc(value)}" ${options.placeholder ? `placeholder="${esc(options.placeholder)}"` : ""}>`}${options.help ? `<small>${options.help}</small>` : ""}</div>`;
}
function openSpoolForm(s = {}, isEdit = false) {
  if (!isEdit) {
    const previous =
      state.settings.spoolDefaults ??
      (!state.settings.demoData ? state.spools[0] : null);
    s = {
      ...s,
      location: s.location ?? previous?.location ?? "",
      storage: s.storage ?? previous?.storage ?? "Sealed bag",
    };
  }
  let qrCodes = s.qrCodes || [];
  if (typeof qrCodes === "string") {
    try {
      qrCodes = JSON.parse(qrCodes);
    } catch {
      qrCodes = [];
    }
  }
  const fromRecognition = Boolean(s._scan || s._catalog);
  const defaultWeight = s.initialWeight ?? (fromRecognition ? "" : 1000);
  const materials = [
    ...new Set(
      [
        "PLA",
        "PETG",
        "ABS",
        "ASA",
        "TPU",
        "PA",
        "PC",
        "PVA",
        ...(state.settings.customMaterials || []),
        ...state.spools.map((spool) => spool.material),
        s.material,
      ].filter(Boolean),
    ),
  ];
  const storages = [
    ...new Set(
      [
        "Sealed bag",
        "Dry box",
        "Open shelf",
        ...state.spools.map((spool) => spool.storage),
        s.storage,
      ].filter(Boolean),
    ),
  ];
  const tare = s.emptySpoolWeight ?? "";
  openModal(
    isEdit ? "Make a little adjustment." : "A new spool, a new possibility.",
    isEdit
      ? "Update the details of your filament."
      : "Add a spool to your shelf. You can fine-tune the details anytime.",
    `<form id="spool-form" ${isEdit ? `data-edit="${esc(s.id)}"` : ""}><div class="form-grid">${field("Spool name", "name", s.name || "", { required: true, full: true, maxlength: 120, placeholder: "e.g. PLA Matte · Forest green" })}${field("Brand", "brand", s.brand || "", { required: true, maxlength: 80, placeholder: "e.g. Bambu Lab" })}${field("Material", "material", s.material || "PLA", { select: materials })}<div class="field full"><label for="f-colorName">Color</label><div class="color-input"><input id="f-colorHex" name="colorHex" type="color" value="${hex(s.colorHex)}" aria-label="Filament color"><input id="f-colorName" name="colorName" value="${esc(s.colorName || "")}" placeholder="e.g. Forest green" maxlength="80" required></div></div><div class="form-divider">A little weight, a lot of potential</div>${field("Full filament weight (g)", "initialWeight", defaultWeight, { type: "number", required: true })}${field("Filament remaining (g)", "remainingWeight", s.remainingWeight ?? (fromRecognition ? "" : defaultWeight), { type: "number", required: true })}${field("Empty spool weight (g)", "emptySpoolWeight", tare, { type: "number", help: "Tare weight only. Measure the empty spool for accurate scale updates. A suggested value is only an estimate." })}${field("Spool status", "status", s.status || "available", { select: ["available", "in-use", "empty"] })}<div class="form-divider">A home on your shelf</div>${field("Location", "location", s.location || "", { maxlength: 100, placeholder: "e.g. Shelf A · Box 02" })}${field("Storage", "storage", s.storage || "Sealed bag", { select: storages })}${field("Purchase date", "purchaseDate", s.purchaseDate?.slice(0, 10) || "", { type: "date" })}${field("Opened on", "openedDate", s.openedDate?.slice(0, 10) || "", { type: "date", help: "Leave blank for an unopened spool." })}${field("Notes", "notes", s.notes || "", { textarea: true, full: true })}</div>${s._scan ? '<div class="note-warning">These details came from a photo. Please verify the brand, material, weight, and color before saving. Spool tare suggestions are approximate.</div>' : ""}<div class="form-actions"><button class="btn" type="button" data-action="close">Cancel</button><button class="btn primary" type="submit">${icon(isEdit ? "save" : "plus")}${isEdit ? "Save changes" : "Add to collection"}</button></div></form>`,
  );
  const tareField = $("#f-emptySpoolWeight").closest(".field");
  tareField.insertAdjacentHTML(
    "afterend",
    field(
      "Current spool + filament weight (g)",
      "grossWeight",
      s.grossWeight ?? "",
      {
        type: "number",
        help: "Optional scale reading. We subtract the empty spool weight to calculate remaining filament. Clear this to enter remaining grams manually.",
      },
    ) +
      '<p id="spool-weight-result" class="section-note full" role="status"></p>',
  );
  updateSpoolWeight();
  tareField.classList.add("has-lookup");
  tareField.insertAdjacentHTML(
    "beforeend",
    '<button type="button" class="text-link lookup-link" data-action="lookup-tare">Look up an empty spool weight</button><div id="tare-lookup"></div>',
  );
  $("#f-material")
    .closest(".field")
    .insertAdjacentHTML(
      "afterend",
      `${field("Product line / variant", "productLine", s.productLine || "", { full: true, maxlength: 120, placeholder: "e.g. X-PLA, PLA Basic, PLA Matte", help: "The branded range or formulation. Base material stays PLA, PETG, etc." })}${field("Vendor / seller", "vendor", s.vendor || "", { maxlength: 100, placeholder: "Where you bought it (optional)" })}${field("Manufacturer", "manufacturer", s.manufacturer || "", { maxlength: 100, placeholder: "Who made it (optional)" })}${field("Print temperature minimum (°C)", "temperatureMin", s.temperatureMin ?? "", { type: "number", min: 20, max: 500 })}${field("Print temperature maximum (°C)", "temperatureMax", s.temperatureMax ?? "", { type: "number", min: 20, max: 500 })}`,
    );
  $("label[for=f-material]").textContent = "Filament type / base material";
  const materialSelect = $("#f-material"),
    materialRow = document.createElement("div");
  materialRow.className = "material-select-control";
  materialSelect.before(materialRow);
  materialRow.append(materialSelect);
  materialRow.insertAdjacentHTML(
    "beforeend",
    `<button type="button" class="icon-btn material-add" data-action="add-material" aria-label="Add filament type" title="Add filament type" aria-expanded="false" aria-controls="custom-material-editor">${icon("plus")}</button>`,
  );
  materialRow.insertAdjacentHTML(
    "afterend",
    '<div id="custom-material-editor" class="custom-material-editor hidden"><label for="custom-material-name">New filament type</label><div class="custom-material-actions"><input id="custom-material-name" type="text" maxlength="40" placeholder="e.g. TPE or PC-ABS" autocomplete="off"><button type="button" class="btn small" data-action="save-material">Add type</button><button type="button" class="btn small ghost" data-action="cancel-material">Cancel</button></div><small>Saved locally for future spools. Polymer blends such as PC-ABS stay separate from PC; a filled grade such as PLA-CF can use PLA with a formulation below.</small><p id="custom-material-status" role="status"></p></div>',
  );
  $("#f-productLine")
    .closest(".field")
    .insertAdjacentHTML(
      "afterend",
      field("Formulation / polymer grade", "formulation", s.formulation || "", {
        maxlength: 120,
        full: true,
        placeholder: "e.g. PLA+, PETG-HF, PA12-CF, TPU 95A",
        help: "Keeps the exact polymer grade separate from its base material and marketed product line.",
      }),
    );
  $("#f-material").required = true;
  if (s._scan && !s.material) {
    $("#f-material").insertAdjacentHTML(
      "afterbegin",
      '<option value="">Choose base material</option>',
    );
    $("#f-material").value = "";
  }
  const provenance = [
    "catalogProductId",
    "catalogVariantId",
    "catalogSizeId",
    "catalogVersion",
    "ocrText",
  ];
  $("#spool-form").dataset.recognition = String(fromRecognition);
  $("#spool-form").dataset.catalog = String(Boolean(s._catalog));
  const qrInput = document.createElement("input");
  qrInput.type = "hidden";
  qrInput.name = "qrCodes";
  qrInput.value = JSON.stringify(qrCodes);
  $("#spool-form").append(qrInput);
  for (const name of provenance) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = s[name] || "";
    $("#spool-form").append(input);
  }
  $("#f-name")
    .closest(".field")
    .insertAdjacentHTML(
      "afterend",
      `<div class="field full"><button type="button" class="btn small" data-action="catalog-from-form">${icon("search")}Find in filament database</button><small>New or corrected filament definitions are saved in your custom catalog when you save this spool, for matching future scans.</small>${s.catalogVariantId ? `<small>Catalog reference: ${esc(s.catalogVariantId)} · ${esc(catalogSourceLabel(s))}. Verify this spool’s details before saving.</small>` : ""}</div>`,
    );
  if (fromRecognition) {
    $("#f-remainingWeight")
      .closest(".field")
      .insertAdjacentHTML(
        "beforeend",
        '<small>Remaining filament is unknown from a label or catalog. Enter your current balance, or explicitly confirm a new full spool.</small><button type="button" class="text-link lookup-link" data-action="mark-full-spool">This is a new, full spool</button>',
      );
    $("#f-remainingWeight").required = true;
  }
  if (s.ocrText)
    $("#spool-form .form-actions").insertAdjacentHTML(
      "beforebegin",
      `<details class="source-text"><summary>Original recognized label text</summary><pre>${esc(s.ocrText)}</pre></details>`,
    );
  if (qrCodes.length)
    $("#spool-form .form-actions").insertAdjacentHTML(
      "beforebegin",
      `<details class="source-text"><summary>Scanned QR data</summary>${qrCodes.map((c) => `<pre>${esc(c)}</pre>`).join("")}<small>Stored locally with this spool. QR links are not fetched automatically.</small></details>`,
    );
  if (s._colorNeedsReview || (s._catalog && !s.colorHex)) {
    $("#f-colorHex").dataset.needsReview = "true";
    $("#f-colorHex")
      .closest(".field")
      .insertAdjacentHTML(
        "beforeend",
        "<small>OFD has no HEX color for this entry. Choose a color manually to confirm it.</small>",
      );
  }
  const form = $("#spool-form");
  form.querySelector('[data-action="close"]').textContent = "Close";
  // Keep the review photo out of FormData and the saved inventory payload.
  form.reviewPhoto =
    typeof s._reviewPhoto === "string" &&
    /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(
      s._reviewPhoto,
    )
      ? s._reviewPhoto
      : null;
  if (form.reviewPhoto) {
    $("#modal").classList.add("photo-review-dialog");
    form.setAttribute("aria-label", "Filament properties");
    const panel = document.createElement("figure");
    panel.className = "review-photo-panel";
    panel.innerHTML =
      '<figcaption><strong>Scan reference</strong><span>Compare the label while reviewing the filament properties.</span></figcaption><div class="review-photo-frame"><img alt="Scanned filament label for checking spool details"></div>';
    panel.querySelector("img").src = form.reviewPhoto;
    form.before(panel);
  }
}
function captureReviewPhoto(scope) {
  return (
    getPhotoAlignment(scope)?.colorCanvas?.toDataURL("image/jpeg", 0.92) || null
  );
}
function closeMaterialEditor() {
  $("#custom-material-editor")?.classList.add("hidden");
  const button = $('[data-action="add-material"]');
  button?.setAttribute("aria-expanded", "false");
  const input = $("#custom-material-name");
  if (input) {
    input.value = "";
    input.setCustomValidity("");
  }
  button?.focus();
}
async function saveCustomMaterial() {
  const form = $("#spool-form"),
    input = $("#custom-material-name"),
    button = $('[data-action="save-material"]');
  if (!form || !input || button.disabled) return;
  const name = input.value.trim();
  if (!name) {
    input.setCustomValidity(
      "Enter a filament type, for example TPE or PC-ABS.",
    );
    input.reportValidity();
    return;
  }
  button.disabled = true;
  try {
    const result = await api("/materials", { method: "POST", body: { name } });
    state.settings.customMaterials = result.customMaterials;
    if ($("#spool-form") !== form || !input.isConnected) return;
    const select = $("#f-material"),
      existing = [...select.options].find(
        (option) =>
          option.value.toUpperCase() === result.material.toUpperCase(),
      );
    if (existing) select.value = existing.value;
    else {
      const option = document.createElement("option");
      option.value = option.textContent = result.material;
      select.append(option);
      select.value = result.material;
    }
    closeMaterialEditor();
    select.focus();
    toast(`Filament type ${result.material} saved.`);
  } catch (error) {
    if (input.isConnected)
      $("#custom-material-status").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
function updateSpoolWeight() {
  const gross = $("#f-grossWeight");
  if (!gross) return "";
  const remaining = $("#f-remainingWeight"),
    result = $("#spool-weight-result"),
    active = gross.value !== "" || gross.validity.badInput;
  gross.setCustomValidity("");
  remaining.readOnly = active;
  if (!active) {
    if (gross.dataset.calculated === "true") remaining.value = "";
    gross.dataset.calculated = "false";
    result.textContent = "";
    return "";
  }
  gross.dataset.calculated = "true";
  const total = gross.valueAsNumber,
    tare = $("#f-emptySpoolWeight").valueAsNumber,
    capacity = $("#f-initialWeight").valueAsNumber,
    net = Math.round((total - tare) * 100) / 100;
  let error = "";
  if (!Number.isFinite(total) || total < 0)
    error = "Enter a valid total spool + filament weight.";
  else if (!Number.isFinite(tare) || tare <= 0)
    error = "Enter the empty spool weight to calculate remaining filament.";
  else if (!Number.isFinite(capacity) || capacity <= 0)
    error = "Enter the full filament capacity first.";
  else if (total < tare)
    error = "Total weight cannot be less than the empty spool weight.";
  else if (net > capacity)
    error = "Calculated filament exceeds the full capacity. Check the weights.";
  remaining.value = error ? "" : net;
  gross.setCustomValidity(error);
  result.textContent =
    error ||
    `${total} g total − ${tare} g empty spool = ${net} g filament remaining`;
  return error;
}
async function lookupTare() {
  const target = $("#tare-lookup");
  if (!target) return;
  if (target.innerHTML) {
    target.innerHTML = "";
    return;
  }
  target.innerHTML = "<small>Checking your local library…</small>";
  try {
    if (!state.catalog) state.catalog = await api("/catalog");
    if (!$("#tare-lookup")) return;
    const brand = $("#f-brand").value.trim().toLowerCase();
    const saved = state.spools
      .filter(
        (s) =>
          s.emptySpoolWeight > 0 &&
          !/demo spool/i.test(s.notes || "") &&
          (!brand || s.brand.toLowerCase() === brand),
      )
      .map((s) => ({
        name: `${s.brand} · ${s.name}`,
        grams: s.emptySpoolWeight,
        source: "From your library · verify the same spool construction",
      }));
    const refs = (state.catalog.emptySpools || [])
      .filter((s) => !brand || s.brand.toLowerCase() === brand)
      .map((s) => ({
        ...s,
        name: `${s.brand} · ${s.name}`,
        source: "Example estimate · weigh your spool to verify",
      }));
    state.tareOptions = [...saved, ...refs];
    $("#tare-lookup").innerHTML =
      `<p class="lookup-note">Choose only a matching spool construction. Reference weights are examples, not verified manufacturer specifications.</p>${state.tareOptions.length ? `<div class="lookup-results">${state.tareOptions.map((s, i) => `<button type="button" class="lookup-option" data-tare-option="${i}"><span><strong>${esc(s.name)}</strong><small>${esc(s.source)}</small></span><span>${grams(s.grams)}</span></button>`).join("")}</div>` : "<small>No matching weight saved. Weigh an empty spool and enter it above; it will be available for future spools.</small>"}`;
  } catch (error) {
    if ($("#tare-lookup"))
      $("#tare-lookup").innerHTML = `<small>${esc(error.message)}</small>`;
  }
}
function openDetail(id, groupKey = null) {
  const s = state.spools.find((s) => s.id === id);
  if (!s) return;
  openModal(
    esc(s.name),
    `${esc(s.brand)} · Your spool details`,
    `<div class="detail-hero"><div class="detail-art">${reel(s.colorHex)}</div><div><span class="material-tag">${esc(s.material)}</span><h3>${esc(s.colorName || "Custom color")}</h3><p>${esc(s.brand)} · ${esc(s.location || "No location yet")}</p>${readiness(s)}</div></div><div class="detail-weight"><div class="weight-line"><span><strong>${grams(s.remainingWeight)}</strong> / ${grams(s.initialWeight)} remaining</span><span class="pct">${pct(s)}%</span></div><div class="progress ${lowStock(s) ? "low" : ""}"><span style="width:${pct(s)}%"></span></div></div><dl class="detail-meta"><div><dt>Empty spool</dt><dd>${s.emptySpoolWeight ? grams(s.emptySpoolWeight) : "Not recorded"}</dd></div><div><dt>Storage</dt><dd>${esc(s.storage || "Not recorded")}</dd></div><div><dt>Status</dt><dd>${esc(s.status === "in-use" ? "In use" : s.status === "empty" ? "Empty" : "Available")}</dd></div><div><dt>Purchased</dt><dd>${when(s.purchaseDate)}</dd></div><div><dt>Opened</dt><dd>${when(s.openedDate)}</dd></div><div><dt>Last dried</dt><dd>${when(s.lastDriedAt)}</dd></div></dl><div class="two-col"><section class="mini-panel"><h3>Just finished a print?</h3><p>Subtract the filament used, including supports and purge. Your slicer provides a useful estimate.</p><form class="inline-form" id="usage-form" data-id="${esc(s.id)}"><div class="field"><label for="usage-grams">Filament used (g)</label><input id="usage-grams" name="grams" type="number" min="0.1" max="${s.remainingWeight}" step="0.1" required placeholder="e.g. 42"></div><button class="btn primary" type="submit">Log print</button></form></section><section class="mini-panel"><h3>Prefer a fresh weigh-in?</h3><p>Enter the total scale reading. We subtract your saved empty spool weight (${grams(s.emptySpoolWeight)}).</p><form class="inline-form" id="weigh-form" data-id="${esc(s.id)}"><div class="field"><label for="gross-weight">Spool + filament (g)</label><input id="gross-weight" name="grossWeight" type="number" min="${s.emptySpoolWeight || 0}" max="${s.initialWeight + s.emptySpoolWeight}" step="0.1" required placeholder="e.g. 950" ${s.emptySpoolWeight > 0 ? "" : "disabled"}></div><button class="btn" type="submit" ${s.emptySpoolWeight > 0 ? "" : "disabled"}>Update</button></form>${s.emptySpoolWeight > 0 ? "" : '<p style="margin-top:12px">Record a measured empty spool weight in Edit details before using a scale.</p>'}</section></div>${s.notes ? `<p class="notes-text">${esc(s.notes)}</p>` : ""}<div class="detail-actions"><div><button class="btn small" data-edit="${esc(s.id)}">${icon("edit")}Edit details</button><button class="btn small" data-dry="${esc(s.id)}">${icon("dry")}Log drying</button><button class="btn small" data-export="${esc(s.id)}">${icon("download")}Export</button></div><button class="btn danger small" data-delete="${esc(s.id)}" aria-label="Delete spool">${icon("trash")}</button></div>`,
    true,
  );
  const extras = [
    ["Product line", s.productLine],
    ["Formulation / grade", s.formulation],
    ["Vendor / seller", s.vendor],
    ["Manufacturer", s.manufacturer],
    [
      "Print temperature",
      s.temperatureMin != null || s.temperatureMax != null
        ? `${s.temperatureMin ?? "?"}–${s.temperatureMax ?? "?"} °C`
        : "",
    ],
  ];
  if (groupKey) {
    $("#modal .modal-body").insertAdjacentHTML(
      "afterbegin",
      `<button type="button" class="btn small group-back" data-open-group="${esc(groupKey)}">${icon("arrow")}Back to filament group</button>`,
    );
    $("#usage-form").dataset.groupKey = groupKey;
    $("#weigh-form").dataset.groupKey = groupKey;
  }
  $(".detail-meta").insertAdjacentHTML(
    "beforeend",
    extras
      .filter(([, value]) => value)
      .map(
        ([label, value]) =>
          `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`,
      )
      .join(""),
  );
}
function openDry(id) {
  const s = state.spools.find((s) => s.id === id);
  if (!s) return;
  const g = guide(s);
  openModal(
    "Fresh filament, fresh start.",
    `${esc(s.name)} · ${esc(s.colorName)}`,
    `<p class="danger-copy">Record a drying cycle once it has finished. This updates the spool’s last-dried date to today.</p><div class="note-warning">Example settings are provided for planning. Verify the safe temperature for both your filament and its spool with the manufacturer before drying.</div><form id="dry-form" data-id="${esc(s.id)}"><div class="form-grid">${field("Drying temperature (°C)", "temperature", g.temp, { type: "number", required: true, min: 20, max: 150 })}${field("Duration (hours)", "hours", g.hours, { type: "number", required: true, min: 0.1, max: 72 })}</div><div class="form-actions"><button class="btn" type="button" data-action="close">Cancel</button><button class="btn primary" type="submit">${icon("check")}Log completed cycle</button></div></form>`,
  );
}
function openExport(id) {
  const s = state.spools.find((s) => s.id === id);
  if (!s) return;
  openModal(
    "From shelf to slicer.",
    `${esc(s.name)} · ${esc(s.brand)} · ${esc(s.colorName)}`,
    `<form id="export-form" data-id="${esc(s.id)}"><div class="form-grid">${field("Your slicer", "format", "Bambu Studio", { select: ["Bambu Studio", "OrcaSlicer", "PrusaSlicer"], full: true })}${field("Installed parent preset (exact name)", "parent", "", { full: true, required: true, placeholder: "Copy the exact name from your slicer", help: "Open a working filament preset in your slicer and copy its name here. This file inherits its temperature and print settings." })}${field("Printer preset name (optional)", "printer", "", { full: true, placeholder: "Exact installed printer preset name", help: "Leave blank to inherit printer compatibility from the parent preset." })}</div><div class="export-preview">Exports include material, color, and brand. Review the imported preset before printing. This does not assign AMS slots or update spool stock inside the slicer.</div><div class="form-actions"><button type="button" class="btn" data-action="close">Cancel</button><button class="btn primary" type="submit">${icon("download")}Download preset</button></div></form>`,
  );
}
function openScan() {
  state.scanUploadJob = null;
  state.scanBusyOwner = null;
  state.scanAlignment?.unbind();
  state.scanAlignment = null;
  state.scanPhotoMode = "pan";
  state.scanSequence++;
  state.scanMatch = null;
  state.scanImage = null;
  state.scanFields = null;
  state.scanText = "";
  state.scanQRCodes = [];
  state.scanColor = null;
  openModal(
    "Meet your next spool.",
    "Choose a saved photo or take a new one. Teach unfamiliar labels once.",
    `<input type="file" id="scan-file" class="file-input" accept="image/*"><input type="file" id="camera-file" class="file-input" accept="image/*" capture="environment"><div class="scan-layout"><div><div class="scan-zone" id="scan-zone">${icon("camera")}<h3>Let’s have a look.</h3><p>A straight-on, close photo of the label gives the best result.</p><button class="btn primary" data-action="choose-photo">${icon("upload")}Choose from photo library</button><button class="btn" data-action="take-photo" style="margin-top:10px">${icon("camera")}Take photo</button></div><div id="scan-color" class="scan-color hidden"><span class="sample"></span><span>Tap the photo to sample the filament’s color.</span></div><div id="scan-status" class="scan-status" aria-live="polite"></div></div><div class="scan-template-panel"><div class="field"><label for="scan-template">Recognition template</label><select id="scan-template"><option value="">Read the whole label</option>${state.templates.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select><small>For a saved template, frame the label like its example. The colored boxes show where text will be read.</small></div><div class="template-intro"><span class="slicer-logo">${icon("scan")}</span><h3>Optional: teach a label layout.</h3><p>Read the label to find catalog matches first. For difficult layouts, draw boxes around the useful fields, correct their text, then match those confirmed fields against the catalog.</p><button class="btn" id="teach-label" data-action="teach-label" disabled>${icon("edit")}Teach this label</button><p class="section-note">Every field is optional. Your photo and template stay in your local SQLite database.</p></div></div></div><div class="form-actions scan-actions"><select class="filter" id="scan-mode" aria-label="Recognition method"><option value="ocr">Local OCR (English)</option><option value="ollama" ${state.scan.ollama ? "" : "disabled"}>Local AI · Ollama</option></select><button class="btn" data-action="choose-photo">${icon("upload")}Choose photo</button><button class="btn" data-action="take-photo">${icon("camera")}Take photo</button><button class="btn primary" id="read-label" data-action="read-label" disabled>${icon("scan")}Read label</button></div>`,
    true,
  );
  $("#scan-zone").insertAdjacentHTML(
    "beforebegin",
    `<details class="photo-guide" open><summary>Take a readable label photo</summary><ul><li>Hold the phone horizontally (landscape), with the label text reading left to right.</li><li>Point the main camera straight at the label, with the phone parallel to it. Avoid ultra-wide lenses and digital zoom.</li><li>Fill most of the photo with the label, keeping every edge and printed field in view.</li><li>Use bright, even light. Avoid flash glare, reflections and shadows. Tap the text to focus and hold steady.</li><li>Check that the small text is sharp before uploading. For a curved label, photograph the useful fields in smaller, straight-on sections.</li></ul><label><input id="auto-orient-photo" type="checkbox" checked> Automatically check text orientation after choosing a photo</label><p>Review automatic changes. Use four-corner straightening for perspective and lens correction for bowed edges.</p></details>`,
  );
  $("#read-label").insertAdjacentHTML(
    "beforebegin",
    '<button type="button" class="btn" data-action="add">Enter manually</button>',
  );
  $("#scan-status").insertAdjacentHTML(
    "beforebegin",
    '<label class="photo-qr-toggle"><input id="scan-read-spool-info" type="checkbox" checked> Read Prusa spool details online</label><p class="section-note">Contacts Prusament with the spool ID only. Photos stay on this computer. Uncheck to use local recognition only.</p>',
  );
  $(".photo-guide").insertAdjacentHTML(
    "beforeend",
    '<label><input id="scan-read-qr" type="checkbox" checked> Read QR codes together with label text</label><p>Keep the complete QR square and its white border sharp and visible. Include one spool code per photo. A QR may contain a product ID, filament data, or only a website link.</p>',
  );
  $(".photo-guide").insertAdjacentHTML(
    "beforeend",
    '<label><input id="auto-focus-label" type="checkbox" checked> Automatically zoom to readable label text (keep a small margin)</label>',
  );
  $("#modal").classList.add("scan-dialog");
  $("#scan-zone").insertAdjacentHTML(
    "afterend",
    `<div id="scan-photo-controls" class="hidden">${photoAdjustmentControls("scan")}</div>`,
  );
}
function photoAdjustmentControls(scope) {
  return `<details class="photo-adjustment" ${scope === "template" ? "open" : ""}><summary>Photo adjustment <span>Rotate, zoom & pan</span></summary><div class="photo-mode-switch" aria-label="Photo interaction"><button type="button" data-photo-scope="${scope}" data-photo-mode="pan">Move photo</button><button type="button" data-photo-scope="${scope}" data-photo-mode="${scope === "scan" ? "color" : "draw"}">${scope === "scan" ? "Pick color" : "Draw fields"}</button></div><p class="photo-help">Drag to pan. Pinch or use the zoom slider. Template boxes stay fixed. After adjustments, use Read label again.</p><div class="photo-quick-actions">${[
    ["rotate-left", "↶ 90°"],
    ["rotate-right", "↷ 90°"],
    ["fit", "Fit photo"],
    ["focus", "Zoom to label"],
    ["reset", "Reset"],
  ]
    .map(
      ([command, label]) =>
        `<button type="button" class="btn small" data-photo-scope="${scope}" data-photo-command="${command}">${label}</button>`,
    )
    .join(
      "",
    )}</div><div class="photo-adjustment-row"><label for="${scope}-photo-angle">Rotation</label><input id="${scope}-photo-angle" type="range" min="-180" max="180" step=".1" value="0" data-photo-scope="${scope}" data-photo-value="angle"><div class="photo-number"><input type="number" step=".1" min="-180" max="180" value="0" aria-label="Rotation in degrees" data-photo-scope="${scope}" data-photo-value="angle"><span>°</span></div></div><div class="photo-adjustment-row"><label for="${scope}-photo-zoom">Zoom</label><input id="${scope}-photo-zoom" type="range" min="10" max="800" step="1" value="100" data-photo-scope="${scope}" data-photo-value="zoom"><div class="photo-number"><input type="number" min="10" max="800" step="1" value="100" aria-label="Zoom percent" data-photo-scope="${scope}" data-photo-value="zoom"><span>%</span></div></div><div class="photo-pan-controls"><span>Position</span><div>${[
    ["left", "←", "Pan left"],
    ["up", "↑", "Pan up"],
    ["down", "↓", "Pan down"],
    ["right", "→", "Pan right"],
  ]
    .map(
      ([command, label, title]) =>
        `<button type="button" class="icon-btn" data-photo-scope="${scope}" data-photo-command="${command}" aria-label="${title}">${label}</button>`,
    )
    .join(
      "",
    )}</div><div class="photo-number"><input type="number" step=".5" min="-400" max="400" value="0" aria-label="Horizontal position percent" data-photo-scope="${scope}" data-photo-value="panX"><span>X%</span></div><div class="photo-number"><input type="number" step=".5" min="-400" max="400" value="0" aria-label="Vertical position percent" data-photo-scope="${scope}" data-photo-value="panY"><span>Y%</span></div></div><p class="photo-frame-note" id="${scope}-photo-frame"></p>${photoPreparationControls(scope)}</details>`;
}
function photoPreparationControls(scope) {
  return `<div class="photo-preparation"><h4>Make text easier to read</h4><div class="field"><label for="${scope}-photo-processing">OCR preview</label><select id="${scope}-photo-processing" data-photo-processing="${scope}"><option value="original">Original color</option><option value="enhanced">Enhanced grayscale</option><option value="grayscale">Grayscale</option><option value="binary">Black & white</option></select><small>The visible image is sent to OCR. Color picking uses the aligned color photo.</small></div>${[
    ["contrast", "Contrast", 0, 100, 30],
    ["sharpness", "Sharpen text edges", 0, 100, 40],
    ["lens", "Lens correction", -40, 40, 0],
  ]
    .map(
      ([key, label, min, max, value]) =>
        `<div class="photo-adjustment-row"><label for="${scope}-photo-${key}">${label}</label><input id="${scope}-photo-${key}" type="range" min="${min}" max="${max}" step="1" value="${value}" data-photo-scope="${scope}" data-photo-value="${key}"><output id="${scope}-photo-${key}-value">${value}</output></div>`,
    )
    .join(
      "",
    )}<p class="photo-help">Contrast and sharpening apply to enhanced and black & white previews. Try both signs of lens correction until straight edges stop bowing. It is an approximation, not camera calibration.</p><div class="photo-quick-actions"><button type="button" class="btn small" data-photo-scope="${scope}" data-photo-command="auto-orient">Auto-orient text</button><button type="button" class="btn small" data-photo-scope="${scope}" data-photo-command="corners">Straighten: mark 4 corners</button><button type="button" class="btn small" data-photo-scope="${scope}" data-photo-command="cancel-corners">Cancel corners</button></div><p id="${scope}-photo-preparation-status" class="photo-help" role="status">For a tilted label, mark its corners: top left, top right, bottom right, bottom left. Reset restores the original photo.</p></div>`;
}
function getPhotoAlignment(scope) {
  return scope === "scan" ? state.scanAlignment : state.templateAlignment;
}
function updatePhotoControls(scope) {
  const alignment = getPhotoAlignment(scope);
  if (!alignment) return;
  const frame = scope === "scan" ? $("#scan-frame") : $("#region-editor");
  if (frame) {
    const aspect = alignment.canvas.width / alignment.canvas.height;
    frame.style.width = `${Math.min(1, aspect) * 100}%`;
    frame.style.height = `${Math.min(1, 1 / aspect) * 100}%`;
  }
  for (const input of document.querySelectorAll(
    `[data-photo-scope="${scope}"][data-photo-value]`,
  )) {
    if (document.activeElement === input) continue;
    const key = input.dataset.photoValue;
    input.value =
      Math.round(alignment.view[key] * (key === "zoom" ? 100 : 1) * 10) / 10;
  }
  const note = $(`#${scope}-photo-frame`);
  const processing = $(`[data-photo-processing="${scope}"]`);
  if (processing) processing.value = alignment.processing;
  for (const key of ["contrast", "sharpness", "lens"]) {
    const output = $(`#${scope}-photo-${key}-value`);
    if (output) output.textContent = alignment.view[key];
  }
  if (note)
    note.textContent = `Recognition frame: ${alignment.canvas.width} × ${alignment.canvas.height} px. The visible photo is the one sent to OCR.`;
}
function setPhotoMode(scope, mode) {
  if (mode !== "corners") clearPhotoCorners(scope);
  if (scope === "scan") {
    state.scanPhotoMode = mode;
    state.scanAlignment?.canvas.classList.toggle("pan-mode", mode === "pan");
    if ($("#scan-color span:last-child"))
      $("#scan-color span:last-child").textContent =
        mode === "color"
          ? "Tap exposed filament to sample its color."
          : "Choose Pick color to sample the filament after aligning the photo.";
  } else if (state.regionEditor) {
    state.regionEditor.mode = mode;
    state.regionEditor.drag = null;
    state.regionEditor.svg.classList.toggle("pan-mode", mode === "pan");
    state.regionEditor.draw();
  }
  const alignment = getPhotoAlignment(scope);
  if (alignment) {
    alignment.pointers.clear();
    alignment.gesture = null;
  }
  for (const button of document.querySelectorAll(
    `[data-photo-scope="${scope}"][data-photo-mode]`,
  )) {
    const active = button.dataset.photoMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}
function changePhotoControl(target) {
  const alignment = getPhotoAlignment(target.dataset.photoScope);
  if (!alignment || target.value.trim() === "") return;
  let value = Number(target.value);
  if (!Number.isFinite(value)) return;
  if (alignment.cornerPoints) setPhotoMode(target.dataset.photoScope, "pan");
  if (target.dataset.photoValue === "zoom") value /= 100;
  alignment.update({ [target.dataset.photoValue]: value });
}
async function photoCommand(scope, command) {
  const alignment = getPhotoAlignment(scope);
  if (!alignment) return;
  if (alignment.cornerPoints && command !== "corners")
    setPhotoMode(scope, "pan");
  if (command === "auto-orient" || command === "focus") {
    if (scope === "scan" && state.scanBusyOwner) return;
    const owner = {};
    if (scope === "scan")
      showScanBusy(
        command === "focus" ? "Zooming to label" : "Aligning label",
        owner,
      );
    const operation =
      command === "focus" ? focusPhotoLabel(scope) : autoOrientPhoto(scope);
    if (scope === "scan") state.scanPipeline = operation;
    try {
      await operation;
    } finally {
      if (scope === "scan") hideScanBusy(owner);
    }
    return;
  }
  if (command === "corners") {
    clearPhotoCorners(scope);
    alignment.cornerPoints = [];
    setPhotoMode(scope, "corners");
    $(`#${scope}-photo-preparation-status`).textContent =
      "Tap corner 1: top left of the label. Then top right, bottom right, bottom left.";
    return;
  }
  if (command === "cancel-corners") {
    clearPhotoCorners(scope);
    setPhotoMode(scope, "pan");
    $(`#${scope}-photo-preparation-status`).textContent =
      "Corner correction cancelled. Photo unchanged.";
    return;
  }
  clearPhotoCorners(scope);
  if (command === "rotate-left") alignment.rotate(-90);
  else if (command === "rotate-right") alignment.rotate(90);
  else if (command === "fit") alignment.fit();
  else if (command === "reset") alignment.reset();
  else {
    const delta = { left: [-2, 0], right: [2, 0], up: [0, -2], down: [0, 2] }[
      command
    ];
    if (delta)
      alignment.update({
        panX: alignment.view.panX + delta[0],
        panY: alignment.view.panY + delta[1],
      });
  }
}
function clearPhotoCorners(scope) {
  const alignment = getPhotoAlignment(scope);
  if (!alignment) return;
  alignment.cornerPoints = null;
  alignment.canvas.parentElement
    ?.querySelectorAll(".photo-corner")
    .forEach((n) => n.remove());
}
function markPhotoCorner(scope, event) {
  const alignment = getPhotoAlignment(scope);
  if (!alignment?.cornerPoints) return;
  const box = alignment.canvas.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const point = {
    x: (event.clientX - box.left) / box.width,
    y: (event.clientY - box.top) / box.height,
  };
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
  alignment.cornerPoints.push(point);
  const marker = document.createElement("span");
  marker.className = "photo-corner";
  marker.textContent = alignment.cornerPoints.length;
  marker.style.left = `${point.x * 100}%`;
  marker.style.top = `${point.y * 100}%`;
  alignment.canvas.parentElement.append(marker);
  const status = $(`#${scope}-photo-preparation-status`);
  if (alignment.cornerPoints.length < 4) {
    status.textContent = `Tap corner ${alignment.cornerPoints.length + 1}: ${["top left", "top right", "bottom right", "bottom left"][alignment.cornerPoints.length]}.`;
    return;
  }
  try {
    alignment.rectify(alignment.cornerPoints);
    status.textContent =
      "Label straightened to a rectangle. Adjust zoom and position beneath the fixed template boxes. Reset restores the original photo.";
  } catch (error) {
    status.textContent = error.message;
  }
  clearPhotoCorners(scope);
  setPhotoMode(scope, "pan");
}
async function autoOrientPhoto(scope) {
  const alignment = getPhotoAlignment(scope);
  if (!alignment || alignment.orienting) return;
  const sequence = state.scanSequence,
    revision = state.templatePhotoRevision,
    status = $(`#${scope}-photo-preparation-status`);
  alignment.orienting = true;
  status.textContent =
    "Checking four text directions and small text tilt locally…";
  const buttons = [
    ...document.querySelectorAll(
      `[data-photo-scope="${scope}"][data-photo-command="auto-orient"]`,
    ),
  ];
  const readControls = [
    ...document.querySelectorAll(
      scope === "scan"
        ? "#read-label, #teach-label"
        : "#read-regions, #save-template, [data-use-spool]",
    ),
  ].map((node) => ({ node, disabled: node.disabled }));
  readControls.forEach(({ node }) => (node.disabled = true));
  buttons.forEach((b) => (b.disabled = true));
  try {
    const result = await api("/photo/orient", {
      method: "POST",
      body: { image: alignment.exportImage() },
    });
    if (
      getPhotoAlignment(scope) !== alignment ||
      !status.isConnected ||
      sequence !== state.scanSequence ||
      (scope === "template" && revision !== state.templatePhotoRevision)
    ) {
      if (getPhotoAlignment(scope) === alignment && status.isConnected)
        status.textContent =
          "Photo changed during orientation check. Current adjustments kept.";
      return false;
    }
    if (result.reliable && Math.abs(result.angle) > 0.1) {
      alignment.rotate(result.angle);
      alignment.fit();
    }
    status.textContent = result.message;
    return true;
  } catch (error) {
    if (
      status.isConnected &&
      getPhotoAlignment(scope) === alignment &&
      sequence === state.scanSequence
    )
      status.textContent = `Automatic orientation unavailable. Use rotation manually. ${error.message}`;
    return (
      getPhotoAlignment(scope) === alignment && sequence === state.scanSequence
    );
  } finally {
    alignment.orienting = false;
    if (getPhotoAlignment(scope) === alignment) {
      buttons.forEach((b) => (b.disabled = false));
      readControls.forEach(({ node, disabled }) => {
        if (node.isConnected) node.disabled = disabled;
      });
    }
  }
}
async function focusPhotoLabel(scope) {
  const alignment = getPhotoAlignment(scope);
  if (!alignment || alignment.focusing) return;
  clearPhotoCorners(scope);
  const sequence = state.scanSequence,
    revision = state.templatePhotoRevision,
    status = $(`#${scope}-photo-preparation-status`);
  alignment.focusing = true;
  status.textContent = "Finding readable label text to zoom in locally…";
  const controls = [
    ...document.querySelectorAll(
      scope === "scan"
        ? "#read-label, #teach-label"
        : "#read-regions, #save-template, [data-use-spool]",
    ),
  ].map((node) => ({ node, disabled: node.disabled }));
  controls.forEach(({ node }) => (node.disabled = true));
  try {
    const result = await api("/photo/focus", {
      method: "POST",
      body: { image: alignment.exportImage() },
    });
    if (
      getPhotoAlignment(scope) !== alignment ||
      !status.isConnected ||
      sequence !== state.scanSequence ||
      (scope === "template" && revision !== state.templatePhotoRevision)
    ) {
      if (getPhotoAlignment(scope) === alignment && status.isConnected)
        status.textContent =
          "Photo changed during label detection. Current adjustments kept.";
      return false;
    }
    if (result.bounds && alignment.focus(result.bounds))
      status.textContent =
        "Zoomed to readable label text with a small margin. Check every printed field. Fit photo restores the whole image.";
    else
      status.textContent =
        "No clear label area found. Use zoom and pan to fill the square with the label, keeping every field visible.";
    return true;
  } catch {
    if (
      getPhotoAlignment(scope) === alignment &&
      status.isConnected &&
      sequence === state.scanSequence
    )
      status.textContent =
        "Automatic label zoom unavailable. Use zoom and pan, keeping all label fields visible.";
    return (
      getPhotoAlignment(scope) === alignment && sequence === state.scanSequence
    );
  } finally {
    alignment.focusing = false;
    if (getPhotoAlignment(scope) === alignment)
      controls.forEach(({ node, disabled }) => {
        if (node.isConnected) node.disabled = disabled;
      });
  }
}
function scanPhotoAdjusted() {
  state.scanSequence++;
  state.scanFields = null;
  state.scanMatch = null;
  state.scanText = "";
  state.scanQRCodes = [];
  state.scanColor = null;
  if ($("#read-label"))
    $("#read-label").innerHTML = icon("scan") + "Read label again";
  if ($("#scan-status"))
    $("#scan-status").textContent =
      "Photo adjusted. Check the fixed boxes, then read the label again.";
  if ($("#scan-color .sample"))
    $("#scan-color .sample").style.background = "#b1ba9e";
  if ($("#scan-color span:last-child"))
    $("#scan-color span:last-child").textContent =
      "Photo changed. Choose Pick color to sample its color again.";
  updatePhotoControls("scan");
}
function syncScanPhoto() {
  if (!state.scanAlignment) return;
  state.scanImage = state.scanAlignment.exportImage();
  state.scanWidth = state.scanAlignment.canvas.width;
  state.scanHeight = state.scanAlignment.canvas.height;
}
async function decodePhotoSource(url, maxDimension = 1800) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
  const canvas = document.createElement("canvas"),
    scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
function showScanBusy(stage, owner) {
  const zone = $("#scan-zone");
  if (!zone) return;
  state.scanBusyOwner = owner;
  zone.setAttribute("aria-busy", "true");
  let overlay = $("#scan-processing");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "scan-processing";
    overlay.className = "scan-processing";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML =
      '<div class="scan-processing-card"><div class="scan-stars" aria-hidden="true"><span class="scan-orbit"><i>✦</i><i>✧</i><i>✦</i></span><span class="scan-star-center">✦</span></div><strong class="scan-processing-stage"></strong><span>Working on your image…</span></div>';
    zone.append(overlay);
  }
  overlay.querySelector(".scan-processing-stage").textContent = stage;
}
function hideScanBusy(owner) {
  if (state.scanBusyOwner !== owner) return;
  state.scanBusyOwner = null;
  $("#scan-processing")?.remove();
  $("#scan-zone")?.setAttribute("aria-busy", "false");
}
async function loadPhoto(file) {
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) {
    toast("Choose a photo smaller than 30 MB.", true);
    return;
  }
  const sequence = ++state.scanSequence;
  const job = {};
  state.scanUploadJob = job;
  showScanBusy("Preparing image", job);
  $("#read-label").disabled = true;
  $("#teach-label").disabled = true;
  const url = URL.createObjectURL(file);
  try {
    const source = await decodePhotoSource(url, 3200);
    if (sequence !== state.scanSequence || !$("#modal").open) return;
    state.scanAlignment?.unbind();
    state.scanPhotoMode = "pan";
    const template = state.templates.find(
      (t) => t.id === $("#scan-template").value,
    );
    state.scanAlignment = new window.PhotoAlignment({
      source,
      frameWidth: template?.imageWidth || Math.max(source.width, source.height),
      frameHeight:
        template?.imageHeight || Math.max(source.width, source.height),
      onChange: scanPhotoAdjusted,
    });
    const alignment = state.scanAlignment,
      canvas = alignment.canvas;
    job.alignment = alignment;
    syncScanPhoto();
    state.scanFields = null;
    state.scanText = "";
    state.scanColor = null;
    const zone = $("#scan-zone");
    if (!zone) return;
    zone.classList.add("has-image");
    zone.innerHTML = "";
    canvas.id = "photo-canvas";
    canvas.setAttribute(
      "aria-label",
      "Spool photograph. Tap filament to sample color.",
    );
    const preview = document.createElement("div");
    preview.id = "scan-preview";
    const frame = document.createElement("div");
    frame.id = "scan-frame";
    frame.append(canvas);
    preview.append(frame);
    zone.append(preview);
    state.scanAlignment.bind(canvas, () => state.scanPhotoMode === "pan");
    $("#scan-photo-controls").classList.remove("hidden");
    setPhotoMode("scan", state.scanPhotoMode);
    updatePhotoControls("scan");
    $("#scan-color").classList.remove("hidden");
    $("#read-label").disabled = true;
    $("#teach-label").disabled = true;
    showScanBusy("Preparing image", job);
    $("#scan-photo-controls .photo-adjustment").open = false;
    previewTemplate();
    $("#read-label").innerHTML = icon("scan") + "Read label";
    $("#scan-status").textContent =
      "Preparing your photo, then reading the label automatically.";
    state.scanAlignment.setProcessing("enhanced");
    $(".photo-guide").open = false;
    job.revision = state.scanSequence;
    const current = () =>
      state.scanUploadJob === job &&
      getPhotoAlignment("scan") === alignment &&
      $("#modal").open &&
      $("#photo-canvas") === canvas;
    const prepareAndRead = async () => {
      if (!current() || state.scanSequence !== job.revision) return;
      if (state.scanReading) await state.scanReading.done;
      if (!current() || state.scanSequence !== job.revision) return;
      let ready = true;
      if ($("#auto-orient-photo").checked) {
        showScanBusy("Aligning label", job);
        ready = await autoOrientPhoto("scan");
      }
      if (
        ready &&
        current() &&
        !$("#scan-template").value &&
        $("#auto-focus-label").checked
      ) {
        showScanBusy("Zooming to label", job);
        ready = await focusPhotoLabel("scan");
      }
      if (ready && current())
        await readLabel({ automatic: true, busyOwner: job });
    };
    const previous = state.scanPipeline || Promise.resolve();
    const pipeline = previous.catch(() => {}).then(prepareAndRead);
    state.scanPipeline = pipeline;
    await pipeline;
  } catch {
    toast(
      "This photo could not be opened. Choose a JPEG, PNG, or WebP photo. For HEIC, export a JPEG first.",
      true,
    );
  } finally {
    URL.revokeObjectURL(url);
    hideScanBusy(job);
    if (state.scanUploadJob === job && $("#read-label")) {
      $("#read-label").disabled = !state.scanAlignment;
      if ($("#teach-label")) $("#teach-label").disabled = !state.scanAlignment;
    }
  }
}
function sampleColor(event) {
  if (state.scanPhotoMode !== "color") return;
  const canvas = event.target,
    box = canvas.getBoundingClientRect(),
    ctx = (state.scanAlignment?.colorCanvas || canvas).getContext("2d");
  const x = Math.min(
      canvas.width - 1,
      Math.max(
        0,
        Math.round(((event.clientX - box.left) / box.width) * canvas.width),
      ),
    ),
    y = Math.min(
      canvas.height - 1,
      Math.max(
        0,
        Math.round(((event.clientY - box.top) / box.height) * canvas.height),
      ),
    );
  const left = Math.max(0, x - 4),
    top = Math.max(0, y - 4),
    pixels = ctx.getImageData(
      left,
      top,
      Math.min(9, canvas.width - left),
      Math.min(9, canvas.height - top),
    ).data;
  let channels = [0, 0, 0];
  for (let i = 0; i < pixels.length; i += 4) {
    channels[0] += pixels[i];
    channels[1] += pixels[i + 1];
    channels[2] += pixels[i + 2];
  }
  state.scanColor =
    "#" +
    channels
      .map((c) =>
        Math.round(c / (pixels.length / 4))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  $("#scan-color .sample").style.background = state.scanColor;
  $("#scan-color span:last-child").textContent =
    `Color sampled: ${state.scanColor.toUpperCase()}. You can adjust it before saving.`;
}
function spoolReportHTML(report, conflicts = []) {
  if (!report) return "";
  if (report.status !== "ok")
    return `<p class="section-note">${esc(report.message || "Spool information is unavailable.")}</p>`;
  const f = report.fields,
    m = report.metadata;
  const values = [
    ["Material", f.material],
    ["Color", f.colorName],
    ["Color HEX", f.colorHex],
    [
      "Nozzle",
      f.temperatureMin != null
        ? `${f.temperatureMin}–${f.temperatureMax} °C`
        : null,
    ],
    [
      "Factory filament weight",
      m.factoryWeight != null ? grams(m.factoryWeight) : null,
    ],
    [
      "Nominal marketed size",
      m.nominalWeight != null ? grams(m.nominalWeight) : null,
    ],
    [
      "Empty spool",
      f.emptySpoolWeight != null ? grams(f.emptySpoolWeight) : null,
    ],
    ["Heatbed", m.bedMin != null ? `${m.bedMin}–${m.bedMax} °C` : null],
    ["Manufactured", m.manufactureDate],
    [
      "Original length",
      m.lengthMetres != null ? `${num(m.lengthMetres)} m` : null,
    ],
  ].filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  const link =
    /^https:\/\/prusament\.com\/spool\/\?spoolId=[a-f\d]{6,32}$/i.test(
      report.url,
    )
      ? report.url
      : null;
  return `<section class="qr-spool-report"><strong>Manufacturer spool report</strong><p>${esc(m.productName)}</p><dl>${values.map(([label, value]) => `<dt>${label}</dt><dd>${esc(value)}</dd>`).join("")}</dl><p>These are the original manufacturing values. Enter your actual remaining filament separately. The source is included in the spool notes when saved.</p>${conflicts.length ? `<p class="catalog-error">Check differences before saving: ${conflicts.map((c) => `${esc(c.field)} — label: ${esc(c.labelValue)}, report: ${esc(c.reportValue)}`).join("; ")}. Your label and confirmed values were kept.</p>` : ""}${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">View manufacturer spool report</a>` : ""}</section>`;
}
function qrResultsHTML(qr) {
  if (!qr) return "";
  if (qr.skipped)
    return '<p class="section-note">QR reading is disabled for this scan.</p>';
  if (!qr.codes?.length)
    return `<p class="section-note">${esc(qr.error || "No readable QR code found. Text recognition was used.")}</p>`;
  return `<section class="qr-scan-results"><h3>QR code ${qr.codes.length > 1 ? "results" : "detected"}</h3><p>${qr.multiple ? "Several codes were found. QR fields were kept separate; take a closer photo of one spool code." : "QR clues were combined with label text. Verify the product before saving."}</p>${spoolReportHTML(qr.spoolReport, qr.reportConflicts)}${qr.codes
    .map(
      (code) =>
        `<div class="qr-scan-code">${code.brandHint ? `<strong>Recognized: ${esc(code.fields?.manufacturer === "Prusa Research" ? "Prusa Research / Prusament" : code.brandHint)}</strong>` : ""}${
          Object.keys(code.fields || {}).length
            ? `<p>${Object.entries(code.fields)
                .map(([k, v]) => `${esc(k)}: ${esc(v)}`)
                .join(" · ")}</p>`
            : "<p>This code does not directly specify a complete filament product.</p>"
        }${qr.spoolReport?.status !== "ok" && code.url && code.fields?.manufacturer === "Prusa Research" && !code.fields?.material && !code.fields?.productLine && !code.fields?.colorName ? "<p>Brand recognized. This code links to a spool page; it does not directly encode the material or color. Read the label or open the spool information to identify the product.</p>" : ""}${code.url ? `<a href="${esc(code.url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open QR link (internet)</a>` : ""}<details class="source-text"><summary>Decoded QR value</summary><pre>${esc(code.text)}</pre></details></div>`,
    )
    .join(
      "",
    )}${qr.conflicts?.length ? `<p class="catalog-error">QR and text disagree: ${qr.conflicts.map((c) => `${esc(c.field)} — text: ${esc(c.textValue)}, QR: ${esc(c.qrValue)}`).join("; ")}. Text values were kept for review.</p>` : ""}<small>Links stay unopened until you choose them. An opaque spool ID needs a catalog match or information from its manufacturer's page.</small></section>`;
}
async function readLabel({ automatic = false, busyOwner = null } = {}) {
  if (state.scanReading) return;
  syncScanPhoto();
  if (state.scanFields) {
    if (automatic) return;
    openSpoolForm({
      ...state.scanFields,
      colorHex: state.scanColor || state.scanFields.colorHex,
      ocrText: state.scanText,
      qrCodes: state.scanQRCodes || [],
      _scan: true,
      _reviewPhoto: captureReviewPhoto("scan"),
    });
    return;
  }
  if (!state.scanImage) return;
  const sequence = state.scanSequence;
  const alignment = state.scanAlignment,
    upload = state.scanUploadJob;
  const reading = {};
  reading.done = new Promise((resolve) => (reading.finish = resolve));
  state.scanReading = reading;
  const busy = busyOwner || reading;
  showScanBusy(
    $("#scan-read-qr")?.checked !== false
      ? "Reading label and QR codes"
      : "Reading label",
    busy,
  );
  const button = $("#read-label");
  button.disabled = true;
  button.innerHTML = icon("loading", "spin") + "Reading…";
  $("#scan-status").innerHTML =
    'Reading your label locally. The first photo may take a little longer.<div class="loading-line"></div>';
  try {
    const result = await api("/scan", {
      method: "POST",
      body: {
        image: state.scanImage,
        qrImage: state.scanAlignment?.originalSource.toDataURL(
          "image/jpeg",
          0.95,
        ),
        readQR: $("#scan-read-qr")?.checked !== false,
        readSpoolInfo: $("#scan-read-spool-info")?.checked !== false,
        mode: $("#scan-template").value ? "ocr" : $("#scan-mode").value,
        templateId: $("#scan-template").value || undefined,
        imageWidth: state.scanWidth,
        imageHeight: state.scanHeight,
      },
    });
    if (
      !$("#scan-status") ||
      sequence !== state.scanSequence ||
      !$("#modal").open
    )
      return;
    state.scanText = result.text || "";
    state.scanQRCodes = (result.qr?.codes || []).map((c) => c.text);
    state.scanFields = result.fields || {};
    const f = state.scanFields;
    state.scanMatch = state.spools.find(
      (s) =>
        !/demo spool/i.test(s.notes || "") &&
        f.brand &&
        f.material &&
        s.brand.toLowerCase() === f.brand.toLowerCase() &&
        s.material.toLowerCase() === f.material.toLowerCase() &&
        (!f.productLine ||
          (s.productLine || "").toLowerCase() ===
            f.productLine.toLowerCase()) &&
        f.colorName &&
        s.colorName.toLowerCase() === f.colorName.toLowerCase(),
    );
    $("#scan-status").innerHTML =
      `<strong>Ready for a quick review.</strong> ${esc((result.warnings || []).join(" "))}${state.scanText ? `<details><summary>View recognized text</summary><div class="ocr-result">${esc(state.scanText)}</div></details>` : ""}${state.scanMatch ? `<div class="scan-match">This looks like <strong>${esc(state.scanMatch.name)}</strong> in your local library. Reuse its saved spool details, then review them.<br><button class="btn small" data-action="scan-library">${icon("spool")}Use saved spool details</button></div>` : ""}`;
    $("#scan-status").insertAdjacentHTML(
      "afterbegin",
      `<div id="scan-catalog-results">${catalogCandidatesHTML(result.catalogMatch || { available: state.filamentDatabase?.available, candidates: [], message: "Search the local catalog using the label text below." }, "scan")}</div><details class="source-text"><summary>Correct text & search again</summary><div class="field"><label for="scan-ocr-text">Label text for matching</label><textarea id="scan-ocr-text" maxlength="12000" rows="5">${esc(state.scanText)}</textarea><small>You can remove unrelated noise or fix a word. The original OCR text is retained with the spool.</small></div><button class="btn small" data-action="rematch-scan-text">${icon("search")}Find matching products</button></details>`,
    );
    $("#scan-status").insertAdjacentHTML(
      "afterbegin",
      qrResultsHTML(result.qr),
    );
    if (!f.brand || !f.material || !f.productLine)
      $("#scan-status").insertAdjacentHTML(
        "beforeend",
        `<div class="scan-match"><strong>Missing or incorrect details?</strong> Teach this label by boxing the printed fields. You can enter an unfamiliar brand or product line yourself.<br><button class="btn small" data-action="teach-label">${icon("edit")}Teach this label</button></div>`,
      );
    if (result.suggestedTemplates?.length)
      $("#scan-status").insertAdjacentHTML(
        "beforeend",
        `<div class="scan-match">Similar saved templates: ${result.suggestedTemplates.map((t) => `<button class="btn small" data-use-template="${esc(t.id)}">${esc(t.name)}</button>`).join(" ")}</div>`,
      );
    button.innerHTML = icon("arrow") + "Review & add spool";
  } catch (error) {
    if (sequence !== state.scanSequence || !$("#modal").open) return;
    if ($("#scan-status")) $("#scan-status").textContent = error.message;
    toast(error.message, true);
    button.innerHTML = icon("scan") + "Try again";
  } finally {
    if (state.scanReading === reading) state.scanReading = null;
    reading.finish();
    hideScanBusy(busy);
    if (
      state.scanAlignment === alignment &&
      state.scanUploadJob === upload &&
      button.isConnected
    )
      button.disabled = false;
  }
}
function templatesPage() {
  const labels = window.LabelRegionEditor?.fields || [];
  return `${heading("TEACH ONCE. READ THE NEXT LABEL.", "Label templates", "Your own local library of label layouts and corrected text.", `<button class="btn primary" data-action="scan">${icon("plus")}Teach a new label</button>`)}<div class="tip-banner">${icon("scan")}<span>Templates read the fields inside your saved boxes. Use the same label layout and similar framing; adjust boxes when a design changes. Every mapped field is optional. Saved example photos are included in your backups.</span></div>${state.templates.length ? `<div class="template-library">${state.templates.map((t) => `<article class="panel template-card"><div class="template-card-icon">${icon("scan")}</div><h2>${esc(t.name)}</h2><p>${t.regions.length} mapped ${t.regions.length === 1 ? "field" : "fields"} · Updated ${when(t.updatedAt)}</p><div class="template-field-tags">${t.regions.map((r) => `<span class="badge">${esc(labels.find(([key]) => key === r.field)?.[1] || r.field)}</span>`).join("")}</div><div class="template-card-actions"><button class="btn small" data-edit-template="${esc(t.id)}">${icon("edit")}View & edit</button><button class="btn small danger" data-delete-template="${esc(t.id)}" aria-label="Delete ${esc(t.name)} template">${icon("trash")}</button></div></article>`).join("")}</div>` : empty("Make unfamiliar labels familiar.", "Open a spool photo, select Teach this label, and map only the fields you need.", `<button class="btn primary" data-action="scan">${icon("camera")}Choose a label photo</button>`, "scan")}`;
}
function previewTemplate() {
  const preview = $("#scan-preview");
  if (!preview) return;
  preview.querySelector("svg")?.remove();
  const template = state.templates.find(
    (t) => t.id === $("#scan-template")?.value,
  );
  if (!template) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("scan-region-preview");
  svg.setAttribute("viewBox", "0 0 1000 1000");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  template.regions.forEach((r) => {
    const rect = document.createElementNS(svg.namespaceURI, "rect");
    for (const key of ["x", "y", "width", "height"])
      rect.setAttribute(key, String(r[key] * 1000));
    rect.setAttribute("fill", "#89af66");
    rect.setAttribute("fill-opacity", ".12");
    rect.setAttribute(
      "stroke",
      window.LabelRegionEditor.fields.find(([k]) => k === r.field)?.[2] ||
        "#89af66",
    );
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("vector-effect", "non-scaling-stroke");
    svg.append(rect);
  });
  ($("#scan-frame") || preview).append(svg);
}
function chooseScanTemplate(id) {
  if (!$("#scan-template")) return;
  $("#scan-template").value = id;
  state.scanSequence++;
  state.scanFields = null;
  $("#read-label").innerHTML = icon("scan") + "Read label";
  $("#scan-mode").disabled = Boolean(id);
  if (id) $("#scan-mode").value = "ocr";
  const template = state.templates.find((t) => t.id === id),
    alignment = state.scanAlignment;
  if (alignment) {
    alignment.setFrame(
      template?.imageWidth ||
        Math.max(alignment.source.width, alignment.source.height),
      template?.imageHeight ||
        Math.max(alignment.source.width, alignment.source.height),
    );
    syncScanPhoto();
    updatePhotoControls("scan");
  }
  previewTemplate();
  $("#scan-status").textContent = id
    ? "Use Photo adjustment to rotate, zoom, and move the photo beneath the colored boxes before reading."
    : "The whole label will be read. You can teach a template if details are missed.";
}
async function editStoredTemplate(id) {
  try {
    const template = await api(`/templates/${encodeURIComponent(id)}`);
    state.scanImage = template.exampleImage;
    state.scanWidth = template.imageWidth;
    state.scanHeight = template.imageHeight;
    state.scanFields = null;
    state.scanColor = null;
    state.scanAlignment?.unbind();
    state.scanAlignment = null;
    const source = await decodePhotoSource(template.exampleImage);
    openTemplateEditor(template, source);
  } catch (error) {
    toast(error.message, true);
  }
}
function openTemplateEditor(template = null, source = null) {
  const readQR = $("#scan-read-qr")?.checked !== false;
  const readSpoolInfo = $("#scan-read-spool-info")?.checked !== false;
  const qrImage = !source
    ? state.scanAlignment?.originalSource.toDataURL("image/jpeg", 0.95)
    : source.toDataURL("image/jpeg", 0.95);
  state.templateQRImage = qrImage;
  state.templateQRCodes = [];
  const inheritedProcessing = !source
    ? state.scanAlignment?.processing
    : "original";
  const inheritedView = !source ? state.scanAlignment?.view : null;
  if (!source && state.scanAlignment) {
    syncScanPhoto();
    source = state.scanAlignment.snapshot(true);
  }
  if (!state.scanImage) {
    toast("Choose a label photo first.", true);
    return;
  }
  if (!template) {
    const id = $("#scan-template")?.value;
    template = state.templates.find((t) => t.id === id) || null;
  }
  state.scanSequence++;
  state.templateAlignment?.unbind();
  state.templatePhotoRevision = 0;
  state.templateCatalogFields = null;
  state.templateOCRText = "";
  state.templateDraft = {
    id: template?.id,
    name:
      template?.name ||
      [
        state.scanFields?.brand,
        state.scanFields?.productLine || state.scanFields?.material,
        "label",
      ]
        .filter(Boolean)
        .join(" "),
    exampleImage: state.scanImage,
    imageWidth: state.scanWidth,
    imageHeight: state.scanHeight,
  };
  const fields = window.LabelRegionEditor.fields;
  state.templateDirtyRegions = new Set();
  const newPhoto = Boolean(
    template && template.exampleImage !== state.scanImage,
  );
  const regions = (template?.regions || []).map((r) => ({
    ...r,
    ...(newPhoto ? { trainingValue: r.value, value: "" } : {}),
  }));
  openModal(
    template ? "Make this label easier to read." : "Teach a new label.",
    "Choose a field, then draw a box around its text. Map only what you need.",
    `<form id="template-form"><div class="field"><label for="template-name">Template name <span class="required">*</span></label><input id="template-name" name="templateName" maxlength="120" required value="${esc(state.templateDraft.name || "New spool label")}" placeholder="e.g. AddNorth PLA label"></div><div class="annotation-layout"><div class="annotation-photo-column"><div class="annotation-instructions">${icon("scan")}Drag over the printed text. On a phone, use one finger.</div><div id="region-editor" class="annotation-photo"></div><p class="section-note">One box per field. Keep the whole word or temperature range inside the box. Use a similar photo framing when reusing this template.</p></div><section class="annotation-controls"><div class="field"><label for="region-field">Field to mark</label><select id="region-field">${fields.map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select><small>Base material is PLA. Product line can be X-PLA, PLA Basic, Economy, or Matte.</small></div><button type="button" class="btn small" data-action="add-region">${icon("plus")}Add box with coordinates</button><div id="region-list" class="region-list"></div><div id="region-controls"></div></section></div><div class="template-reading-row"><button type="button" class="btn" id="read-regions" data-action="read-regions">${icon("scan")}Read selected boxes</button><span id="template-status" role="status">Add a box, read its text, then correct it if needed.</span></div><div class="note-warning">Confirmed text is an example for this photo. Future scans read the new photo; the template does not copy this spool’s color, variant, or weight onto every spool.</div><div class="form-actions template-actions"><button type="button" class="btn" data-action="close">Cancel</button><button id="save-template" class="btn" type="submit">${icon("save")}Save template</button><button class="btn primary" type="submit" data-use-spool="true">${icon("arrow")}Save & review spool</button></div></form>`,
    true,
  );
  state.templateAlignment = new window.PhotoAlignment({
    source,
    frameWidth: state.templateDraft.imageWidth,
    frameHeight: state.templateDraft.imageHeight,
    onChange: templatePhotoAdjusted,
  });
  const editor = new window.LabelRegionEditor({
    container: $("#region-editor"),
    image: state.scanImage,
    canvas: state.templateAlignment.canvas,
    regions,
    onChange: (_regions, selected, reason) => {
      if (reason === "draw") state.templateDirtyRegions.delete(selected);
      renderRegionControls();
    },
  });
  state.regionEditor = editor;
  const viewport = document.createElement("div");
  viewport.className = "annotation-viewport";
  const photoContainer = $("#region-editor");
  photoContainer.before(viewport);
  viewport.append(photoContainer);
  viewport.insertAdjacentHTML("afterend", photoAdjustmentControls("template"));
  viewport.insertAdjacentHTML(
    "afterend",
    `<label class="photo-qr-toggle"><input id="template-read-qr" type="checkbox" ${readQR ? "checked" : ""}> Read QR codes together with selected text boxes</label>`,
  );
  viewport.insertAdjacentHTML(
    "afterend",
    `<label class="photo-qr-toggle"><input id="template-read-spool-info" type="checkbox" ${readSpoolInfo ? "checked" : ""}> Read Prusa spool details online (spool ID only; photos stay local)</label>`,
  );
  $(".template-reading-row").insertAdjacentHTML(
    "afterend",
    '<div id="template-catalog-results"></div>',
  );
  $(".template-reading-row").insertAdjacentHTML(
    "afterend",
    '<button type="button" class="btn small" data-action="match-template-fields">Find catalog matches from confirmed fields</button>',
  );
  state.templateAlignment.bind(editor.svg, () => editor.mode === "pan");
  setPhotoMode("template", "draw");
  if (inheritedView)
    state.templateAlignment.update(
      { contrast: inheritedView.contrast, sharpness: inheritedView.sharpness },
      false,
    );
  if (inheritedProcessing)
    state.templateAlignment.setProcessing(inheritedProcessing, false);
  updatePhotoControls("template");
  renderRegionControls();
}
function templatePhotoAdjusted() {
  state.templatePhotoRevision++;
  state.scanFields = null;
  state.scanColor = null;
  state.templateCatalogFields = null;
  state.templateOCRText = "";
  state.templateQRCodes = [];
  if ($("#template-catalog-results"))
    $("#template-catalog-results").innerHTML = "";
  for (const region of state.regionEditor?.regions || []) {
    region.recognizedText = "";
    if (!state.templateDirtyRegions.has(region.id)) region.value = "";
  }
  if ($("#template-status"))
    $("#template-status").textContent =
      "Photo adjusted. Read the fixed boxes again; any text you corrected by hand is kept.";
  updatePhotoControls("template");
  renderRegionControls();
}
function syncTemplatePhoto() {
  const alignment = state.templateAlignment;
  if (!alignment) return;
  state.templateDraft.exampleImage = alignment.exportImage();
  state.templateDraft.imageWidth = alignment.canvas.width;
  state.templateDraft.imageHeight = alignment.canvas.height;
}
function renderRegionControls() {
  const editor = state.regionEditor;
  if (!editor || !$("#region-list")) return;
  const fields = window.LabelRegionEditor.fields;
  $("#region-list").innerHTML = editor.regions.length
    ? editor.regions
        .map(
          (r) =>
            `<button type="button" class="region-list-item ${r.id === editor.selected ? "selected" : ""}" data-select-region="${esc(r.id)}"><span class="region-dot" style="background:${fields.find(([k]) => k === r.field)?.[2] || "#5da980"}"></span><span><strong>${esc(fields.find(([k]) => k === r.field)?.[1] || r.field)}</strong><small>${esc(r.value || "No confirmed text yet")}</small></span>${icon("chevron")}</button>`,
        )
        .join("")
    : '<p class="section-note">No fields mapped yet. Draw your first box or add one with coordinates.</p>';
  const region = editor.regions.find((r) => r.id === editor.selected);
  $("#read-regions").disabled = !editor.regions.length;
  if (!region) {
    $("#region-controls").innerHTML = "";
    return;
  }
  $("#region-field").value = region.field;
  $("#region-controls").innerHTML =
    `<div class="field"><label for="region-value">Confirmed text</label><input id="region-value" maxlength="200" value="${esc(region.value || "")}" placeholder="Type a correction, e.g. PLA Basic"><small>Optional. Enter what is printed in the selected box. Read boxes to fill it with local OCR.</small></div><details class="region-geometry"><summary>Adjust box coordinates (%)</summary><div class="region-coordinate-grid">${["x", "y", "width", "height"].map((k) => `<div class="field"><label for="region-${k}">${{ x: "Left", y: "Top", width: "Width", height: "Height" }[k]}</label><input id="region-${k}" type="number" min="${k === "width" || k === "height" ? 0.5 : 0}" max="100" step=".1" value="${Math.round(region[k] * 1000) / 10}"></div>`).join("")}</div></details><button type="button" class="text-link region-remove" data-action="remove-region">Remove selected box</button>`;
}
async function readTemplateRegions() {
  if (state.templateReading) {
    toast("Another label is being read. Please wait for it to finish.", true);
    return;
  }
  const editor = state.regionEditor;
  if (!editor?.regions.length) return;
  const button = $("#read-regions");
  button.disabled = true;
  state.templateReading = true;
  const snapshot = editor.regions.map((r) => ({ ...r }));
  const photoRevision = state.templatePhotoRevision;
  syncTemplatePhoto();
  $("#template-status").textContent = "Reading your selected regions locally…";
  try {
    const result = await api("/scan", {
      method: "POST",
      body: {
        image: state.templateDraft.exampleImage,
        qrImage: state.templateQRImage,
        readQR: $("#template-read-qr").checked,
        readSpoolInfo: $("#template-read-spool-info").checked,
        regions: snapshot.map(({ trainingValue, ...r }) => ({
          ...r,
          value: trainingValue ?? r.value,
        })),
        mode: "ocr",
        imageWidth: state.templateDraft.imageWidth,
        imageHeight: state.templateDraft.imageHeight,
      },
    });
    if (
      state.regionEditor !== editor ||
      photoRevision !== state.templatePhotoRevision ||
      !$("#template-status") ||
      !$("#modal").open
    )
      return;
    for (const read of result.regions || []) {
      const region = editor.regions.find(
        (r) => r.id === read.id || r.field === read.field,
      );
      const previous = snapshot.find((r) => r.id === region?.id);
      if (
        !region ||
        !previous ||
        ["x", "y", "width", "height"].some((k) => region[k] !== previous[k])
      )
        continue;
      region.recognizedText = read.text || "";
      if (!state.templateDirtyRegions.has(region.id))
        region.value = read.correctedText || read.text || "";
    }
    state.templateOCRText = result.text || "";
    state.templateQRCodes = (result.qr?.codes || []).map((c) => c.text);
    if (result.catalogMatch)
      $("#template-catalog-results").innerHTML = catalogCandidatesHTML(
        result.catalogMatch,
        "template",
      );
    $("#template-catalog-results").insertAdjacentHTML(
      "afterbegin",
      qrResultsHTML(result.qr),
    );
    renderRegionControls();
    $("#template-status").textContent =
      "Boxes read. Select each field and check its confirmed text before saving.";
  } catch (error) {
    if (
      state.regionEditor !== editor ||
      photoRevision !== state.templatePhotoRevision ||
      !$("#modal").open
    )
      return;
    if ($("#template-status"))
      $("#template-status").textContent = error.message;
    toast(error.message, true);
  } finally {
    button.disabled = false;
    state.templateReading = false;
  }
}
async function saveLabelTemplate(useForSpool) {
  const draft = state.templateDraft,
    editor = state.regionEditor;
  if (state.templateReading)
    throw new Error(
      "Wait for the selected boxes to finish reading before saving.",
    );
  if (!editor?.regions.length)
    throw new Error(
      "Draw at least one box. You can leave the other fields unmapped.",
    );
  syncTemplatePhoto();
  const payload = {
    name: $("#template-name").value.trim(),
    exampleImage: draft.exampleImage,
    imageWidth: draft.imageWidth,
    imageHeight: draft.imageHeight,
    regions: editor.regions.map(({ trainingValue, ...r }) => r),
  };
  const saved = await api(
    draft.id ? `/templates/${encodeURIComponent(draft.id)}` : "/templates",
    { method: draft.id ? "PATCH" : "POST", body: payload },
  );
  await refresh();
  if (useForSpool) {
    const fields = {
      ...(state.scanFields || {}),
      ...(state.templateCatalogFields || {}),
    };
    for (const region of editor.regions) {
      const keys =
        region.field === "temperatureRange"
          ? ["temperatureMin", "temperatureMax"]
          : region.field === "colorName"
            ? ["colorName", "colorHex"]
            : [region.field];
      keys.forEach((key) => delete fields[key]);
    }
    Object.assign(fields, saved.fields || {});
    if (
      state.templateCatalogFields?.colorHex &&
      fields.colorName?.toLowerCase() ===
        state.templateCatalogFields.colorName?.toLowerCase()
    )
      fields.colorHex = state.templateCatalogFields.colorHex;
    fields.name = [
      fields.brand,
      fields.productLine || fields.material,
      fields.colorName,
    ]
      .filter(Boolean)
      .join(" · ");
    openSpoolForm({
      ...fields,
      colorHex: state.scanColor || fields.colorHex,
      _scan: true,
      ocrText: state.templateOCRText || state.scanText,
      qrCodes: state.templateQRCodes || [],
      _catalog: Boolean(state.templateCatalogFields),
      _reviewPhoto: captureReviewPhoto("template"),
    });
  } else $("#modal").close();
  toast("Label template and example photo saved locally.");
}
function openPhone() {
  const urls = (state.network.urls || []).filter(
    (u) => !u.includes("localhost") && !u.includes("127.0.0.1"),
  );
  const url = (state.network.setupUrls || [])[0] || urls[0];
  openModal(
    "Your shelf, wherever you stand.",
    "Bring your phone along for the next spool.",
    (state.network.httpsPort
      ? `<p class="tip-banner">First time on this phone? The QR code opens certificate setup. Trust your server’s certificate, then open the HTTPS address below and install from Chrome.</p>${state.network.https?.fingerprint ? `<p class="section-note">Compare the certificate SHA-256 on your phone with this server: <code style="overflow-wrap:anywhere">${esc(state.network.https.fingerprint)}</code></p>` : ""}`
      : "") +
      `<div class="qr-layout">${url ? `<img class="qr" src="/api/qr?url=${encodeURIComponent(url)}" alt="QR code linking to ${esc(url)}">` : ""}<div><p class="danger-copy">Connect your phone to the same Wi-Fi as this computer, then scan the QR code or open the address below.</p>${urls.map((u) => `<a class="network-address" href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join("") || "<p>No Wi-Fi address detected. Connect this computer to your local network and restart the server.</p>"}</div></div><div class="tip-banner" style="margin-top:20px">${icon("camera")}<span>On your phone, tap <strong>Scan a spool</strong>, then <strong>Choose photo</strong> for your library or <strong>Take photo</strong> for the camera. The phone’s photo picker supports camera capture over local HTTP. Keep this computer and server running.</span></div><p class="section-note" style="line-height:1.8">If the address does not open, allow Node.js through Windows Firewall for private networks. This prototype has no login; use trusted Wi-Fi only.</p>`,
  );
}
function openGuide(dryOnly = false) {
  openModal(
    dryOnly
      ? "A little care for every material."
      : "Welcome to a more organized shelf.",
    dryOnly ? "How drying reminders work" : "A quick guide to Spoolspace",
    dryOnly
      ? `<p class="danger-copy">A drying reminder appears for an opened spool stored outside a sealed bag or dry box after its material’s estimated interval. Opening or logging drying resets that interval.</p><p class="danger-copy">These are planning reminders, not moisture measurements. Sealed storage can still contain moist filament. Check your filament and spool manufacturer’s instructions before drying, and log a cycle only after it finishes.</p><p class="danger-copy">Example intervals: PLA 30 days, PETG 14 days, TPU 7 days, PA 3 days. They are editable in the open-source code and are not manufacturer recommendations.</p>`
      : `<ol class="guide-list"><li><strong>Make the shelf yours.</strong> Explore the sample spools, then clear them in Settings and add your own.</li><li><strong>Add by hand or photo.</strong> Scan a label with local OCR, check the detected information, and choose a filament color.</li><li><strong>Keep track of every gram.</strong> Open a spool to subtract print usage, or weigh the spool and subtract its recorded empty-spool weight.</li><li><strong>Store and dry with care.</strong> Record storage, open dates, and completed drying cycles. Follow the manufacturer’s drying instructions.</li><li><strong>Take it into your slicer.</strong> Export a filament preset from any spool. Check its inherited print settings before using it.</li><li><strong>Keep a copy.</strong> Download a JSON backup in Settings before clearing or restoring your collection.</li></ol>`,
  );
}
function openPlanner() {
  const materials = [...new Set(state.spools.map((s) => s.material))].sort();
  openModal(
    "A spool for your next idea.",
    "Find filament with enough left for the job.",
    `<form id="planner-form"><div class="form-grid">${field("Material", "planMaterial", "Any material", { select: ["Any material", ...materials], full: true })}${field("Slicer estimate (g)", "planGrams", "", { type: "number", min: 0.1, max: 100000, required: true, placeholder: "Include supports and purge" })}${field("Extra allowance (%)", "planMargin", 10, { type: "number", min: 0, max: 100, required: true, help: "A little spare filament for estimation differences." })}</div><div class="form-actions"><button class="btn primary" type="submit">${icon("search")}Find matching spools</button></div></form><div id="planner-results" aria-live="polite"></div>`,
  );
}
function planPrint(values) {
  const estimate = Number(values.planGrams),
    margin = Number(values.planMargin);
  if (
    !Number.isFinite(estimate) ||
    estimate <= 0 ||
    !Number.isFinite(margin) ||
    margin < 0 ||
    margin > 100
  )
    throw new Error(
      "Enter a positive print weight and an allowance between 0 and 100%.",
    );
  const required = estimate * (1 + margin / 100);
  const matches = state.spools
    .filter(
      (s) =>
        s.status !== "empty" &&
        s.remainingWeight >= required &&
        (values.planMaterial === "Any material" ||
          s.material === values.planMaterial),
    )
    .sort(
      (a, b) =>
        Number(drying(a).due) - Number(drying(b).due) ||
        a.remainingWeight - b.remainingWeight,
    );
  $("#planner-results").innerHTML =
    `<div class="section-heading" style="margin-top:24px"><h2>${matches.length} matching ${matches.length === 1 ? "spool" : "spools"}</h2><span class="section-note">${num(required, 1)} g needed with allowance</span></div>${matches.length ? matches.map((s) => `<div class="select-spool-row"><div><strong>${esc(s.name)}</strong><p>${esc(s.brand)} · ${esc(s.colorName)} · ${grams(s.remainingWeight - required)} left after this print</p><p>${drying(s).due ? "Check drying before printing" : "Check condition and settings before printing"}${s.status === "in-use" ? " · Currently marked in use" : ""}</p></div><button class="btn small" data-detail="${esc(s.id)}">View spool ${icon("arrow")}</button></div>`).join("") : empty("A little short on filament.", "No single spool has enough for this estimate. Try another material or a smaller print.", "", "spool")}<p class="section-note" style="line-height:1.8;margin-top:15px">Matches consider stock, material, and your drying records. Check the material’s suitability for the part. Filament is only deducted when you log a completed print.</p>`;
}
function confirmModal(
  title,
  text,
  onConfirm,
  buttonText = "Confirm",
  danger = false,
) {
  openModal(
    title,
    "",
    `<p class="danger-copy">${text}</p><div class="form-actions"><button class="btn" data-action="close">Cancel</button><button class="btn ${danger ? "danger" : "primary"}" id="confirm-action">${buttonText}</button></div>`,
  );
  $("#confirm-action").addEventListener("click", async (event) => {
    event.target.disabled = true;
    try {
      await onConfirm();
    } catch (error) {
      toast(error.message, true);
      event.target.disabled = false;
    }
  });
}

document.addEventListener("click", async (event) => {
  const photoSurface = event.target.closest("#scan-preview, #region-editor");
  if (photoSurface) {
    const scope = photoSurface.id === "scan-preview" ? "scan" : "template";
    if (getPhotoAlignment(scope)?.cornerPoints) {
      markPhotoCorner(scope, event);
      return;
    }
  }
  const groupTrigger = event.target.closest("[data-open-group]");
  if (groupTrigger) {
    openSpoolGroup(groupTrigger.dataset.openGroup);
    return;
  }
  const startGroup = event.target.closest("[data-start-group]");
  if (startGroup) {
    const key = startGroup.dataset.startGroup,
      index = Number(startGroup.dataset.batchIndex),
      group = collectSpoolGroups(state.spools).find((item) => item.key === key),
      id = document.getElementById(`group-batch-${index}`)?.value;
    if (!group?.batches[index]?.spools.some((spool) => spool.id === id)) return;
    startGroup.disabled = true;
    try {
      await api(`/spools/${encodeURIComponent(id)}/start`, {
        method: "POST",
        body: {},
      });
      await refresh();
      if (startGroup.isConnected && $("#modal").open) openSpoolGroup(key, id);
      toast("One spool opened. Enter the filament used for your print.");
    } catch (error) {
      toast(error.message, true);
      startGroup.disabled = false;
    }
    return;
  }
  const catalogPick = event.target.closest("[data-catalog-pick]");
  if (catalogPick) {
    catalogPick.disabled = true;
    await pickCatalogProduct(
      catalogPick.dataset.catalogScope,
      Number(catalogPick.dataset.catalogPick),
    );
    catalogPick.disabled = false;
    return;
  }
  const photoMode = event.target.closest("[data-photo-mode]");
  if (photoMode) {
    setPhotoMode(photoMode.dataset.photoScope, photoMode.dataset.photoMode);
    return;
  }
  const photoAction = event.target.closest("[data-photo-command]");
  if (photoAction) {
    await photoCommand(
      photoAction.dataset.photoScope,
      photoAction.dataset.photoCommand,
    );
    return;
  }
  const editTemplate = event.target.closest("[data-edit-template]");
  if (editTemplate) {
    await editStoredTemplate(editTemplate.dataset.editTemplate);
    return;
  }
  const deleteTemplate = event.target.closest("[data-delete-template]");
  if (deleteTemplate) {
    const id = deleteTemplate.dataset.deleteTemplate;
    const template = state.templates.find((t) => t.id === id);
    confirmModal(
      "Remove this label template?",
      `<strong>${esc(template?.name || "This template")}</strong> and its saved photo will be removed. Existing inventory spools are kept.`,
      async () => {
        await api(`/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
        $("#modal").close();
        await refresh();
        toast("Label template removed.");
      },
      "Remove template",
      true,
    );
    return;
  }
  const selectRegion = event.target.closest("[data-select-region]");
  if (selectRegion) {
    state.regionEditor?.select(selectRegion.dataset.selectRegion);
    return;
  }
  const useTemplate = event.target.closest("[data-use-template]");
  if (useTemplate) {
    chooseScanTemplate(useTemplate.dataset.useTemplate);
    return;
  }
  const view = event.target.closest("[data-view]");
  if (view) {
    state.view = view.dataset.view;
    location.hash = state.view;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const layout = event.target.closest("[data-layout]");
  if (layout) {
    state.layout = layout.dataset.layout;
    try {
      localStorage.setItem("spoolspace-layout", state.layout);
    } catch {}
    render();
    return;
  }
  if (event.target.id === "photo-canvas") {
    sampleColor(event);
    return;
  }
  const tare = event.target.closest("[data-tare-option]");
  if (tare) {
    const value = state.tareOptions[Number(tare.dataset.tareOption)];
    if (value) {
      $("#f-emptySpoolWeight").value = value.grams;
      updateSpoolWeight();
      $("#tare-lookup").innerHTML = "";
      toast("Spool weight filled. Verify it against your actual spool.");
    }
    return;
  }
  const edit = event.target.closest("[data-edit]");
  if (edit && edit.tagName !== "FORM") {
    openSpoolForm(
      state.spools.find((s) => s.id === edit.dataset.edit),
      true,
    );
    return;
  }
  const del = event.target.closest("[data-delete]");
  if (del) {
    const s = state.spools.find((s) => s.id === del.dataset.delete);
    confirmModal(
      "Remove this spool?",
      `<strong>${esc(s.name)}</strong> will be removed from your collection. This cannot be undone.`,
      async () => {
        await api(`/spools/${encodeURIComponent(s.id)}`, { method: "DELETE" });
        $("#modal").close();
        await refresh();
        toast("Spool removed from your shelf.");
      },
      "Remove spool",
      true,
    );
    return;
  }
  const dry = event.target.closest("[data-dry]");
  if (dry) {
    openDry(dry.dataset.dry);
    return;
  }
  const exp = event.target.closest("[data-export]");
  if (exp) {
    openExport(exp.dataset.export);
    return;
  }
  const detail = event.target.closest("[data-detail]");
  if (detail) {
    openDetail(detail.dataset.detail, detail.dataset.groupParent || null);
    return;
  }
  const row = event.target.closest("[data-id]");
  if (row && !event.target.closest("form")) {
    openDetail(row.dataset.id);
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "add-material") {
    $("#custom-material-editor").classList.remove("hidden");
    $('[data-action="add-material"]').setAttribute("aria-expanded", "true");
    $("#custom-material-status").textContent = "";
    $("#custom-material-name").focus();
  }
  if (action === "cancel-material") closeMaterialEditor();
  if (action === "save-material") await saveCustomMaterial();
  if (action === "close") closeCurrentDialog();
  if (action === "update-filament-database") await updateFilamentDatabase();
  if (action === "open-filament-database") openCatalogBrowser();
  if (action === "catalog-from-form") openCatalogBrowser(true);
  if (action === "return-to-spool-form") returnToSpoolForm();
  if (action === "rematch-scan-text") await rematchScanText();
  if (action === "match-template-fields") await matchConfirmedTemplateFields();
  if (action === "mark-full-spool") {
    const weight = Number($("#f-initialWeight").value);
    if (weight > 0) {
      $("#f-grossWeight").value = "";
      updateSpoolWeight();
      $("#f-remainingWeight").value = weight;
    } else toast("Enter the full filament capacity first.", true);
  }
  if (action === "add") {
    const fromScan = Boolean($("#scan-zone") && state.scanAlignment);
    openSpoolForm(
      fromScan
        ? {
            ...state.scanFields,
            _scan: true,
            _reviewPhoto: captureReviewPhoto("scan"),
          }
        : {},
    );
  }
  if (action === "scan") openScan();
  if (action === "phone") openPhone();
  if (action === "guide") openGuide();
  if (action === "dry-guide") openGuide(true);
  if (action === "planner") openPlanner();
  if (action === "choose-photo") $("#scan-file").click();
  if (action === "take-photo") $("#camera-file").click();
  if (action === "teach-label") openTemplateEditor();
  if (action === "add-region") state.regionEditor?.add();
  if (action === "remove-region")
    state.regionEditor?.remove(state.regionEditor.selected);
  if (action === "read-regions") await readTemplateRegions();
  if (action === "read-label") await readLabel();
  if (action === "lookup-tare") await lookupTare();
  if (action === "scan-library" && state.scanMatch) {
    const s = state.scanMatch,
      f = state.scanFields;
    openSpoolForm({
      ...s,
      ...f,
      initialWeight: f.initialWeight || s.initialWeight,
      remainingWeight: f.initialWeight || s.initialWeight,
      emptySpoolWeight: f.emptySpoolWeight ?? s.emptySpoolWeight,
      colorHex: state.scanColor || f.colorHex || s.colorHex,
      lastDriedAt: "",
      openedDate: "",
      purchaseDate: "",
      status: "available",
      notes:
        "Photo matched a saved spool. Verify the same spool construction and tare weight.",
      _scan: true,
      _reviewPhoto: captureReviewPhoto("scan"),
    });
  }
  if (action === "refresh") {
    try {
      await refresh();
      toast("Your shelf is up to date.");
    } catch (error) {
      toast(error.message, true);
    }
  }
  if (action === "clear-demo")
    confirmModal(
      "Start with an empty shelf?",
      "This removes <strong>all current spools and activity</strong>, including any changes or spools you’ve added. Download a backup in Settings first if you want to keep them.",
      async () => {
        await api("/demo/clear", { method: "POST", body: {} });
        $("#modal").close();
        await refresh();
        toast("A fresh shelf, ready for your collection.");
      },
      "Clear inventory",
      true,
    );
});
document.addEventListener("keydown", (event) => {
  if (
    event.target.id === "custom-material-name" &&
    (event.key === "Enter" || event.key === "Escape")
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Enter") void saveCustomMaterial();
    else closeMaterialEditor();
    return;
  }
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches("[data-id]:not(form), [data-open-group][role=button]")
  ) {
    event.preventDefault();
    if (event.target.dataset.openGroup)
      openSpoolGroup(event.target.dataset.openGroup);
    else openDetail(event.target.dataset.id);
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "custom-material-name")
    event.target.setCustomValidity("");
  if (
    ["f-grossWeight", "f-emptySpoolWeight", "f-initialWeight"].includes(
      event.target.id,
    )
  )
    updateSpoolWeight();
  if (event.target.id === "f-colorHex")
    event.target.dataset.needsReview = "false";
  if (event.target.matches("[data-photo-value]")) {
    changePhotoControl(event.target);
    return;
  }
  if (event.target.id === "region-value") {
    const editor = state.regionEditor,
      region = editor?.regions.find((r) => r.id === editor.selected);
    if (region) {
      region.value = event.target.value;
      state.templateDirtyRegions.add(region.id);
      const row = [...document.querySelectorAll("[data-select-region]")].find(
        (r) => r.dataset.selectRegion === region.id,
      );
      if (row)
        row.querySelector("small").textContent =
          region.value || "No confirmed text yet";
    }
  }
  if (event.target.id === "search") {
    state.query = event.target.value;
    renderInventory();
  }
});
document.addEventListener("change", async (event) => {
  const el = event.target;
  if (el.id === "scan-read-qr" || el.id === "scan-read-spool-info") {
    scanPhotoAdjusted();
    return;
  }
  if (el.id === "template-read-qr" || el.id === "template-read-spool-info") {
    templatePhotoAdjusted();
    return;
  }
  if (el.dataset.photoProcessing) {
    getPhotoAlignment(el.dataset.photoProcessing)?.setProcessing(el.value);
    return;
  }
  if (
    ["f-grossWeight", "f-emptySpoolWeight", "f-initialWeight"].includes(el.id)
  )
    updateSpoolWeight();
  if (el.id === "ofd-auto-update") {
    el.disabled = true;
    try {
      state.filamentDatabase = await api("/filament-database/settings", {
        method: "PATCH",
        body: { autoUpdate: el.checked },
      });
      renderCatalogStatus();
    } catch (error) {
      toast(error.message, true);
      renderCatalogStatus();
    }
    return;
  }
  if (el.matches("[data-photo-value]")) {
    changePhotoControl(el);
    return;
  }
  if (el.id === "filter-material") {
    state.material = el.value;
    renderInventory();
  }
  if (el.id === "filter-stock") {
    state.stock = el.value;
    renderInventory();
  }
  if (el.id === "sort") {
    state.sort = el.value;
    renderInventory();
  }
  if (el.id === "scan-file" || el.id === "camera-file") {
    await loadPhoto(el.files[0]);
    el.value = "";
  }
  if (el.id === "scan-template") chooseScanTemplate(el.value);
  if (el.id === "region-field") {
    const editor = state.regionEditor;
    if (editor) {
      editor.field = el.value;
      const found = editor.regions.find((r) => r.field === el.value);
      editor.selected = found?.id || null;
      editor.changed();
    }
  }
  if (
    ["region-x", "region-y", "region-width", "region-height"].includes(el.id)
  ) {
    state.regionEditor?.bounds(
      Object.fromEntries(
        ["x", "y", "width", "height"].map((k) => [
          k,
          Number($("#region-" + k).value) / 100,
        ]),
      ),
    );
  }
  if (el.id === "f-status" && el.value === "empty") {
    $("#f-grossWeight").value = "";
    updateSpoolWeight();
    $("#f-remainingWeight").value = 0;
  }
  if (el.id === "scan-mode" && state.scanImage) {
    state.scanSequence++;
    state.scanFields = null;
    $("#read-label").innerHTML = icon("scan") + "Read label";
    $("#scan-status").textContent =
      "Read the photo with the selected recognition method.";
  }
  if (el.id === "f-format") {
    const prusa = el.value === "PrusaSlicer";
    $("#f-parent").required = !prusa;
    $("#f-parent").closest(".field").classList.toggle("hidden", prusa);
    $("#f-printer").closest(".field").classList.toggle("hidden", prusa);
  }
  if (el.id === "restore-file" && el.files[0]) {
    try {
      if (el.files[0].size > 38 * 1024 * 1024)
        throw new Error("Backup must be smaller than 38 MB.");
      const data = JSON.parse(await el.files[0].text());
      if (data.version !== 1 || !Array.isArray(data.spools))
        throw new Error("Choose a valid Spoolspace version 1 backup.");
      confirmModal(
        "Replace your current collection?",
        `Restore <strong>${data.spools.length} spools</strong> from this backup? Your current inventory and history will be replaced.${Array.isArray(data.customFilaments) ? ` Your custom filament catalog will be replaced with ${data.customFilaments.length} entries from the backup.` : " Your existing custom catalog will be kept."} Download a backup of your current collection first if needed.`,
        async () => {
          await api("/restore", { method: "POST", body: data });
          $("#modal").close();
          state.query = "";
          state.material = "all";
          state.stock = "all";
          await refresh();
          toast("Your collection has been restored.");
        },
        "Restore backup",
        true,
      );
    } catch (error) {
      toast(error.message, true);
    }
    el.value = "";
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  const groupUsage = form.classList.contains("group-usage-form");
  if (
    ![
      "spool-form",
      "usage-form",
      "weigh-form",
      "dry-form",
      "export-form",
      "settings-form",
      "planner-form",
      "template-form",
      "ofd-search-form",
      "ofd-match-form",
    ].includes(form.id) &&
    !groupUsage
  )
    return;
  event.preventDefault();
  if (form.dataset.submitting === "true") return;
  form.dataset.submitting = "true";
  const values = Object.fromEntries(new FormData(form)),
    button = form.querySelector("button[type=submit]");
  const submitButtons = [...form.querySelectorAll("button[type=submit]")];
  submitButtons.forEach((b) => (b.disabled = true));
  try {
    if (groupUsage) {
      await api(`/spools/${encodeURIComponent(form.dataset.id)}/usage`, {
        method: "POST",
        body: { grams: Number(values.grams) },
      });
      await refresh();
      if (form.isConnected && $("#modal").open)
        openSpoolGroup(form.dataset.groupKey, form.dataset.id);
      toast("Print logged for this spool.");
      return;
    }
    if (form.id === "ofd-search-form" || form.id === "ofd-match-form") {
      await searchCatalog(values, form.id === "ofd-match-form");
      return;
    }
    if (form.id === "template-form") {
      await saveLabelTemplate(event.submitter?.dataset.useSpool === "true");
      return;
    }
    if (form.id === "planner-form") {
      planPrint(values);
      return;
    }
    if (form.id === "export-form") {
      const format =
        values.format === "Bambu Studio"
          ? "bambu"
          : values.format === "OrcaSlicer"
            ? "orca"
            : "prusa";
      const response = await fetch(
        `/api/export/${encodeURIComponent(form.dataset.id)}?${new URLSearchParams({ format, parent: values.parent, printer: values.printer })}`,
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed.");
      }
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      const disposition = response.headers.get("Content-Disposition") || "";
      link.download =
        disposition.match(/filename="?([^";]+)"?/)?.[1] ||
        `spoolspace-${format}.${format === "prusa" ? "ini" : "json"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      closeCurrentDialog();
      toast("Preset downloaded. Import and review it in your slicer.");
      return;
    }
    if (form.id === "spool-form") {
      values.qrCodes = JSON.parse(values.qrCodes || "[]");
      const weightError = updateSpoolWeight();
      if (weightError) throw new Error(weightError);
      values.remainingWeight = $("#f-remainingWeight").value;
      delete values.grossWeight;
      if (
        !String(values.initialWeight ?? "").trim() ||
        !String(values.remainingWeight ?? "").trim()
      )
        throw new Error(
          "Enter the full filament capacity and the actual remaining weight, or confirm a new full spool.",
        );
      if ($("#f-colorHex").dataset.needsReview === "true")
        throw new Error(
          "The catalog has no HEX color. Choose a color manually to confirm it before saving.",
        );
      ["temperatureMin", "temperatureMax"].forEach(
        (k) => (values[k] = values[k]?.trim() ? Number(values[k]) : null),
      );
      ["initialWeight", "remainingWeight", "emptySpoolWeight"].forEach(
        (k) => (values[k] = Number(values[k] || 0)),
      );
      if (values.initialWeight <= 0)
        throw new Error("Full filament weight must be greater than zero.");
      if (values.remainingWeight > values.initialWeight)
        throw new Error(
          "Remaining filament cannot exceed the full filament weight.",
        );
      const id = form.dataset.edit;
      await api(id ? `/spools/${encodeURIComponent(id)}` : "/spools", {
        method: id ? "PATCH" : "POST",
        body: values,
      });
      $("#modal").close();
      await refresh();
      toast(id ? "Spool details updated." : "A new spool, right at home.");
    }
    if (
      form.id === "usage-form" ||
      form.id === "weigh-form" ||
      form.id === "dry-form"
    ) {
      Object.keys(values).forEach((k) => (values[k] = Number(values[k])));
      const action =
        form.id === "usage-form"
          ? "usage"
          : form.id === "weigh-form"
            ? "weigh"
            : "dry";
      await api(`/spools/${encodeURIComponent(form.dataset.id)}/${action}`, {
        method: "POST",
        body: values,
      });
      await refresh();
      if (action === "dry") $("#modal").close();
      else if (form.dataset.groupKey)
        openSpoolGroup(form.dataset.groupKey, form.dataset.id);
      else openDetail(form.dataset.id);
      toast(
        action === "usage"
          ? "Print logged. Every gram accounted for."
          : action === "weigh"
            ? "Weight updated from your scale reading."
            : "Drying cycle recorded. Fresh start!",
      );
    }
    if (form.id === "settings-form") {
      values.lowStockThreshold = Number(values.lowStockThreshold);
      await api("/settings", { method: "PATCH", body: values });
      await refresh();
      toast("Workspace preferences saved.");
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    delete form.dataset.submitting;
    submitButtons.forEach((b) => (b.disabled = false));
  }
});
$("#modal").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeCurrentDialog();
});
window.addEventListener("hashchange", () => {
  const v = location.hash.slice(1);
  if (views[v] && state.view !== v) {
    state.view = v;
    render();
  }
});
async function init() {
  const view = location.hash.slice(1);
  if (views[view]) state.view = view;
  try {
    const layout = localStorage.getItem("spoolspace-layout");
    if (["grid", "list"].includes(layout)) state.layout = layout;
  } catch {}
  try {
    await refresh();
  } catch (error) {
    $("#app").innerHTML =
      `<div class="content"><div class="connection-error"><strong>Your local server needs a moment.</strong><p>${esc(error.message)}</p><p>Make sure Spoolspace is running, then refresh this page.</p><button class="btn" data-action="refresh">Try again</button></div></div>`;
  }
}
init();
