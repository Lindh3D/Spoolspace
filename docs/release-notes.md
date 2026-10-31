# Spoolspace 0.5.3

Returns to HTTP by default for local-network use. Windows opens `http://localhost:4173`; phone QR codes open the app directly. No certificates are generated or requested in HTTP mode. Phone settings explain Home Screen shortcuts without displaying a non-working install button.

The installer also switches existing configurations to HTTP, preserving the inventory, Windows startup choice, paths, ports and all other settings. The original configuration is backed up before the first change. Existing certificate files and device trust are retained but unused. HTTPS remains an explicit advanced opt-in, and an off setting takes precedence over saved certificate paths.

## Spoolspace 0.5.2

HTTPS is now the default for Windows and source launches, including local IP addresses. A unique local CA signs certificates for localhost/current LAN addresses; the server renews leaf certificates without replacing the CA. HTTP redirects to HTTPS and rejects inventory writes. A read-only `/connect` page and public certificate download make first-time phone trust possible before HTTPS is trusted. The Windows launcher offers an explicit current-user certificate trust prompt; background/service launches never modify trust.

Android installation shows an Install button only when the browser provides a real prompt, displays service-worker errors and provides certificate/Chrome guidance. Phone QR codes now lead to first-time certificate setup, while advertised app addresses use HTTPS. Certificate keys remain outside release packages and inventory backups.

Tests cover verified certificate chains for localhost/LAN IPs, persistence/renewal, default supervised HTTPS launch, redirects, HTTP write refusal, public-only certificate download and install prompt/error handling. Android installation, OS certificate import and the Windows trust dialog still require device/installed-PC checks; browser installation cannot be forced by the app.

## Spoolspace 0.5.1

Adds **Settings → Windows startup** to switch an installed copy between manual, background at sign-in and server-at-boot modes. A registered local link opens a Windows review dialog and requests administrator permission only when saving. The current server keeps running; the chosen mode applies at the next Windows startup. Settings reads the real Windows configuration and can refresh after a change. The notification-area menu opens the same dialog.

Startup transitions have native tests for all mode combinations, rollback, invalid activation links and refusing unrelated service/startup entries, without changing the test computer's configuration. Desktop browser protocol activation, the UAC interaction, installed service changes and reboot behavior still require an installed Windows/VM check.

## Spoolspace 0.5.0

Windows installer with bundled Node.js runtime, desktop shortcut, notification-area launcher, sign-in background mode and optional boot-time Windows service. Data is stored separately and retained across upgrades/uninstall. A portable Windows package and clean source archive are also supplied.

Phone Home Screen/PWA manifest and icons, installation guidance, offline connection page, and optional native HTTPS with configured certificates. Inventory and mutations remain on the home server.

Includes spool grouping, remaining-weight tracking, custom catalogs protected from OFD updates, photo/template alignment, local OCR and QR decoding, and optional Prusa spool-report enrichment.

This is an unsigned prototype release. Windows service installation/reboot, firewall, upgrade/uninstall and physical phone installation still need validation in a disposable VM/device setup before a stable public release. Do not expose the unauthenticated server directly to the internet. Back up existing inventories before migration.
