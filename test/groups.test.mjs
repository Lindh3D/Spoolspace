import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../lib/store.mjs";
import { createApp } from "../server.mjs";
const spool = {
  name: "PLA stock",
  brand: "My brand",
  material: "PLA",
  colorName: "Black",
  colorHex: "#000000",
  initialWeight: 1000,
  remainingWeight: 1000,
  emptySpoolWeight: 238,
};

test("opening and using one physical spool preserves its siblings and persists its individual history", () => {
  const directory = mkdtempSync(join(tmpdir(), "spoolspace-groups-")),
    path = join(directory, "inventory.sqlite");
  let store = createStore(path, { seed: false });
  try {
    const first = store.add(spool),
      second = store.add(spool);
    const opened = store.start(first.id);
    assert.equal(opened.remainingWeight, 1000);
    assert.equal(opened.status, "in-use");
    assert.ok(opened.openedDate);
    store.start(first.id);
    assert.equal(store.activity().filter((a) => a.type === "opened").length, 1);
    const used = store.use(first.id, { grams: 42.5 });
    assert.equal(used.remainingWeight, 957.5);
    assert.equal(used.openedDate, opened.openedDate);
    assert.deepEqual(store.get(second.id), second);
    assert.throws(() => store.use(first.id, { grams: 1000 }));
    assert.equal(store.get(first.id).remainingWeight, 957.5);
    const backup = store.backup();
    store.restore(backup);
    const restoredSecond = store.get(second.id);
    store.close();
    store = createStore(path, { seed: false });
    assert.equal(store.get(first.id).remainingWeight, 957.5);
    assert.deepEqual(store.get(second.id), restoredSecond);
    assert.equal(store.list().length, 2);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("logging a first print marks only that spool opened, and an exhausted spool becomes empty", () => {
  const store = createStore(":memory:", { seed: false });
  try {
    const first = store.add(spool),
      second = store.add(spool);
    const used = store.use(first.id, { grams: 1000 });
    assert.equal(used.status, "empty");
    assert.ok(used.openedDate);
    assert.equal(used.remainingWeight, 0);
    assert.throws(() => store.start(first.id), /empty spool/);
    assert.equal(store.get(second.id).status, "available");
    assert.equal(store.get(second.id).openedDate, "");
    assert.equal(store.get(second.id).remainingWeight, 1000);
  } finally {
    store.close();
  }
});

test("the start and usage endpoints update a selected spool without reducing group stock twice", async (t) => {
  const app = createApp({
    database: ":memory:",
    seed: false,
    host: "127.0.0.1",
    port: 0,
  });
  const address = await app.listen();
  t.after(() => app.close());
  const base = `http://127.0.0.1:${address.port}`,
    post = (path, body = {}) =>
      fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
  const a = await (await post("/api/spools", spool)).json(),
    b = await (await post("/api/spools", spool)).json();
  const started = await post(`/api/spools/${a.id}/start`);
  assert.equal(started.status, 200);
  assert.equal((await started.json()).remainingWeight, 1000);
  const used = await post(`/api/spools/${a.id}/usage`, { grams: 125 });
  assert.equal((await used.json()).remainingWeight, 875);
  const data = await (await fetch(base + "/api/spools")).json();
  assert.equal(data.find((s) => s.id === b.id).remainingWeight, 1000);
  assert.equal(data.find((s) => s.id === b.id).openedDate, "");
  assert.equal(
    data.reduce((total, s) => total + s.remainingWeight, 0),
    1875,
  );
});
