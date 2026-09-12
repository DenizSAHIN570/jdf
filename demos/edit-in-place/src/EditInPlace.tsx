import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";

export const FPS = 30;
export const DURATION_FRAMES = FPS * 17;

// ── timeline (seconds) ─────────────────────────────────────────────────────
const T = {
  open: 0.4,          // page fades in
  cursorStart: 1.6,   // cursor starts moving toward the heading
  dblclick: 3.0,      // double-click on "Hello, JDF"
  typingStart: 3.9,   // characters start replacing the text
  typingEnd: 7.2,
  enter: 8.0,         // Enter key
  saved: 8.35,        // "Saved" badge
  cursor2Start: 9.6,  // second edit: paragraph, commit by clicking away
  dblclick2: 10.8,
  typing2Start: 11.5,
  typing2End: 13.0,
  clickAway: 13.7,
  saved2: 14.05,
  outro: 15.2,
};
const s = (sec: number) => Math.round(sec * FPS);

const HEADING_BEFORE = "Hello, JDF";
const HEADING_AFTER = "Hello, edited JDF";
const PARA_BEFORE = "A document format that's just JSON. Renders like PDF. Diffs in git. Edits in any text editor.";
const PARA_AFTER = "A document format that's just JSON. Renders like PDF. Diffs in git. Edit it right here — it saves itself.";

const font = "Inter, -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const serif = "'Times New Roman', Times, serif";

// Position of the heading / paragraph on the page (px, 1280×720 canvas).
const PAGE = { x: 330, y: 96, w: 794, h: 720 };
const HEAD = { x: PAGE.x + 84, y: PAGE.y + 118, w: 630, h: 54 };
const PARA = { x: PAGE.x + 84, y: PAGE.y + 200, w: 630, h: 58 };

function typed(frame: number, from: string, to: string, startSec: number, endSec: number) {
  const start = s(startSec), end = s(endSec);
  if (frame < start) return { text: from, editing: false, caret: false };
  // First frame: everything selected → replaced by typing.
  const progress = interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const n = Math.round(progress * to.length);
  return { text: to.slice(0, n), editing: true, caret: true };
}

const Caption: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [s(from), s(from) + 8, s(to) - 8, s(to)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [s(from), s(from) + 8], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (a <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center", opacity: a, transform: `translateY(${y}px)` }}>
      <div style={{ background: "rgba(15,23,42,0.92)", color: "white", fontFamily: font, fontSize: 22, fontWeight: 500, padding: "12px 22px", borderRadius: 12, letterSpacing: 0.1, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        {children}
      </div>
    </div>
  );
};

const Cursor: React.FC<{ x: number; y: number; pressed?: boolean }> = ({ x, y, pressed }) => (
  <svg style={{ position: "absolute", left: x, top: y, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))", transform: pressed ? "scale(0.9)" : "scale(1)", transformOrigin: "4px 4px" }} width="26" height="30" viewBox="0 0 26 30">
    <path d="M3 2 L3 24 L9 18.5 L13.5 28 L17.5 26.2 L13 17 L21 17 Z" fill="#111827" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const Ripple: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const frame = useCurrentFrame();
  const rings = [0, 6]; // two clicks
  return (
    <>
      {rings.map((off, i) => {
        const f = frame - s(at) - off;
        if (f < 0 || f > 16) return null;
        const r = interpolate(f, [0, 16], [6, 34]);
        const o = interpolate(f, [0, 16], [0.55, 0]);
        return <div key={i} style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: "3px solid #2563eb", opacity: o }} />;
      })}
    </>
  );
};

const KeyCap: React.FC<{ at: number; label: string }> = ({ at, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - s(at);
  if (f < -4 || f > 40) return null;
  const pop = spring({ frame: Math.max(0, f + 4), fps, config: { damping: 12, stiffness: 180 } });
  const fade = interpolate(f, [26, 40], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pressed = f >= 2 && f <= 8;
  return (
    <div style={{ position: "absolute", right: 60, bottom: 120, opacity: fade, transform: `scale(${0.6 + 0.4 * pop}) translateY(${pressed ? 4 : 0}px)`, fontFamily: font }}>
      <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderBottomWidth: pressed ? 2 : 6, borderRadius: 12, padding: "14px 26px", fontSize: 26, fontWeight: 600, color: "#0f172a", boxShadow: "0 10px 30px rgba(0,0,0,0.18)" }}>
        {label}
      </div>
    </div>
  );
};

