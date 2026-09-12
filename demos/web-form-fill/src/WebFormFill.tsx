import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";

export const FPS = 30;
export const DURATION_FRAMES = FPS * 36;

// ── timeline (seconds) ─────────────────────────────────────────────────────
const T = {
  pageIn: 0.5,
  cursorStart: 3.0,
  clickField: 5.6,
  typingStart: 6.6,
  typingEnd: 11.4,
  cursorToSave: 13.0,
  clickSave: 15.2,
  downloadChip: 15.6,
  editorIn: 19.0,       // slide in the downloaded file in a text editor
  highlight: 21.0,      // highlight the value line
  reopenIn: 26.0,       // re-opened form, pre-filled
  outro: 32.0,
};
const s = (sec: number) => Math.round(sec * FPS);
const NAME = "Ayşe Yılmaz";
const font = "Inter, -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

// Geometry (1280×720 canvas). Browser chrome 0–70, docs page below.
const EMBED = { x: 300, y: 150, w: 740 };
const FIELD = { x: EMBED.x + 70, y: EMBED.y + 228, w: 598, h: 30 };
const SAVE = { x: EMBED.x + 626, y: EMBED.y + 452, w: 96, h: 34 };

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const Caption: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [s(from), s(from) + 10, s(to) - 10, s(to)], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 240, right: 0, top: 84, display: "flex", justifyContent: "center", opacity: a }}>
      <div style={{ background: "rgba(15,23,42,0.92)", color: "white", fontFamily: font, fontSize: 22, fontWeight: 500, padding: "12px 22px", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>{children}</div>
    </div>
  );
};

const Cursor: React.FC<{ x: number; y: number; pressed?: boolean }> = ({ x, y, pressed }) => (
  <svg style={{ position: "absolute", left: x - 2, top: y - 2, filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.45))", transform: pressed ? "scale(0.88)" : "scale(1)", transformOrigin: "6px 6px" }} width="52" height="60" viewBox="0 0 26 30">
    <path d="M3 2 L3 24 L9 18.5 L13.5 28 L17.5 26.2 L13 17 L21 17 Z" fill="#111827" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
  </svg>
);

const Ripple: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const frame = useCurrentFrame();
  const f = frame - s(at);
  if (f < 0 || f > 26) return null;
  const r = interpolate(f, [0, 26], [8, 46]);
  const o = interpolate(f, [0, 26], [0.6, 0]);
  return <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: "3px solid #2563eb", opacity: o }} />;
};

const BrowserChrome: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 70, background: "#f1f3f4", borderBottom: "1px solid #dadce0", fontFamily: font }}>
    <div style={{ position: "absolute", left: 14, top: 12, display: "flex", gap: 8 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c, display: "inline-block" }} />)}
    </div>
    <div style={{ position: "absolute", left: 80, top: 6, height: 28, padding: "0 14px", background: "white", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#202124" }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", display: "inline-block" }} /> Fillable forms — JDF docs
    </div>
    <div style={{ position: "absolute", left: 14, right: 14, top: 38, height: 26, background: "white", borderRadius: 13, display: "flex", alignItems: "center", padding: "0 14px", fontSize: 12, color: "#5f6368", gap: 8 }}>
      <span style={{ color: "#9aa0a6" }}>‹ › ⟳</span>
      <span style={{ color: "#202124" }}>jdf.dev/docs/forms.html</span>
    </div>
  </div>
);

const DownloadChip: React.FC<{ at: number; until: number }> = ({ at, until }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - s(at);
  if (f < 0 || frame > s(until) + 12) return null;
  const fade = interpolate(frame, [s(until), s(until) + 12], [1, 0], clamp);
  const pop = spring({ frame: f, fps, config: { damping: 14, stiffness: 160 } }) * fade;
  const done = f > 24;
  return (
    <div style={{ position: "absolute", right: 16, top: 150, background: "white", border: "1px solid #dadce0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", fontFamily: font, transform: `translateY(${(1 - pop) * -20}px) scale(${0.85 + 0.15 * pop})`, opacity: pop }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: done ? "#e6f4ea" : "#e8f0fe", display: "flex", alignItems: "center", justifyContent: "center", color: done ? "#137333" : "#1a73e8", fontSize: 18 }}>{done ? "✓" : "↓"}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#202124" }}>filled-customer-form.jdf</div>
        <div style={{ fontSize: 11, color: "#5f6368" }}>{done ? "Done · 2.1 KB" : "Downloading…"}</div>
      </div>
    </div>
  );
};

