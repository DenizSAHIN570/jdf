/**
 * Downloads the soundtrack for the benchmark video into public/ (gitignored).
 *
 * Track: "Epical Drums 05" by Grigoriy Nuzhny (percussion trailer) — Mixkit Stock Music Free License
 * (free for personal and commercial use in videos, no attribution required;
 * the track itself may not be redistributed on its own, which is why it is
 * fetched at render time instead of being committed).
 *   https://mixkit.co/free-stock-music/epical-drums-05-680/
 *   https://mixkit.co/license/#musicFree
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const URL_ = "https://assets.mixkit.co/music/680/680.mp3";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/music.mp3");
if (fs.existsSync(out) && fs.statSync(out).size > 100_000) {
  console.log(`music: already present → ${path.relative(process.cwd(), out)}`);
} else {
  const res = await fetch(URL_);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`music: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB → ${path.relative(process.cwd(), out)}`);
}
