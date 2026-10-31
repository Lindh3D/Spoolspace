import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

test(
  "Windows build hashes and extracts without Get-FileHash or Expand-Archive, releases handles and rejects corrupt archives",
  { skip: process.platform !== "win32" },
  () => {
    const directory = mkdtempSync(join(tmpdir(), "spoolspace-build-tools-"));
    try {
      const output = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          fileURLToPath(new URL("./windows-build-tools.ps1", import.meta.url)),
          "-Helper",
          fileURLToPath(
            new URL("../scripts/windows-build-tools.ps1", import.meta.url),
          ),
          "-Scratch",
          directory,
        ],
        { encoding: "utf8", windowsHide: true, timeout: 30000 },
      );
      const result = JSON.parse(output.trim());
      assert.equal(
        result.hash,
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      );
      assert.equal(
        result.emptyHash,
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      );
      assert.equal(result.extracted, "archive fixture");
      assert.equal(result.corruptRejected, true);
    } finally {
      rmSync(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    }
  },
);