const DocsSidebar: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: 70, bottom: 0, width: 240, background: "white", borderRight: "1px solid #e5e7eb", padding: "26px 40px", fontFamily: font, fontSize: 13, color: "#1f2937", lineHeight: "30px" }}>
    <div style={{ fontSize: 10, letterSpacing: 1.2, color: "#9ca3af", fontWeight: 600, marginBottom: 2 }}>GET STARTED</div>
    <div>Introduction</div><div>Getting started</div>
    <div style={{ fontSize: 10, letterSpacing: 1.2, color: "#9ca3af", fontWeight: 600, marginTop: 14 }}>WEB EMBED — JDF.JS</div>
    <div>&lt;jdf&gt; tag</div><div>Live examples</div><div>API reference</div>
    <div style={{ fontSize: 10, letterSpacing: 1.2, color: "#2563eb", fontWeight: 600, marginTop: 14 }}>JDF FORMS <span style={{ background: "#ec4899", color: "white", borderRadius: 4, padding: "1px 6px", fontSize: 9, marginLeft: 6 }}>NEW</span></div>
    <div style={{ background: "#eff6ff", color: "#1d4ed8", fontWeight: 600, margin: "2px -12px", padding: "0 12px", borderRadius: 6 }}>Fillable forms ★</div>
    <div style={{ fontSize: 10, letterSpacing: 1.2, color: "#9ca3af", fontWeight: 600, marginTop: 14 }}>FORMAT</div>
    <div>Format overview</div><div>Element reference</div>
  </div>
);

const Field: React.FC<{ label: string; value?: string; placeholder?: string; w: number; focused?: boolean; caret?: boolean; h?: number }> = ({ label, value, placeholder, w, focused, caret, h = 30 }) => {
  const frame = useCurrentFrame();
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <div style={{ width: w, fontFamily: font }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#4b5563", marginBottom: 5 }}>{label}</div>
      <div style={{ height: h, background: focused ? "white" : "#f5f6f8", border: `1px solid ${focused ? "#2563eb" : "#d7dbe0"}`, boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.16)" : undefined, borderRadius: 6, padding: "0 10px", display: "flex", alignItems: h > 40 ? "flex-start" : "center", fontSize: 12.5, color: value ? "#111827" : "#9ca3af", paddingTop: h > 40 ? 8 : 0 }}>
        {value || placeholder}
        {caret && <span style={{ display: "inline-block", width: 1.5, height: 15, background: "#111827", marginLeft: 1, opacity: blink ? 1 : 0 }} />}
      </div>
    </div>
  );
};

const Embed: React.FC<{ x: number; y: number; w: number; nameValue: string; focused: boolean; caret: boolean; savePressed: boolean; title?: string }> = ({ x, y, w, nameValue, focused, caret, savePressed, title }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, fontFamily: font }}>
    <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderBottom: "none", borderRadius: "10px 10px 0 0", padding: "8px 18px", fontSize: 11.5, letterSpacing: 0.8, color: "#4f46e5", fontWeight: 600 }}>{title ?? "↓ LIVE DEMO — TYPE, TICK, SIGN, THEN CLICK SAVE FORM"}</div>
    <div style={{ background: "white", border: "1px solid #dbe1ea", borderRadius: "0 0 10px 10px", position: "relative", height: 500, overflow: "hidden" }}>
      <div style={{ height: 44, borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", padding: "0 16px", fontSize: 13, color: "#111827" }}>
        <span style={{ fontWeight: 600 }}>Customer Onboarding Form</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: "#6b7280", fontSize: 12 }}>‹ &nbsp; 1 / 1 &nbsp; › &nbsp;&nbsp;|&nbsp;&nbsp; − &nbsp; 89% &nbsp; +</span>
      </div>
      <div style={{ position: "absolute", left: 16, right: 16, top: 66, bottom: -20, background: "white", borderRadius: 4, boxShadow: "0 2px 12px rgba(15,23,42,0.12)", padding: "34px 54px" }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#111827", letterSpacing: -0.4 }}>Customer Onboarding</div>
        <div style={{ fontSize: 13, color: "#4b5563", marginTop: 8, lineHeight: "19px", width: 590 }}>Type into any field — your input lives in the document. Click Save form to download a .jdf with your answers baked in.</div>
        <div style={{ marginTop: 22 }}><Field label="Full name" value={nameValue} placeholder="Jane Doe" w={598} focused={focused} caret={caret} /></div>
        <div style={{ marginTop: 18 }}><Field label="Email address" placeholder="jane@example.com" w={598} /></div>
        <div style={{ marginTop: 18, display: "flex", gap: 22 }}><Field label="Date of birth" placeholder="dd/mm/yyyy" w={288} /><Field label="Country" value="Turkey" w={288} /></div>
        <div style={{ marginTop: 18 }}><Field label="Anything we should know?" placeholder="Tell us about your team, use case, anything…" w={598} h={56} /></div>
        <div style={{ marginTop: 26, fontSize: 12.5, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 14, height: 14, border: "1.5px solid #9ca3af", borderRadius: 3, display: "inline-block" }} /> Email me product updates (about once a month)</div>
        <div style={{ marginTop: 10, fontSize: 12.5, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 14, height: 14, border: "1.5px solid #9ca3af", borderRadius: 3, display: "inline-block" }} /> I agree to the terms and conditions</div>
      </div>
      <div style={{ position: "absolute", right: 16, bottom: 16, background: savePressed ? "#1d4ed8" : "#2563eb", color: "white", fontWeight: 600, fontSize: 13, padding: "9px 16px", borderRadius: 8, boxShadow: "0 6px 16px rgba(37,99,235,0.35)", transform: savePressed ? "scale(0.96)" : "scale(1)" }}>Save form</div>
    </div>
  </div>
);

