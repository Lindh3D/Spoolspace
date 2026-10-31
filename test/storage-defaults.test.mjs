import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../lib/store.mjs";

test("saved storage defaults survive restart and backup restore without retaining spool-specific fields", () => {
  const directory = mkdtempSync(join(tmpdir(), "spoolspace-storage-"));
  const path = join(directory, "inventory.sqlite");
  let store = createStore(path, { seed: false });
  try {
    store.add({
      name: "My spool",
      location: " Cabinet C ",
      storage: "Dry box",
      notes: "Do not copy",
      remainingWeight: 800,
    });
    const expected = { location: "Cabinet C", storage: "Dry box" };
    assert.deepEqual(store.settings().spoolDefaults, expected);
    const backup = store.backup();
    store.close();
    store = createStore(path, { seed: false });
    assert.deepEqual(store.settings().spoolDefaults, expected);
    store.add({ name: "Elsewhere", location: "Shelf", storage: "Open shelf" });
    store.restore(backup);
    assert.deepEqual(store.settings().spoolDefaults, expected);
    assert.throws(() =>
      store.restore({
        ...backup,
        settings: { spoolDefaults: { location: [], storage: "Dry box" } },
      }),
    );
    assert.deepEqual(store.settings().spoolDefaults, expected);
    assert.equal(store.list().length, 1);
    assert.throws(() =>
      store.add({ name: "Invalid", location: "Other", remainingWeight: -1 }),
    );
    assert.deepEqual(store.settings().spoolDefaults, expected);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("only changed storage settings on edits replace remembered values; demo stock does not supply defaults", () => {
  const store = createStore(":memory:", { seed: true });
  try {
    assert.equal(store.settings().spoolDefaults, null);
    store.clearDemo();
    const old = store.add({
      name: "Old spool",
      location: "Shelf A",
      storage: "Open shelf",
    });
    store.add({ name: "New spool", location: "Cabinet B", storage: "Dry box" });
    store.update(old.id, { ...old, notes: "A note" });
    store.use(old.id, { grams: 20 });
    assert.deepEqual(store.settings().spoolDefaults, {
      location: "Cabinet B",
      storage: "Dry box",
    });
    store.update(old.id, { location: "", storage: "Sealed bag" });
    assert.deepEqual(store.settings().spoolDefaults, {
      location: "",
      storage: "Sealed bag",
    });
  } finally {
    store.close();
  }
});
