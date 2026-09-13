import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, Easing } from "remotion";
import example from "./example.json";

// Seven uniform 3.6 s scenes; every screen that carries information holds ≥ 1.8 s.
export const FPS = 30;
const SCENE = 3.6, BEAT = 1.8;
const T = { open: 0, doc: SCENE, transcribe: SCENE * 2, chunk: SCENE * 3, ask: SCENE * 4, folder: SCENE * 5, outro: SCENE * 6, end: SCENE * 7 };
export const DURATION_FRAMES = Math.round(T.end * FPS);
const s = (sec: number) => Math.round(sec * FPS);

const font = "Inter, -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const mono = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const C = { bg: "#05080f", text: "#f8fafc", soft: "#94a3b8", jdf: "#60a5fa", jdf2: "#2563eb", good: "#34d399", bad: "#f87171", key: "#93c5fd", str: "#86efac", num: "#fcd34d" };

// ── data: the shipped example (docs/examples/video.jdf) ─────────────────────
const video: any = (example as any).pages[0].elements.find((e: any) => e.type === "video");
const segs: { t0: number; t1: number; text: string }[] = video.transcript.segments;
const chapters: { t: number; title: string }[] = video.chapters;
const fmt = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.round(t % 60)).padStart(2, "0")}`;
const chapterAt = (t: number) => [...chapters].reverse().find((c) => c.t <= t + 1e-6)?.title ?? "";
// The chunk `jdf chunk` emits for the 3rd window — same shape as the CLI output.
const hitSeg = segs[2];
const hitChunk = { id: `${video.id}@${Math.round(hitSeg.t0)}`, path: [(example as any).meta.title, video.title, chapterAt(hitSeg.t0)], media: { element: video.id, t0: hitSeg.t0, t1: hitSeg.t1 }, text: `[${fmt(hitSeg.t0)}–${fmt(hitSeg.t1)}] ${hitSeg.text}` };

// ── fx ──────────────────────────────────────────────────────────────────────
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const easeOut = (f: number, a: number, b: number) => (f >= b ? 1 : interpolate(f, [a, b], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }));
const slam = (frame: number, at: number) => { const f = frame - s(at); const p = spring({ frame: f, fps: FPS, config: { damping: 16, stiffness: 180, mass: 0.9 } }); return { scale: 1.6 - 0.6 * p, opacity: f < 0 ? 0 : Math.min(1, f / 3), shake: f >= 0 && f < 12 ? Math.sin(f * 2.2) * (12 - f) * 1.2 : 0, glitch: f >= 0 && f < 6 }; };
const Cut: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => { const frame = useCurrentFrame(); return frame < s(from) || frame >= s(to) ? null : <AbsoluteFill>{children}</AbsoluteFill>; };
const Flash: React.FC<{ at: number }> = ({ at }) => { const frame = useCurrentFrame(); const o = interpolate(frame - s(at), [0, 1, 4], [0, 0.55, 0], clamp); return o > 0 ? <AbsoluteFill style={{ background: "#fff", opacity: o }} /> : null; };
const Bg: React.FC = () => { const frame = useCurrentFrame(); return (
  <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at 50% 40%, #0f1a33 0%, ${C.bg} 70%)` }}>
    <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(96,165,250,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.06) 1px, transparent 1px)", backgroundSize: "64px 64px", transform: `translateY(${(frame * 0.6) % 64}px)` }} />
    <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 4px)" }} />
    <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 220px rgba(0,0,0,0.85)" }} />
  </AbsoluteFill>); };
const Glitch: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => (
  <div style={{ position: "relative" }}>
    {on && <div style={{ position: "absolute", inset: 0, color: "#f87171", transform: "translate(-4px,0)", opacity: 0.7, mixBlendMode: "screen" }} aria-hidden>{children}</div>}
    {on && <div style={{ position: "absolute", inset: 0, color: "#22d3ee", transform: "translate(4px,0)", opacity: 0.7, mixBlendMode: "screen" }} aria-hidden>{children}</div>}
    <div>{children}</div>
  </div>);