const JSON_LINES: Array<{ t: string; hl?: boolean }> = [
  { t: '{' },
  { t: '  "$jdf": "1.0.0",' },
  { t: '  "meta": { "title": "Customer Onboarding Form", "pageSize": "A4" },' },
  { t: '  "pages": [' },
  { t: '    {' },
  { t: '      "elements": [' },
  { t: '        { "type": "text", "content": "Customer Onboarding", "heading": 1 },' },
  { t: '        {' },
  { t: '          "type": "input",' },
  { t: '          "name": "fullName",' },
  { t: '          "label": "Full name",' },
  { t: `          "value": "${NAME}",`, hl: true },
  { t: '          "position": { "x": 0, "y": 30 }, "width": 178' },
  { t: '        },' },
  { t: '        { "type": "input", "name": "email", "label": "Email address", "value": "" },' },
  { t: '        { "type": "select", "name": "country", "value": "TR", "options": [ … ] },' },
  { t: '        { "type": "checkbox", "name": "terms", "checked": false },' },
  { t: '        { "type": "signature", "name": "signature", "value": "" }' },
  { t: '      ]' },
  { t: '    }' },
  { t: '  ]' },
  { t: '}' },
];

const Editor: React.FC<{ progress: number; highlight: number }> = ({ progress, highlight }) => (
  <div style={{ position: "absolute", left: 220 + (1 - progress) * 900, top: 150, width: 860, height: 500, background: "#0f172a", borderRadius: 12, boxShadow: "0 30px 80px rgba(0,0,0,0.45)", overflow: "hidden", fontFamily: mono, opacity: progress }}>
    <div style={{ height: 38, background: "#1e293b", display: "flex", alignItems: "center", padding: "0 14px", gap: 8 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c, display: "inline-block" }} />)}
      <span style={{ marginLeft: 14, color: "#cbd5e1", fontSize: 12, fontFamily: font }}>~/Downloads/filled-customer-form.jdf</span>
    </div>
    <div style={{ padding: "12px 0", fontSize: 12.5, lineHeight: "20px" }}>
      {JSON_LINES.map((l, i) => {
        const hl = l.hl ? highlight : 0;
        return (
          <div key={i} style={{ display: "flex", background: hl ? `rgba(250,204,21,${0.18 * hl})` : "transparent", borderLeft: hl ? `3px solid rgba(250,204,21,${hl})` : "3px solid transparent" }}>
            <span style={{ width: 44, textAlign: "right", color: "#475569", paddingRight: 16, userSelect: "none" }}>{i + 1}</span>
            <span style={{ color: l.hl ? "#fde68a" : "#e2e8f0", whiteSpace: "pre", fontWeight: l.hl ? 700 : 400 }}>{l.t}</span>
          </div>
        );
      })}
    </div>
  </div>
);

