// Drives the REAL docs page (docs/docs/forms.html, served statically) in
// Google Chrome: the <jdf save-button> embed renders customer-form.jdf, we
// type a name into "Full name", click "Save form", capture the download the
// browser receives and assert the .jdf carries the typed value.
//
// Usage: pnpm --filter @jdf/demo-web-form-fill verify
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const outDir = path.join(here, "../out");
fs.mkdirSync(outDir, { recursive: true });

const PORT = 4173;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: path.join(repoRoot, "docs"), stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/docs/forms.html`)).ok) break; } catch { /* not yet */ }
  await new Promise((r) => setTimeout(r, 250));
}

const NAME = "Ayşe Yılmaz";
const failures = [];
const check = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) failures.push(m); };

try {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, recordVideo: { dir: outDir, size: { width: 1280, height: 800 } } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/docs/forms.html`);

  const embed = page.locator("jdf[save-button]").first();
  const nameInput = embed.locator("input[name=fullName]");
  await nameInput.waitFor({ timeout: 15_000 });
  await embed.scrollIntoViewIfNeeded();
  check(true, "forms.html rendered customer-form.jdf inside <jdf save-button>");
  await page.screenshot({ path: path.join(outDir, "1-form.png") });

  await nameInput.click();
  await nameInput.pressSequentially(NAME, { delay: 40 });
  check((await nameInput.inputValue()) === NAME, `typed "${NAME}" into Full name`);
  await page.screenshot({ path: path.join(outDir, "2-filled.png") });

  const saveBtn = embed.locator(".jdfjs-save-button");
  check((await saveBtn.textContent())?.trim() === "Save form", 'embed shows the "Save form" button');
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 10_000 }), saveBtn.click()]);
  const suggested = download.suggestedFilename();
  const savedPath = path.join(outDir, suggested);
  await download.saveAs(savedPath);
  check(suggested === "filled-customer-form.jdf", `browser downloaded "${suggested}"`);

  const doc = JSON.parse(fs.readFileSync(savedPath, "utf8"));
  const field = doc.pages[0].elements.find((e) => e.type === "input" && e.name === "fullName");
  check(field?.value === NAME, `downloaded .jdf has fullName.value = "${field?.value}"`);
  check(doc.$jdf === "1.0.0" && Array.isArray(doc.pages), "downloaded file is a valid JDF document (schema shape)");
  await page.screenshot({ path: path.join(outDir, "3-saved.png") });

  // Re-open: load the downloaded document into a fresh embed and confirm the field is pre-filled.
  await page.evaluate((json) => {
    const blob = new Blob([json], { type: "application/jdf+json" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("jdf");
    el.setAttribute("src", url); el.setAttribute("height", "400"); el.id = "reopened";
    document.body.appendChild(el); el.scrollIntoView();
  }, fs.readFileSync(savedPath, "utf8"));
  const reopened = page.locator("#reopened input[name=fullName]");
  await reopened.waitFor({ timeout: 10_000 });
  check((await reopened.inputValue()) === NAME, "re-opening the downloaded .jdf shows the form pre-filled");
  await page.screenshot({ path: path.join(outDir, "4-reopened.png") });

  await context.close(); await browser.close();
  const vids = fs.readdirSync(outDir).filter((f) => f.endsWith(".webm") && f !== "verify-real-embed.webm");
  if (vids.length) fs.renameSync(path.join(outDir, vids[0]), path.join(outDir, "verify-real-embed.webm"));
} catch (e) {
  failures.push(String(e?.message || e)); console.error(e);
} finally {
  server.kill("SIGTERM");
}
if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
console.log("\nAll web-form checks passed.");