const SaveBadge: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const f = frame - s(at);
  if (f < -10) return null;
  const saving = f < 0;
  const opacity = interpolate(f, [-10, -6, 50, 62], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 632, top: 15, display: "flex", alignItems: "center", gap: 6, fontFamily: font, fontSize: 12.5, fontWeight: 600, color: saving ? "#64748b" : "#15803d", opacity }}>
      {saving ? (
        <span style={{ width: 11, height: 11, borderRadius: "50%", border: "2px solid #cbd5e1", borderTopColor: "#2563eb", display: "inline-block", transform: `rotate(${frame * 30}deg)` }} />
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="7" fill="#16a34a" /><path d="M4 7.2l2 2 4-4.4" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
      {saving ? "Saving…" : "Saved"}
    </div>
  );
};

const Toolbar: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 48, background: "white", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", padding: "0 12px", gap: 18, fontFamily: font, fontSize: 13, color: "#334155" }}>
    <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", color: "white", fontWeight: 700, fontSize: 10.5, display: "flex", alignItems: "center", justifyContent: "center" }}>JDF</div>
    <span>New</span><span>Open</span><span>Save As</span><span style={{ color: "#2563eb", fontWeight: 600 }}>PDF</span>
    <span style={{ color: "#cbd5e1" }}>|</span>
    <span style={{ color: "#94a3b8" }}>▯</span><span style={{ color: "#94a3b8" }}>✕</span><span style={{ color: "#cbd5e1" }}>↶</span><span style={{ color: "#cbd5e1" }}>↷</span>
    <span style={{ fontWeight: 500, color: "#0f172a" }}>hello-world.jdf</span>
    <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 7, overflow: "hidden", fontSize: 12 }}>
      <span style={{ padding: "4px 12px", background: "#f1f5f9", fontWeight: 600 }}>View</span>
      <span style={{ padding: "4px 12px", color: "#64748b" }}>JSON</span>
    </div>
    <div style={{ flex: 1 }} />
    <span style={{ color: "#64748b" }}>⌕</span>
    <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "ui-monospace, monospace" }}>‹ &nbsp;1 / 2&nbsp; ›</span>
    <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "ui-monospace, monospace" }}>− &nbsp;100%&nbsp; +</span>
    <span style={{ color: "#64748b" }}>☼</span><span style={{ color: "#64748b" }}>?</span>
  </div>
);

const InsertBar: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 48, height: 60, display: "flex", justifyContent: "center", alignItems: "center", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
    <div style={{ display: "flex", gap: 22, border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", background: "white", fontFamily: font, fontSize: 9.5, color: "#64748b", alignItems: "center" }}>
      <span style={{ letterSpacing: 1.2, fontWeight: 600, color: "#94a3b8" }}>INSERT</span>
      {[["T", "Text"], ["B", "Rich text"], ["≡", "List"], ["⊞", "Table"], ["☐", "Shape"], ["▣", "Image"], ["▶", "Section"], ["≣", "TOC"]].map(([i, l]) => (
        <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><span style={{ fontSize: 15, color: "#0f172a" }}>{i}</span><span>{l}</span></div>
      ))}
    </div>
  </div>
);

const Sidebar: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: 108, bottom: 0, width: 176, background: "#f9fafb", borderRight: "1px solid #e5e7eb", padding: 10, fontFamily: font }}>
    <div style={{ fontSize: 9.5, letterSpacing: 1.2, color: "#94a3b8", fontWeight: 600, marginBottom: 10, display: "flex", justifyContent: "space-between" }}><span>PAGES · 2</span><span>+</span></div>
    {[true, false].map((active, i) => (
      <div key={i} style={{ border: active ? "2px solid #3b82f6" : "2px solid #e5e7eb", borderRadius: 6, overflow: "hidden", marginBottom: 12, boxShadow: active ? "0 0 0 3px rgba(59,130,246,0.15)" : undefined }}>
        <div style={{ height: 210, background: "white", position: "relative", padding: 8 }}>
          {[3, 5, 3, 3, 8, 3, 3, 3, 3].map((h, j) => (
            <div key={j} style={{ height: h, background: j === 1 ? "#475569" : "#cbd5e1", marginBottom: 6, borderRadius: 1, width: j % 3 === 2 ? "70%" : "100%", opacity: i === 1 && j > 5 ? 0 : 1 }} />
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 10, padding: "3px 0", background: active ? "#3b82f6" : "white", color: active ? "white" : "#94a3b8", fontFamily: "ui-monospace, monospace" }}>{i + 1}</div>
      </div>
    ))}
  </div>
);