export const WebFormFill: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pageIn = spring({ frame: frame - s(T.pageIn), fps, config: { damping: 18, stiffness: 120 } });

  const typedN = Math.round(interpolate(frame, [s(T.typingStart), s(T.typingEnd)], [0, NAME.length], { ...clamp, easing: Easing.inOut(Easing.sin) }));
  const nameValue = frame >= s(T.typingStart) ? NAME.slice(0, typedN) : "";
  const focused = frame >= s(T.clickField) + 2 && frame < s(T.clickSave);
  const caret = focused;
  const savePressed = frame >= s(T.clickSave) && frame < s(T.clickSave) + 6;

  const keys = [s(T.cursorStart), s(T.clickField) - 6, s(T.clickField) + 24, s(T.clickField) + 54, s(T.cursorToSave), s(T.clickSave) - 6];
  const cx = interpolate(frame, keys, [1100, FIELD.x + 60, FIELD.x + 60, FIELD.x + 380, FIELD.x + 380, SAVE.x + 48], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const cy = interpolate(frame, keys, [620, FIELD.y + 15, FIELD.y + 15, FIELD.y + 110, FIELD.y + 110, SAVE.y + 17], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const cursorVisible = frame >= s(T.cursorStart) - 6 && frame < s(T.editorIn);
  const pressed = [T.clickField, T.clickSave].some((t) => frame >= s(t) && frame < s(t) + 5);

  const editorP = interpolate(frame, [s(T.editorIn), s(T.editorIn) + 26], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const editorOut = interpolate(frame, [s(T.reopenIn) - 12, s(T.reopenIn)], [1, 0], clamp);
  const highlight = interpolate(frame, [s(T.highlight), s(T.highlight) + 14], [0, 1], clamp);
  const dim = interpolate(frame, [s(T.editorIn), s(T.editorIn) + 20], [0, 0.55], clamp) * editorOut;

  const reopenP = interpolate(frame, [s(T.reopenIn), s(T.reopenIn) + 24], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const outro = interpolate(frame, [s(T.outro), s(T.outro) + 30], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ background: "#ffffff", overflow: "hidden" }}>
      <BrowserChrome />
      <DocsSidebar />
      <div style={{ position: "absolute", left: 240, right: 0, top: 70, bottom: 0, background: "white", opacity: pageIn }}>
        {reopenP < 1 && (
          <div style={{ opacity: 1 - reopenP, transform: `translateY(${-reopenP * 30}px)` }}>
            <Embed x={EMBED.x - 240} y={EMBED.y - 70} w={EMBED.w} nameValue={nameValue} focused={focused} caret={caret} savePressed={savePressed} />
            <div style={{ position: "absolute", left: EMBED.x - 240, top: EMBED.y - 70 + 580, width: EMBED.w, fontFamily: font, fontSize: 15, color: "#374151", lineHeight: "24px" }}>Open the downloaded file in any text editor. Every value you typed is right there next to its field declaration — no binary parsing required.</div>
          </div>
        )}
        {reopenP > 0 && (
          <div style={{ opacity: reopenP, transform: `translateY(${(1 - reopenP) * 30}px)` }}>
            <Embed x={EMBED.x - 240} y={EMBED.y - 70} w={EMBED.w} nameValue={NAME} focused={false} caret={false} savePressed={false} title="↻ RE-OPENED — filled-customer-form.jdf" />
          </div>
        )}
      </div>

      <div style={{ position: "absolute", inset: 0, background: "#0f172a", opacity: dim, pointerEvents: "none" }} />
      {editorP > 0 && editorOut > 0 && <div style={{ opacity: editorOut }}><Editor progress={editorP} highlight={highlight} /></div>}

      <Ripple at={T.clickField} x={FIELD.x + 60} y={FIELD.y + 15} />
      <Ripple at={T.clickSave} x={SAVE.x + 48} y={SAVE.y + 17} />
      {cursorVisible && <Cursor x={cx} y={cy} pressed={pressed} />}
      <DownloadChip at={T.downloadChip} until={T.editorIn} />

      <Caption from={1.0} to={5.2}>A JDF form embedded in a web page with one <b>&lt;jdf&gt;</b> tag.</Caption>
      <Caption from={6.0} to={12.4}>Fill in a field — the value is stored in the document itself.</Caption>
      <Caption from={13.2} to={18.4}>Click <b>Save form</b>. The browser downloads a <b>.jdf</b> file.</Caption>
      <Caption from={19.4} to={25.4}>Open it in any text editor: your answer is right there, as plain JSON.</Caption>
      <Caption from={26.4} to={31.6}>Open the same file again — the form comes back already filled in.</Caption>

      <AbsoluteFill style={{ background: "#0f172a", opacity: outro, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 18, fontFamily: font }}>
        <div style={{ width: 84, height: 84, borderRadius: 22, background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", color: "white", fontWeight: 700, fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 50px rgba(37,99,235,0.35)" }}>JDF</div>
        <div style={{ color: "white", fontSize: 44, fontWeight: 700, letterSpacing: -0.5 }}>JDF Forms</div>
        <div style={{ color: "#93c5fd", fontSize: 24, fontWeight: 500 }}>The form is the file. Fill it on the web, keep it as JSON.</div>
        <div style={{ color: "#64748b", fontSize: 18, marginTop: 10 }}>github.com/uurtech/jdf</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
