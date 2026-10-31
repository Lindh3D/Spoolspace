# Spoolspace

A local filament inventory for your print room. Run one small server on a Windows PC, then open the responsive web interface on your desktop or phone over Wi-Fi.

Spoolspace is a first prototype, with local SQLite storage, spool tracking, photo-assisted entry, drying records, and downloadable slicer presets. It runs independently of Bambu Studio, OrcaSlicer, and PrusaSlicer.

**[Read the step-by-step user guide](docs/user-guide.md)** for adding/scanning spools, label templates, groups, scale weighing, drying, phone access, Windows startup, slicer exports and backups.

## Run on Windows

For a Windows setup EXE with its own runtime, desktop shortcut and optional background/service startup, see the [installation and release guide](docs/windows-installation.md). The same guide covers the portable ZIP, phone Home Screen installation, HTTPS and GitHub draft releases. Existing source users can export a backup and restore it after installing; your current project data folder is not moved or included in a release.

Installed Windows copies can change their startup mode in **Settings → Windows startup** on the server's localhost page. Choose manual, background at sign-in, or a Windows service at boot, then review/save in the Windows dialog with administrator permission. The choice takes effect at the next Windows startup while the current server keeps running. Phone clients can view the mode; changes are made on the Windows computer.

Install **Node.js 24 LTS** from [nodejs.org](https://nodejs.org/). Open PowerShell in this folder and run:

```powershell
npm install
npm start
```

Open **http://localhost:4173**. HTTP is the default for your local network; no certificates are generated or needed. You can double-click `start.bat` after installing Node.js. Keep the server running while using the app; press `Ctrl+C` in its terminal to stop it. If using an older `.env` from 0.5.2, set `HTTPS_MODE=off` and restart.

The initial dependency installation requires internet access. After installation, the interface, database, OCR engine, and English OCR language data run locally. There is no cloud AI account or API key to configure.

## Use your phone

1. Connect the phone and PC to the same trusted Wi-Fi network.
2. Open **Connect your phone** in Spoolspace and scan its QR code, or visit the displayed address, such as `http://192.168.1.20:4173`. No certificate setup is needed.
3. If Windows Firewall asks, allow Node.js on your **private** network. Guest Wi-Fi or router client isolation may prevent a phone reaching the PC.
4. Open **Scan spool**. Use **Choose photo** for an existing image, or **Take photo** for the camera. Run local recognition and review the detected details before saving.

For a phone Home Screen shortcut, use Chrome's menu → Add to Home screen → Create shortcut, or Safari → Share → Add to Home Screen. **Settings → Use on your phone** explains the steps. Full browser-promoted PWA installation may be unavailable on HTTP. Optional HTTPS is documented in the [hosting guide](docs/windows-installation.md#optional-https).

Photo selection and camera capture use separate file inputs. **Choose photo** has no camera-capture hint, so it lets the browser offer the photo library or file picker. **Take photo** requests the rear camera on supporting phones. The browser ultimately controls its picker options. A continuous live camera stream via `getUserMedia` would require HTTPS on a LAN address and is not used by this prototype.

The server listens on the LAN by default. This prototype has **no sign-in**: anyone who can reach it can read and change inventory. Use it only on a trusted home network. Do not port-forward it or expose it to the internet.

## Inventory workflow

Use the small **+** to the right of **Filament type / base material** when adding or editing a spool to create your own type, such as **TPE** or **PC-ABS**. Enter the name and choose **Add type** (or press Enter). It is selected immediately without clearing your spool details, saved locally for future spools, shared with your phone through the server, and included in backups. Names are stored in uppercase and duplicates are reused. Adding a type saves the type list only; save the spool separately. PC-ABS remains a polymer blend, while PLA-CF can use PLA as its base material with the filled grade recorded under formulation.

- Add spools with brand, vendor, manufacturer, base material, product line, print temperature range, color, net filament capacity, remaining grams, empty spool weight, and storage location.
- New spool forms, including photo and catalog entries, reuse the last saved location and storage type. Change either before saving if needed. These defaults are stored on the local server, shared with your phone, and included in backups. Cancelling a form does not change them. Editing an existing spool keeps its own values; saving a changed location or storage type updates the defaults for future additions.
- Search and filter your collection, compare remaining-filament bars, and find low-stock spools.
- Use **Find a spool for a print** to compare a slicer's estimated usage plus an extra allowance against your material and remaining stock. Planning does not deduct filament; log usage after the print finishes.
- Log the grams consumed after a print, or weigh the loaded spool to calculate remaining filament.
- Record drying sessions and follow the drying queue. Store spools in a dry location after drying.
- Export an inventory backup and restore it through Settings before moving to another PC.
- The initial inventory contains clearly labeled example spools so you can explore the interface. Clear the example inventory through Settings before entering your real collection.

Matching spools appear as one filament group in both the grid and list. Groups match brand, base material, product line, formulation, manufacturer, color name and color value, and print temperature range. Storage location, supplier, dates and individual weights stay attached to each physical spool. Different capacities appear as separate batches inside the same group.

Full spools marked **Available** with no opening date are counted together, for example **4 new, unused spools**. Open the group, choose the physical spool by its location and ID, and select **Start using one**. It becomes an individual opened spool without changing its weight. Enter **Filament used for this print (g)** and select **Log print** to deduct that amount from that spool and update the group total. Other opened or partly used spools remain separate, each with its own remaining-filament bar and print log.

Groups organize the view; every spool retains its original record, ID, tare, location, QR link and history. Search and filters match individual spools; a matching group shows its complete stock with a count of matching spools so unopened siblings remain accessible.

The calculation is:

```text
remaining filament (g) = total measured spool weight (g) - empty spool weight (g)
remaining percentage = remaining filament / original net filament weight × 100
```

An empty spool weight is specific to its construction, size, and version. Weigh an empty spool yourself for an accurate tare. Example or recognized weights are estimates until verified. A photo cannot reliably determine the remaining weight of wound filament.

When adding or editing a spool, enter **Empty spool weight (g)** and **Current spool + filament weight (g)** to calculate remaining filament automatically. Changes to either weight recalculate the balance. Totals below the empty spool weight or above the full filament capacity must be corrected before saving. Clear the total scale reading to enter remaining grams manually.

The empty-spool lookup reuses weights from your saved same-brand spools and includes a small library of clearly labeled approximate examples. Choose a saved value only when the spool construction matches, and verify reference estimates by weighing your actual empty spool. Selecting a lookup result fills the form; it does not add a spool until you save it.

Drying reminders describe your records and material defaults; they do not measure moisture. Example drying times and temperatures are illustrative. Check your filament manufacturer's and dryer's instructions, including the spool's heat tolerance, before drying. Recognition results must be checked before use.

## Local photo recognition

Choosing or taking a new photo automatically runs **prepare → align → zoom → read** in that order. A swirling-star overlay shows the active stage over the image, and the first read waits for the enabled orientation and label-zoom steps to finish. The results stay in the scan dialog for review; inventory is saved separately. Photo adjustment starts collapsed. Expand it to rotate, pan, zoom or change the OCR preview, then choose **Read label again** when ready. Adjustments, template changes and recognition-method changes never trigger automatic re-reading. Each new upload gets one automatic first read; a failed read leaves a manual retry button. The animation respects reduced-motion preferences.

Clicking outside a dialog keeps it open and preserves your entries. Use the **X** at the top right or **Close** at the bottom to dismiss it deliberately; Escape also closes the active dialog. After choosing a scan photo, **Enter manually** opens the spool form with the photo beside it. Recognized and template-based spool reviews keep that reference too. On wider screens the aligned color photo stays visible on the left while the properties scroll independently on the right; on phones it stays above the scrolling properties. The reference is retained for the review session, including a catalog lookup and return to the form.

Spoolspace now uses a separate, locally cached **Open Filament Database** catalog to rank recognized labels against real brands, product lines, formulations, colors and spool sizes. Open **Settings → Filament Database** to update the catalog, control automatic daily checks, search products, or paste noisy label text. Photo scanning and corrected template fields show matching candidates for review. The original OCR and source identifiers are preserved; inventory is only saved after confirmation, and remaining filament must be entered or explicitly confirmed as a new full spool.

See the [OFD integration guide](docs/open-filament-database.md) for the inspected upstream schema, field mapping, synchronization behavior, matching scores, tests and known missing data. The catalog is cached separately as `data/open_filament_database.db`; the existing user inventory remains `data/spoolspace.sqlite`.

When you save a new manually entered or corrected filament, its brand, base material, product line, formulation, manufacturer, color, print temperatures, suppliers and spool sizes are learned in your **custom filament catalog**. Repeated physical spools reuse the same product entry. Spool balances, storage, dates, notes and raw recognition text are not copied into catalog definitions. Entries with no brand cannot provide a useful product identity and are not learned until a brand is saved. Unchanged products selected from OFD are kept as upstream references.

Your custom products participate in future photo/OCR and QR-brand matching and ordinary catalog searches, even before downloading OFD. Open **Settings → Filament Database → Search catalog / label text** and choose **My custom filaments** under **Catalog source** to browse only your entries. A match still needs review, and a new spool still needs an actual remaining weight or explicit full-spool confirmation. A saved custom entry supplies recognition clues; it does not infer filament usage from a photo.

Custom definitions live in the separate `custom_filaments` table inside `data/spoolspace.sqlite`. OFD updates replace only the external cache file and cannot overwrite this table. Deleting or using a physical spool keeps its custom definition for later recognition. Existing manual inventory is learned when the custom table is first introduced (sample stock is excluded). JSON backups include custom definitions; restoring a backup containing them explicitly replaces the custom catalog, while older backups without that section preserve it and learn their restored manual spools.

The default engine is [Tesseract.js](https://github.com/naptha/tesseract.js), running on the local server. OCR reads the printed label; a parser looks for material, brand, weight, and recognizable color names. It cannot recognize every label or infer missing product information. Review the recognized text and correct the fields before adding a spool. Slicer exports currently assume 1.75 mm filament.

QR recognition is shown above catalog suggestions. Prusa spool links such as `prusa.io/s/…` identify the filament brand as **Prusament** and its manufacturer as **Prusa Research**. With **Read Prusa spool details online** enabled, the app reads that spool's structured manufacturer report to obtain its exact material, color name/HEX, nozzle range and tare. The report also shows factory filament weight, nominal marketed size, manufacturing date, original length and bed range. Only the spool ID is sent to the fixed Prusament endpoint; photos remain local. Unsupported links are not fetched. You can uncheck the option to use local recognition only. Network failures leave OCR, QR brand identification and the local catalog available.

Labels such as **ASA Signal White** retain the full color name, and nozzle labels such as **260 ±10 °C** or OCR **260 +10 °C** become a 250–270 °C range. A manufacturer report can refine generic **White** to **Signal White** and provide its actual HEX. Conflicting brand/material observations and confirmed template corrections are kept for review rather than silently replaced. Without product clues from the label, report or an exact catalog identifier, the app retains the recognized brand instead of suggesting unrelated products.

The original filament capacity uses the manufacturer's factory-measured net weight where supplied; the nominal marketed size is shown separately. Neither value establishes the current remaining filament. Enter your actual balance, weigh the spool, or explicitly confirm a new full spool. Report source and manufacturing details are included in the saved spool notes and backups. Saving the spool teaches its verified product settings and tare to your custom catalog; scanning alone does not add inventory or catalog entries. Successful report lookups are cached in memory for 24 hours. Failed lookups can be retried immediately. The importer only requests recognized single-spool Prusa IDs, rejects redirects, bounds response size, and parses the embedded JSON without executing website scripts.

QR reading retains a separate color source up to 3,200 pixels across, while the aligned OCR preview stays bounded at 1,800 pixels. The local decoder tries normal and inverted codes at multiple resolutions, then reconnects small gaps between printed dots when ordinary decoding fails. This helps with dotted spool codes and small QR labels inside larger photos. For the best result, keep the code sharp and include its full border; heavy blur, glare or missing parts can still prevent a read.

Base material and product line are separate. For example, a spool can have material **PLA** and product line **X-PLA**, **PLA Economy**, **PLA Basic**, or **PLA Matte**. Brand identifies the marketed filament brand; vendor and manufacturer are optional when the label supplies them. Store a printed temperature range as label information and verify it before printing; it does not replace the calibrated settings inherited by slicer exports.

For best results, photograph one label straight on in good light, with the text in focus. Avoid glare and tightly curved labels. Phone photos are resized before being sent to the PC. Use JPEG, PNG, or WebP; HEIC support depends on whether your browser can decode the photo.

Color recognition is a separate local image tool. Choose **Pick color**, then tap an area of visible filament to sample its color. You can adjust the color manually before saving. Lighting, shadows, and the camera's white balance affect the result; it is an approximation rather than a color measurement.

### Adjust a photo to a template

After choosing a photo, select the saved recognition template. **Photo adjustment** lets you move the photo beneath the fixed template boxes:

New scans use a **square 1:1 preview and OCR frame**, including portrait phone photos. After orientation, **Automatically zoom to readable label text** (enabled by default) finds readable text and enlarges it to use the square with an 8% margin. Review the crop so every useful field remains visible. If text cannot be detected confidently, the full photo stays visible for manual zoom and pan. **Zoom to label** repeats detection on the current view; **Fit photo** restores the whole image. The photo guide collapses after upload to give the preview more space. Automatic detection adds a local OCR pass and cannot recover detail missing from a distant or blurry photo.

Older rectangular templates appear proportionally within the square preview area. Their OCR dimensions and boxes retain their existing coordinates; automatic label zoom is skipped when loading a saved template. New templates taught from a normal square scan use the square frame. QR scanning continues to use the original photo as well as the current cropped view.

For the clearest photo, hold the phone in landscape with text horizontal and the main camera parallel to the label. Fill most of the frame with the label, including its edges. Use even light without flash glare or shadows, tap the text to focus, and hold steady. Avoid ultra-wide lenses and digital zoom. For a curved label, photograph smaller useful sections straight on. Retake blurred or reflective photos; sharpening cannot recover missing detail.

**Automatically check text orientation** is enabled when choosing a photo. Local OCR compares four text directions, then estimates small baseline tilt. Uncertain results leave orientation unchanged for manual adjustment. This adds local processing time and works best with several readable lines of English text. The **Auto-orient text** button can repeat the check in the scan or template editor. Inspect the preview before reading.

Under **Make text easier to read**, choose original color, enhanced grayscale (default for new photos), grayscale, or black and white. Enhanced mode stretches contrast and sharpens text edges; black and white uses an automatic threshold while keeping filled character strokes. Contrast and sharpening sliders affect enhanced and black-and-white modes. The visible rendered image goes to OCR; color sampling uses a separate aligned color copy. Moving into the template editor preserves the color copy and current processing settings for that session. Saved template examples retain the rendered preview, so a saved monochrome example cannot restore its original colors later.

For lens distortion, adjust **Lens correction** until straight label edges stop bowing. For perspective, choose **Straighten: mark 4 corners** and tap top left, top right, bottom right, then bottom left of a rectangular label or text block. The app projects that area into a rectangle; adjust zoom and position afterward to align it beneath fixed template boxes. Correct lens bowing before marking corners. **Cancel corners** leaves the photo unchanged; **Reset** restores the photo as opened in that editor. Lens correction is approximate, and four-corner correction does not flatten a curved spool surface or recover the exact physical aspect ratio.

- Use the 90-degree buttons to correct orientation, or the rotation slider/number for a precise angle.
- Zoom with the slider, percentage input, mouse wheel, or a two-finger pinch.
- Select **Move photo** and drag with a mouse or one finger to pan. Arrow buttons and X/Y percentage inputs also adjust position.
- **Fit photo** centers the whole photo at its current angle. **Reset** clears the adjustments for this editing session.

The recognition frame uses the selected template's aspect ratio, so the boxes stay fixed as the photo rotates, zooms, or pans. Changes are rendered into the image sent to OCR, rather than just changing its appearance on screen. White areas outside the photo remain blank, and image content outside the frame is cropped. The source image is retained in memory during editing, so each adjustment is rendered from that source.

The same controls are available in the template editor. Switch between **Move photo** and **Draw fields** to align the image without accidentally moving or drawing boxes. Read the selected boxes again after changing the photo: previous automatic OCR results are cleared, while text you corrected by hand is kept. Saving a template stores its aligned example photo with the existing field coordinates. Ordinary scan adjustments do not change your saved template.

The OCR worker and English model are installed with the app. The [Tesseract.js local installation guide](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md) explains local worker and language paths. Spoolspace does not send label photos to a cloud OCR service.

### Scan QR codes and label text together

**Read QR codes together with label text** is enabled by default. Choose a photo from the library or camera as usual, keeping one spool's label and complete QR square in view. Keep its surrounding white border, use sharp focus and avoid reflections. The first read starts automatically after image preparation. For later adjustments, choose **Read label again**. The app decodes QR codes locally from both the original color photo and the aligned OCR image, then combines useful clues with the text results. This also works over your Wi-Fi HTTP connection without a browser live-camera API.

The review shows decoded QR values, website brand hints, direct filament fields and conflicts with OCR. Supported payloads include printed filament text, JSON filament data, product links, and identifiers found in the local OFD catalog (QR identifiers, GTIN, article numbers, barcode identifiers, size UUIDs and exact purchase links). Exact catalog identifiers show a **QR** badge. Multiple codes are displayed separately without applying their QR fields; take a closer photo of one spool to avoid ambiguity. Unsupported or damaged codes leave OCR/manual entry available. This is a QR decoder, not a one-dimensional barcode scanner or RFID reader.

Prusament's [official website](https://prusament.com/) describes spool QR links to manufacturing reports. Its opaque spool ID alone does not reveal the material or color offline. Official Prusament, Add-North and Bambu Lab domains provide brand clues; product identification still needs useful QR content, an exact catalog reference, or readable label text. Bambu's [AMS identification uses RFID](https://blog.bambulab.com/ams/); a printed QR does not expose the RFID tag contents. Actual Add-North and Bambu QR label formats have not been verified on physical spools.

Manufacturer URLs are shown as optional **Open QR link (internet)** links. Generic manufacturer pages are not fetched automatically. A recognized Prusament single-spool link can optionally retrieve its official spool report when **Read Prusa spool details online** is enabled; only the spool ID is sent, and photos stay local. Original/factory weights never establish your current remaining balance. A generic support/shop URL does not imply a particular product. Check unsupported links manually when a code contains only a serial or unknown identifier.

Decoded QR values are retained with the spool and included in inventory backups. New-spool remaining grams still require an explicit balance, a scale reading minus tare, or confirmation of a full spool. Recognition never adds inventory automatically. Turn off QR reading in the scan or template editor if the code is unrelated.

Torwell's `torwell3d.com` and `torwelltech.com` links also provide a Torwell brand clue. A clear printed or confirmed brand restricts catalog matching to that brand. Missing brands stay available for manual spool entry, with no substitute-brand recommendation. “Metal Filament” is retained as a printed description; it does not by itself establish PLA or another base polymer.

QR decoding uses [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0) and `@napi-rs/canvas` for local image decoding. Image work runs in a bounded worker thread; these packages are runtime dependencies and install with `npm install`.

### Teach a label layout

When the generic reader misses an unfamiliar label, create a recognition template from the photo:

1. Name the template so you can find the label family again.
2. Choose **Teach this label**, select the field you want to identify, then draw a rectangle around that text in the photo. Add only the fields the label actually contains; brand, vendor, manufacturer, material, product line, temperature range, color, and weight fields are optional. **Add box with coordinates** and percentage-based position controls provide an alternative to drawing.
3. Use **Read selected boxes**, then select each field and correct its **Confirmed text**. Keep a base material such as PLA separate from the printed product line.
4. Use **Save template** to keep only the layout, or **Save & review spool** to open a separate spool form with the reviewed details. The spool is added only when you save that form. Saved templates can be viewed and edited from **Label templates**.
5. For a future label with the same layout, select the saved template and use **Photo adjustment** to align the printed fields beneath the boxes. The reader applies the saved regions to the aligned image rather than copying the old spool's color, product line, or weight.

This teaches OCR where to look; it does not train a general image model. Rotation, zoom, and panning help align similar labels, while a different label layout may need another template. Review the regions and results. Recognition can still fail on small, curved, blurred, or reflective print.

Template example photos and their field regions are stored in the local SQLite database. Photos are retained when you explicitly save a template; ordinary recognition does not create a photo archive. Template photos can show anything visible around the spool, so choose an appropriate example before saving or sharing a backup.

A saved template photo may be up to 3 MB. The library allows up to 250 templates and 32 MB of serialized template data, including encoded photos and region text. Phone photos are resized before upload; if a saved example is still too large, choose a smaller image or crop it to the label before uploading. Saved regions are relative to the whole image, so use that same framing when reading future labels.

### Optional Ollama vision

If you already run [Ollama](https://ollama.com/) locally, enable the optional vision engine in Settings and enter the exact name of an installed vision-capable model. Downloading a model is a separate, one-time step and can require several gigabytes. No model is installed automatically.

Ollama can suggest details that OCR misses. Its results still need your review. The default OCR workflow remains available when Ollama is disabled or unavailable.

## Slicer presets

Open a spool's export action and choose the slicer. Exports carry filament identity and basic material metadata. They are a starting point for a custom preset, not a complete calibration for your printer.

| Slicer       | Download                | Import                                                               |
| ------------ | ----------------------- | -------------------------------------------------------------------- |
| Bambu Studio | `.json` filament preset | File → Import → Import Configs / Import Preset, depending on version |
| OrcaSlicer   | `.json` filament preset | File → Import → Import Configs                                       |
| PrusaSlicer  | `.ini` filament bundle  | File → Import → Import Config Bundle                                 |

For Bambu Studio and OrcaSlicer, enter the **exact name of an installed parent filament preset** in the export dialog. The parent supplies printer-specific settings and temperatures. Select the corresponding printer and nozzle in your slicer before importing. A missing parent or incompatible printer can make a preset fail to import or remain hidden. The same parent name is not guaranteed to exist in both slicers.

Review inherited temperatures, flow, maximum volumetric speed, and printer compatibility in the slicer. The app does not overwrite slicer directories, calibrate filament, or modify printer settings. Your inventory's remaining grams are maintained in Spoolspace; exporting a preset does not update a printer's remaining-weight estimate.

**Direct AMS synchronization and RFID writing are not implemented.** Preset import is a file-based step. Assign the physical spool to the correct AMS slot in the printer or slicer separately. This prototype does not subscribe to printer telemetry or automatically deduct print usage.

Compatibility references:

- [Bambu Studio preset import implementation](https://github.com/bambulab/BambuStudio/blob/master/src/libslic3r/PresetBundle.cpp) accepts JSON and resolves the exact parent named by `inherits`.
- [OrcaSlicer profile guide](https://github.com/OrcaSlicer/OrcaSlicer/wiki/how_to_create_profiles) documents JSON, inheritance, and printer compatibility.
- [PrusaSlicer import and export guide](https://help.prusa3d.com/article/how-to-import-and-export-custom-profiles-in-prusaslicer_382766) documents `.ini` configuration bundles.

Slicer exports are prototype integrations. Real import and print compatibility must be verified with your installed slicer, printer, and nozzle.

## Configuration and storage

The optional `.env` file is loaded at startup. Copy `.env.example` to `.env` to change `HOST`, `PORT`, `DATA_DIR`, or the default `OLLAMA_MODEL`, then restart the server. Ollama requests use only `http://127.0.0.1:11434/api/generate` in this prototype.

Your working database is `data/spoolspace.sqlite` by default. This folder, `.env`, and `node_modules/` are excluded from Git. Use the app's backup export for a portable copy of inventory, settings, activity history, and saved recognition templates, including their example photos. Restoring a backup containing a templates array replaces the template library with that backup. Older backups without templates remain supported and preserve your existing template library. For a filesystem-level backup, stop the server before copying the entire `data/` folder so SQLite files remain consistent.

Backups contain your spool data and any saved template photos. Keep your backup outside this project folder and check a restored backup before replacing the only copy of an inventory. Do not upload your personal database or backups when publishing the app's source.

## Development and sharing

```powershell
npm test
npm run check
npm run format
```

The tests cover the database, HTTP API, local OCR, exports, and DOM workflows. DOM checks do not replace checking the responsive layout and phone camera in your own browser. The format command uses Prettier to keep contributions readable.

The interface uses HTML, CSS, and JavaScript served by a Node.js HTTP server. SQLite is provided by Node's built-in `node:sqlite` module. There is no separate database service, frontend build, or paid API required.

You can publish this source to a GitHub repository under the included [MIT license](LICENSE). Review your files before pushing; exclude inventories, photos, backups, `.env`, and local model data. Dependency licenses remain their respective owners' licenses. Spoolspace is an independent community project and is not affiliated with the slicer or printer manufacturers.

Possible next steps include printer usage import, a verified spool-weight catalog, QR labels and authenticated LAN access. A bundled Windows installer, portable package and release-building workflow are already included.
