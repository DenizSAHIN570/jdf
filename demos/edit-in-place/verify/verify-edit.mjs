// Drives the REAL reader frontend (apps/reader, Vite dev server) in Google
// Chrome through Playwright, with the Tauri IPC bridge replaced by a small
// in-page mock. Proves the edit-in-place contract the demo video shows:
//
//   1. open a .jdf            → read_text_file is called, page renders
//   2. double-click a line    → an inline editor appears
//   3. type + Enter           → the doc is mutated and autosaved (save_document)
//   4. double-click + blur    → same commit path via blur
//   5. Escape                 → edit is cancelled, nothing saved
//
// Usage: pnpm --filter @jdf/demo-edit-in-place verify
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const fixturePath = path.join(repoRoot, "spec/examples/hello-world.jdf");
const fixture = fs.readFileSync(fixturePath, "utf8");
const outDir = path.join(here, "../out");
fs.mkdirSync(outDir, { recursive: true });

const PORT = 1420;
const server = spawn("pnpm", ["--filter", "@jdf/reader", "dev"], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
const serverLog = [];
server.stdout.on("data", (d) => serverLog.push(String(d)));
server.stderr.on("data", (d) => serverLog.push(String(d)));

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`);
      if (r.ok) return;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("vite dev server did not start:\n" + serverLog.join(""));
}

const failures = [];
function check(cond, msg) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures.push(msg);
}

try {
  await waitForServer();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();

  // Tauri IPC mock — installed before any app script runs. `@tauri-apps/api`
  // routes every invoke() through window.__TAURI_INTERNALS__.invoke.
  await page.addInitScript(({ fixturePath, fixture }) => {
    const saves = [];
    window.__jdfMock = { saves };
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" }, windows: [{ label: "main" }] },
      transformCallback: (cb) => cb,
      convertFileSrc: (p) => p,
      async invoke(cmd, args) {
        switch (cmd) {
          case "read_text_file":
            if (args?.path === fixturePath) return fixture;
            throw new Error(`mock: unknown path ${args?.path}`);
          case "save_document":
            saves.push({ path: args.path, document: JSON.parse(JSON.stringify(args.document)) });
            return null;
          case "consume_pending_file":
            return null;
          default:
            throw new Error(`mock: unhandled command ${cmd}`);
        }
      },
    };
    localStorage.setItem("jdf-recent", JSON.stringify([fixturePath]));
  }, { fixturePath, fixture });

  await page.goto(`http://localhost:${PORT}/`);

  // 1. open from Recent Files
  await page.getByText("hello-world.jdf", { exact: true }).click();
  const heading = page.locator(".jdf-page h1", { hasText: "Hello, JDF" });
  await heading.waitFor({ timeout: 10_000 });
  check(true, "opened hello-world.jdf via Recent Files (read_text_file)");
  await page.screenshot({ path: path.join(outDir, "1-opened.png") });

  // 2. double-click → inline editor
  await heading.dblclick();
  const editor = page.locator(".jdf-page .editable-active");
  await editor.waitFor({ timeout: 5_000 });
  check(await editor.evaluate((el) => el === document.activeElement), "double-click opened an inline editor and focused it");
  await page.screenshot({ path: path.join(outDir, "2-editing.png") });

  // 3. type + Enter → commit + autosave
  await editor.fill("Hello, edited JDF");
  await editor.press("Enter");
  await page.locator(".jdf-page h1", { hasText: "Hello, edited JDF" }).waitFor({ timeout: 5_000 });
  await page.waitForFunction(() => window.__jdfMock.saves.length >= 1, null, { timeout: 5_000 });
  let saves = await page.evaluate(() => window.__jdfMock.saves);
  const savedHeading = saves.at(-1).document.pages[0].elements.find((e) => e.heading === 1)?.content;
  check(savedHeading === "Hello, edited JDF", `Enter committed the edit and autosaved to disk (save_document → "${savedHeading}")`);
  check(saves.at(-1).path === fixturePath, "autosave targets the opened file path");
  await page.screenshot({ path: path.join(outDir, "3-saved.png") });

  // 4. blur commit: edit a paragraph, click elsewhere
  const para = page.locator(".jdf-page p", { hasText: /just JSON/i }).first();
  const original = (await para.textContent()) ?? "";
  await para.dblclick();
  const editor2 = page.locator(".jdf-page .editable-active");
  await editor2.waitFor({ timeout: 5_000 });
  await editor2.fill("Edited by clicking away.");
  await page.mouse.click(1200, 700); // blur
  await page.waitForFunction((n) => window.__jdfMock.saves.length > n, saves.length, { timeout: 5_000 });
  saves = await page.evaluate(() => window.__jdfMock.saves);
  const doc = saves.at(-1).document;
  const blurCommitted = JSON.stringify(doc).includes("Edited by clicking away.") && !JSON.stringify(doc).includes(original.trim());
  check(blurCommitted, "clicking elsewhere (blur) committed the edit and autosaved");

  // 5. Escape cancels
  const count = saves.length;
  await page.locator(".jdf-page h1").first().dblclick();
  const editor3 = page.locator(".jdf-page .editable-active");
  await editor3.waitFor({ timeout: 5_000 });
  await editor3.fill("should not persist");
  await editor3.press("Escape");
  await page.waitForTimeout(600);
  saves = await page.evaluate(() => window.__jdfMock.saves);
  check(saves.length === count && !JSON.stringify(saves.at(-1).document).includes("should not persist"), "Escape cancelled the edit without saving");

  await context.close();
  await browser.close();
  const videos = fs.readdirSync(outDir).filter((f) => f.endsWith(".webm"));
  if (videos.length) {
    const latest = videos.map((f) => path.join(outDir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    fs.renameSync(latest, path.join(outDir, "verify-real-app.webm"));
    console.log(`→ real-app recording: ${path.relative(repoRoot, path.join(outDir, "verify-real-app.webm"))}`);
  }
} catch (e) {
  failures.push(String(e?.message || e));
  console.error(e);
} finally {
  server.kill("SIGTERM");
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll edit-in-place checks passed.");