const Slam: React.FC<{ at: number; size?: number; color?: string; sub?: string; children: React.ReactNode }> = ({ at, size = 120, color = C.text, sub, children }) => { const frame = useCurrentFrame(); const a = slam(frame, at); return (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: a.opacity, transform: `translate(${a.shake}px,${-a.shake * 0.6}px) scale(${a.scale})`, fontFamily: font, textAlign: "center" }}>
    <Glitch on={a.glitch}><div style={{ fontSize: size, fontWeight: 900, letterSpacing: -3, lineHeight: 1, color }}>{children}</div></Glitch>
    {sub && <div style={{ fontSize: 24, color: C.soft, marginTop: 18, letterSpacing: 3, textTransform: "uppercase" }}>{sub}</div>}
  </div>); };
const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ position: "absolute", left: 48, top: 36, fontFamily: mono, fontSize: 15, letterSpacing: 3, color: C.soft, textTransform: "uppercase" }}>{children}</div>;
const Term: React.FC<{ lines: { text: string; at: number; color?: string }[]; from: number; width?: number }> = ({ lines, from, width = 1180 }) => { const frame = useCurrentFrame(); const f = frame - s(from); return (
  <div style={{ position: "absolute", left: 50, top: 110, width, fontFamily: mono, fontSize: 22, lineHeight: 1.6, color: "#e2e8f0", background: "rgba(2,6,23,0.75)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 14, padding: "20px 26px" }}>
    {lines.map((l, i) => { const st = s(l.at); if (f < st) return null; const typed = l.text.startsWith("$") ? l.text.slice(0, Math.min(l.text.length, Math.floor((f - st) * 1.6))) : l.text; return <div key={i} style={{ color: l.color ?? "#e2e8f0", whiteSpace: "pre-wrap", opacity: l.text.startsWith("$") ? 1 : Math.min(1, (f - st) / 4) }}>{typed}{l.text.startsWith("$") && typed.length < l.text.length ? "▌" : ""}</div>; })}
  </div>); };

// ── scenes ──────────────────────────────────────────────────────────────────
const Open: React.FC = () => { const frame = useCurrentFrame(); const words = ["A VIDEO", "INSIDE A DOCUMENT"]; const per = s(BEAT) / words.length; const i = Math.min(words.length - 1, Math.floor(frame / per)); return (
  <>
    {frame < s(BEAT) ? <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font }}><Glitch on={frame - i * per < 2}><div style={{ fontSize: 96, fontWeight: 900, letterSpacing: 6, color: C.text }}>{words[i]}</div></Glitch></div>
      : <Slam at={BEAT} size={150} sub="how does RAG search it?"><span style={{ color: C.jdf }}>JDF</span> can.</Slam>}
    <Flash at={BEAT} />
  </>); };

const Doc: React.FC = () => { const frame = useCurrentFrame(); const f = frame - s(T.doc); const p = easeOut(f, 0, s(1.2)); return (
  <div style={{ position: "absolute", inset: 0, fontFamily: font, color: C.text }}>
    <Tag>docs/examples/video.jdf · a real file from the repo</Tag>
    <div style={{ position: "absolute", left: 80, top: 110, width: 1120, background: "#fff", color: "#0f172a", borderRadius: 12, padding: "40px 56px", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", transform: `translateY(${(1 - p) * 40}px)`, opacity: p }}>
      <div style={{ fontSize: 34, fontWeight: 800 }}>{(example as any).meta.title}</div>
      <div style={{ fontSize: 16, color: "#475569", marginTop: 10, lineHeight: 1.5 }}>A video element plays inline in jdf.js and the desktop reader…</div>
      <div style={{ marginTop: 22, height: 300, background: "#05080f", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ width: 0, height: 0, borderLeft: "48px solid #f8fafc", borderTop: "30px solid transparent", borderBottom: "30px solid transparent" }} />
        <div style={{ position: "absolute", left: 20, right: 20, bottom: 18, height: 6, background: "rgba(255,255,255,0.25)", borderRadius: 3 }}><div style={{ width: `${30 * p}%`, height: "100%", background: C.jdf, borderRadius: 3 }} /></div>
        <div style={{ position: "absolute", right: 20, bottom: 32, fontFamily: mono, fontSize: 14, color: "#cbd5e1" }}>{fmt(0)} / {fmt(segs[segs.length - 1].t1)}</div>
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 10 }}>{video.title}</div>
    </div>
    <div style={{ position: "absolute", left: 80, right: 80, bottom: 40, fontSize: 22, color: C.soft, textAlign: "center" }}>PDF can’t even hold it. A search index sees <b style={{ color: C.bad }}>“[video]”</b> — nothing else.</div>
  </div>); };

