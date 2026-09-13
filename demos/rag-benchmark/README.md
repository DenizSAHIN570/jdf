# Demo: JDF vs PDF — RAG benchmark

A 21-second presentation of the benchmark in [`bench/`](../../bench/): the setup (same 24 reports, two formats, same pipeline), retrieval accuracy per embedding model, the RAG cost comparison at 1,000 documents, and the one-paragraph re-index test.

**Every number on screen is read from [`docs/bench.json`](../../docs/bench.json)** — the file `pnpm --filter @jdf/bench render` writes from `bench/results/latest.json` and `cost-latest.json`. Re-run the benchmarks, re-render the site, re-render the video: nothing is typed in by hand.

```bash
pnpm --filter @jdf/demo-rag-benchmark verify   # python rag_bench.py --verify (BM25) — the numbers reproduce
pnpm --filter @jdf/demo-rag-benchmark render   # → rag-benchmark.mp4 (1920×1080)
pnpm --filter @jdf/demo-rag-benchmark studio   # Remotion studio to scrub the timeline
```

Output: `rag-benchmark.mp4` (21 s).

**Music:** "Epical Drums 02" by Grigoriy Nuzhny, [Mixkit Stock Music Free License](https://mixkit.co/license/#musicFree) — free for commercial use in videos, no attribution required. The MP3 is not committed (the licence does not allow redistributing the track on its own); `pnpm render` fetches it from [mixkit.co](https://mixkit.co/free-stock-music/epical-drums-02-677/) into `public/` first.
