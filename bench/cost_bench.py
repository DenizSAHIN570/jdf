#!/usr/bin/env python3
"""
JDF vs PDF — RAG COST benchmark: what indexing and querying 1,000 documents costs.

    python cost_bench.py                 # 1,000 files per format (default)
    python cost_bench.py --files 10000
    python cost_bench.py --verify        # recompute and compare with results/cost-latest.json

Same RAG pipeline on both sides, only the input format differs:
  PDF   text → LangChain-style fixed chunks (the PDF configuration that scored
        best in rag_bench.py) → embeddings → vector store → top-5 context → LLM
  JDF   `jdf chunk --strategy section` (committed output) → embeddings → …

What is counted, per N files (the 24-document corpus cycled, file i = doc i mod 24):
  * chunks and embedding TOKENS for the initial index — counted exactly from the
    chunks each pipeline produces (ceil(chars/4) on both sides, same estimate the
    JDF CLI uses);
  * embedding $ = tokens × the public prices in prices.json (as-of date + source
    per entry; edit for your provider — this script never calls a paid API);
  * local embedding time — a real sample of each pipeline's chunks is embedded
    with a sentence-transformers model, the measured tokens/second is applied to
    the pipeline's total tokens (--embed-all embeds everything);
  * vector-store payload (bytes of chunk text stored next to the vectors);
  * re-index cost when one paragraph changes in every document: JDF re-embeds
    only the chunks whose content hash changed (`jdf embed --incremental`); a
    PDF has no chunk identity, so the whole document is re-chunked and re-embedded;
  * LLM input tokens and $ for 1M queries with top-5 context (from rag_bench.py).
"""
from __future__ import annotations

import argparse
import json
import math
import platform
import subprocess
import sys
import time
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rag_bench import (CORPUS, DOCS, EXTRACTORS, RESULTS, Chunk, Embedder, est_tokens,  # noqa: E402
                       load_jdf_pipeline, machine, split_text)

PRICES = json.loads((Path(__file__).resolve().parent / "prices.json").read_text())


def fmt_usd(x: float) -> str:
    return f"${x:,.2f}" if x >= 1 else f"${x:.4f}"


def fmt_int(x: float) -> str:
    return f"{int(round(x)):,}"


