/**
 * Table detection for the PDF importer.
 *
 * A PDF has no notion of a table — just glyph runs positioned on a page and,
 * usually, some rectangles/lines drawn around them. This module rebuilds the
 * grid from geometry so the importer can emit a real JDF `table` element
 * (headers + rows + column widths) instead of dozens of loose text runs. That
 * is the single biggest "structure" win for RAG: `jdf chunk` serialises a
 * table row as `Header: value | Header: value`, so a number never loses its
 * column meaning.
 *
 * Approach (runtime-agnostic, pure geometry, no ML):
 *  1. Group merged text lines into rows by baseline (y).
 *  2. Grow blocks of consecutive rows whose cells fall into a consistent set of
 *     column bands (cells cluster by x-interval overlap; no two cells of a row
 *     share a band).
 *  3. Accept a block as a table when it has >= 2 columns and >= 3 rows (or >= 2
 *     rows when drawn cell borders/backgrounds confirm the grid), with regular
 *     row spacing.
 *  4. Use drawn rectangles for hints: a filled band over the first row => header
 *     with that background; alternating fills => alternatingRowColor; thin
 *     rects/lines inside the block => borders. Those shapes are consumed so the
 *     renderer does not draw them twice.
 *
 * Deliberately conservative: a paragraph never has >= 3 consecutive lines that
 * split into the same >= 2 x-bands, so prose stays prose. Multi-line cells that
 * wrap onto a continuation line (single cell, not in the first column) are
 * folded back into the previous row.
 */
import type { TableElement, TableColumn, TextAlign } from "@jdf/core";

export interface TRun {
  text: string;
  x: number;       // mm, left
  y: number;       // mm, top
  width: number;   // mm (may be over-reported by PDF.js for runs ending in a stretched space)
  height: number;  // mm
  fontSize: number; // pt
  fontName: string;
  color: string;
  bold?: boolean;
}

export interface TShape {
  kind: "rect" | "line" | "path";
  x: number; y: number; width: number; height: number; // mm
  fill?: string;
  stroke?: string;
}

export interface DetectedTable {
  element: TableElement;
  lineIdx: number[];   // indices into the input runs that became cells
  shapeIdx: number[];  // indices into the input shapes consumed as borders/backgrounds
}

const PT_TO_MM = 0.352778;

interface Cell { run: TRun; idx: number; x0: number; x1: number; }
interface Row { y: number; h: number; cells: Cell[]; }

/** Text extent that ignores a trailing stretched space: min(reported, chars × 0.62em). */
function textExtent(r: TRun): number {
  const chars = Math.max(1, r.text.replace(/\s+$/, "").length);
  const est = chars * r.fontSize * PT_TO_MM * 0.62;
  return Math.max(r.fontSize * PT_TO_MM * 0.5, Math.min(r.width, est));
}

function groupRows(runs: TRun[], skip: (r: TRun) => boolean): Row[] {
  const idx = runs.map((_, i) => i).filter((i) => !skip(runs[i]) && runs[i].text.trim().length > 0);
  idx.sort((a, b) => runs[a].y - runs[b].y || runs[a].x - runs[b].x);
  const rows: Row[] = [];
  for (const i of idx) {
    const r = runs[i];
    const tol = Math.max(0.8, r.fontSize * PT_TO_MM * 0.35);
    const last = rows[rows.length - 1];
    const cell: Cell = { run: r, idx: i, x0: r.x, x1: r.x + textExtent(r) };
    if (last && Math.abs(last.y - r.y) <= tol) {
      last.cells.push(cell);
      last.h = Math.max(last.h, r.height);
    } else {
      rows.push({ y: r.y, h: r.height, cells: [cell] });
    }
  }
  for (const row of rows) row.cells.sort((a, b) => a.x0 - b.x0);
  return rows;
}

/** Cluster cells of several rows into column bands by x-interval overlap. Returns bands or null when a row has two cells in one band. */
function columnBands(rows: Row[]): { x0: number; x1: number }[] | null {
  const cells = rows.flatMap((r) => r.cells);
  const sorted = cells.slice().sort((a, b) => a.x0 - b.x0);
  const bands: { x0: number; x1: number; members: Cell[] }[] = [];
  for (const c of sorted) {
    const last = bands[bands.length - 1];
    // Overlap test with a small tolerance so kerning drift doesn't split a column.
    if (last && c.x0 <= last.x1 - 0.2) { last.x1 = Math.max(last.x1, c.x1); last.members.push(c); }
    else bands.push({ x0: c.x0, x1: c.x1, members: [c] });
  }
  for (const b of bands) {
    const rowsSeen = new Set<Row>();
    for (const m of b.members) {
      const row = rows.find((r) => r.cells.includes(m))!;
      if (rowsSeen.has(row)) return null; // two cells of one row in the same band → not a grid
      rowsSeen.add(row);
    }
  }
  return bands.map(({ x0, x1 }) => ({ x0, x1 }));
}