const Transcribe: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, fontFamily: font, color: C.text }}>
    <Tag>step 1 · time-stamped text, stored in the document (not an asset)</Tag>
    <Term from={T.transcribe} lines={[
      { text: "$ jdf transcribe video.jdf --from talk.srt --chapters chapters.txt", at: 0 },
      { text: `Transcribed: video.jdf → element "${video.id}" (${segs.length} segments, ${Math.round(segs[segs.length - 1].t1)} s, source srt-import)`, at: 0.9, color: C.good },
      { text: `Chapters:    ${chapters.length}`, at: 1.0, color: C.soft },
      { text: " ", at: 1.1 },
      ...segs.slice(0, 4).map((sg, i) => ({ text: `  ${fmt(sg.t0)}–${fmt(sg.t1)}  ${sg.text.length > 88 ? sg.text.slice(0, 85) + "…" : sg.text}`, at: 1.3 + i * 0.25, color: i === 2 ? C.key : "#cbd5e1" })),
      { text: "  …  also: --provider whisper-cli (local) · --provider openai --prompt \"JDF, Ollama\"", at: 2.5, color: C.soft },
    ]} />
    <div style={{ position: "absolute", left: 50, right: 50, bottom: 40, fontSize: 21, color: C.soft }}>SRT / VTT import works offline. Whisper runs locally with whisper.cpp, or through the OpenAI audio API. Same JSON either way.</div>
  </div>);

const Chunk: React.FC = () => { const frame = useCurrentFrame(); const f = frame - s(T.chunk); const show = f > s(0.9); const json = JSON.stringify(hitChunk, null, 2).split("\n"); const colour = (l: string) => l.includes('"media"') || l.includes('"t0"') || l.includes('"t1"') || l.includes('"element"') ? C.num : l.includes('"path"') ? C.key : C.text; return (
  <div style={{ position: "absolute", inset: 0, fontFamily: font, color: C.text }}>
    <Tag>step 2 · jdf chunk — every window knows its element and its seconds</Tag>
    <Term from={T.chunk} lines={[{ text: "$ jdf chunk video.jdf --window 45", at: 0 }, { text: `Done! 8 chunks — 7 from the transcript, each with media.t0 / media.t1`, at: 0.8, color: C.good }]} width={1180} />
    <div style={{ position: "absolute", left: 50, top: 250, width: 1180, opacity: show ? Math.min(1, (f - s(0.9)) / 6) : 0, fontFamily: mono, fontSize: 20, lineHeight: 1.45, background: "rgba(2,6,23,0.85)", border: `1px solid ${C.jdf}55`, borderRadius: 14, padding: "18px 26px", boxShadow: `0 0 60px ${C.jdf}22` }}>
      {json.map((l, i) => <div key={i} style={{ color: colour(l), whiteSpace: "pre" }}>{l.length > 118 ? l.slice(0, 115) + "…" : l}</div>)}
    </div>
  </div>); };

const Ask: React.FC = () => { const frame = useCurrentFrame(); const f = frame - s(T.ask); const q = "How much less LLM spend per question?"; const typed = q.slice(0, Math.min(q.length, Math.floor(f * 1.4))); const hit = f >= s(BEAT); const seek = f >= s(BEAT) + 12; return (
  <div style={{ position: "absolute", inset: 0, fontFamily: font, color: C.text }}>
    <Tag>step 3 · a question hits the transcript, the viewer seeks to the second</Tag>
    <div style={{ position: "absolute", left: 50, top: 110, width: 1180, fontFamily: mono, fontSize: 30, background: "rgba(2,6,23,0.75)", border: "1px solid rgba(148,163,184,0.25)", borderRadius: 14, padding: "18px 26px" }}><span style={{ color: C.soft }}>? </span>{typed}<span style={{ opacity: Math.floor(f / 3) % 2 ? 0 : 1 }}>▌</span></div>
    {hit && <div style={{ position: "absolute", left: 50, top: 215, width: 1180, opacity: Math.min(1, (f - s(BEAT)) / 5), background: "rgba(52,211,153,0.08)", border: `1px solid ${C.good}88`, borderRadius: 14, padding: "20px 26px" }}>
      <div style={{ fontFamily: mono, fontSize: 16, color: C.good, letterSpacing: 2 }}>TOP HIT · {hitChunk.path.join(" › ")}</div>
      <div style={{ fontSize: 26, marginTop: 10, lineHeight: 1.35 }}>{hitChunk.text}</div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ fontFamily: mono, fontSize: 20, color: C.jdf, border: `2px solid ${C.jdf}`, borderRadius: 10, padding: "8px 16px", whiteSpace: "nowrap", transform: `scale(${seek ? 1 + 0.15 * Math.max(0, 1 - (f - s(BEAT) - 12) / 8) : 1})` }}>viewer.seek("{video.id}", {hitChunk.media.t0})</div>
        <div style={{ fontSize: 20, color: C.soft }}>→ the video scrolls into view and plays from {fmt(hitChunk.media.t0)}. Captions on, from the same transcript.</div>
      </div>
    </div>}
    <Flash at={T.ask + BEAT} />
  </div>); };