def fmt_secs(s: float) -> str:
    return f"{s:.1f} s" if s < 120 else (f"{s / 60:.1f} min" if s < 7200 else f"{s / 3600:.2f} h")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--files", type=int, default=1_000, help="files per format (default 1,000)")
    ap.add_argument("--pdf-pipeline", default=None, help="PDF pipeline id from results/latest.json to cost (default: the best-scoring PDF pipeline there)")
    ap.add_argument("--embedder", default="st:BAAI/bge-small-en-v1.5", help="local model for embedding-time measurement; 'none' to skip")
    ap.add_argument("--embed-sample", type=int, default=2000, help="unique chunks to really embed for the throughput measurement")
    ap.add_argument("--embed-all", action="store_true", help="really embed every chunk of every file (slow)")
    ap.add_argument("--queries", type=int, default=1_000_000, help="query volume for the LLM-cost row")
    ap.add_argument("--verify", action="store_true")
    a = ap.parse_args()

    manifest = json.loads((CORPUS / "manifest.json").read_text())
    doc_ids = [d["id"] for d in manifest["documents"]]
    n_files = a.files
    files = [doc_ids[i % len(doc_ids)] for i in range(n_files)]
    print(f"RAG cost benchmark — {n_files:,} files per format (the {len(doc_ids)}-document corpus cycled)\n")

    # ── accuracy run tells us which PDF pipeline to cost (its best one) ───────
    acc = json.loads((RESULTS / "latest.json").read_text()) if (RESULTS / "latest.json").exists() else None
    if not acc:
        raise SystemExit("run rag_bench.py first — cost_bench.py costs the PDF pipeline that scored best there")
    pdf_pipes = [p for p in acc["pipelines"] if p["format"] == "pdf"]
    if a.pdf_pipeline:
        pdf_pipe = next(p for p in pdf_pipes if p["id"] == a.pdf_pipeline)
    else:
        pdf_pipe = max(pdf_pipes, key=lambda p: p["retrievers"][acc["headline"]]["all"]["recallAt1000Tok"])
    ex_id, size = pdf_pipe["id"].split("-")[1], int(pdf_pipe["id"].split("-")[2])
    overlap = next(c["overlap"] for c in acc["settings"]["pdfChunking"] if c["chars"] == size)
    ex = next(e for e in EXTRACTORS if e[0] == ex_id)
    print(f"  PDF side: {pdf_pipe['label']} (best PDF pipeline in the accuracy run)")

    # ── JDF side: committed `jdf chunk` output ────────────────────────────────
    jdf = load_jdf_pipeline(manifest)
    jdf_chunks_by_doc: dict[str, list[Chunk]] = {}
    for c in jdf.chunks:
        jdf_chunks_by_doc.setdefault(c.doc, []).append(c)
    before = {r["id"]: r["hash"] for r in (json.loads(l) for l in (CORPUS / "jdf-chunks.jsonl").read_text().splitlines() if l.strip()) if r["doc"] == "d01"}
    edited = [json.loads(l) for l in (CORPUS / "jdf-chunks.d01-edited.jsonl").read_text().splitlines() if l.strip()]
    jdf_reembed_tokens_d01 = sum(r["tokens"] for r in edited if before.get(r["id"]) != r["hash"])
    jdf_reembed_chunks_d01 = sum(1 for r in edited if before.get(r["id"]) != r["hash"])

    # ── PDF side: text of each unique document → fixed chunks ─────────────────
    pdf_chunks_by_doc: dict[str, list[Chunk]] = {}
    for d in doc_ids:
        text = "\n\n".join(ex[3](DOCS / f"{d}.pdf"))
        pdf_chunks_by_doc[d] = [Chunk(f"{d}-{i}", d, t, t, est_tokens(t)) for i, t in enumerate(split_text(text, size, overlap))]
    pdf_sides = [{"id": ex_id, "label": pdf_pipe["label"], "version": pdf_pipe["version"], "chunks_by_doc": pdf_chunks_by_doc}]

    # ── totals per format over the N files ────────────────────────────────────
    def totals(chunks_by_doc: dict[str, list[Chunk]]):
        n_chunks = sum(len(chunks_by_doc[d]) for d in files)
        tokens = sum(sum(c.tokens for c in chunks_by_doc[d]) for d in files)
        store_bytes = sum(sum(len(c.embed_text.encode()) for c in chunks_by_doc[d]) for d in files)
        return n_chunks, tokens, store_bytes

    # ── local embedding throughput (really measured on unique chunks) ─────────
    emb = None
    throughput = None
    if a.embedder != "none":
        emb = Embedder(a.embedder)
        def measure(chunks: list[Chunk]) -> float:
            sample = chunks if a.embed_all else chunks[: a.embed_sample]
            toks = sum(c.tokens for c in sample)
            emb.cache.clear()  # force real work
            t0 = time.perf_counter()
            emb._embed_raw([c.embed_text for c in sample])
            return toks / (time.perf_counter() - t0)
        throughput = {"jdf": measure([c for d in files for c in jdf_chunks_by_doc[d]] if a.embed_all else jdf.chunks)}
        for s in pdf_sides:
            throughput[s["id"]] = measure([c for d in files for c in s["chunks_by_doc"][d]] if a.embed_all else [c for d in doc_ids for c in s["chunks_by_doc"][d]])
        print(f"\n  Local embedding ({emb.model}): " + ", ".join(f"{k} {v:,.0f} tok/s" for k, v in throughput.items()))

    # ── query-side context tokens from the accuracy run (top-5) ───────────────
    def ctx_tokens(pipeline_id: str) -> float | None:
        if not acc:
            return None
        p = next((x for x in acc["pipelines"] if x["id"] == pipeline_id), None)
        return p["retrievers"][acc["headline"]]["all"]["ctxTokensTop5"] if p else None

    emb_prices = PRICES["embedding"]
    llm_prices = PRICES["llm_input"]

    def side_result(sid: str, label: str, version: str, chunks_by_doc, reembed_chunks_per_doc, reembed_tokens_per_doc, pipeline_id):
        n_chunks, tokens, store = totals(chunks_by_doc)
        reembed_tokens = reembed_tokens_per_doc * n_files
        ctx = ctx_tokens(pipeline_id)
        acc_p = next((x for x in acc["pipelines"] if x["id"] == pipeline_id), None)
        accuracy = None if not acc_p else {k: acc_p["retrievers"][acc["headline"]]["all"][k] for k in ("recallAt1000Tok", "recall1", "recall5", "mrr10")} | {"retriever": acc["headline"]}
        per_doc = {d: {"chunks": len(cs), "tokens": sum(c.tokens for c in cs), "bytes": sum(len(c.embed_text.encode()) for c in cs)} for d, cs in chunks_by_doc.items()}
        return {
            "id": sid, "label": label, "version": version, "files": n_files, "perDoc": per_doc,
            "accuracy": accuracy, "chunks": n_chunks, "embedTokens": tokens, "chunkStoreBytes": store,
            "embedUsd": {k: tokens / 1e6 * p["usd_per_1m_tokens"] for k, p in emb_prices.items()},
            "localEmbedSeconds": (tokens / throughput[sid]) if throughput else None,
            "reindex": {"chunksPerEditedDoc": reembed_chunks_per_doc, "tokensPerEditedDoc": reembed_tokens_per_doc,
                        "tokensAllDocsEdited": reembed_tokens,
                        "usd": {k: reembed_tokens / 1e6 * p["usd_per_1m_tokens"] for k, p in emb_prices.items()}},
            "query": None if ctx is None else {"ctxTokensPerQuery": ctx, "queries": a.queries, "inputTokens": ctx * a.queries,
                                              "usd": {k: ctx * a.queries / 1e6 * p["usd_per_1m_tokens"] for k, p in llm_prices.items()}},
        }

    sides = [side_result("jdf", "JDF · jdf chunk (section)", jdf.version, jdf_chunks_by_doc, jdf_reembed_chunks_d01, jdf_reembed_tokens_d01, "jdf")]
    for s in pdf_sides:
        d01 = s["chunks_by_doc"]["d01"]
        # PDF has no chunk identity: an edit anywhere means re-chunk + re-embed the whole document.
        sides.append(side_result(s["id"], s["label"], s["version"], s["chunks_by_doc"], len(d01), sum(c.tokens for c in d01), pdf_pipe["id"]))

    out = {
        "date": date.today().isoformat(), "machine": machine(), "files": n_files, "corpusDocuments": len(doc_ids),
        "pdfPipeline": pdf_pipe["id"], "pdfChunking": {"chars": size, "overlap": overlap}, "queries": a.queries,
        "embedding": {"provider": emb.provider, "model": emb.model, "version": emb.version, "measuredOn": "all chunks" if a.embed_all else f"first {a.embed_sample} unique chunks per pipeline", "tokensPerSecond": throughput} if emb else None,
        "prices": PRICES, "sides": sides,
    }

    # ── print ─────────────────────────────────────────────────────────────────
    ek = list(emb_prices)[0]; lk = list(llm_prices)[0]
    print(f"\nPer {n_files:,} documents{'':<32} " + " ".join(f"{s['id'][:18]:>18}" for s in sides))
    row = lambda name, f: print(f"  {name:<44} " + " ".join(f"{f(s):>18}" for s in sides))
    pc = lambda x: f"{x * 100:.1f}%"
    row(f"accuracy · answer in first 1k tokens ({sides[0]['accuracy']['retriever'][6:]})", lambda s: pc(s["accuracy"]["recallAt1000Tok"]) if s["accuracy"] else "—")
    row("accuracy · top-1 hit", lambda s: pc(s["accuracy"]["recall1"]) if s["accuracy"] else "—")
    row("chunks", lambda s: fmt_int(s["chunks"]))
    row("embedding tokens (initial index)", lambda s: fmt_int(s["embedTokens"]))
    row(f"embedding $ ({ek})", lambda s: fmt_usd(s["embedUsd"][ek]))
    if throughput:
        row(f"local embedding time ({emb.model.split('/')[-1]})", lambda s: fmt_secs(s["localEmbedSeconds"]))
    row("vector-store payload (MB)", lambda s: f"{s['chunkStoreBytes'] / 1e6:,.1f}")
    row("re-embed tokens, 1 paragraph edited per doc", lambda s: fmt_int(s["reindex"]["tokensAllDocsEdited"]))
    if sides[0]["query"]:
        row(f"LLM input tokens per {a.queries:,} queries", lambda s: fmt_int(s["query"]["inputTokens"]) if s["query"] else "—")
        row(f"LLM input $ ({lk})", lambda s: fmt_usd(s["query"]["usd"][lk]) if s["query"] else "—")

    if a.verify:
        pub_f = RESULTS / "cost-latest.json"
        if not pub_f.exists():
            print("\nno published cost results to compare"); return 1
        pub = json.loads(pub_f.read_text()); fails = 0
        for ps in pub["sides"]:
            fs = next((x for x in sides if x["id"] == ps["id"]), None)
            if not fs:
                print(f"  ✗ {ps['id']} missing in this run"); fails += 1; continue
            # Recompute the published totals for the published N from this run's per-document
            # counts (file i is document i mod 24) — exact at any --files, so verify can be quick.
            pub_files = [doc_ids[i % len(doc_ids)] for i in range(ps["files"])]
            expect = {k: sum(fs["perDoc"][d][src] for d in pub_files) for k, src in (("chunks", "chunks"), ("embedTokens", "tokens"), ("chunkStoreBytes", "bytes"))}
            for k, v in expect.items():
                if ps[k] != v:
                    print(f"  ✗ {ps['id']} {k}: published {ps[k]:,} vs recomputed {v:,}"); fails += 1
            if ps["reindex"]["tokensPerEditedDoc"] != fs["reindex"]["tokensPerEditedDoc"]:
                print(f"  ✗ {ps['id']} re-index tokens differ"); fails += 1
            if fails == 0:
                print(f"  ✓ {ps['id']}: chunks {ps['chunks']:,}, tokens {ps['embedTokens']:,}, store {ps['chunkStoreBytes']:,} B reproduce for {ps['files']:,} files")
        print("\nVERIFIED — counts reproduce exactly (embedding throughput is machine-dependent and not compared)." if fails == 0 else f"\nFAILED — {fails} discrepancy(ies).")
        return 1 if fails else 0

    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "cost-latest.json").write_text(json.dumps(out, indent=2) + "\n")
    print(f"\n→ results/cost-latest.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
