# Windows installation and home-server hosting

## Install

Run `Spoolspace-Setup-0.5.3-win-x64.exe`. This is a Windows 10/11 x64 package, also designed for Windows Server with .NET Framework available. It contains Node.js 24 and the production dependencies: end users do not install Node or npm. Windows asks for administrator privileges to install program files and the optional service/firewall rule.

Choose a desktop shortcut and one startup mode:

- **Manual:** the shortcut starts a hidden local server and opens the browser. Closing the browser leaves the server in the notification area. Use **Stop server and exit** there to stop it.
- **At sign-in:** the same background launcher starts at Windows user sign-in. Open the desktop shortcut to view the app.
- **Windows service:** starts at computer boot without anyone signing in. The service is called **Spoolspace** and runs as **LocalService**. Start/stop it in Windows Services. The desktop shortcut opens its existing web interface.

The optional firewall rule is limited to the bundled runtime, ports 4173/4174, the private network profile and local subnet. The installer never enables public-internet access.

Program files go to `C:\Program Files\Spoolspace`. Inventory, custom products, templates, caches and logs go to `C:\ProgramData\Spoolspace`. Configuration is `C:\ProgramData\Spoolspace\config.json`. Upgrades retain this file and the inventory. Uninstall removes the program, service, autostart entry and its firewall rule, while keeping data. Make inventory backups before upgrades.

For an unattended install, use `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /STARTUP=service`; the other startup values are `manual` and `login`. Desktop and private-LAN firewall tasks can be selected with `/TASKS="desktopicon,firewall"`.

## Change Windows startup after installation

On the Windows computer running Spoolspace, open `http://localhost:4173` (use your configured port) and go to **Settings → Windows startup**. The panel reads the actual Windows service and sign-in entry, rather than a copied inventory preference. Choose manual, background at sign-in, or server at Windows startup, then click **Review and apply in Windows**. Allow the browser to open Spoolspace, save in the desktop dialog, and accept Windows' administrator prompt. Return to Settings and click **Refresh setting** to see the saved choice. The same dialog is available from **Windows startup settings** in the notification-area menu.

Changes take effect at the **next Windows startup**. The running server and inventory are left in place. When switching away from service mode, the existing service is disabled for future startup; it is not stopped during your session. When switching to service mode, the service is created/enabled but starts at the next boot. Until then, the desktop shortcut can still start the tray server. Cancelling the desktop dialog or administrator prompt makes no change. Failed saves attempt to restore previous startup settings and report any recovery failure.

The installer registers the `spoolspace://startup` link used to open this local dialog. The web server only reads startup configuration; it does not perform privileged writes or try to display administrator prompts from a Windows service. Phone/LAN clients can view the setting but must use the Windows computer's localhost page to change it. Portable/source versions explain that installation is required. Custom data directories or TLS keys still need LocalService permissions configured by their owner; the startup dialog only grants access to the installed `C:\ProgramData\Spoolspace` folder.

To update an existing installation, download an inventory backup, stop the tray server if it is running, and run the 0.5.3 installer over the existing installation. This release sets `httpsMode` to `off`, including for existing 0.5.2 installations. All other configuration, inventory and Windows startup choices are retained. The first changed configuration is backed up to `config.json.before-http.json`. No inventory restore is needed. Existing certificate files and device trust are left in place but are not used for HTTP; no new certificates or trust prompts are required. Open the HTTP address after updating, and replace any old HTTPS bookmark or Home Screen shortcut.

Existing source/development users: export a backup from the old instance, stop it so port 4173 is available, install, and restore the backup into the new instance. The installer does not copy, move, or bundle your existing project's `data` folder. Keep it until you have verified the restored inventory.

## Configuration

`config.example.json` documents the configuration fields. The tray menu opens the active configuration file. Stop and restart the tray server, or restart the Windows service, after changes. `host` defaults to `0.0.0.0` for home-Wi-Fi access; choose `127.0.0.1` for this PC only. If you change ports, update your private firewall rule too.

