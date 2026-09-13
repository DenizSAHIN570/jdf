# Demo: video RAG in JDF

25-second, hard-cut walkthrough: a video inside a JDF document → `jdf transcribe` (SRT/VTT import, whisper.cpp or OpenAI) → `jdf chunk` windows carrying `media.t0/t1` → a question hits the transcript and `viewer.seek()` plays the second → `jdf rag <folder>` over a whole knowledge base.

The document, transcript, chapters and chunk shape on screen come from [`docs/examples/video.jdf`](../../docs/examples/video.jdf) — the shipped example. The folder-scene counts (212 files, 4,918 chunks…) are illustrative and labelled as such.

```bash
pnpm --filter @jdf/demo-video-rag render   # → video-rag.mp4 (1920×1080)
```

**Music:** "Epical Drums 05" by Grigoriy Nuzhny, [Mixkit Stock Music Free License](https://mixkit.co/license/#musicFree); fetched at render time, not committed.
