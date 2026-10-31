# Open Filament Database integration

Spoolspace keeps a downloadable OFD catalog alongside the existing user inventory. Photo OCR, template regions, alignment, drying records, activity, backups and slicer export remain in the same application.

## Local workflow

1. Start Spoolspace with `start.bat` or `npm start`.
2. Open **Settings → Filament Database**. The app checks in the background while running; **Update Filament Database** also starts a manual check.
3. Review the version, last successful check, download progress and catalog counts. After the first successful download, searching and matching work offline.
4. Use **Search catalog / label text** to search known products or paste noisy OCR. In **Scan a spool**, **Read label** automatically requests the top five local catalog candidates after OCR.
5. Review a candidate's brand, base material, product line, color, source ID, field scores and spool size. Choose **Review this product** to open the spool form. Nothing is saved yet.
6. Enter the actual remaining filament. A catalog or label describes full capacity, not the current balance. **This is a new, full spool** explicitly copies the capacity into the remaining-weight field.
7. Check the data and save the spool. Its OFD identifiers/version and original OCR text are retained locally.

The text box under **Correct text & search again** allows noise to be removed or a word corrected for matching while preserving the original OCR text. The score bands are heuristic similarities, not probabilities: 95–100 very strong, 80–94 likely, 60–79 needs verification, below 60 weak. No automatic acceptance workflow is enabled.

Templates are optional. For a difficult layout, align the photo, map useful regions, read the boxes, and correct their **Confirmed text**. **Find catalog matches from confirmed fields** uses those corrections in preference to conflicting whole-photo OCR. **Use for this label** applies the selected catalog values to the mapped fields for this photo. The usual **Save template** and **Save & review spool** actions remain available. New photos are re-read; example colors, product variants and weights are not copied automatically.

**Find in filament database** inside a spool form fills only blank fields. Existing user entries are kept; closing the lookup restores the unsaved form. Missing source data never overwrites a user value. Seller options describe actual OFD purchase links; they are not assumed to be the shop where the user bought a spool.

## Synchronization

