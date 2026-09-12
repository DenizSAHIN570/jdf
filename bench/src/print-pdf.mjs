// Prints every bench/corpus/docs/*.jdf to a PDF using the real jdf.js renderer
// in Google Chrome (Playwright, channel "chrome"). This is fixture generation,
// run once by the maintainer — the PDFs are committed so `pnpm bench` never
// needs a browser. The PDF pipeline is fed exactly what a reader would print.
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const docsDir = path.join(repo, "bench/corpus/docs");
const MIME = { ".js": "text/javascript", ".css": "text/css", ".jdf": "application/json", ".html": "text/html; charset=utf-8" };

const server = createServer((req, res) => {
  const p = path.join(repo, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const page = (docUrl) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${base}/docs/jdfjs-local/jdfjs.css">
<script type="module" src="${base}/docs/jdfjs-local/jdfjs.js"></script>
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; background: #fff; }
  .jdfjs, .jdfjs-root, .jdfjs-body, .jdfjs-pages { display: block !important; height: auto !important; max-height: none !important; padding: 0 !important; overflow: visible !important; border: 0 !important; border-radius: 0 !important; background: #fff !important; }
  .jdfjs-toolbar, .jdfjs-sidebar { display: none !important; }
  .jdfjs-page-wrapper { break-after: page; page-break-after: always; margin: 0 !important; }
  .jdfjs-page { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; }
</style></head><body>
<jdf src="${docUrl}" toolbar="false" sidebar="false" fit="manual" zoom="1" dark-mode="light"></jdf>
</body></html>`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".jdf")).sort();
for (const f of files) {
  const tab = await ctx.newPage();
  // Served (not setContent) so jdf.js auto-init sees a normal page load.
  fs.mkdirSync(path.join(repo, "bench/out"), { recursive: true });
  fs.writeFileSync(path.join(repo, "bench/out/print.html"), page(`${base}/bench/corpus/docs/${f}`));
  await tab.goto(`${base}/bench/out/print.html`, { waitUntil: "load" });
  await tab.waitForSelector(".jdfjs-page", { timeout: 20000 });
  await tab.waitForTimeout(400); // fonts + last layout pass
  const expected = JSON.parse(fs.readFileSync(path.join(docsDir, f), "utf8")).pages.length;
  const got = await tab.locator(".jdfjs-page").count();
  if (got !== expected) throw new Error(`${f}: rendered ${got} pages, expected ${expected}`);
  await tab.emulateMedia({ media: "print" });
  const out = path.join(docsDir, f.replace(/\.jdf$/, ".pdf"));
  await tab.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  if (process.argv.includes("--shots")) await tab.screenshot({ path: path.join(repo, "bench/out", f.replace(/\.jdf$/, ".png")), fullPage: true });
  console.log(`${f} → ${path.basename(out)} (${expected} pages, ${(fs.statSync(out).size / 1024).toFixed(0)} kB)`);
  await tab.close();
}
await browser.close();
server.close();
