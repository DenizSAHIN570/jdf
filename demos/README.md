# Demos

Short product videos, generated from code so they can be re-rendered whenever the UI changes.

| Demo | What it shows | Output |
|---|---|---|
| [`edit-in-place/`](edit-in-place/) | Open a `.jdf`, double-click a line, type, press Enter (or click away) — the change is saved to the file. | `edit-in-place/edit-in-place.mp4` (1920×1080, 34 s) |

Each demo folder is a small [Remotion](https://www.remotion.dev) project (React → video) plus, where it makes sense, a Playwright script that drives the **real** app through the same flow so the video never shows behaviour the product doesn't have.