const numeric = (s: string) => /^[\s$€£¥+\-−–]*[\d.,]+\s*(%|ms|s|k|m|b|M|K|B|x|×)?\s*(\/\w+)?$/i.test(s.trim()) || /^[+\-−]?\d/.test(s.trim()) && /\d$/.test(s.trim().replace(/[%)]$/, ""));

export function detectTables(runs: TRun[], shapes: TShape[], pageWidthMm: number): DetectedTable[] {
  const out: DetectedTable[] = [];
  const used = new Set<number>();
  const rows = groupRows(runs, () => false);
  const pageW = pageWidthMm;

  let i = 0;
  while (i < rows.length) {
    if (rows[i].cells.length < 2) { i++; continue; }
    // Grow the block while the column structure stays consistent.
    let j = i;
    let bands = columnBands([rows[i]]);
    let best: { j: number; bands: { x0: number; x1: number }[] } | null = null;
    while (j + 1 < rows.length && bands) {
      const next = rows[j + 1];
      const gap = next.y - (rows[j].y + rows[j].h);
      const rowH = Math.max(rows[j].h, next.h);
      if (gap > rowH * 2.2) break;                      // vertical gap too large → new paragraph/table
      if (next.cells.length === 1) {
        // Continuation line of a wrapped cell? Only if it sits inside an existing non-first band.
        const c = next.cells[0];
        const inBand = bands.findIndex((b) => c.x0 < b.x1 - 0.2 && c.x1 > b.x0 + 0.2);
        const spansSeveral = bands.filter((b) => c.x0 < b.x1 - 0.2 && c.x1 > b.x0 + 0.2).length > 1;
        if (inBand <= 0 || spansSeveral) break;         // a lone line in the first column or across columns ends the table
        j++;                                            // keep as continuation; bands unchanged
        continue;
      }
      const nb = columnBands(rows.slice(i, j + 2));
      if (!nb || nb.length < 2) break;
      // A row may only add a column while the block is still short (header rows with fewer cells).
      if (nb.length > bands.length && j - i >= 2) break;
      bands = nb; j++;
      if (bands.length >= 2) best = { j, bands };
    }
    const multiRows = best ? rows.slice(i, best.j + 1).filter((r) => r.cells.length >= 2).length : 0;
    const blockRows = best ? rows.slice(i, best.j + 1) : [];
    // Lattice evidence: drawn rects/lines within the block's bbox.
    const bbox = blockRows.length ? {
      x0: Math.min(...best!.bands.map((b) => b.x0)) - 2, x1: Math.max(...best!.bands.map((b) => b.x1)) + 2,
      y0: blockRows[0].y - blockRows[0].h * 0.6, y1: blockRows[blockRows.length - 1].y + blockRows[blockRows.length - 1].h * 1.6,
    } : null;
    const gridShapes = bbox ? shapes.map((s, k) => ({ s, k })).filter(({ s }) =>
      s.x >= bbox.x0 - 1 && s.x + s.width <= bbox.x1 + 1 && s.y >= bbox.y0 - 1 && s.y + s.height <= bbox.y1 + 1 &&
      (s.kind === "line" || s.kind === "rect")) : [];
    const hasLattice = gridShapes.length >= 3;

    if (!best || multiRows < (hasLattice ? 2 : 3) || best.bands.length < 2) { i++; continue; }

    // ── build the element ──────────────────────────────────────────────────
    const bands = best.bands;
    const cellText = (row: Row, b: number) => row.cells
      .filter((c) => c.x0 < bands[b].x1 - 0.2 && c.x1 > bands[b].x0 + 0.2)
      .map((c) => c.run.text.trim()).join(" ").trim();
    const grid: string[][] = [];
    const lineIdx: number[] = [];
    for (const row of blockRows) {
      if (row.cells.length === 1 && grid.length) {
        // Continuation of a wrapped cell → append to the same column of the previous row.
        const c = row.cells[0];
        const b = bands.findIndex((bb) => c.x0 < bb.x1 - 0.2 && c.x1 > bb.x0 + 0.2);
        if (b > 0) { grid[grid.length - 1][b] = (grid[grid.length - 1][b] + " " + c.run.text.trim()).trim(); lineIdx.push(c.idx); continue; }
      }
      grid.push(bands.map((_, b) => cellText(row, b)));
      for (const c of row.cells) lineIdx.push(c.idx);
    }
    if (lineIdx.some((k) => used.has(k))) { i = best.j + 1; continue; }

    // Header: first row is a header when its runs are bold, or when a filled band covers exactly that row.
    const first = blockRows[0];
    const headerBg = gridShapes.find(({ s }) => s.kind === "rect" && s.fill && s.fill !== "#ffffff" &&
      s.y <= first.y + 0.5 && s.y + s.height >= first.y + first.h * 0.6 && s.y + s.height < (blockRows[1]?.y ?? Infinity) + 0.5 && s.width >= (bbox!.x1 - bbox!.x0) * 0.5);
    const firstBold = first.cells.every((c) => c.run.bold);
    const isHeader = !!headerBg || (firstBold && !blockRows.slice(1).every((r) => r.cells.every((c) => c.run.bold)));

    // Column alignment: numeric columns whose right edges line up → right.
    const columns: TableColumn[] = bands.map((b, k) => {
      const vals = grid.slice(isHeader ? 1 : 0).map((r) => r[k]).filter(Boolean);
      const numericShare = vals.length ? vals.filter(numeric).length / vals.length : 0;
      const col: TableColumn = { width: Math.round((b.x1 - b.x0) * 10) / 10 };
      if (numericShare >= 0.7) col.align = "right" as TextAlign;
      return col;
    });
    // Widen bands to fill the gaps between them (cells have padding).
    const x0 = Math.max(0, bands[0].x0 - 2.5);
    const x1 = Math.min(pageW, bands[bands.length - 1].x1 + 2.5);
    for (let k = 0; k < bands.length; k++) {
      const left = k === 0 ? x0 : (bands[k - 1].x1 + bands[k].x0) / 2;
      const right = k === bands.length - 1 ? x1 : (bands[k].x1 + bands[k + 1].x0) / 2;
      columns[k].width = Math.round((right - left) * 10) / 10;
    }

    // Alternating row background from fills that cover single body rows.
    const rowFills = blockRows.slice(isHeader ? 1 : 0).map((row) =>
      gridShapes.find(({ s }) => s.kind === "rect" && s.fill && s.fill !== "#ffffff" && s.y <= row.y + 0.5 && s.y + s.height >= row.y + row.h * 0.6 && s.height < row.h * 2.2)?.s.fill ?? null);
    const altColor = rowFills.find((f, k) => f && k % 2 === 1 && rowFills.filter((g, m) => m % 2 === 1).every((g) => g === f)) ?? undefined;
    const borderShape = gridShapes.find(({ s }) => (s.kind === "line") || (s.kind === "rect" && (s.height < 0.6 || s.width < 0.6) && (s.fill || s.stroke)));
    const borderColor = borderShape ? (borderShape.s.stroke || borderShape.s.fill) : undefined;

    const fontSize = Math.round(first.cells[0].run.fontSize * 10) / 10;
    const y0 = headerBg ? headerBg.s.y : first.y - first.h * 0.5;
    const element: TableElement = {
      type: "table",
      position: { x: Math.round(x0 * 100) / 100, y: Math.round(Math.max(0, y0) * 100) / 100 },
      width: Math.round((x1 - x0) * 100) / 100,
      columns,
      rows: (isHeader ? grid.slice(1) : grid),
      style: { fontSize },
    };
    if (isHeader) {
      element.headers = grid[0];
      const hs: Record<string, unknown> = { fontWeight: "bold" };
      if (headerBg?.s.fill) hs.backgroundColor = headerBg.s.fill;
      const hc = first.cells[0].run.color;
      if (hc && hc !== "#000000") hs.color = hc;
      element.headerStyle = hs as any;
    }
    if (altColor) element.alternatingRowColor = altColor;
    element.borders = borderColor ? { outer: true, inner: true, color: borderColor, width: 1 } : false;

    for (const k of lineIdx) used.add(k);
    out.push({ element, lineIdx, shapeIdx: gridShapes.map(({ k }) => k) });
    i = best.j + 1;
  }
  return out;
}