Source: [official SQLite download](https://api.openfilamentdatabase.org/sqlite/filaments.db), documented at the [OFD API](https://api.openfilamentdatabase.org/) and [source repository](https://github.com/OpenFilamentCollective/open-filament-database).

- `data/open_filament_database.db`: the cached OFD SQLite file, separate from `data/spoolspace.sqlite`.
- `data/open_filament_database.state.json`: automatic-update preference, HTTP validators, successful-check/download times and last failure.
- `data/spoolspace.sqlite`, table `custom_filaments`: your locally learned filament definitions. The download worker only owns the OFD cache; it cannot replace or edit this table.
- `DATA_DIR` changes both files' containing directory consistently with the inventory configuration.

The service downloads into a unique staging file in the same directory, flushes it, runs `PRAGMA integrity_check`, verifies the required tables/columns, and checks that the catalog has usable rows. It closes its previous read connection immediately before atomically renaming the validated file into place. A failed download or validation leaves the previous working catalog intact. Download size is bounded at 80 MB; network requests time out after two minutes. The source database is queried read-only and its existing indexes are reused.

Automatic checks run on startup and an hourly timer while the server is running, with at least 24 hours between attempts, including failed/manual attempts. Manual checks can be retried at any time. Conditional HTTP requests use ETag, or Last-Modified when no ETag is available, so an unchanged dataset can return 304 without another database download. Without validators, the 24-hour interval is the fallback. A failed check is displayed as cached/offline operation when a valid local file remains available.

Validation, SQLite searches and fuzzy matching run in a worker thread; the HTTP server stays responsive during catalog operations. Connections and a small brand/product-line vocabulary are reused. Per-request matching reads a bounded candidate subset rather than loading every color and size into JavaScript. The browser receives bounded JSON results, never the entire SQLite database. Label text/photos are not sent to OFD.

## Inspected schema and mapping

The official SQLite snapshot inspected for this integration reports version **2026.10.27**: 180 brands, 2,155 product lines, 15,063 color variants, 23,970 sizes and 66 stores. These are snapshot counts, not constants in the application.

| OFD table/column                                          | Spoolspace field / behavior                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `meta.version`, `meta.generated_at`                       | Catalog version and generation time                                                   |
| `brand.name`                                              | Brand, retaining the canonical source spelling                                        |
| `filament.material`                                       | Exact formulation/grade; also normalized to a base material                           |
| `filament.name`                                           | Product line / variant                                                                |
| `variant.name`                                            | Original manufacturer color naming, unchanged                                         |
| `variant.color_hex`, `hex_variants`, `color_standards`    | Primary HEX, additional HEX values and color codes when available; searchable locally |
| `filament.min_print_temperature`, `max_print_temperature` | Optional print-temperature range in Celsius                                           |
| `size.filament_weight`                                    | Net filament capacity in grams                                                        |
| `size.empty_spool_weight`                                 | Optional empty-spool tare in grams                                                    |
| `size.diameter`                                           | Size selection in millimeters                                                         |
| `purchase_link` → `store.name`                            | Available vendor/seller choices, only when provided                                   |
| Entity `uuid`, with `id` fallback                         | Stable product/variant/size references                                                |
| No corresponding column                                   | Manufacturer remains blank/manual; brand/parent brand are not substituted             |

The application stores `catalogProductId`, `catalogVariantId`, `catalogSizeId`, `catalogVersion`, `formulation` and `ocrText` with a confirmed spool. Inventory backups retain these fields and the separate custom catalog. The downloaded OFD catalog and its update preferences are not embedded in the user's JSON inventory backup; it can be downloaded again. Existing inventories and older backups remain supported without replacing their database.

Saving a manual filament with a brand learns its product identity, color, formulation, temperatures, suppliers and sizes in `custom_filaments`. Repeated stock records share a product definition; quantities, remaining weights, storage details, dates, notes and raw OCR remain per spool. Unmodified upstream selections are not copied. Manual product corrections to an upstream spool create a custom definition. Removing a physical spool keeps its learned definition. Existing manual inventory is learned when the table is first introduced; sample stock is excluded.

Search and matching combine the two sources, label custom candidates **My custom filament**, and support `source=all|custom|ofd`. Custom matching uses the same text, QR-brand, polymer and confirmed-region guards as OFD and works before the upstream catalog is downloaded. A custom match still needs review and a new spool still needs measured remaining grams or explicit full-spool confirmation. Backups containing `customFilaments` explicitly replace that table on restore; older backups preserve it and learn their restored manual inventory.

## Matching

The matcher normalizes case, accents, spaces/hyphens and known aliases such as BambuLabs/Bambu Lab, then compares OCR windows with names obtained from the local database. Common OCR confusions such as 0/O, 1/I/l and 8/B are compared without changing the original OCR or canonical source data. Brand, material, product line, color and net weight receive separate scores. Explicit formulation modifiers and numeric color-code contradictions are checked so similar names are not treated as identical formulations/colors.

Clear printed text takes precedence over conflicting unconfirmed model guesses. User-confirmed template fields take precedence over whole-photo OCR, including a corrected company, material or color.

Prefixed PLA ranges such as **E-PLA**, **ePLA**, **X-PLA** and **rPLA** resolve to the PLA family while keeping the printed range name separately. Alternate hyphens and spacing in prefixed labels such as “E-PL A” are tolerated. Matches still require polymer tokens or supported prefixes; an arbitrary company name containing the letters PLA is not sufficient. A clearly transcribed PLA type cannot be replaced by an unconfirmed PETG model guess. QR catalog entries for a different polymer family are excluded from selectable recommendations, with the discrepancy reported in the match message. Confirmed template material corrections remain authoritative.

A recognized printed brand, an explicitly labelled brand, or a confirmed brand limits fuzzy matching to that brand. If it is absent from the catalog, the result explains the missing brand and retains the observed fields for manual entry. Generic words such as “filament”, “metal”, “copper”, material names and units cannot serve as brand evidence. A separately printed unknown brand can be recognized when its name agrees with its printed website. QR brand clues remain separate from OCR, so a conflicting QR cannot erase a clear printed brand.

The Torwell example reads **Torwell · Metal Filament · Copper**, net capacity **1,000 g**, print range **190–240 °C** (including the OCR spelling “pint temp”). Its base polymer, manufacturer, seller and remaining grams remain unconfirmed. The cached 2026.10.27 dataset has no Torwell brand entry; FilamentPM is therefore excluded rather than offered as its replacement. A homepage QR establishes a brand clue, not a specific filament product.

Initial weights are brand 25, material 20, product line 25, color 25, and net weight 5; missing evidence is excluded from that weighted average. A missing/inconsistent brand, base material or color prevents a strong best-candidate suggestion. Weak product-line evidence or a weight absent from the source's sizes caps the score below 80. Explicit contradictory color evidence caps it below 60. A size mismatch leaves size selection unconfirmed. Every result still requires a user choice and the separate spool save.

All SQL query values use parameters. Available filters include general text, brand, material, product line, color/HEX/code, seller, net weight, empty-spool weight and temperature bounds. A manufacturer filter can match your custom entries; upstream-only queries return an explanatory empty result because the inspected OFD schema does not provide that field. No bulk web scraping or per-brand catalog download is used. Supported individual Prusa QR spool reports are read separately when the scan's online lookup option is enabled; their source is retained with saved spool notes.

## Limitations found in the dataset

- Many sizes have no empty-spool weight; some products lack temperatures, color metadata or seller links. Such values remain null/blank. An unknown tare is represented by the app's existing zero/“not recorded” convention and cannot be used for a scale calculation.
- Print temperatures in this snapshot reach 480°C, so stored print-range validation now allows up to 500°C. These are label/catalog records; the app does not set printer temperatures or override slicer calibration.
- The supplied noisy label matches **Add-North → PLA Economy → Black** in the inspected snapshot. The match is computed from source rows, not a hardcoded product rule.
- **Add-North PETG Glitz Grey** is absent from that snapshot. Its fuzzy example is tested against a small fixture where the product exists; production does not fabricate it when missing.
- OCR and heuristic matching can still be wrong. A materially different label layout may require different boxes or manual entry. Physical phone/browser behavior still needs device testing.

## Files and validation

- `lib/ofd-catalog.mjs`: download, validation, atomic install, cached SQL queries and schema mapping.
- `lib/local-catalog.mjs`, `lib/catalog-input.mjs`: combined local/upstream search and ranking, source selection, and shared OCR/QR/confirmed-region handling.
- `lib/prusa-spool.mjs`: bounded, optional lookup of individual manufacturer spool reports, exact color/tare/temperature data, original-versus-nominal weight mapping, and conflict-aware enrichment that preserves confirmed fields.
- `lib/ofd-match.mjs`, `lib/filament-normalize.mjs`: field scoring, evidence windows, aliases and formulation/color guards.
- `lib/brand-evidence.mjs`: shared printed-brand/domain references, generic-word exclusions and corroborated unknown names.
- `lib/ofd-client.mjs`, `lib/ofd-worker.mjs`: background worker and reusable asynchronous service.
- `server.mjs`: catalog API, startup checks and OCR enrichment.
- `lib/store.mjs`, `lib/parser.mjs`, `lib/recognition.mjs`: additive provenance/grade fields, safer weight parsing and supported print-temperature range.
- `public/app.js`, `public/styles.css`: Settings, catalog search, candidate review and template-field matching.
- `test/ofd.test.mjs`, `test/ofd-ui.test.mjs`, `test/helpers/ofd-fixture.mjs`: offline integration and UI tests, in addition to existing photo/template tests.

No new dependencies were needed for this integration. It uses Node.js fetch, worker threads and the existing built-in SQLite library.

```powershell
npm test
npm run check
npm start
```

The suite covers first download, schema/integrity detection, failed/corrupt/schema-incompatible updates, conditional refresh, daily throttling, offline search, SQL injection attempts, OCR examples, material grades, color/size contradictions, inventory preservation, real photo OCR enrichment and confirmation-only UI behavior. Custom-catalog checks cover deduplication, size variants, restart/backup persistence, migration, source filtering, saving and reusing a custom product in the UI, and successful/failed upstream updates leaving custom definitions unchanged. Test downloads use a local fixture; ordinary tests require no external network.
