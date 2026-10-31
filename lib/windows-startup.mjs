import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
const modes = new Set(["manual", "login", "service"]);

// Read-only bridge. Windows changes happen in the interactive desktop helper,
// never under the web server's (possibly LocalService) identity.
export async function windowsStartupStatus({
  platform = process.platform,
  executable = process.env.SPOOLSPACE_WINDOWS_EXE,
  run = execute,
} = {}) {
  if (platform !== "win32" || !executable)
    return { installed: false, mode: null };
  try {
    const { stdout } = await run(executable, ["--startup-status"], {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 8192,
    });
    const status = JSON.parse(stdout.trim());
    if (!status.installed) return { installed: false, mode: null };
    if (!modes.has(status.mode)) throw new Error("Invalid startup mode");
    return {
      installed: true,
      mode: status.mode,
      conflict: status.conflict === true,
    };
  } catch {
    return {
      installed: true,
      mode: null,
      error:
        "Windows startup settings could not be read. Open Windows startup settings from the Spoolspace notification-area menu.",
    };
  }
}

export function isLocalStartupClient(address, hostname) {
  return (
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname.toLowerCase())
  );
}