const EditBox: React.FC<{ box: { x: number; y: number; w: number; h: number }; text: string; caret: boolean; big?: boolean; showBar?: boolean }> = ({ box, text, caret, big, showBar }) => {
  const frame = useCurrentFrame();
  const blink = Math.floor(frame / 9) % 2 === 0;
  return (
    <>
      {showBar && (
        <div style={{ position: "absolute", left: box.x + box.w - 96, top: box.y - 24, background: "#0f172a", borderRadius: 6, padding: "4px 8px", display: "flex", gap: 12, color: "white", fontSize: 10 }}>
          <span>⌃</span><span>⌄</span><span>⧉</span><span>✕</span>
        </div>
      )}
      <div style={{ position: "absolute", left: box.x - 4, top: box.y - 6, width: box.w + 8, height: box.h + 12, border: "2px solid #2563eb", borderRadius: 4, background: "#fff", boxShadow: "0 0 0 4px rgba(37,99,235,0.15)" }} />
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, fontFamily: serif, fontSize: big ? 40 : 17, fontWeight: big ? 700 : 400, color: "#0f172a", lineHeight: big ? "54px" : "26px", whiteSpace: "pre-wrap" }}>
        {text}
        {caret && <span style={{ display: "inline-block", width: 2, height: big ? 36 : 18, background: "#0f172a", marginLeft: 2, verticalAlign: big ? "-4px" : "-3px", opacity: blink ? 1 : 0 }} />}
      </div>
    </>
  );
};

