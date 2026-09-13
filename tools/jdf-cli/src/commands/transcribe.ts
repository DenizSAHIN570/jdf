import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
import type { JdfDocument, VideoTranscript, TranscriptSegment } from "@jdf/core";
import { JDFX_DOCUMENT_PATH } from "@jdf/core";
import { packJdfx } from "../jdfx";

/**
 * `jdf transcribe` — attach time-stamped text to a video element so RAG can
 * use the video. The transcript is stored INSIDE document.json (it is text),
 * so a .jdf stays a single JSON file; only the clip itself is an asset.
 *
 * Three ways to get the text, all writing the same `transcript` shape:
 *   --from captions.srt|.vtt|.json   import existing subtitles (always works, offline)
 *   --provider whisper-cli           local whisper.cpp (`whisper-cli`) + ffmpeg
 *   --provider openai                OpenAI audio transcription API (OPENAI_API_KEY)
 *
 * The clip is resolved from the element: a bundled asset (resources.videos),
 * a data: URL, a local path, or an http(s) URL (downloaded to a temp file).
 * Nothing is sent anywhere unless you pick --provider openai.
 */
export interface TranscribeOptions {
  /** Element id (or 0-based index among video elements). Default: the only/first video. */
  element?: string;
  /** Subtitle file to import instead of running a model. */
  from?: string;
  provider?: "whisper-cli" | "openai";
  model?: string;
  language?: string;
  /** Whisper "prompt": names, acronyms and spelling hints the model should prefer (not an instruction). */
  prompt?: string;
  output?: string;
  /** Optional chapters file: JSON [{t,title}] or "mm:ss Title" lines. */
  chapters?: string;
}

// ── subtitle parsing ────────────────────────────────────────────────────────
const toSec = (ts: string): number => {
  const m = ts.trim().replace(",", ".").match(/^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/);
  if (!m) throw new Error(`bad timestamp "${ts}"`);
  return (m[1] ? Number(m[1]) * 3600 : 0) + Number(m[2]) * 60 + Number(m[3]);
};

export function parseSubtitles(text: string, filename = ""): TranscriptSegment[] {
  const trimmed = text.replace(/^﻿/, "").trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    // JSON: either our own {segments:[...]} or Whisper-style {segments:[{start,end,text}]} or a bare array.
    const j = JSON.parse(trimmed);
    const arr: any[] = Array.isArray(j) ? j : Array.isArray(j.segments) ? j.segments : [];
    return arr.map((sg) => ({
      t0: Number(sg.t0 ?? sg.start ?? sg.from ?? 0),
      t1: Number(sg.t1 ?? sg.end ?? sg.to ?? 0),
      text: String(sg.text ?? "").trim(),
      ...(sg.speaker ? { speaker: String(sg.speaker) } : {}),
    })).filter((sg) => sg.text);
  }
  // SRT / WebVTT: blocks separated by blank lines, a "t0 --> t1" line, then text.
  const segs: TranscriptSegment[] = [];
  for (const block of trimmed.split(/\r?\n\r?\n+/)) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim() !== "" && l.trim() !== "WEBVTT");
    const ti = lines.findIndex((l) => l.includes("-->"));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split("-->").map((x) => x.trim().split(/\s+/)[0]);
    const body = lines.slice(ti + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!body) continue;
    segs.push({ t0: toSec(a), t1: toSec(b), text: body });
  }
  if (!segs.length) throw new Error(`no cues found in ${filename || "subtitle input"} (expected SRT, WebVTT or JSON segments)`);
  return segs;
}

export function parseChapters(text: string): { t: number; title: string }[] {
  const t = text.trim();
  if (t.startsWith("[")) return (JSON.parse(t) as any[]).map((c) => ({ t: Number(c.t ?? c.start ?? 0), title: String(c.title ?? "") }));
  return t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(\S+)\s+(.+)$/);
    if (!m) throw new Error(`bad chapter line "${l}" (expected "mm:ss Title")`);
    return { t: toSec(m[1]), title: m[2].trim() };
  });
}

