import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, Easing } from "remotion";
import bench from "../../../docs/bench.json";

export const FPS = 30;
export const DURATION_FRAMES = FPS * 42;
const s = (sec: number) => Math.round(sec * FPS);

// ── timeline (seconds) ──────────────────────────────────────────────────────
const T = {
  title: 0, setup: 4, accuracy: 10, cost: 25, reindex: 33.5, outro: 38, end: 42,
};

const font = "Inter, -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const mono = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const C = { bg: "#0b1220", panel: "#111a2e", text: "#f1f5f9", soft: "#94a3b8", line: "rgba(148,163,184,0.18)", jdf: "#60a5fa", jdf2: "#3b82f6", pdf: "#94a3b8", pdf2: "#64748b", good: "#34d399" };

// ── data (all from docs/bench.json) ─────────────────────────────────────────
type Pipe = (typeof bench.accuracy.pipelines)[number];
const acc = bench.accuracy;
const cost = bench.cost!;
const pipes: Pipe[] = acc.pipelines as Pipe[];
const jdf = pipes.find((p) => p.id === "jdf")!;
const retrievers = Object.keys(jdf.retrievers);
const label = (r: string) => (r === "bm25" ? "BM25 (lexical)" : r.replace(/^dense:/, "").split("/").pop()!.replace("-en-v1.5", "").replace("all-", ""));
const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
const int = (x: number) => Math.round(x).toLocaleString("en-US");
const usd = (x: number) => (x >= 1 ? `$${x.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${x.toFixed(4)}`);
const METRIC = "recallAt1000Tok" as const;

/** JDF + each PDF parser's best config for the metric under a retriever. */
function rows(r: string) {
  const byTool = new Map<string, Pipe>();
  for (const p of pipes.filter((x) => x.format === "pdf")) {
    const cur = byTool.get(p.tool);
    if (!cur || (p.retrievers as any)[r].all[METRIC] > (cur.retrievers as any)[r].all[METRIC]) byTool.set(p.tool, p);
  }
  const pdf = [...byTool.values()].sort((a, b) => (b.retrievers as any)[r].all[METRIC] - (a.retrievers as any)[r].all[METRIC]);
  return [jdf, ...pdf].map((p) => ({
    name: p.format === "jdf" ? "JDF" : `PDF · ${p.tool.split(" ")[0]}`,
    sub: p.format === "jdf" ? "jdf chunk · section" : p.label.replace(/^.*fixed /, "fixed ") + " chars",
    isJdf: p.format === "jdf",
    v: (p.retrievers as any)[r].all[METRIC] as number,
    ctx: (p.retrievers as any)[r].all.ctxTokensTop5 as number,
  }));
}
// Order the retriever showcase: headline first, then the rest (BM25 last).
const showcase = [acc.headline, ...retrievers.filter((r) => r !== acc.headline && r !== "bm25"), "bm25"].filter((r, i, a) => a.indexOf(r) === i);

// ── helpers ─────────────────────────────────────────────────────────────────
const fade = (frame: number, from: number, to: number, inD = 12, outD = 12) =>
  interpolate(frame, [s(from), s(from) + inD, s(to) - outD, s(to)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const rise = (frame: number, at: number, d = 14) => interpolate(frame, [s(at), s(at) + d], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

const Scene: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const a = fade(frame, from, to);
  if (frame < s(from) - 1 || frame > s(to) + 1) return null;
  return <AbsoluteFill style={{ opacity: a }}>{children}</AbsoluteFill>;
};

const Caption: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const a = fade(frame, from, to, 8, 8);
  if (a <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, display: "flex", justifyContent: "center", opacity: a, transform: `translateY(${rise(frame, from, 8)}px)` }}>
      <div style={{ background: "rgba(241,245,249,0.96)", color: "#0f172a", fontFamily: font, fontSize: 20, fontWeight: 500, padding: "11px 20px", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.35)", maxWidth: 1040, textAlign: "center", lineHeight: 1.35 }}>
        {children}
      </div>
    </div>
  );
};

const Brand: React.FC = () => (
  <div style={{ position: "absolute", left: 40, top: 28, display: "flex", alignItems: "center", gap: 10, fontFamily: font, color: C.text }}>
    <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 11, color: "#fff", letterSpacing: -0.5 }}>JDF</div>
    <span style={{ fontWeight: 700, fontSize: 16 }}>JDF</span>
    <span style={{ color: C.soft, fontSize: 14 }}>/ RAG benchmark</span>
  </div>
);

