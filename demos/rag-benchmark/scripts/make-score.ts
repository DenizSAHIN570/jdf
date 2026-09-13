/**
 * Synthesises the soundtrack for the benchmark video — no samples, no
 * downloads, no licence to worry about. Dark pulse: sub drone, four-on-the-
 * floor kick, hi-hat ticks, a riser into the money shot, and a low boom on
 * every on-screen slam (HITS from src/timeline.ts). Writes public/score.wav.
 *
 *   npx tsx scripts/make-score.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DURATION_SEC, HITS, SPEED, T } from "../src/timeline";

const SR = 44100;
const N = Math.ceil(DURATION_SEC * SR);
const L = new Float32Array(N), R = new Float32Array(N);

// Deterministic noise so the file is reproducible byte for byte.
let seed = 20260913;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
const env = (t: number, a: number, d: number) => (t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d));

for (let i = 0; i < N; i++) {
  const t = i / SR;
  let l = 0, r = 0;
  // Sub drone: 55 Hz + fifth, slow tremolo, fades in over the first second.
  const drone = (Math.sin(2 * Math.PI * 55 * t) * 0.6 + Math.sin(2 * Math.PI * 82.4 * t) * 0.25) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.8 * t)) * Math.min(1, t / 1.0) * 0.28;
  l += drone; r += drone;
  // Kick every 0.5 s (scaled), pitch sweep 130 → 45 Hz.
  const beat = 0.5 * SPEED;
  const tk = t % beat;
  const kick = Math.sin(2 * Math.PI * (45 + 85 * Math.exp(-tk * 22)) * tk) * env(tk, 0.002, 0.11) * 0.55;
  l += kick; r += kick;
  // Hi-hat ticks on the off-beats.
  const th = (t + beat / 2) % (beat / 2);
  const hat = rnd() * env(th, 0.001, 0.018) * 0.16;
  l += hat * 0.8; r += hat * 1.2;
  // Riser: filtered noise swelling into the money slam, then cut.
  const moneyAt = T.money * SPEED;
  if (t > moneyAt - 2.2 && t < moneyAt) {
    const p = (t - (moneyAt - 2.2)) / 2.2;
    const riser = rnd() * p * p * 0.35 + Math.sin(2 * Math.PI * (110 + 330 * p) * t) * p * 0.12;
    l += riser; r += riser;
  }
  // Slam hits: boom (sine sweep) + short noise burst, panned alternately.
  HITS.forEach((h, k) => {
    const th2 = t - h * SPEED;
    if (th2 < 0 || th2 > 0.9) return;
    const boom = Math.sin(2 * Math.PI * (38 + 60 * Math.exp(-th2 * 14)) * th2) * env(th2, 0.003, 0.28) * 0.9;
    const burst = rnd() * env(th2, 0.001, 0.05) * 0.5;
    const pan = k % 2 ? 0.35 : -0.35;
    l += (boom + burst) * (1 - pan); r += (boom + burst) * (1 + pan);
  });
  // Tail fade.
  const fade = Math.min(1, (DURATION_SEC - t) / 0.6);
  L[i] = l * fade; R[i] = r * fade;
}
// Soft clip + normalise.
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.89 / peak;
const clip = (x: number) => Math.tanh(x * g * 1.15);
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(clip(L[i]) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(clip(R[i]) * 32767), 46 + i * 4); }
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/score.wav");
fs.writeFileSync(out, buf);
console.log(`score: ${DURATION_SEC.toFixed(2)} s, ${(buf.length / 1e6).toFixed(1)} MB → ${path.relative(process.cwd(), out)}`);