export const EditInPlace: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pageIn = spring({ frame: frame - s(T.open), fps, config: { damping: 18, stiffness: 120 } });

  // Heading edit state
  const head = typed(frame, HEADING_BEFORE, HEADING_AFTER, T.typingStart, T.typingEnd);
  const headEditing = frame >= s(T.dblclick) + 4 && frame < s(T.enter) + 2;
  const headText = frame >= s(T.enter) + 2 ? HEADING_AFTER : head.editing ? head.text : HEADING_BEFORE;

  // Paragraph edit state
  const para = typed(frame, PARA_BEFORE, PARA_AFTER, T.typing2Start, T.typing2End);
  const paraEditing = frame >= s(T.dblclick2) + 4 && frame < s(T.clickAway) + 2;
  const paraText = frame >= s(T.clickAway) + 2 ? PARA_AFTER : para.editing ? para.text : PARA_BEFORE;

  // Cursor path
  const cx = interpolate(frame, [s(T.cursorStart), s(T.dblclick) - 2, s(T.cursor2Start), s(T.dblclick2) - 2, s(T.clickAway) - 14, s(T.clickAway) - 2], [980, HEAD.x + 150, HEAD.x + 150, PARA.x + 260, PARA.x + 260, 1180], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const cy = interpolate(frame, [s(T.cursorStart), s(T.dblclick) - 2, s(T.cursor2Start), s(T.dblclick2) - 2, s(T.clickAway) - 14, s(T.clickAway) - 2], [560, HEAD.y + 30, HEAD.y + 30, PARA.y + 16, PARA.y + 16, 600], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const cursorVisible = frame >= s(T.cursorStart) - 6 && frame < s(T.outro);
  const pressed = [T.dblclick, T.dblclick + 0.2, T.dblclick2, T.dblclick2 + 0.2, T.clickAway].some((t) => frame >= s(t) && frame < s(t) + 3);

  const outro = interpolate(frame, [s(T.outro), s(T.outro) + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f3f4f6", overflow: "hidden" }}>
      <Toolbar />
      <InsertBar />
      <Sidebar />
      <SaveBadge at={T.saved} />
      <SaveBadge at={T.saved2} />

      {/* Page */}
      <div style={{ position: "absolute", left: PAGE.x, top: PAGE.y, width: PAGE.w, height: PAGE.h, background: "white", boxShadow: "0 4px 24px rgba(15,23,42,0.12)", borderRadius: 2, opacity: pageIn, transform: `translateY(${(1 - pageIn) * 24}px)` }}>
        <div style={{ position: "absolute", left: 84, top: 94, fontFamily: serif, fontSize: 11.5, letterSpacing: 1.2, fontWeight: 700, color: "#64748b" }}>DOCUMENT FORMAT</div>
        <div style={{ position: "absolute", left: 84, top: HEAD.y - PAGE.y, width: HEAD.w, fontFamily: serif, fontSize: 40, fontWeight: 700, color: "#0f172a", lineHeight: "54px", opacity: headEditing ? 0 : 1 }}>{headText}</div>
        <div style={{ position: "absolute", left: 84, top: PARA.y - PAGE.y, width: PARA.w, fontFamily: serif, fontSize: 17, lineHeight: "26px", color: "#0f172a", opacity: paraEditing ? 0 : 1 }}>{paraText}</div>
        <div style={{ position: "absolute", left: 84, top: 306, width: 66, height: 3, background: "#2563eb" }} />
        <div style={{ position: "absolute", left: 84, top: 344, fontFamily: serif, fontSize: 21, fontWeight: 700, color: "#0f172a" }}>What it does</div>
        <div style={{ position: "absolute", left: 84, top: 384, width: 628, padding: "8px 0", background: "#f1f5f9", fontFamily: serif, fontSize: 15, lineHeight: "24px", color: "#0f172a" }}>
          Open .jdf in any text editor and you see clean JSON. Open it in JDF Reader and you see a beautifully rendered page. Edit either side, the other reflects it.
        </div>
        <ul style={{ position: "absolute", left: 104, top: 470, margin: 0, padding: 0, fontFamily: serif, fontSize: 14.5, lineHeight: "27px", color: "#0f172a" }}>
          <li>Human-readable JSON — open with cat, grep, jq, VS Code.</li>
          <li>git diff is real — change a heading, see one line change.</li>
          <li>Generate from code — JSON.stringify(doc) is your PDF library.</li>
          <li>JSON Schema validation — autocomplete in your editor, errors in CI.</li>
        </ul>
      </div>

      {headEditing && <EditBox box={HEAD} text={head.editing ? head.text : HEADING_BEFORE} caret={head.caret || frame < s(T.typingStart)} big showBar />}
      {paraEditing && <EditBox box={PARA} text={para.editing ? para.text : PARA_BEFORE} caret={para.caret || frame < s(T.typing2Start)} />}

      <Ripple at={T.dblclick} x={HEAD.x + 150} y={HEAD.y + 30} />
      <Ripple at={T.dblclick2} x={PARA.x + 260} y={PARA.y + 16} />
      <Ripple at={T.clickAway} x={1180} y={600} />
      {cursorVisible && <Cursor x={cx} y={cy} pressed={pressed} />}

      <KeyCap at={T.enter} label="↵ Enter" />

      <Caption from={0.6} to={2.9}>Open a <b>.jdf</b> — it renders like a PDF.</Caption>
      <Caption from={3.1} to={7.6}>Double-click any line. It becomes editable — right on the page.</Caption>
      <Caption from={7.8} to={9.6}>Press <b>Enter</b>. The change is saved to the file. Nothing else to do.</Caption>
      <Caption from={10.2} to={13.4}>Or just click somewhere else — that saves too.</Caption>
      <Caption from={13.8} to={15.1}>Your document stays plain JSON: diff it, grep it, feed it to AI.</Caption>

      {/* Outro */}
      <AbsoluteFill style={{ background: "#0f172a", opacity: outro, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 18, fontFamily: font }}>
        <div style={{ width: 84, height: 84, borderRadius: 22, background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", color: "white", fontWeight: 700, fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 50px rgba(37,99,235,0.35)" }}>JDF</div>
        <div style={{ color: "white", fontSize: 44, fontWeight: 700, letterSpacing: -0.5 }}>JDF Reader</div>
        <div style={{ color: "#93c5fd", fontSize: 24, fontWeight: 500 }}>Edit in place. The file is the document.</div>
        <div style={{ color: "#64748b", fontSize: 18, marginTop: 10 }}>github.com/uurtech/jdf</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