// ── scenes ──────────────────────────────────────────────────────────────────
const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const y = rise(frame, T.title + 0.2, 20);
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, color: C.text }}>
      <div style={{ textAlign: "center", transform: `translateY(${y}px)` }}>
        <div style={{ fontSize: 15, letterSpacing: 3, textTransform: "uppercase", color: C.soft, marginBottom: 18 }}>the same documents, two formats, one RAG pipeline</div>
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2, lineHeight: 1.05 }}>
          <span style={{ color: C.pdf }}>PDF</span> vs <span style={{ color: C.jdf }}>JDF</span> for RAG
        </div>
        <div style={{ fontSize: 22, color: C.soft, marginTop: 22 }}>
          {acc.corpus.documents} reports · {acc.corpus.pages} pages · {acc.corpus.questions} questions with known answers · {acc.embeddings.length} embedding models + BM25
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Setup: React.FC = () => {
  const frame = useCurrentFrame();
  const step = (i: number) => spring({ frame: frame - s(T.setup + 0.4 + i * 0.55), fps: FPS, config: { damping: 18, stiffness: 120 } });
  const Col: React.FC<{ title: string; color: string; steps: string[]; idx: number }> = ({ title, color, steps, idx }) => (
    <div style={{ width: 520, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "26px 30px", fontFamily: font, color: C.text }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 18 }}>{title}</div>
      {steps.map((t, i) => {
        const p = step(i + idx * 0.5);
        return (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12, opacity: p, transform: `translateX(${(1 - p) * -16}px)` }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}22`, color, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ fontSize: 19, lineHeight: 1.3 }}>{t}</div>
          </div>
        );
      })}
    </div>
  );
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Brand />
      <div style={{ display: "flex", gap: 40, marginTop: 10 }}>
        <Col idx={0} title="PDF pipeline" color={C.pdf} steps={["Parse the PDF (PyMuPDF, pdfplumber, pypdf, pdftotext)", "Fixed-size chunks — LangChain RecursiveCharacterTextSplitter, 1000/200 and 2000/200 chars", "Embed every chunk, index in a vector store", "Retrieve top-k for each question"]} />
        <Col idx={1} title="JDF pipeline" color={C.jdf} steps={["Read the JSON — structure is already there", "jdf chunk — one chunk per section, tables as “Header: value” rows, heading breadcrumb attached", "Embed every chunk, same model, same store", "Retrieve top-k — same retriever, same questions"]} />
      </div>
      <Caption from={T.setup + 0.6} to={T.accuracy}>The PDFs were printed from the JDF originals by a real browser — identical content, clean text layer. Same hit rule for both: right document, and the chunk contains the answer with its row/subject key.</Caption>
    </AbsoluteFill>
  );
};

const Bars: React.FC<{ retriever: string; from: number; to: number }> = ({ retriever, from, to }) => {
  const frame = useCurrentFrame();
  const data = rows(retriever);
  const max = Math.max(...data.map((d) => d.v)) || 1;
  const a = fade(frame, from, to, 8, 8);
  if (a <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 120, right: 120, top: 150, opacity: a, fontFamily: font, color: C.text }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>Answer inside the first 1,000 tokens of retrieved context</div>
          <div style={{ fontSize: 17, color: C.soft, marginTop: 4 }}>higher is better · chunk-size neutral · {acc.corpus.questions} questions</div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 18, color: C.jdf, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.4)", borderRadius: 999, padding: "6px 16px" }}>{label(retriever)}</div>
      </div>
      {data.map((d, i) => {
        const p = spring({ frame: frame - s(from) - 6 - i * 4, fps: FPS, config: { damping: 22, stiffness: 90 } });
        const w = (d.v / max) * p;
        return (
          <div key={d.name} style={{ display: "grid", gridTemplateColumns: "250px 1fr 110px", alignItems: "center", gap: 20, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: d.isJdf ? C.jdf : C.text }}>{d.name}</div>
              <div style={{ fontSize: 13, color: C.soft, fontFamily: mono, marginTop: 2 }}>{d.sub}</div>
            </div>
            <div style={{ height: 36, background: "rgba(148,163,184,0.12)", borderRadius: 9, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${w * 100}%`, borderRadius: 9, background: d.isJdf ? `linear-gradient(90deg,${C.jdf2},${C.jdf})` : `linear-gradient(90deg,${C.pdf2},${C.pdf})` }} />
            </div>
            <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, textAlign: "right", color: d.isJdf ? C.jdf : C.text }}>{pc(d.v * p)}</div>
          </div>
        );
      })}
    </div>
  );
};