The portable ZIP includes the same runtime and launcher. Extract it to a writable folder and run `Spoolspace.exe`. A portable copy keeps its own `data` directory beside the executable. Do not run an installed and portable instance on the same port. Their inventories are separate unless you intentionally configure the same data folder; only one server should own it.

## Phone Home Screen

HTTP is the default for installed, portable and source launches. Open `http://localhost:4173` on the server or `http://<server-ip>:4173` on the phone. The phone QR code links directly to the app. No certificate setup is needed. Use only a trusted home network.

Android: open the address in Chrome → ⋮ → Add to Home screen → Create shortcut (or the available Home Screen option). iPhone/iPad: Safari → Share → Add to Home Screen. The **Use on your phone** panel gives these steps. Full browser-promoted PWA installation and service workers may be unavailable over HTTP; the app does not show a non-working Install button. Keep the home server running and use the same Wi-Fi when opening the shortcut.

### Optional HTTPS

HTTPS remains an explicit advanced option: set `"httpsMode":"auto"` in Windows config or `HTTPS_MODE=auto` in a source `.env`, then restart. Previously copied `.env` files from 0.5.2 must instead be set to `HTTPS_MODE=off` to return to HTTP. When opted into HTTPS, Spoolspace creates a unique local certificate authority and server certificate in the active data folder's `https` directory. The desktop shortcut opens `https://localhost:4174`; phone addresses use `https://<server-ip>:4174`. In this mode only, HTTP redirects the app to HTTPS and refuses inventory writes; the read-only health endpoint, public certificate and `/connect` setup page remain accessible over HTTP. The rest of this subsection applies only when HTTPS is explicitly enabled.

**A locally generated certificate is not automatically trusted by a phone.** Trust the public CA once on each device. Bypassing a browser warning does not complete this step and may block service workers and installation.

1. Open **Connect your phone** on the Windows computer and scan its QR code. It opens `http://<server-ip>:4173/connect`, which works before certificate trust is set up.
2. Download **Spoolspace-Local-CA.crt**. Compare its SHA-256 fingerprint with the one shown on your Windows computer. This is the public certificate; private keys are never downloaded.
3. Android: open system Settings → Security & privacy → More security settings → Encryption & credentials → Install a certificate → **CA certificate**. Select the downloaded certificate. Menu names vary; search Settings for “CA certificate”. A screen-lock PIN and Android's trust confirmation may be required. On managed phones, your administrator may restrict this setting.
4. Fully close/reopen Chrome if needed, then open the HTTPS address shown on the setup page. There must be no certificate warning. Use normal Chrome, not Incognito or an embedded browser.
5. Go to **Settings → Install on your phone**. Interact with the page and leave it open for at least 30 seconds. **Install Spoolspace** appears only when Chrome actually supplies its install prompt. Otherwise try Chrome's ⋮ menu → Add to Home screen → Install. A shortcut is different from an installed app. Chrome/Android ultimately controls the available installation flow; a web page cannot force it. Some devices/managed browsers may not offer a full installed app even after HTTPS setup.

On iPhone/iPad, install the downloaded profile through Settings and enable full trust under General → About → Certificate Trust Settings. Then use Safari → Share → Add to Home Screen, enabling Open as Web App where offered.

On Windows, a desktop launch offers to trust the app's local CA **for the current Windows account**, showing its fingerprint and asking Yes/No. No trust is added without accepting. The notification-area menu can open this prompt later. Services/background startup never change certificate trust or display trust prompts. Source users can open `/connect` and import the public certificate into their own trusted root store manually. Trusting a CA authorizes it to issue certificates your device accepts: only trust your own server after checking its fingerprint. The CA files persist across upgrades/uninstall; remove its trust manually in your device's certificate settings if retiring the server.

Certificates cover localhost, the computer's DNS names, configured allowed hosts and current LAN IP addresses. Server certificates last 90 days and are renewed before expiry; a running server checks every six hours. The CA stays the same, so ordinary leaf renewal does not require trusting again. A restart also refreshes certificates for changed IPs. Reserve the server's address in your router so the installed app keeps the same origin. Do not delete the CA key or replace the authority casually: doing so requires trusting a new certificate on all devices. Keep `data/https` private and out of GitHub. Inventory JSON backups do not include certificate keys.

