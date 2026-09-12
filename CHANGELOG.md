# Changelog

All notable changes to JDF are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · semantic-ish. Versions are shared by the desktop reader, `@uurtech/jdf` (jdf.js) and `@uurtech/jdf-cli`.

## [Unreleased]

_Nothing yet._

## [0.1.26] — 2026-09-12

### Fixed — desktop reader
- **Recent Files / Finder / drag-drop from any folder.** Files opened from outside `~/Downloads`, `~/Documents`, `~/Desktop` failed with "forbidden path" on the next open and silently vanished from the recent list. All reads and writes now go through the app's own Rust commands (`read_text_file`, `read_binary_file`, `write_binary_file`, `open_document`, `save_document`) with no directory allow-list.
- **Editing a `.jdfx` no longer destroys its images.** Zip assets are bound into `resources.images[id].data` on open, so the autosave re-packs every asset (the old blob-URL rebind produced a bundle with zero assets and dead `blob:` links).
- **Rich text and links render.** Bold/italic/colour runs and internal/external links were flattened to plain text whenever a document was loaded; they now render in the same markup as jdf.js while staying double-click editable.
- Cmd+Z / Cmd+S / Cmd+F while typing in the JSON view, a form field or an inline editor no longer trigger document undo / Save As / search. Arrow keys inside `<select>` no longer flip pages.
- Malformed JSON committed from the JSON view (`pages: 5`, page without `elements`, missing `meta`) is normalised or rejected instead of crashing the viewer and being autosaved.
- Header/footer elements are editable — edits addressed the non-existent path `["__hf__", …]` and were dropped while still creating undo entries.
- No-op mutations (move-up on the first element, undo with an empty stack) no longer mark the document dirty or add history entries.
- Pending autosave is flushed before another file is opened (the last edit to the previous file was lost).
- Table header edits on tables that define headers via `columns[*].header` write to the right place; empty headers no longer shift column indices.
- Search tolerates `null` table cells / non-array rows (same leniency as the renderers).
- Scroll-based page detection works under zoom and no longer snaps the viewport back to the page top; zoom uses CSS `zoom` so the left edge stays reachable and the scroll area grows with the pages (Markdown view too).
- Signature pad strokes land under the cursor at any zoom.
- `resources.images[*].path` images load through Tauri's asset protocol.
- Print outputs the whole document, not just the visible viewport.

### Fixed — jdf.js
- Opening a `.jdfx` binds assets into `resources.images` instead of `blob:` URLs, so `viewer.exportJdf()` / `downloadJdf()` keep the images.

### Added — PDF import (shared by reader + CLI, `@jdf/pdf-import`)
- **Form XObject transforms.** Content placed with `Do` (logos, headers, InDesign/Word artwork) now honours its `/Matrix`; previously it landed at the wrong position or off-page.
- **Per-word text colour by position.** Text items are matched to the operator that painted them instead of by index, which drifted as soon as PDF.js merged two runs. Measured against rendered pixels on a mixed corpus: 401→555 of 563 correct (SoW), 79→100 of 128 (sign-off form), 2024→2835 of 2986 (77-page AWS guide).
- **Images**: inline images (`BI … EI`), 1-bit stencil masks painted in the current fill colour, repeated XObjects (`paintImageXObjectRepeat`), ImageBitmap fallback. Node runtime gains `DOMMatrix` / `Path2D` / `ImageData` polyfills from `@napi-rs/canvas`, so `page.render()` no longer fails silently on pages with clips or gradients — images on those pages were missing from CLI output (sample.pdf: 2 → 14 image placements).
- **Gradient fills** (axial/radial shading patterns) become their average colour instead of inheriting the previous solid colour.
- **Internal links** resolve destinations to `#page-N`; external links unchanged.
- **Bookmarks/outline** promote matching text to headings with `tocEntry` / `tocLevel`.
- **Document info** → `meta.author`, `created`, `modified`, `keywords`, `language`.
- **Encrypted PDFs**: `password` / `onPassword` options; CLI `--password <pw>`; the reader shows a password prompt (retries on a wrong password).
- **Scanned PDFs**: invisible OCR text (rendering mode 3) is kept with `opacity: 0` so search / `jdf chunk` / `jdf embed` see the words; CLI `--drop-invisible-text` restores the old behaviour. Clip-only text (mode 7) is dropped.
- Annotation appearance streams are excluded from the operator walk (form widgets are emitted from `getAnnotations()` already), removing duplicated widget borders and text-colour misalignment on filled forms.
- Node runtime passes `standardFontDataUrl` / `cMapUrl`, so non-embedded standard fonts and CJK CMaps resolve without warnings. `stopAtErrors: false` and `isOffscreenCanvasSupported: false` are set explicitly for lenient, host-independent output.

