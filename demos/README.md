# Demos

Short product videos, generated from code so they can be re-rendered whenever the UI changes.

| Demo | What it shows | Output |
|---|---|---|
| [`edit-in-place/`](edit-in-place/) | Desktop reader: open a `.jdf`, double-click a line, type, press Enter (or click away) — the change is saved to the file. | `edit-in-place/edit-in-place.mp4` (1920×1080, 34 s) |
| [`web-form-fill/`](web-form-fill/) | Web embed: fill a field in a `<jdf save-button>` form, click Save, the downloaded `.jdf` carries the value and re-opens pre-filled. | `web-form-fill/web-form-fill.mp4` (1920×1080, 36 s) |
| [`rag-benchmark/`](rag-benchmark/) | The JDF-vs-PDF RAG benchmark: setup, retrieval accuracy per embedding model, RAG cost at 1,000 documents, what JDF saves, one-paragraph re-index. Every number is read from `docs/bench.json`. | `rag-benchmark/rag-benchmark.mp4` (1920×1080, 10 s) |

Each demo folder is a small [Remotion](https://www.remotion.dev) project (React → video) plus, where it makes sense, a Playwright script that drives the **real** app through the same flow so the video never shows behaviour the product doesn't have.