The panel reports service-worker errors instead of hiding them. The offline page explains when the home server cannot be reached; inventory APIs, scans and writes are never cached or queued offline. Android phone installation and the Windows trust dialog still need physical device/installed-PC verification; automated tests verify real TLS with the generated CA, redirects and prompt/error behavior.

### Use your own certificate or reverse proxy

You can supply a certificate already trusted by your devices, covering your server's DNS name, with absolute PEM paths:

```json
{
  "port": 4173,
  "host": "0.0.0.0",
  "dataDir": "%ProgramData%\\Spoolspace",
  "httpsPort": 4174,
  "httpsMode": "auto",
  "tlsCertFile": "C:\\SpoolspaceCertificates\\server.crt",
  "tlsKeyFile": "C:\\SpoolspaceCertificates\\server.key",
  "allowedHosts": ["spool.home.arpa"]
}
```

Arrange local DNS for `spool.home.arpa` and open `https://spool.home.arpa:4174` on the phone. The LocalService account needs read access to these certificate files; keep the private key outside GitHub and restrict its file permissions. Custom certificate provisioning and phone trust remain managed by you; Spoolspace never bypasses certificate validation or silently installs a phone root.

For source installs, set `HTTPS_MODE=auto` to use `TLS_CERT_FILE`, `TLS_KEY_FILE`, `HTTPS_PORT` and comma-separated `ALLOWED_HOSTS` in `.env`. The default is `HTTPS_MODE=off`; saved certificate paths are ignored while off. A reverse proxy can terminate HTTPS instead: keep `HTTPS_MODE=off` (or `"httpsMode":"off"` in Windows config), preserve the Host header and allow its hostname. This application has no reverse-proxy authentication feature; choose a trusted home-network deployment.

## Build and publish

On Windows, use Node.js 24+, `npm ci`, `npm test`, `npm run check`, then `npm run build:windows`. The build downloads pinned official Node and Inno Setup tools, verifies their SHA-256 values, and extracts the compiler in portable mode inside `tmp/toolchain`. Inno Setup is not installed system-wide. The .NET Framework compiler supplied by Windows builds the tray/service launcher. `npm run build:icons` regenerates icons from the existing SVG.

Outputs in `releases/`:

- `Spoolspace-Setup-<version>-win-x64.exe`
- `Spoolspace-<version>-win-x64.zip`
- `spoolspace-<version>-source.zip`
- `SHA256SUMS.txt`

The source ZIP is assembled from a fixed allowlist. Installer and portable bundles contain production dependencies and their license files, `THIRD-PARTY-NOTICES.txt`, and the Node runtime license. No inventory, photos, report caches, private configuration or TLS keys are packaged. Builds are repeatable from pinned inputs; executable signing/timestamps mean byte-for-byte reproducibility is not claimed.

Create your GitHub repository and upload the clean source (or initialize Git in this folder). MIT, contribution/security guidance, issue templates and an Actions release workflow are included. No remote repository or public release is created by the local build. Update package/version and service-worker cache versions together. Pushing a matching `v<version>` tag runs checks, builds Windows artifacts and creates a **draft** GitHub release for your review. A manual workflow run only uploads build artifacts.

The current installer is unsigned. A public distributor can add Authenticode signing with their own certificate before publishing and regenerate checksums afterward. Test install, upgrade, chosen startup mode, reboot, phone access and uninstall in a disposable Windows VM before calling a release stable; the local build smoke-tests the real bundled Node, SQLite, native canvas, offline OCR and launcher lifecycle without changing this computer's services or firewall.

Primary references: [Inno Setup](https://jrsoftware.org/isdl.php), [Node.js distributions](https://nodejs.org/dist/), [PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [Apple Home Screen instructions](https://support.apple.com/guide/iphone/iph42ab2f3a7/ios).