### Changed — release tooling
- `scripts/publish-dmg.sh` notarizes and staples **the dmg itself** (`notarytool submit --wait` + `stapler staple`), verifies with `spctl`, and computes the Cask sha256 *after* stapling. Tauri only notarized the `.app` inside; the dmg container was "Unnotarized Developer ID", which is what produced the "Apple could not verify… / Move to Trash" dialog for direct downloads and `brew install --cask jdf`.
- Tauri: `protocol-asset` feature + `assetProtocol` enabled for `path`-backed image resources.

## [0.1.25] — 2026-09-01
- Signed + notarized release; Homebrew tap install for `jdf-cli` documented; Cargo.lock synced.

## [0.1.24] — 2026-08-31
- PDF import: correct CTM composition order for nested transforms (`cm` prepends) — images/shapes were sent off-page by nested matrices.
- First Developer ID signed + notarized dmg; the Cask's `xattr -cr` workaround was removed.
- Presentation deck and contributor avatars on the docs site.

## [0.1.23] / [0.1.22] — 2026-07-05 … 07-06
- RAG in the CLI: `jdf chunk` (deterministic; section/element/fixed; jsonl/json/inline) and `jdf embed` (Ollama default, OpenAI optional, `--incremental`). Optional top-level `index` block in the schema.
- Table column widths and per-cell `align` / `style` across jdf.js, reader and Rust export.
- Rust PDF export: word-wrap, real table grid, `measure_element`, `flow` auto-pagination (`page.flow` / `meta.flow`).
- CLI Markdown importer at parity with the reader's `pulldown_cmark` path (richtext, table, blockquote, nested list, hr).
- jdf.js `renderTable` tolerates non-array rows / null cells (a null cell used to abort the whole page render on the web only).
- Docs: CLI page, format pages, landing showcase for RAG.

## [0.1.21] / [0.1.20] — 2026-06-24
- JDF Forms: `input`, `textarea`, `checkbox`, `select`, `signature` in all surfaces; PDF AcroForm widgets import as form elements with their values; `viewer.exportJdf()` / `downloadJdf()` in jdf.js.
- `.jdfx` zip bundle (document.json + manifest + assets) in reader, jdf.js and CLI; `--json` to force inline output.
- `jdf convert` as the headline verb (`jdf import` kept as alias); `jdf convert file.json` for LLM/agent output.
- Wording/rebranding pass on README and site; Homebrew install flow.

## [0.1.16] … [0.1.19] — 2026-06-15 … 06-21
- jdf.js `<jdf src>` custom element with auto-init, MutationObserver-based discovery, sidebar/toolbar/dark-mode attributes; npm publish as `@uurtech/jdf`.
- Docs site on GitHub Pages; landing demos; multi-OS release workflow.

## [0.1.4] … [0.1.8] — 2026-06-12
- Reader: fixed double-click open, close button, margin-vs-absolute page layout.
- Edit-in-place (double-click any text, list item, table cell, collapsible title, image src/alt) with autosave; live two-way JSON view; native Markdown viewer with GFM; welcome screen with recent files; sidebar thumbnails; search panel; help overlay.
- Header/footer elements and template variables (`{{pageNumber}}`, `{{title}}`, …); internal `#page-N` links; TOC navigation.
- PDF export honours `meta.pageSize` / `pageOrientation`, text colour, real TOC.
- JSON Schema (`spec/jdf-schema.json`) and CLI `validate`; renderer/type mismatches fixed (heading levels, ordered lists, richtext runs, table headers/borders, image `fit`, shape stroke objects).

## [0.1.0] — 2026-06-10
- Initial release: JDF format spec, Tauri viewer, PDF/Markdown import, PDF export, search/sidebar/zoom/dark mode, file associations.
