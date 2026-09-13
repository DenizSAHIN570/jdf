import fs from "node:fs";
import path from "node:path";
import type { ChunkStrategy } from "./chunk";
import { chunkFile } from "./chunk";
import { embedFile, type EmbeddingProvider } from "./embed";
import { transcribeFile } from "./transcribe";
import JSZip from "jszip";
import { JDFX_DOCUMENT_PATH } from "@jdf/core";

/**
 * `jdf rag <dir>` — one command to make a folder retrieval-ready.
 *
 *   1. find every .jdf / .jdfx under <dir> (recursively, skipping node_modules
 *      and the .jdf-rag output folder)
 *   2. videos without a transcript: transcribe them when a provider is
 *      configured (`--transcribe whisper-cli|openai`); otherwise count and report
 *   3. chunk + embed each file (`jdf embed --incremental` semantics: a sidecar
 *      per file, only changed chunks re-embedded)
 *   4. write <dir>/.jdf-rag/index.jsonl (every chunk + file + media window) and
 *      <dir>/.jdf-rag/manifest.json (what was done, what was skipped)
 *
 * Defaults come from <dir>/jdf.rag.json when present (same keys as the flags),
 * flags win. It is an INGESTION config, not a training config — nothing is
 * trained; the folder is chunked and embedded so a retriever can search it.
 */
export interface RagOptions {
  provider?: EmbeddingProvider;
  model?: string;
  strategy?: ChunkStrategy;
  maxTokens?: number;
  transcriptWindowSec?: number;
  /** "none" (default) | "whisper-cli" | "openai" */
  transcribe?: "none" | "whisper-cli" | "openai";
  transcribeModel?: string;
  language?: string;
  prompt?: string;
  /** Skip embedding (chunk + index only). */
  noEmbed?: boolean;
  dryRun?: boolean;
  out?: string;
}

const CONFIG_NAME = "jdf.rag.json";
const OUT_DIR = ".jdf-rag";

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === OUT_DIR || ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(jdf|jdfx)$/i.test(ent.name)) acc.push(p);
  }
  return acc.sort();
}

async function readDoc(file: string): Promise<any> {
  if (file.toLowerCase().endsWith(".jdfx")) {
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    return JSON.parse(await zip.file(JDFX_DOCUMENT_PATH)!.async("string"));
  }
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function videosIn(doc: any): { id?: string; hasTranscript: boolean }[] {
  const out: { id?: string; hasTranscript: boolean }[] = [];
  const w = (els: any[] | undefined) => { for (const el of els ?? []) { if (el?.type === "video") out.push({ id: el.id, hasTranscript: !!el.transcript?.segments?.length }); if (el?.elements) w(el.elements); } };
  for (const p of doc.pages ?? []) w(p.elements);
  return out;
}

export async function ragFolder(dirPath: string, cli: RagOptions = {}): Promise<void> {
  const dir = path.resolve(dirPath);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`Not a directory: ${dir}`);
  const cfgPath = path.join(dir, CONFIG_NAME);
  const cfg: RagOptions = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, "utf-8")) : {};
  const opts: RagOptions = { ...cfg, ...Object.fromEntries(Object.entries(cli).filter(([, v]) => v !== undefined)) };
  const provider = opts.provider ?? "ollama";
  const transcribe = opts.transcribe ?? "none";
  const outDir = path.resolve(opts.out ?? path.join(dir, OUT_DIR));

  const files = walk(dir);
  console.log(`jdf rag: ${dir}\n  files:      ${files.length} (.jdf/.jdfx)${fs.existsSync(cfgPath) ? `\n  config:     ${CONFIG_NAME}` : ""}\n  embeddings: ${opts.noEmbed ? "skipped (--no-embed)" : `${provider}${opts.model ? " / " + opts.model : ""}`}\n  transcribe: ${transcribe}${opts.dryRun ? "\n  DRY RUN — nothing written" : ""}\n`);
  if (!files.length) { console.log("Nothing to do."); return; }

  const manifest: any = { dir, created: new Date().toISOString(), provider: opts.noEmbed ? null : provider, model: opts.model ?? null, strategy: opts.strategy ?? "section", transcribe, files: [] as any[], totals: { files: files.length, chunks: 0, videoChunks: 0, videos: 0, transcribed: 0, untranscribed: 0 } };
  const indexLines: string[] = [];

  for (const file of files) {
    const rel = path.relative(dir, file);
    const doc = await readDoc(file);
    const vids = videosIn(doc);
    let transcribedHere = 0;
    for (const v of vids) {
      if (v.hasTranscript) continue;
      if (transcribe === "none") { manifest.totals.untranscribed++; continue; }
      if (opts.dryRun) { transcribedHere++; continue; }
      try {
        await transcribeFile(file, { provider: transcribe, element: v.id, model: opts.transcribeModel, language: opts.language, prompt: opts.prompt });
        transcribedHere++;
      } catch (e: any) {
        console.warn(`  ! ${rel}: transcription failed for video ${v.id ?? "#?"}: ${e.message}`);
        manifest.totals.untranscribed++;
      }
    }
    manifest.totals.videos += vids.length;
    manifest.totals.transcribed += transcribedHere;

    if (opts.dryRun) { manifest.files.push({ file: rel, videos: vids.length, wouldTranscribe: transcribedHere }); continue; }

    const chunkOpts = { strategy: opts.strategy, maxTokens: opts.maxTokens, transcriptWindowSec: opts.transcriptWindowSec };
    const chunkOut = path.join(outDir, "chunks", rel.replace(/\.(jdf|jdfx)$/i, ".chunks.jsonl"));
    fs.mkdirSync(path.dirname(chunkOut), { recursive: true });
    let chunks;
    if (opts.noEmbed) {
      chunks = await chunkFile(file, { ...chunkOpts, format: "jsonl", output: chunkOut });
    } else {
      const side = await embedFile(file, { ...chunkOpts, provider, model: opts.model, incremental: true });
      chunks = await chunkFile(file, { ...chunkOpts, format: "jsonl", output: chunkOut });
      manifest.files.push({ file: rel, chunks: chunks.length, vectors: Object.keys(side.vectors).length, sidecar: path.relative(dir, file.replace(/\.(jdf|jdfx)$/i, ".embeddings.json")), videos: vids.length, transcribed: transcribedHere });
    }
    if (opts.noEmbed) manifest.files.push({ file: rel, chunks: chunks.length, videos: vids.length, transcribed: transcribedHere });
    for (const c of chunks) {
      indexLines.push(JSON.stringify({ file: rel, ...c }));
      manifest.totals.chunks++;
      if (c.media) manifest.totals.videoChunks++;
    }
  }

  if (!opts.dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.jsonl"), indexLines.join("\n") + (indexLines.length ? "\n" : ""));
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  }
  const t = manifest.totals;
  console.log(`\nDone. ${t.files} files → ${t.chunks} chunks (${t.videoChunks} from video transcripts); videos ${t.videos}, transcribed now ${t.transcribed}, still without transcript ${t.untranscribed}${t.untranscribed && transcribe === "none" ? " (pass --transcribe whisper-cli|openai, or jdf transcribe --from subs.srt)" : ""}.`);
  if (!opts.dryRun) console.log(`Index:  ${path.join(outDir, "index.jsonl")}\nReport: ${path.join(outDir, "manifest.json")}${opts.noEmbed ? "" : `\nVectors: one <file>.embeddings.json next to each document (incremental — re-run any time)`}`);
}