const Accuracy: React.FC = () => {
  const per = (T.cost - T.accuracy) / showcase.length;
  return (
    <AbsoluteFill>
      <Brand />
      {showcase.map((r, i) => <Bars key={r} retriever={r} from={T.accuracy + i * per} to={T.accuracy + (i + 1) * per} />)}
      <Caption from={T.accuracy + 0.5} to={T.cost}>
        PDF rows show each parser's best chunk size. Top-1 flips with tiny embedding models because a 2,000-character PDF chunk is a quarter of the document — and then costs 3× the tokens; the token-budget metric is the fair one. Full tables per model on the site.
      </Caption>
    </AbsoluteFill>
  );
};

const Cost: React.FC = () => {
  const frame = useCurrentFrame();
  const j = cost.sides.find((x) => x.id === "jdf")!, p = cost.sides.find((x) => x.id !== "jdf")!;
  const ek = Object.keys(cost.prices.embedding)[0], lk = Object.keys(cost.prices.llm_input)[0];
  const rowsC: [string, string, string, boolean][] = [
    ["Accuracy · answer in first 1k tokens", pc(j.accuracy!.recallAt1000Tok), pc(p.accuracy!.recallAt1000Tok), true],
    ["Chunks", int(j.chunks), int(p.chunks), false],
    ["Embedding tokens · initial index", int(j.embedTokens), int(p.embedTokens), false],
    [`Embedding cost · ${(cost.prices.embedding as any)[ek].label}`, usd((j.embedUsd as any)[ek]), usd((p.embedUsd as any)[ek]), false],
    ["Re-embed tokens · one paragraph edited per document", int(j.reindex.tokensAllDocsEdited), int(p.reindex.tokensAllDocsEdited), true],
    [`LLM input tokens · 1M queries, top-5 context`, int(j.query!.inputTokens), int(p.query!.inputTokens), true],
    [`LLM input cost · ${(cost.prices.llm_input as any)[lk].label}`, usd((j.query!.usd as any)[lk]), usd((p.query!.usd as any)[lk]), true],
  ];
  return (
    <AbsoluteFill style={{ fontFamily: font, color: C.text }}>
      <Brand />
      <div style={{ position: "absolute", left: 100, right: 100, top: 78 }}>
        <div style={{ fontSize: 30, fontWeight: 800 }}>RAG cost — {int(cost.files)} PDF files vs {int(cost.files)} JDF files</div>
        <div style={{ fontSize: 17, color: C.soft, marginTop: 4 }}>same pipeline: chunks → embeddings → vector store → top-5 context → LLM · PDF column = best PDF pipeline from the accuracy run ({p.label})</div>
        <div style={{ marginTop: 18, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 250px 250px", padding: "12px 26px", fontSize: 14, textTransform: "uppercase", letterSpacing: 1.5, color: C.soft, borderBottom: `1px solid ${C.line}` }}>
            <div>per {int(cost.files)} documents</div><div style={{ textAlign: "right", color: C.jdf }}>JDF</div><div style={{ textAlign: "right" }}>PDF</div>
          </div>
          {rowsC.map(([name, a, b, hi], i) => {
            const pr = spring({ frame: frame - s(T.cost) - 10 - i * 9, fps: FPS, config: { damping: 20, stiffness: 110 } });
            return (
              <div key={name} style={{ display: "grid", gridTemplateColumns: "1fr 250px 250px", padding: "9px 26px", fontSize: 18, borderBottom: `1px solid ${C.line}`, opacity: pr, transform: `translateX(${(1 - pr) * -14}px)`, background: hi ? "rgba(96,165,250,0.06)" : "transparent" }}>
                <div>{name}</div>
                <div style={{ textAlign: "right", fontFamily: mono, fontWeight: 700, color: C.jdf }}>{a}</div>
                <div style={{ textAlign: "right", fontFamily: mono, color: C.text }}>{b}</div>
              </div>
            );
          })}
        </div>
      </div>
      <Caption from={T.cost + 0.6} to={T.reindex}>Tokens are counted from the chunks each pipeline produces; dollars are public list prices from bench/prices.json. The benchmark never calls a paid API.</Caption>
    </AbsoluteFill>
  );
};

const Reindex: React.FC = () => {
  const frame = useCurrentFrame();
  const n = acc.jdfOnly.corpusChunks, changed = acc.jdfOnly.chunksReembedded;
  const cols = 16, size = 20, gap = 6;
  const litAt = s(T.reindex + 1.2);
  return (
    <AbsoluteFill style={{ fontFamily: font, color: C.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Brand />
      <div style={{ display: "flex", gap: 56, alignItems: "center", marginTop: 10 }}>
        <div style={{ width: 520 }}>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}>Edit one paragraph.<br />What has to be re-embedded?</div>
          <div style={{ fontSize: 19, color: C.soft, marginTop: 16, lineHeight: 1.45 }}>
            JDF chunks are content-hashed. <code style={{ fontFamily: mono, color: C.jdf }}>jdf embed --incremental</code> re-embeds only the chunks whose hash changed: <b style={{ color: C.jdf }}>{changed} of {n}</b> in the corpus.
            <br /><br />A PDF has no chunk identity — re-parse, re-chunk, re-embed the whole document, every time.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap }}>
          {Array.from({ length: n }).map((_, i) => {
            const isChanged = i === 7; // the edited section, drawn in the first document's row
            const lit = frame >= litAt && isChanged;
            const pulse = lit ? 1 + 0.15 * Math.sin((frame - litAt) / 3) : 1;
            const p = spring({ frame: frame - s(T.reindex) - Math.floor(i / cols) * 2, fps: FPS, config: { damping: 20, stiffness: 140 } });
            return <div key={i} style={{ width: size, height: size, borderRadius: 5, background: lit ? C.good : "rgba(96,165,250,0.35)", opacity: p, transform: `scale(${pulse})`, boxShadow: lit ? `0 0 18px ${C.good}` : "none" }} />;
          })}
        </div>
      </div>
      <Caption from={T.reindex + 0.5} to={T.outro}>{n} JDF chunks in the corpus · {changed} re-embedded after the edit · verified by python rag_bench.py --verify</Caption>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const y = rise(frame, T.outro + 0.2, 18);
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, color: C.text }}>
      <div style={{ textAlign: "center", transform: `translateY(${y}px)` }}>
        <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -1 }}>Measured, not claimed. Run it yourself.</div>
        <div style={{ marginTop: 26, display: "inline-block", textAlign: "left", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 26px", fontFamily: mono, fontSize: 19, lineHeight: 1.7, color: "#e2e8f0" }}>
          <div><span style={{ color: C.soft }}>$ </span>cd bench && pip install -r requirements.txt</div>
          <div><span style={{ color: C.soft }}>$ </span>python rag_bench.py <span style={{ color: C.soft }}># accuracy</span></div>
          <div><span style={{ color: C.soft }}>$ </span>python cost_bench.py <span style={{ color: C.soft }}># RAG cost</span></div>
          <div><span style={{ color: C.soft }}>$ </span>python rag_bench.py --verify</div>
        </div>
        <div style={{ fontSize: 20, color: C.soft, marginTop: 24 }}>uurtech.github.io/jdf/docs/benchmark.html · github.com/uurtech/jdf/tree/master/bench</div>
        <div style={{ fontSize: 14, color: C.soft, marginTop: 10, opacity: 0.8 }}>{acc.machine.cpu} · {acc.date} · synthetic corpus with exact ground truth — a floor for the gap, not a ceiling</div>
      </div>
    </AbsoluteFill>
  );
};

export const RagBenchmark: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Scene from={T.title} to={T.setup}><Title /></Scene>
    <Scene from={T.setup} to={T.accuracy}><Setup /></Scene>
    <Scene from={T.accuracy} to={T.cost}><Accuracy /></Scene>
    <Scene from={T.cost} to={T.reindex}><Cost /></Scene>
    <Scene from={T.reindex} to={T.outro}><Reindex /></Scene>
    <Scene from={T.outro} to={T.end}><Outro /></Scene>
  </AbsoluteFill>
);