const Folder: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, fontFamily: font, color: C.text }}>
    <Tag>step 4 · a whole folder, one command</Tag>
    <Term from={T.folder} lines={[
      { text: "$ jdf rag ./knowledge-base --transcribe openai", at: 0 },
      { text: "jdf rag: ./knowledge-base", at: 1.0, color: C.soft },
      { text: "  files:      212 (.jdf/.jdfx)   config: jdf.rag.json", at: 1.1, color: C.soft },
      { text: "  embeddings: ollama / nomic-embed-text   transcribe: openai", at: 1.2, color: C.soft },
      { text: "  …", at: 1.3, color: C.soft },
      { text: "Done. 212 files → 4,918 chunks (611 from video transcripts); videos 37, transcribed now 5, still without transcript 0.", at: 1.7, color: C.good },
      { text: "Index:  knowledge-base/.jdf-rag/index.jsonl   Vectors: one <file>.embeddings.json per document, incremental", at: 1.9, color: "#cbd5e1" },
    ]} />
    <div style={{ position: "absolute", left: 50, right: 50, bottom: 40, fontSize: 21, color: C.soft }}>Finds every .jdf / .jdfx, transcribes what is missing, chunks, embeds only what changed, writes one index. Defaults from jdf.rag.json — ingestion config, nothing is trained. <span style={{ color: C.soft, fontStyle: "italic" }}>(numbers on this screen are illustrative)</span></div>
  </div>);

const Outro: React.FC = () => { const frame = useCurrentFrame(); const f = frame - s(T.outro); const a = slam(frame, T.outro); const cmd = "jdf transcribe · jdf chunk · jdf rag".slice(0, Math.max(0, Math.floor((f - s(0.6)) * 0.9))); return (
  <div style={{ position: "absolute", inset: 0, fontFamily: font, color: C.text }}>
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: a.opacity, transform: `translate(${a.shake}px,0) scale(${a.scale})` }}>
      <Glitch on={a.glitch}><div style={{ fontSize: 76, fontWeight: 900, letterSpacing: -2, textAlign: "center" }}>VIDEO IS <span style={{ color: C.jdf }}>TEXT WITH TIMESTAMPS.</span></div></Glitch>
      <div style={{ marginTop: 26, fontFamily: mono, fontSize: 30, color: C.good }}>{cmd}<span style={{ opacity: Math.floor(f / 3) % 2 ? 0 : 1 }}>▌</span></div>
      <div style={{ marginTop: 22, fontSize: 20, color: C.soft }}>jdf.dev/docs/cli.html · open source · MIT</div>
    </div>
    <Flash at={T.outro} />
  </div>); };

export const VideoRag: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    {/* "Epical Drums 05" — Grigoriy Nuzhny, Mixkit Stock Music Free License (fetched by scripts/fetch-music.ts). */}
    <Audio src={staticFile("music.mp3")} volume={(f) => interpolate(f, [0, 20, DURATION_FRAMES - 40, DURATION_FRAMES], [0, 0.85, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    <Bg />
    <Cut from={T.open} to={T.doc}><Open /></Cut>
    <Cut from={T.doc} to={T.transcribe}><Doc /></Cut>
    <Cut from={T.transcribe} to={T.chunk}><Transcribe /></Cut>
    <Cut from={T.chunk} to={T.ask}><Chunk /></Cut>
    <Cut from={T.ask} to={T.folder}><Ask /></Cut>
    <Cut from={T.folder} to={T.outro}><Folder /></Cut>
    <Cut from={T.outro} to={T.end}><Outro /></Cut>
  </AbsoluteFill>
);
