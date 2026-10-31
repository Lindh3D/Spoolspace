# Security

Spoolspace is intended for a trusted home network. This prototype has no account system. Anyone who can reach the server can read or change the inventory. HTTPS protects transport; it does not add authentication. Do not port-forward an unauthenticated instance onto the public internet.

The Windows installer can add an inbound firewall rule restricted to the private profile, local subnet and bundled runtime. That is an explicit installation option. The Windows service runs as LocalService. The app's data folder is separate from program files and remains after uninstall.

Keep inventory, label photos, backups, configuration secrets and TLS private keys out of GitHub. Use the generated source archive, which is assembled from an allowlist. Installer outputs are currently unsigned unless the release publisher signs them separately. Verify checksums from the same trusted release source.

HTTP is the default on trusted home Wi-Fi. No certificates are generated or trust prompts shown in this mode. HTTPS is optional and must be explicitly enabled. When enabled, `data/https/authority.json` and `server.json` contain private keys; only the public `spoolspace-ca.crt` is downloadable. Compare the CA's SHA-256 fingerprint with the Windows server before trusting it. Trusting a CA changes device trust and must be an explicit device-owner action. Service/background startup never installs roots. Phone trust is set in OS settings. Certificate files and previously accepted trust are not deleted when returning to HTTP; they are simply unused. Inventory backups do not include these keys.

For a security issue, use GitHub's private vulnerability reporting if the repository maintainer has enabled it, or contact the maintainer privately. Avoid including real inventory backups or private-network details in public issues.