// ── document IO ─────────────────────────────────────────────────────────────
async function loadDoc(file: string): Promise<{ doc: JdfDocument; bundle: boolean; zip?: JSZip }> {
  if (file.toLowerCase().endsWith(".jdfx")) {
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    const f = zip.file(JDFX_DOCUMENT_PATH);
    if (!f) throw new Error(`Bundle missing ${JDFX_DOCUMENT_PATH}`);
    const doc = JSON.parse(await f.async("string")) as JdfDocument;
    // Bind assets so a whisper run can find the clip bytes.
    const manifest = zip.file("manifest.json") ? JSON.parse(await zip.file("manifest.json")!.async("string")) : { assets: [] };
    for (const a of manifest.assets ?? []) {
      const af = zip.file(a.path); if (!af) continue;
      const data = (await af.async("nodebuffer")).toString("base64");
      const res = { src: "embedded" as const, mimeType: a.mimeType, data };
      doc.resources ??= {};
      if (/^video\//i.test(a.mimeType || "")) (doc.resources.videos ??= {})[a.id] = res; else (doc.resources.images ??= {})[a.id] = res;
    }
    return { doc, bundle: true, zip };
  }
  return { doc: JSON.parse(fs.readFileSync(file, "utf-8")), bundle: false };
}

function findVideos(doc: JdfDocument): { el: any; page: number; index: number }[] {
  const out: { el: any; page: number; index: number }[] = [];
  const walk = (els: any[] | undefined, page: number) => { for (const el of els ?? []) { if (el?.type === "video") out.push({ el, page, index: out.length }); if (el?.elements) walk(el.elements, page); } };
  doc.pages.forEach((p, i) => walk(p.elements as any[], i + 1));
  return out;
}

/** Materialise the clip to a temp file for whisper. Returns null when the clip is not reachable. */
async function clipToTempFile(doc: JdfDocument, el: any, docDir: string): Promise<string | null> {
  const tmp = path.join(fs.mkdtempSync(path.join(require("node:os").tmpdir(), "jdf-transcribe-")), "clip.mp4");
  const res = el.resource ? (doc.resources?.videos?.[el.resource] ?? doc.resources?.images?.[el.resource]) : undefined;
  if (res?.data) { fs.writeFileSync(tmp, Buffer.from(res.data.replace(/^data:[^,]*,/, ""), "base64")); return tmp; }
  if (res?.path) return path.resolve(docDir, res.path);
  const src: string | undefined = el.src;
  if (!src) return null;
  if (src.startsWith("data:")) { fs.writeFileSync(tmp, Buffer.from(src.replace(/^data:[^,]*,/, ""), "base64")); return tmp; }
  if (/^https?:\/\//i.test(src)) { const r = await fetch(src); if (!r.ok) throw new Error(`download failed ${r.status}: ${src}`); fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer())); return tmp; }
  const local = path.resolve(docDir, src);
  return fs.existsSync(local) ? local : null;
}

// ── providers ───────────────────────────────────────────────────────────────
function whisperCli(clip: string, model: string | undefined, language: string | undefined, prompt: string | undefined): TranscriptSegment[] {
  const ffmpeg = spawnSync("ffmpeg", ["-version"]); if (ffmpeg.error) throw new Error("ffmpeg not found — needed to extract audio for whisper-cli (brew install ffmpeg)");
  const wav = clip.replace(/\.[^.]+$/, "") + ".16k.wav";
  const ex = spawnSync("ffmpeg", ["-y", "-i", clip, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", wav], { encoding: "utf-8" });
  if (ex.status !== 0) throw new Error(`ffmpeg failed: ${ex.stderr.slice(-400)}`);
  const args = ["-f", wav, "-oj", "-of", wav.replace(/\.wav$/, "")];
  if (model) args.push("-m", model);
  if (language) args.push("-l", language);
  if (prompt) args.push("--prompt", prompt);
  const run = spawnSync("whisper-cli", args, { encoding: "utf-8" });
  if (run.error) throw new Error("whisper-cli not found — install whisper.cpp (brew install whisper-cpp) or use --from / --provider openai");
  if (run.status !== 0) throw new Error(`whisper-cli failed: ${run.stderr.slice(-400)}`);
  const j = JSON.parse(fs.readFileSync(wav.replace(/\.wav$/, "") + ".json", "utf-8"));
  const segs: any[] = j.transcription ?? j.segments ?? [];
  const ms = (x: any) => typeof x === "number" ? x / 1000 : toSec(String(x).replace(",", "."));
  return segs.map((sg) => ({ t0: ms(sg.offsets?.from ?? sg.start), t1: ms(sg.offsets?.to ?? sg.end), text: String(sg.text ?? "").trim() })).filter((sg) => sg.text);
}

async function openaiTranscribe(clip: string, model: string | undefined, language: string | undefined, prompt: string | undefined): Promise<TranscriptSegment[]> {
  const key = process.env.OPENAI_API_KEY; if (!key) throw new Error("OPENAI_API_KEY is not set");
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(clip)]), path.basename(clip));
  form.append("model", model || "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (language) form.append("language", language);
  // Whisper's `prompt` is a spelling/vocabulary hint (product names, acronyms,
  // speaker names), not an instruction — e.g. "JDF, jdfx, Ollama, nomic-embed-text".
  if (prompt) form.append("prompt", prompt);
  const r = await fetch(`${base}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!r.ok) throw new Error(`OpenAI transcription failed ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j: any = await r.json();
  return (j.segments ?? []).map((sg: any) => ({ t0: Number(sg.start), t1: Number(sg.end), text: String(sg.text).trim() })).filter((sg: TranscriptSegment) => sg.text);
}

// ── command ─────────────────────────────────────────────────────────────────
export async function transcribeFile(inputPath: string, opts: TranscribeOptions = {}): Promise<VideoTranscript> {
  const input = path.resolve(inputPath);
  if (!fs.existsSync(input)) throw new Error(`File not found: ${input}`);
  const { doc, bundle } = await loadDoc(input);
  const videos = findVideos(doc);
  if (!videos.length) throw new Error("document has no video element");
  let target = videos[0];
  if (opts.element != null) {
    const byId = videos.find((v) => v.el.id === opts.element);
    const byIdx = /^\d+$/.test(opts.element) ? videos[Number(opts.element)] : undefined;
    target = byId ?? byIdx ?? (() => { throw new Error(`no video element "${opts.element}" (have: ${videos.map((v) => v.el.id ?? `#${v.index}`).join(", ")})`); })();
  } else if (videos.length > 1) {
    throw new Error(`document has ${videos.length} videos — pick one with --element <id|index>`);
  }

  let segments: TranscriptSegment[];
  let source: string;
  if (opts.from) {
    segments = parseSubtitles(fs.readFileSync(path.resolve(opts.from), "utf-8"), opts.from);
    source = `${path.extname(opts.from).slice(1).toLowerCase() || "file"}-import`;
  } else {
    const provider = opts.provider ?? "whisper-cli";
    const clip = await clipToTempFile(doc, target.el, path.dirname(input));
    if (!clip) throw new Error("could not locate the clip bytes (no bundled asset, data URL, local path or http URL) — use --from to import subtitles instead");
    segments = provider === "openai" ? await openaiTranscribe(clip, opts.model, opts.language, opts.prompt) : whisperCli(clip, opts.model, opts.language, opts.prompt);
    source = provider === "openai" ? `openai:${opts.model || "whisper-1"}` : `whisper-cli${opts.model ? ":" + path.basename(opts.model) : ""}`;
  }
  segments.sort((a, b) => a.t0 - b.t0);
  const transcript: VideoTranscript = { ...(opts.language ? { language: opts.language } : {}), source, created: new Date().toISOString(), segments };
  target.el.transcript = transcript;
  if (opts.chapters) target.el.chapters = parseChapters(fs.readFileSync(path.resolve(opts.chapters), "utf-8"));
  if (!target.el.id) target.el.id = `video-${target.index + 1}`;

  const output = opts.output ? path.resolve(opts.output) : input;
  if (output.toLowerCase().endsWith(".jdfx") || (bundle && !opts.output)) {
    const { bytes } = await packJdfx(doc);
    fs.writeFileSync(output, bytes);
  } else {
    fs.writeFileSync(output, JSON.stringify(doc, null, 2));
  }
  const dur = segments.length ? segments[segments.length - 1].t1 : 0;
  console.log(`Transcribed: ${path.basename(input)} → element "${target.el.id}" (${segments.length} segments, ${Math.round(dur)} s, source ${source})`);
  if (target.el.chapters) console.log(`Chapters:    ${target.el.chapters.length}`);
  console.log(`Output:      ${output}\nNext:        jdf chunk ${path.basename(output)}   # transcript → time-windowed chunks with media.t0/t1`);
  return transcript;
}
