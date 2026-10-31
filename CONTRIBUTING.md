# Contributing to Spoolspace

Spoolspace is MIT-licensed. Bug reports, tested fixes, accessibility improvements and additional label/provider support are welcome.

Use Node.js 24 or later, run `npm ci`, then `npm test` and `npm run check`. Start development with `npm run dev`. Use temporary databases in tests. Never commit inventory, photos, backups, TLS private keys, `.env`, `node_modules`, or installer build caches. Report camera/browser behavior with the browser, OS and a non-sensitive sample label.

Recognition must remain reviewable. Keep base polymer, marketed range, formulation and exact color separate. Preserve confirmed corrections and original evidence; never derive remaining filament from a photo or the manufacturer's original weight. Custom products must remain independent of the replaceable OFD cache.

For Windows release builds, see [the packaging guide](docs/windows-installation.md). Build the installer from a clean checkout and locked dependencies. The build verifies its downloaded tools and tests the staged runtime before compiling the installer. Changes to installer services, permissions and upgrades should also be exercised in a disposable Windows VM before a public stable release.
