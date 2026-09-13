/**
 * Exports the JDF side of the benchmark as plain data so the Python benchmark
 * (bench/rag_bench.py) needs no Node toolchain:
 *
 *   corpus/jdf-chunks.jsonl         `jdf chunk --strategy section --max-tokens 512`
 *                                   for every document, plus the exact string
 *                                   `jdf embed` sends to the model (embed_text).
 *   corpus/jdf-chunks.d01-edited.jsonl
 *                                   same for d01 after one paragraph is edited —
 *                                   lets Python count how many chunk hashes change
 *                                   (= what `jdf embed --incremental` re-embeds).
 *
 * This is the CLI's real output (same chunkDocument / embeddingInput functions),
 * not a re-implementation. Regenerate after any chunker change:
 *   pnpm --filter @jdf/bench export-chunks
 */
import fs from "node:fs";
import path from "node:path";
import { chunkDocument, embeddingInput } from "../../tools/jdf-cli/src/commands/chunk.ts";
import type { JdfDocument } from "@jdf/core";
import { CORPUS_DIR, DOCS_DIR, MANIFEST_FILE, REPO_ROOT } from "./lib/paths.ts";

const MAX_TOKENS = 512;
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
const cliVersion = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "tools/jdf-cli/package.json"), "utf8")).version as string;

const toLines = (docId: string, doc: JdfDocument) =>
  chunkDocument(doc, { strategy: "section", maxTokens: MAX_TOKENS }).map((c) =>
    JSON.stringify({ id: c.id, doc: docId, text: c.text, embed_text: embeddingInput(c), path: c.path, page: c.page, types: c.types, tokens: c.tokens, hash: c.hash }));

const lines: string[] = [];
for (const d of manifest.documents as { id: string }[]) {
  lines.push(...toLines(d.id, JSON.parse(fs.readFileSync(path.join(DOCS_DIR, `${d.id}.jdf`), "utf8"))));
}
fs.writeFileSync(path.join(CORPUS_DIR, "jdf-chunks.jsonl"), lines.join("\n") + "\n");

// One-paragraph edit in d01 (the Outlook prose element).
const edited: JdfDocument = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, "d01.jdf"), "utf8"));
for (const page of edited.pages) for (const el of page.elements as any[]) {
  if (el.id === "d01-s8-outlook") el.content += " Figures were revised after the board meeting.";
}
fs.writeFileSync(path.join(CORPUS_DIR, "jdf-chunks.d01-edited.jsonl"), toLines("d01", edited).join("\n") + "\n");

// Third pipeline: the PDFs converted back with `jdf convert` (same importer the
// reader and CLI ship) → `jdf chunk`. Answers "I only have PDFs — does converting
// them to JDF get me the JDF advantage?" Chunk ids are prefixed per document.
import { importPdfToJdf } from "../../packages/jdf-pdf-import/src/node.ts";
const convLines: string[] = [];
for (const d of manifest.documents as { id: string }[]) {
  const conv = await importPdfToJdf(path.join(DOCS_DIR, `${d.id}.pdf`), d.id, {});
  for (const c of chunkDocument(conv, { strategy: "section", maxTokens: MAX_TOKENS })) {
    convLines.push(JSON.stringify({ id: `${d.id}-${c.id}`, doc: d.id, text: c.text, embed_text: embeddingInput(c), path: c.path, page: c.page, types: c.types, tokens: c.tokens, hash: c.hash }));
  }
}
fs.writeFileSync(path.join(CORPUS_DIR, "jdf-chunks.converted.jsonl"), convLines.join("\n") + "\n");
console.log(`exported ${convLines.length} chunks from PDF→JDF converted documents → bench/corpus/jdf-chunks.converted.jsonl`);

const meta = { tool: "jdf chunk", cli_version: cliVersion, strategy: "section", max_tokens: MAX_TOKENS, chunks: lines.length, converted_chunks: convLines.length, embed_text: "heading breadcrumb + chunk text (embeddingInput)" };
fs.writeFileSync(path.join(CORPUS_DIR, "jdf-chunks.meta.json"), JSON.stringify(meta, null, 2) + "\n");
console.log(`exported ${lines.length} chunks (jdf-cli ${cliVersion}) → bench/corpus/jdf-chunks.jsonl (+ d01-edited)`);
