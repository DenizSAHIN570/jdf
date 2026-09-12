/**
 * Table-detection check against ground truth.
 *
 * bench/corpus has 24 documents whose JDF originals contain 120 tables with
 * known headers and cells, and PDFs printed from those originals by a real
 * browser. Converting each PDF back and comparing the detected tables cell by
 * cell gives an exact precision/recall for the importer's table detection.
 *
 *   pnpm --filter @jdf/pdf-import verify:tables
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importPdfToJdf } from "../src/node";

const here = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(here, "../../../bench/corpus/docs");
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

let truthTables = 0, found = 0, exactTables = 0, cellsTotal = 0, cellsOk = 0, headersOk = 0, falsePositives = 0;
const misses: string[] = [];
const files = fs.readdirSync(docsDir).filter((f: string) => f.endsWith(".jdf")).sort();
const only = process.argv[2];
for (const f of files) {
  if (only && !f.startsWith(only)) continue;
  const truth = JSON.parse(fs.readFileSync(path.join(docsDir, f), "utf8"));
  const conv = await importPdfToJdf(path.join(docsDir, f.replace(/\.jdf$/, ".pdf")), f, {});
  const truthTs = truth.pages.flatMap((p: any) => p.elements.filter((e: any) => e.type === "table"));
  const gotTs = conv.pages.flatMap((p: any) => p.elements.filter((e: any) => e.type === "table"));
  truthTables += truthTs.length;
  const matched = new Set<number>();
  for (const t of truthTs) {
    const want = [t.headers, ...t.rows].map((r: string[]) => r.map(norm));
    cellsTotal += want.flat().length;
    // best candidate = detected table sharing the most cells
    let best = -1, bestScore = 0;
    gotTs.forEach((g: any, k: number) => {
      if (matched.has(k)) return;
      const have = new Set([...(g.headers ?? []), ...g.rows.flat().map((c: any) => (typeof c === "string" ? c : c.content))].map(norm));
      const score = want.flat().filter((c) => have.has(c)).length;
      if (score > bestScore) { bestScore = score; best = k; }
    });
    if (best < 0 || bestScore < want.flat().length * 0.5) { misses.push(`${f}: ${t.headers.join(" | ")}`); continue; }
    matched.add(best); found++;
    const g = gotTs[best];
    const gotGrid = [g.headers ?? [], ...g.rows.map((r: any[]) => r.map((c) => (typeof c === "string" ? c : c.content)))].map((r: string[]) => r.map(norm));
    const exact = JSON.stringify(gotGrid) === JSON.stringify(want);
    if (exact) exactTables++;
    if (JSON.stringify(gotGrid[0]) === JSON.stringify(want[0])) headersOk++;
    // cell-level: same (row, col) position
    want.forEach((row, ri) => row.forEach((cell, ci) => { if (gotGrid[ri]?.[ci] === cell) cellsOk++; }));
    if (!exact && misses.length < 40) misses.push(`${f}: inexact "${t.headers[0]}" want ${want.length}×${want[0].length} got ${gotGrid.length}×${gotGrid[0]?.length}: ${JSON.stringify(gotGrid.slice(0, 2))}`);
  }
  falsePositives += gotTs.length - matched.size;
}
console.log(`tables: ${found}/${truthTables} found, ${exactTables} exact, headers exact ${headersOk}; cells ${cellsOk}/${cellsTotal} (${(100 * cellsOk / Math.max(1, cellsTotal)).toFixed(1)}%); extra tables (false positives): ${falsePositives}`);
for (const m of misses.slice(0, 25)) console.log("  ·", m);
process.exit(found === truthTables && falsePositives === 0 && cellsOk === cellsTotal ? 0 : 1);
